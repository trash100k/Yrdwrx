// @ts-nocheck
// CSV import + merge — the I/O layer. Executes the pure plan (csvImport.ts) through the
// RLS-scoped repos + supabase client, so every read/write is automatically tenant-scoped
// (no tenantId is passed; RLS + makeRepo().create() handle it). No server endpoint is used.
//
// Split from the pure core on purpose: everything here does side effects (network), so it is
// exercised via the app/manual QA, while the classification/normalization/merge decisions are
// unit-tested in csvImport.test.ts.

import { supabase } from "./supabase";
import { customersRepo } from "./repos";
import { buildCustomerMergePlan } from "./csvImport";

// Bounded-concurrency runner so a 10k-row import doesn't open 10k sockets at once but also
// isn't fully serial. Never throws — collects per-item errors for a partial-success summary.
async function runPool(items, worker, concurrency = 6) {
  const errors = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        await worker(items[i], i);
      } catch (e) {
        errors.push({ index: items[i]?.index ?? i, message: e?.message || String(e) });
      }
    }
  });
  await Promise.all(runners);
  return errors;
}

export interface ImportExecResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
}

/**
 * Apply resolved import decisions to a repo (customersRepo / inventoryRepo).
 * The UI resolves every `review` into a concrete action first, so this only sees
 * create / update / skip. `toRow` (optional) shapes a mapped row into the repo's column
 * layout (e.g. tucking custom fields into `data`) — defaults to identity.
 */
export async function executeImportPlan(
  decisions: Array<{ index: number; action: string; matchId?: string; row: Record<string, any> }>,
  repo: { create: (row: any) => Promise<any>; update: (id: string, patch: any) => Promise<any> },
  toRow: (row: Record<string, any>) => Record<string, any> = (r) => r,
): Promise<ImportExecResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const actionable = decisions.filter((d) => d.action === "create" || d.action === "update");
  skipped = decisions.length - actionable.length;

  const errors = await runPool(actionable, async (d) => {
    const payload = toRow(d.row);
    if (d.action === "update" && d.matchId) {
      await repo.update(d.matchId, payload);
      updated++;
    } else {
      await repo.create(payload);
      created++;
    }
  });

  return { created, updated, skipped, errors };
}

export interface MergeExecResult {
  survivorId: string;
  loserId: string;
  patched: boolean;
  reassigned: Record<string, number>;
  archived: boolean;
  errors: Array<{ table: string; message: string }>;
}

/**
 * Merge two duplicate customers: fold the loser's missing fields into the survivor, reassign
 * every child record (jobs/invoices/tasks/…) from the loser to the survivor, then archive the
 * loser (existing is_archived/deleted_at). Best-effort per child table so one missing/edge table
 * never orphans jobs or invoices; returns a per-table reassignment count.
 *
 * RLS scopes all of these to the caller's tenant. Pass the full survivor/loser records (already
 * loaded in the UI) to avoid an extra fetch; falls back to getById if omitted.
 */
export async function mergeCustomers(
  survivorId: string,
  loserId: string,
  opts: { survivor?: Record<string, any>; loser?: Record<string, any> } = {},
): Promise<MergeExecResult> {
  if (survivorId === loserId) throw new Error("Cannot merge a customer into itself.");

  const survivor = opts.survivor || (await customersRepo.getById(survivorId));
  const loser = opts.loser || (await customersRepo.getById(loserId));
  if (!survivor || !loser) throw new Error("Both customers must exist to merge.");

  const plan = buildCustomerMergePlan({ ...survivor, id: survivorId }, { ...loser, id: loserId });
  const errors: Array<{ table: string; message: string }> = [];
  const reassigned: Record<string, number> = {};

  // 1) Fill the survivor's gaps (only if there's anything to add).
  let patched = false;
  if (Object.keys(plan.patch).length > 0) {
    try {
      await customersRepo.update(survivorId, plan.patch);
      patched = true;
    } catch (e) {
      errors.push({ table: "customers", message: e?.message || String(e) });
    }
  }

  // 2) Reassign child records loser -> survivor (RLS-scoped). Best-effort per table.
  for (const table of plan.reassignChildTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .update({ customer_id: survivorId })
        .eq("customer_id", loserId)
        .select("id");
      if (error) throw error;
      reassigned[table] = (data || []).length;
    } catch (e) {
      // A table that doesn't exist in this deployment (or lacks customer_id) is skipped, not fatal.
      errors.push({ table, message: e?.message || String(e) });
    }
  }

  // 3) Archive the loser (soft-delete — recoverable from Trash, never orphans history).
  let archived = false;
  try {
    await customersRepo.archive(loserId);
    archived = true;
  } catch (e) {
    errors.push({ table: "customers(archive)", message: e?.message || String(e) });
  }

  return { survivorId, loserId, patched, reassigned, archived, errors };
}
