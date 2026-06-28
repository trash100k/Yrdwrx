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
const toCamelKey = (k: string) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const toSnakeKey = (k: string) => k.replace(/([A-Z])/g, (m) => "_" + m.toLowerCase());
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

// Generic CRUD + realtime wrapper around a single Postgres table.
// Reads return camelCase; writes accept camelCase and persist snake_case.
export function makeRepo<T = any>(table: string, opts: RepoOptions = {}) {
  const order = opts.orderBy;
  const soft = !!opts.softDelete;

  async function list(): Promise<T[]> {
    let q = supabase.from(table).select("*");
    if (soft) q = q.eq("is_archived", false);
    if (order) q = q.order(order.column, { ascending: order.ascending ?? false });
    const { data, error } = await q;
    if (error) throw error;
    return camelize(data ?? []) as T[];
  }

  // Archived ("Trash") rows — only meaningful for soft-delete tables.
  async function listArchived(): Promise<T[]> {
    let q = supabase.from(table).select("*").eq("is_archived", true);
    if (order) q = q.order(order.column, { ascending: order.ascending ?? false });
    const { data, error } = await q;
    if (error) throw error;
    return camelize(data ?? []) as T[];
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

  // Realtime subscription replacing Firestore onSnapshot. Pushes a fresh full list
  // on any change (simplest correct mapping; pages already re-render off a list).
  // Returns an unsubscribe fn matching the onSnapshot() ergonomics pages expect.
  function subscribe(cb: (rows: T[]) => void): () => void {
    let active = true;
    const push = () => list().then((rows) => active && cb(rows)).catch(() => {});
    push();
    const channel = supabase
      .channel(`realtime:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, push)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
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
