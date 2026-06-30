// @ts-nocheck
// Unified agent action executor — the ONE place voice (LiveEar) and text (CuttyChat)
// agents turn a detected intent into a real, RLS-scoped Supabase mutation + a navigation
// hint + a human-readable confirmation. Both surfaces call executeAgentAction() so the
// owner can run their whole day by talking/typing and just clicking through to verify.
//
// Everything writes through the repos (Supabase, tenant-scoped by RLS) so actions appear
// on the same screens the owner is looking at once those screens read from the repos too.

import {
  customersRepo,
  jobsRepo,
  invoicesRepo,
  expensesRepo,
  inventoryRepo,
  tasksRepo,
} from "./repos";
import { supabase } from "./supabase";

// Coerce a model-supplied money value to a number. The model often emits currency-formatted
// strings ("$1,200", "1,200.50"); a bare Number() of those is NaN → silently a $0 invoice.
// Strip currency symbols/commas/whitespace first. (Exported for tests.)
export function parseMoney(v: any): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export interface AgentActionContext {
  navigate?: (path: string) => void;
  rolePrefix?: string; // "/admin" | "/employee"
  showToast?: (title: string, body?: string, type?: string) => void;
  toggleFieldMode?: () => void;
  getLoadedCustomer?: () => any | null;
  setLoadedCustomer?: (c: any | null) => void;
}

export interface AgentActionResult {
  ok: boolean;
  message: string; // human-readable confirmation/result
  navigateTo?: string; // optional route to open so the owner can verify
  data?: any;
}

const fullName = (c: any) =>
  c
    ? `${c.first_name || c.firstName || ""} ${c.last_name || c.lastName || ""}`.trim() ||
      c.company_name ||
      c.companyName ||
      "customer"
    : "";

// Resolve the customer an action applies to: the already-loaded one, or a name/phone lookup.
async function resolveCustomer(args: any, ctx: AgentActionContext) {
  const loaded = ctx.getLoadedCustomer?.();
  const q = args.clientName || args.name || "";
  if (loaded && (!q || fullName(loaded).toLowerCase().includes(String(q).toLowerCase()))) {
    return loaded;
  }
  if (q) {
    const matches = await customersRepo.findByNameOrPhone(q);
    if (matches && matches.length) {
      ctx.setLoadedCustomer?.(matches[0]);
      return matches[0];
    }
  }
  return loaded || null;
}

const path = (ctx: AgentActionContext, sub: string) =>
  `${ctx.rolePrefix || "/admin"}/${sub}`;

// Execute a single detected tool-call. Never throws — returns a structured result so the
// caller can show a confirmation and (optionally) navigate.
export async function executeAgentAction(
  call: { name: string; args?: Record<string, any> },
  ctx: AgentActionContext = {},
): Promise<AgentActionResult> {
  const name = call?.name;
  const args = call?.args || {};
  try {
    switch (name) {
      case "load_client_data": {
        const q = args.clientName || args.name || "";
        const matches = await customersRepo.findByNameOrPhone(q);
        if (matches && matches.length) {
          ctx.setLoadedCustomer?.(matches[0]);
          return {
            ok: true,
            message: `Pulled up ${fullName(matches[0])}.`,
            navigateTo: path(ctx, "crm"),
            data: matches[0],
          };
        }
        ctx.setLoadedCustomer?.(null);
        return { ok: false, message: `No customer matched "${q}". Want me to add them as a lead?` };
      }

      case "create_lead":
      case "create_contact": {
        const first = args.firstName || (args.name ? String(args.name).split(" ")[0] : "") || "New";
        const last = args.lastName || (args.name ? String(args.name).split(" ").slice(1).join(" ") : "") || "Lead";
        const created = await customersRepo.create({
          first_name: first,
          last_name: last,
          phone: args.phone || null,
          email: args.email || null,
          address: args.address || null,
          status: "lead",
          notes: args.notes || null,
        });
        ctx.setLoadedCustomer?.(created);
        return {
          ok: true,
          message: `Added ${first} ${last} to your client book as a lead.`,
          navigateTo: path(ctx, "crm"),
          data: created,
        };
      }

      case "schedule_job": {
        const customer = await resolveCustomer(args, ctx);
        const job = await jobsRepo.create({
          title: args.serviceType || args.service || args.title || "Service visit",
          status: "SCHEDULED",
          date: args.date ? toDateOrNull(args.date) : null,
          customer_id: customer?.id || null,
          address: customer?.address || args.address || null,
          notes: args.notes || null,
        });
        return {
          ok: true,
          message: `Scheduled "${job.title || "Service"}"${customer ? ` for ${fullName(customer)}` : ""}.`,
          navigateTo: path(ctx, "scheduler"),
          data: job,
        };
      }

      case "create_invoice":
      case "create_quote":
      case "create_estimate": {
        const customer = await resolveCustomer(args, ctx);
        const amount = parseMoney(args.amount);
        const isQuote = name !== "create_invoice";
        const clientLabel = customer ? fullName(customer) : args.clientName || "";
        const inv = await invoicesRepo.create({
          amount,
          status: "draft", // lowercase: the Invoices UI + ClientPortal are lowercase-oriented
          customer_id: customer?.id || null,
          data: {
            serviceDescription: args.serviceDescription || args.description || "",
            kind: isQuote ? "quote" : "invoice",
            // The invoice screens read `data.client` (name string) for display + portal matching.
            client: clientLabel,
            clientName: clientLabel,
          },
        });
        return {
          ok: true,
          message: `${isQuote ? "Drafted a quote" : "Drafted an invoice"} for $${amount}${customer ? ` to ${fullName(customer)}` : ""}.`,
          navigateTo: path(ctx, "invoices"),
          data: inv,
        };
      }

      case "add_client_note": {
        const customer = await resolveCustomer(args, ctx);
        if (!customer) return { ok: false, message: "Say the client's name first, then I'll add the note." };
        const note = args.note || args.notes || "";
        const merged = (customer.notes ? customer.notes + "\n" : "") + note;
        const updated = await customersRepo.update(customer.id, { notes: merged });
        ctx.setLoadedCustomer?.(updated || { ...customer, notes: merged });
        return {
          ok: true,
          message: `Added a note to ${fullName(customer)}.`,
          navigateTo: path(ctx, "crm"),
          data: updated,
        };
      }

      case "set_gate_code": {
        const customer = await resolveCustomer(args, ctx);
        if (!customer) return { ok: false, message: "Tell me which client this gate code is for." };
        const code = args.gateCode || args.code || "";
        const data = { ...(customer.data || {}), gateCode: code };
        const updated = await customersRepo.update(customer.id, { data });
        ctx.setLoadedCustomer?.(updated || { ...customer, data });
        return {
          ok: true,
          message: `Saved gate code ${code} for ${fullName(customer)}.`,
          navigateTo: path(ctx, "crm"),
          data: updated,
        };
      }

      case "set_hoa_rules": {
        const customer = await resolveCustomer(args, ctx);
        if (!customer)
          return { ok: false, message: "Tell me which client's HOA rules to save." };
        const rules = parseRules(args.rules);
        const quietHoursStart =
          typeof args.quietHoursStart === "string" && args.quietHoursStart.trim()
            ? args.quietHoursStart.trim()
            : undefined;
        const data = {
          ...(customer.data || {}),
          hoaRules: rules,
          ...(quietHoursStart ? { quietHoursStart } : {}),
        };
        // is_hoa is a real boolean column — pass the snake_case key directly so the repo's
        // snake-izer doesn't mangle it (isHOA would not map cleanly).
        const updated = await customersRepo.update(customer.id, {
          is_hoa: true,
          data,
        });
        ctx.setLoadedCustomer?.(updated || { ...customer, is_hoa: true, data });
        return {
          ok: true,
          message: `Saved HOA rules for ${fullName(customer)} (${rules.length} rule${rules.length === 1 ? "" : "s"}).`,
          navigateTo: path(ctx, "crm"),
          data: updated,
        };
      }

      case "log_expense": {
        const amount = parseMoney(args.amount);
        const exp = await expensesRepo.create({
          amount,
          merchant: args.merchant || args.vendor || null,
          category: args.category || "Uncategorized",
          date: toDateOrNull(args.date) || new Date().toISOString(),
          data: { description: args.description || "" },
        });
        return {
          ok: true,
          message: `Logged a $${amount} expense${args.merchant || args.vendor ? ` at ${args.merchant || args.vendor}` : ""}.`,
          navigateTo: path(ctx, "invoices"),
          data: exp,
        };
      }

      case "check_inventory": {
        const items = await inventoryRepo.list();
        const q = (args.itemName || "").toLowerCase();
        const matches = q
          ? items.filter((i: any) => (i.name || "").toLowerCase().includes(q))
          : items;
        const summary = matches.length
          ? matches
              .slice(0, 5)
              .map((i: any) => `${i.name}: ${i.quantity ?? i.stock ?? 0} ${i.unit || ""}`.trim())
              .join("; ")
          : "No matching items on hand.";
        return {
          ok: true,
          message: q ? `Stock — ${summary}` : `Inventory: ${summary}`,
          navigateTo: path(ctx, "inventory"),
          data: matches,
        };
      }

      case "log_inventory_usage": {
        const items = await inventoryRepo.list();
        const q = (args.itemName || "").toLowerCase();
        const item = items.find((i: any) => (i.name || "").toLowerCase().includes(q));
        const qty = Number(args.quantity) || 1;
        const customer = args.clientName ? await resolveCustomer(args, ctx) : null;
        if (item) {
          const current = Number(item.quantity ?? item.stock ?? 0);
          await inventoryRepo.update(item.id, { quantity: Math.max(0, current - qty) });
        }
        // Record the draw so it shows in the material log / can be billed.
        try {
          await supabase.from("material_logs").insert(
            await stampTenant({
              item_id: item?.id || null,
              inventory_item_id: item?.id || null,
              item_name: item?.name || args.itemName || "item",
              quantity: qty,
              unit: item?.unit || null,
              type: "out",
              client_name: customer ? fullName(customer) : args.clientName || null,
            }),
          );
        } catch {
          /* material_logs is best-effort */
        }
        return {
          ok: true,
          message: `Logged ${qty}× ${item?.name || args.itemName || "item"} used${customer ? ` on ${fullName(customer)}'s job` : ""}.`,
          navigateTo: path(ctx, "inventory"),
          data: item,
        };
      }

      case "load_employee_data": {
        const q = args.employeeName || args.name || "";
        let row: any = null;
        try {
          const { data } = await supabase
            .from("employees")
            .select("*")
            .ilike("name", `%${q}%`)
            .limit(1)
            .maybeSingle();
          row = data;
        } catch {
          /* ignore */
        }
        return {
          ok: !!row,
          message: row
            ? `${row.name} — ${row.role || "crew"} (${row.status || "active"}).`
            : `Opening the crew board for ${q || "your team"}.`,
          navigateTo: path(ctx, "crew-suite"),
          data: row,
        };
      }

      case "request_review": {
        const customer = await resolveCustomer(args, ctx);
        // Queue a follow-up task so the review ask isn't forgotten.
        try {
          await tasksRepo.create({
            title: `Request a review from ${customer ? fullName(customer) : args.clientName || "client"}`,
            customer_id: customer?.id || null,
            status: "pending",
            priority: "medium",
          });
        } catch {
          /* tasks is best-effort */
        }
        return {
          ok: true,
          message: `Queued a review request${customer ? ` for ${fullName(customer)}` : ""}.`,
          navigateTo: path(ctx, "reviews"),
        };
      }

      case "build_design_vision":
      case "create_design": {
        const customer = await resolveCustomer(args, ctx);
        ctx.setLoadedCustomer?.(customer || null);
        const designPath = path(ctx, "design-studio");
        const message = `Opening Design Studio${customer ? ` for ${fullName(customer)}` : ""}.`;
        // Navigate WITH router state so the studio opens pre-loaded with this customer.
        // react-router's navigate(path, { state }) is the only way to pass state, so we
        // call it here directly and tell the caller not to double-navigate (navigateTo
        // would lose the state). Fall back to navigateTo if navigate isn't available.
        if (typeof ctx.navigate === "function") {
          ctx.navigate(designPath, { state: { customer } });
          return { ok: true, message, navigateTo: undefined, data: customer };
        }
        return {
          ok: true,
          message,
          navigateTo: designPath,
          data: customer,
        };
      }

      case "enter_field_mode": {
        ctx.toggleFieldMode?.();
        return { ok: true, message: "Field Mode on — ready for the route." };
      }

      default:
        return { ok: false, message: `I heard "${prettyName(name)}" but don't have an action for it yet.` };
    }
  } catch (err: any) {
    return { ok: false, message: `Couldn't ${prettyName(name)}: ${err?.message || "something went wrong"}.` };
  }
}

// Stamp tenant_id for raw supabase inserts that don't go through a repo.
async function stampTenant(row: any) {
  if (row.tenant_id) return row;
  try {
    const { getCurrentProfile } = await import("./repos/profile");
    const profile = await getCurrentProfile();
    return { ...row, tenant_id: profile?.tenant_id };
  } catch {
    return row;
  }
}

// Normalize HOA rules into a clean string[]. Accepts an array already, or a single
// string the model dictated as prose — split on commas, semicolons, newlines, and "and".
export function parseRules(input: any): string[] {
  if (Array.isArray(input)) {
    return input.map((r) => String(r).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[;,\n]|\band\b/gi)
      .map((r) => r.trim())
      .filter(Boolean);
  }
  return [];
}

export function toDateOrNull(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function prettyName(name: string): string {
  return (name || "action").replace(/_/g, " ");
}
