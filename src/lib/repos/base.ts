// @ts-nocheck
// Repository factory — the seam pages migrate onto, one domain at a time.
// RLS (supabase/migrations/0002_rls.sql) scopes every read/write to the caller's
// tenant, so repos do NOT pass a tenantId filter. On insert, tenant_id is stamped
// server-side via a column default trigger OR provided by the caller's profile; for
// the app layer we attach it from the current profile (see attachTenant()).

import { supabase } from "../supabase";

export interface RepoOptions {
  orderBy?: { column: string; ascending?: boolean };
  // When true, the table has `is_archived`/`deleted_at` columns; list() hides archived
  // rows by default and archive()/restore()/listArchived() become meaningful.
  softDelete?: boolean;
}

// --- camelCase <-> snake_case key mapping ---------------------------------
// Postgres columns are snake_case; the frontend (+ types.ts) is camelCase. We map
// TOP-LEVEL keys only on the way out (read) and in (write), leaving nested values
// (the freeform `data`/`customFields` jsonb, arrays like `tags`/`items`) untouched.
export const toCamelKey = (k: string) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
// Round-trip safe with toCamelKey: underscore before camelCase humps AND before a digit
// that follows a letter, so `address_line_2` -> `addressLine2` -> `address_line_2`
// (the old version dropped the underscore-before-digit and corrupted `*_2`/`*_1` columns).
export const toSnakeKey = (k: string) =>
  k
    .replace(/([A-Z])/g, (m) => "_" + m.toLowerCase())
    .replace(/([a-zA-Z])(\d)/g, "$1_$2")
    .replace(/^_/, "");
function mapKeys(input: any, fn: (k: string) => string): any {
  if (Array.isArray(input)) return input.map((o) => mapKeys(o, fn));
  if (input && typeof input === "object") {
    const out: any = {};
    for (const k of Object.keys(input)) out[fn(k)] = input[k]; // shallow: don't recurse into values
    return out;
  }
  return input;
}
const camelize = (x: any) => mapKeys(x, toCamelKey);
const snakeize = (x: any) => mapKeys(x, toSnakeKey);

// --- pagination -------------------------------------------------------------
// PostgREST silently caps unranged selects at 1000 rows, so a plain select('*')
// LIES at volume (money screens showing 1000 of 1400 invoices). We page through in
// PAGE_SIZE chunks until a short page, capped at MAX_ROWS as a runaway guard.
const PAGE_SIZE = 1000;
const MAX_ROWS = 10000;

// `buildQuery` must return a FRESH query builder each call (builders are one-shot).
async function fetchAllPages(table: string, buildQuery: () => any): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) return all;
  }
  console.warn(
    `[repos] ${table}: hit MAX_ROWS cap (${MAX_ROWS}); result truncated. ` +
      `This table needs server-side filtering/pagination.`,
  );
  return all;
}

// --- realtime delta application ---------------------------------------------
// Applies one postgres_changes payload to an in-memory (already-camelized) list so
// subscribers don't full-refetch on every event. Exported for unit tests.
// Contract: rows are the repo's default list() view (softDelete tables exclude
// archived rows), payload.new/old are raw snake_case DB rows.
export function applyRealtimeDelta<T = any>(
  rows: T[],
  payload: { eventType: string; new?: any; old?: any },
  opts: RepoOptions = {},
): T[] {
  const type = payload?.eventType;
  const record: any = camelize(payload?.new ?? {});
  const oldRecord: any = camelize(payload?.old ?? {});
  const id = record?.id ?? oldRecord?.id;
  if (!id) return rows; // can't correlate (e.g. minimal REPLICA IDENTITY) — backstop refetch will reconcile

  const without = (rows as any[]).filter((r) => r?.id !== id);

  if (type === "DELETE") return without as T[];

  if (type === "INSERT" || type === "UPDATE") {
    // Respect the default-list softDelete filter: an UPDATE flipping is_archived=true
    // removes the row; is_archived=false (restore) re-inserts it.
    if (opts.softDelete && record.isArchived) return without as T[];
    return insertOrdered(without, record, opts.orderBy) as T[];
  }

  return rows;
}

// Insert `row` at the position the repo's orderBy dictates (list() is server-ordered,
// so the in-memory copy must stay ordered too). No orderBy declared -> append.
function insertOrdered(
  rows: any[],
  row: any,
  order?: { column: string; ascending?: boolean },
): any[] {
  const out = [...rows];
  if (!order) {
    out.push(row);
    return out;
  }
  const key = toCamelKey(order.column); // in-memory rows are camelized
  const asc = order.ascending ?? false;
  const before = (a: any, b: any) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av === bv) return false;
    if (av == null || bv == null) return bv == null; // nulls sort last
    return asc ? av < bv : av > bv;
  };
  const idx = out.findIndex((existing) => before(row, existing));
  out.splice(idx === -1 ? out.length : idx, 0, row);
  return out;
}

// Generic CRUD + realtime wrapper around a single Postgres table.
// Reads return camelCase; writes accept camelCase and persist snake_case.
export function makeRepo<T = any>(table: string, opts: RepoOptions = {}) {
  const order = opts.orderBy;
  const soft = !!opts.softDelete;

  // Deterministic order is required for .range() paging to be gap/dup-free; the `id`
  // tiebreak keeps pages stable when the primary order column has equal values.
  const applyOrder = (q: any) => {
    if (order) q = q.order(order.column, { ascending: order.ascending ?? false });
    return q.order("id", { ascending: true });
  };

  async function list(): Promise<T[]> {
    const rows = await fetchAllPages(table, () => {
      let q = supabase.from(table).select("*");
      if (soft) q = q.eq("is_archived", false);
      return applyOrder(q);
    });
    return camelize(rows) as T[];
  }

  // Archived ("Trash") rows — only meaningful for soft-delete tables.
  async function listArchived(): Promise<T[]> {
    const rows = await fetchAllPages(table, () =>
      applyOrder(supabase.from(table).select("*").eq("is_archived", true)),
    );
    return camelize(rows) as T[];
  }

  // Soft-delete: move to Trash instead of destroying.
  async function archive(id: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .update({ is_archived: true, deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async function restore(id: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .update({ is_archived: false, deleted_at: null })
      .eq("id", id);
    if (error) throw error;
  }

  async function getById(id: string): Promise<T | null> {
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data ? camelize(data) : null) as T | null;
  }

  async function create(row: Partial<T>): Promise<T> {
    // camelCase in -> snake_case to the DB; stamp tenant_id so RLS WITH CHECK passes.
    const { data, error } = await supabase
      .from(table)
      .insert(await attachTenant(snakeize(row)))
      .select()
      .single();
    if (error) throw error;
    return camelize(data) as T;
  }

  async function update(id: string, patch: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(table)
      .update(snakeize(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return camelize(data) as T;
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
  }

  // Realtime subscription replacing Firestore onSnapshot. Maintains an in-memory copy
  // and applies each postgres_changes event as a DELTA (no full refetch per event); a
  // single trailing debounced refetch reconciles any drift. The callback contract is
  // unchanged: subscribers always receive the FULL (updated) array.
  // Returns an unsubscribe fn matching the onSnapshot() ergonomics pages expect.
  function subscribe(cb: (rows: T[]) => void): () => void {
    let active = true;
    let rows: T[] = [];
    let channel: any = null;
    let retried = false;
    let backstopTimer: any = null;

    const refetch = () =>
      list()
        .then((fresh) => {
          if (!active) return;
          rows = fresh;
          cb(rows);
        })
        .catch(() => {});

    // Consistency backstop: one full refetch 30s after the LAST event (covers missed
    // events, DELETE payloads without full rows, cross-page edge cases).
    const scheduleBackstop = () => {
      if (backstopTimer) clearTimeout(backstopTimer);
      backstopTimer = setTimeout(() => {
        backstopTimer = null;
        if (active) refetch();
      }, 30_000);
    };

    const onEvent = (payload: any) => {
      if (!active) return;
      rows = applyRealtimeDelta(rows, payload, opts);
      cb(rows);
      scheduleBackstop();
    };

    const connect = () => {
      if (!active) return;
      // UNIQUE topic per subscription. supabase-js reuses channel instances by topic,
      // so a fixed `realtime:${table}` name made co-mounted subscribers (CrewSuite +
      // ResourceTimeline, FieldMode + Scheduler) share one channel — and unmounting
      // either removeChannel()'d it out from under the other. Math.random (not
      // crypto.randomUUID) because older WebViews lack randomUUID.
      channel = supabase
        .channel(`${table}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, onEvent)
        .subscribe((status: string) => {
          if (!active) return;
          if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !retried) {
            retried = true; // one retry only — no reconnect loops
            const dead = channel;
            channel = null;
            try {
              supabase.removeChannel(dead);
            } catch {}
            setTimeout(() => {
              if (!active) return;
              connect();
              refetch(); // resync whatever was missed while the channel was down
            }, 2_000);
          }
        });
    };

    refetch(); // initial full load (same behavior as before)
    connect();

    return () => {
      active = false;
      if (backstopTimer) clearTimeout(backstopTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }

  return { table, list, listArchived, getById, create, update, remove, archive, restore, subscribe };
}

// Stamp the caller's tenant_id onto a new row (RLS WITH CHECK requires it to match).
import { getCurrentProfile } from "./profile";
export async function attachTenant<T extends Record<string, any>>(row: T): Promise<T> {
  if (row.tenant_id) return row;
  const profile = await getCurrentProfile();
  return { ...row, tenant_id: profile?.tenant_id } as T;
}
