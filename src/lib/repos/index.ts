// @ts-nocheck
// Domain repositories — the Supabase data-access seam pages migrate onto.
// RLS scopes everything to the caller's tenant, so no tenantId filter is needed;
// new rows get tenant_id stamped via attachTenant().
import { makeRepo, attachTenant } from "./base";
import { supabase } from "../supabase";
import { auth } from "../firebase";

export { getCurrentProfile, clearProfileCache } from "./profile";

// --- Customers (soft-delete enabled) ---
export const customersRepo = {
  ...makeRepo("customers", { orderBy: { column: "created_at" }, softDelete: true }),
  async create(row: any) {
    const { data, error } = await supabase
      .from("customers")
      .insert(await attachTenant(row))
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  // Name OR phone lookup (used by Live Ear / on-site flows).
  async findByNameOrPhone(query: string) {
    const q = (query || "").trim();
    if (!q) return [];
    const digits = q.replace(/\D/g, "");
    let req = supabase.from("customers").select("*").eq("is_archived", false);
    if (digits.length >= 7) {
      req = req.or(`phone.ilike.%${digits}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    } else {
      req = req.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%`);
    }
    const { data, error } = await req.limit(10);
    if (error) throw error;
    return data ?? [];
  },
};

// --- Tasks ---
export const tasksRepo = {
  ...makeRepo("tasks", { orderBy: { column: "due_date", ascending: true } }),
  async create(row: any) {
    const { data, error } = await supabase
      .from("tasks")
      .insert(await attachTenant(row))
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async complete(id: string) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
  async reopen(id: string) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "pending", completed_at: null })
      .eq("id", id);
    if (error) throw error;
  },
};

// --- Jobs ---
export const jobsRepo = {
  ...makeRepo("jobs", { orderBy: { column: "date", ascending: true } }),
  async create(row: any) {
    const { data, error } = await supabase
      .from("jobs")
      .insert(await attachTenant(row))
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async forCustomer(customerId: string) {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("customer_id", customerId)
      .order("date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};

// --- Leads (reject = archive, not destroy) ---
export const leadsRepo = {
  ...makeRepo("leads", { orderBy: { column: "created_at" } }),
  async create(row: any) {
    const { data, error } = await supabase
      .from("leads")
      .insert(await attachTenant(row))
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export { documentsRepo } from "./documents";
