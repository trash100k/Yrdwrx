import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// Regression guard for multi-tenant isolation. The #1 way RLS breaks is adding a new
// table/repo and forgetting to enable row-level security for it — leaving it world-open.
// This test fails if any table reached through `makeRepo(...)` has no RLS wiring in the
// committed Supabase migrations. (Live enforcement is separately verified against the
// real project; see supabase/RLS_ISOLATION_TEST.sql.)

const ROOT = join(__dirname, "..", "..", "..");
const MIG_DIR = join(ROOT, "supabase", "migrations");
const REPOS_DIR = join(ROOT, "src", "lib", "repos");

const SQL = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(MIG_DIR, f), "utf8"))
  .join("\n");

function repoTables(): string[] {
  const set = new Set<string>();
  for (const f of readdirSync(REPOS_DIR)) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    const src = readFileSync(join(REPOS_DIR, f), "utf8");
    for (const m of src.matchAll(/makeRepo\(\s*["'`]([a-z_]+)["'`]/g)) set.add(m[1]);
  }
  return [...set].sort();
}

const TABLES = repoTables();

describe("RLS coverage — every repo table is protected by row-level security", () => {
  it("discovers the repo table set", () => {
    expect(TABLES.length).toBeGreaterThan(10);
  });

  it.each(TABLES)('table "%s" has RLS enabled + a policy in a migration', (t) => {
    // Covered either by an explicit `alter table ... enable row level security`,
    // by membership in a tenant_tables array that gets RLS applied, or by an
    // explicit `create policy ... on public.<t>`.
    const enabledExplicit = new RegExp(`alter table\\s+(?:public\\.)?"?${t}"?\\s+enable row level security`, "i").test(SQL);
    const inTenantArray = new RegExp(`['"]${t}['"]`).test(SQL); // element of an array[...] RLS loop
    const hasPolicy = new RegExp(`on\\s+public\\.${t}\\b`, "i").test(SQL);
    expect(
      enabledExplicit || inTenantArray || hasPolicy,
      `No RLS (enable + policy) wiring found for "${t}" in supabase/migrations — a new repo table must ship with row-level security.`,
    ).toBe(true);
  });

  it("RLS helpers live in the non-exposed private schema and are SECURITY DEFINER", () => {
    expect(/create or replace function private\.auth_tenant_id\(\)[\s\S]*?security definer/i.test(SQL)).toBe(true);
    expect(/create or replace function private\.auth_role\(\)[\s\S]*?security definer/i.test(SQL)).toBe(true);
    expect(/create or replace function private\.is_platform_admin\(\)[\s\S]*?security definer/i.test(SQL)).toBe(true);
    // The PostgREST-exposed public variants must be dropped.
    expect(/drop function if exists public\.auth_tenant_id/i.test(SQL)).toBe(true);
  });

  it("tenant-scoped policies key on tenant_id and block the client role from writing", () => {
    expect(/tenant_id\s*=\s*private\.auth_tenant_id\(\)/i.test(SQL)).toBe(true);
    expect(/auth_role\(\)\s*<>\s*''client''/i.test(SQL)).toBe(true);
  });
});
