// @ts-nocheck
// Tenant (workspace) settings repository.
//
// Unlike the generic per-row repos, the tenant is a SINGLETON per workspace: one
// `tenants` row keyed by the caller's profile.tenant_id. Its settings/legal/quotas
// are JSONB columns that must be MERGED (read-modify-write) rather than dot-path
// patched. Firestore allowed `update(doc, { "settings.features": obj })`; Postgres
// JSONB through the supabase-js client cannot be patched by dot-path — doing so would
// create a literal top-level column key. So every JSONB write here reads the current
// value, deep-merges the patch, and writes the whole object back. RLS scopes the row
// to the caller's tenant.

import { supabase } from "../supabase";
import { getCurrentProfile } from "./profile";

async function currentTenantId(): Promise<string | null> {
  const p = await getCurrentProfile();
  return p?.tenant_id || null;
}

// One-level deep merge: top-level keys are merged; a nested plain-object value is
// shallow-merged into the existing one (so updating settings.features doesn't clobber
// settings.serviceCatalog). Arrays and scalars replace wholesale.
function mergeJsonb(base: any, patch: any) {
  const out = { ...(base || {}) };
  for (const k of Object.keys(patch || {})) {
    const pv = patch[k];
    const isPlainObj = (v: any) => v && typeof v === "object" && !Array.isArray(v);
    if (isPlainObj(pv) && isPlainObj(out[k])) {
      out[k] = { ...out[k], ...pv };
    } else {
      out[k] = pv;
    }
  }
  return out;
}

async function patchJsonbColumn(column: "settings" | "legal" | "quotas", patch: any) {
  const id = await currentTenantId();
  if (!id) throw new Error("No active tenant for settings write");
  const { data: cur, error: readErr } = await supabase
    .from("tenants")
    .select(column)
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  const merged = mergeJsonb(cur?.[column], patch);
  const { data, error } = await supabase
    .from("tenants")
    .update({ [column]: merged })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const tenantsRepo = {
  // Full current-tenant row (camel-ish; callers read .settings/.legal/.tier directly).
  async get() {
    const id = await currentTenantId();
    if (!id) return null;
    const { data, error } = await supabase.from("tenants").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  // Merge a patch into the settings JSONB (e.g. { features: {...} }, { serviceCatalog: [...] },
  // { integrations: {...} }, { workflows: [...] }).
  updateSettings(patch: any) {
    return patchJsonbColumn("settings", patch);
  },

  // Merge a patch into the legal JSONB (e.g. { aiDisclaimerAccepted: true, acceptedAt }).
  updateLegal(patch: any) {
    return patchJsonbColumn("legal", patch);
  },

  updateQuotas(patch: any) {
    return patchJsonbColumn("quotas", patch);
  },

  // Top-level scalar columns (name, tier, stripe_account_id). Pass snake_case keys.
  async updateFields(fields: Record<string, any>) {
    const id = await currentTenantId();
    if (!id) throw new Error("No active tenant for field write");
    const { data, error } = await supabase
      .from("tenants")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
