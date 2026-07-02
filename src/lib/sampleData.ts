// Sample ("practice") data utilities.
//
// The onboarding seeder (server.ts POST /api/tenants/provision, `loadDemoData`) stamps
// every row it creates with { isSample: true } inside the row's freeform `data` jsonb
// column. The repos layer maps only TOP-LEVEL keys between camelCase and snake_case,
// so the flag survives round-trips untouched: a sample row reads back as
// { ..., data: { isSample: true, ... } }.
//
// This module is the single client-side authority on that convention:
//   - isSampleRow / filterSampleRows — pure predicates (unit-tested in sampleData.test.ts)
//   - hasSampleData()  — cheap existence probe (drives SampleDataBanner visibility)
//   - clearSampleData() — one-tap removal of every sample-flagged row via the repos
//
// RLS scopes every read/delete here to the caller's tenant, so "clear" can never
// reach across tenants.

import { supabase } from "./supabase";
import {
  customersRepo,
  jobsRepo,
  invoicesRepo,
  crewsRepo,
  leadsRepo,
  vendorsRepo,
  inventoryRepo,
} from "./repos";

/** The jsonb key the seeder stamps onto every practice row's `data` column. */
export const SAMPLE_FLAG = "isSample" as const;

/** Minimal shape of a repo row for sample-detection purposes. */
export interface SampleFlaggedRow {
  id?: string | number | null;
  data?: Record<string, unknown> | null;
}

/** Minimal repo surface this module needs (matches makeRepo() in ./repos/base). */
export interface SampleRepo {
  list(): Promise<SampleFlaggedRow[]>;
  /** Soft-delete tables (customers) hide archived rows from list(); sweep these too. */
  listArchived?(): Promise<SampleFlaggedRow[]>;
  remove(id: string): Promise<void>;
}

/** True only when a row carries the exact seeder stamp: data.isSample === true. */
export function isSampleRow(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const data = (row as SampleFlaggedRow).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return (data as Record<string, unknown>)[SAMPLE_FLAG] === true;
}

/** Pure filter: the sample-flagged subset of `rows`. Non-arrays yield []. */
export function filterSampleRows<T>(rows: readonly T[] | null | undefined): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => isSampleRow(row));
}

// Every table the seeder writes, in deletion order. FKs are `on delete set null`
// so ordering isn't required for integrity, but deleting children (invoices, jobs)
// before their customers keeps intermediate realtime states sensible.
const SAMPLE_REPOS: ReadonlyArray<readonly [table: string, repo: SampleRepo]> = [
  ["invoices", invoicesRepo],
  ["jobs", jobsRepo],
  ["customers", customersRepo],
  ["crews", crewsRepo],
  ["leads", leadsRepo],
  ["vendors", vendorsRepo],
  ["inventory", inventoryRepo],
];

// The seeder always writes customers/jobs/invoices, so probing just these three is a
// reliable (and cheap: `data @> {"isSample":true}` LIMIT 1) existence check.
const PROBE_TABLES = ["customers", "jobs", "invoices"] as const;

/** Cheap check: does the current tenant still have any sample-flagged rows? */
export async function hasSampleData(): Promise<boolean> {
  try {
    const hits = await Promise.all(
      PROBE_TABLES.map(async (table) => {
        const { data, error } = await supabase
          .from(table)
          .select("id")
          .contains("data", { [SAMPLE_FLAG]: true })
          .limit(1);
        if (error) return false;
        return Array.isArray(data) && data.length > 0;
      }),
    );
    return hits.some(Boolean);
  } catch {
    // Fail closed: if we can't tell (offline, unconfigured env), show no banner.
    return false;
  }
}

export interface ClearSampleDataResult {
  /** Total rows removed across all tables. */
  total: number;
  /** Rows removed per table, e.g. { customers: 3, jobs: 3, ... }. */
  byTable: Record<string, number>;
}

/**
 * Delete every sample-flagged row the caller's tenant can see, via the repos
 * (RLS-scoped hard deletes). Best-effort per table/row: one unreadable table or
 * one failed delete never aborts the rest of the sweep.
 */
export async function clearSampleData(): Promise<ClearSampleDataResult> {
  const byTable: Record<string, number> = {};
  let total = 0;

  for (const [table, repo] of SAMPLE_REPOS) {
    byTable[table] = 0;
    let rows: SampleFlaggedRow[];
    try {
      rows = await repo.list();
    } catch {
      continue; // table unreadable right now — skip it, keep sweeping
    }
    // Soft-delete tables hide archived rows from list(); a sample row sitting in the
    // Trash still counts (and would keep hasSampleData() true), so sweep it too.
    if (typeof repo.listArchived === "function") {
      try {
        rows = rows.concat(await repo.listArchived());
      } catch {
        // archived view unreadable — still clear the live rows
      }
    }
    for (const row of filterSampleRows(rows)) {
      const id = row?.id;
      if (id == null || id === "") continue;
      try {
        await repo.remove(String(id));
        byTable[table] += 1;
        total += 1;
      } catch {
        // leave the row for a later retry; keep going
      }
    }
  }

  return { total, byTable };
}
