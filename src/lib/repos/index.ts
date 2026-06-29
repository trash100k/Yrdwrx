// @ts-nocheck
// Domain repositories — the Supabase data-access seam pages migrate onto.
// RLS scopes everything to the caller's tenant; makeRepo().create() auto-stamps tenant_id.
import { makeRepo } from "./base";
import { supabase } from "../supabase";

export { getCurrentProfile, clearProfileCache } from "./profile";
export { documentsRepo } from "./documents";
export { tenantsRepo } from "./tenant";

// --- Customers (soft-delete enabled) ---
export const customersRepo = {
  ...makeRepo("customers", { orderBy: { column: "created_at" }, softDelete: true }),
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
  async complete(id: string) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
  async reopen(id: string) {
    const { error } = await supabase.from("tasks").update({ status: "pending", completed_at: null }).eq("id", id);
    if (error) throw error;
  },
};

// --- Jobs ---
export const jobsRepo = {
  ...makeRepo("jobs", { orderBy: { column: "date", ascending: true } }),
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

// --- Other domains (generic CRUD + realtime; create auto-stamps tenant) ---
export const leadsRepo = makeRepo("leads", { orderBy: { column: "created_at" } });
export const materialLogsRepo = makeRepo("material_logs", { orderBy: { column: "created_at", ascending: false } });
export const invoicesRepo = makeRepo("invoices", { orderBy: { column: "created_at" } });
export const expensesRepo = makeRepo("expenses", { orderBy: { column: "created_at" } });
export const reviewsRepo = makeRepo("reviews", { orderBy: { column: "created_at" } });
export const inventoryRepo = makeRepo("inventory", { orderBy: { column: "created_at" } });
export const crewsRepo = makeRepo("crews", { orderBy: { column: "created_at" } });
export const vendorsRepo = makeRepo("vendors", { orderBy: { column: "created_at" } });
export const knowledgeRepo = makeRepo("knowledge", { orderBy: { column: "created_at" } });
export const designCatalogRepo = makeRepo("design_catalog", { orderBy: { column: "created_at" } });
export const contractsRepo = makeRepo("contracts", { orderBy: { column: "created_at" } });
export const inspectionFormsRepo = makeRepo("inspection_forms", { orderBy: { column: "created_at" } });
export const designVisionsRepo = makeRepo("customer_design_visions", { orderBy: { column: "created_at" } });
// Timesheets (clock in/out) — read for week-hours rollups, create/update on clock events.
export const timesheetsRepo = makeRepo("timesheets", { orderBy: { column: "clock_in", ascending: false } });
// System logs — READ path for the Reports audit feed (writes happen via logSystemEvent in lib/firebase).
export const systemLogsRepo = makeRepo("system_logs", { orderBy: { column: "created_at", ascending: false } });
// Chemical / pesticide application compliance logs (turf/tree regulatory requirement).
export const complianceLogsRepo = makeRepo("compliance_logs", { orderBy: { column: "application_date", ascending: false } });
// Equipment & vehicle maintenance ledger (hours/mileage service tracking).
export const equipmentRepo = makeRepo("equipment", { orderBy: { column: "created_at", ascending: false } });
// Referral & advocacy engine (trackable referral offers + reward status).
export const referralsRepo = makeRepo("referrals", { orderBy: { column: "created_at", ascending: false } });
