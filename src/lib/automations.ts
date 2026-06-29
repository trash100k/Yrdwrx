// @ts-nocheck
// Automation engine — actually EXECUTES the user-built "If This, Then That" rules
// stored in tenant.settings.workflows (the WorkflowBuilderSection editor). Before this,
// rules were saved but never ran (and the builder drew a fabricated activity chart).
//
// Call runAutomations(event, payload) from the place where the real event happens
// (job set to COMPLETED, invoice paid, new client created, quote approved). It is
// fire-and-forget and MUST NEVER throw into the triggering code path.

import { tenantsRepo, tasksRepo } from "./repos";
import { fetchApi } from "./api";

export type AutomationEvent =
  | "job_completed"
  | "client_created"
  | "invoice_paid"
  | "quote_approved";

const EVENT_LABEL: Record<string, string> = {
  job_completed: "Job completed",
  client_created: "New client added",
  invoice_paid: "Invoice paid",
  quote_approved: "Quote approved",
};

function describe(event: AutomationEvent, payload: any): string {
  const who =
    payload?.clientName ||
    payload?.client ||
    payload?.customerName ||
    payload?.name ||
    payload?.title ||
    "";
  return `${EVENT_LABEL[event] || event}${who ? ` — ${who}` : ""}`;
}

async function executeAction(rule: any, event: AutomationEvent, payload: any) {
  switch (rule.action) {
    case "send_webhook": {
      if (!rule.targetPayload) return;
      // Proxied server-side: dodges browser CORS on arbitrary Zapier/Make hooks and lets
      // the server SSRF-guard the tenant-supplied URL. Retries are honored server-side.
      await fetchApi("/api/automations/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: rule.targetPayload,
          event,
          payload,
          retries: rule.enableRetries !== false,
        }),
      });
      return;
    }
    case "flag_for_review": {
      await tasksRepo.create({
        title: `⚑ Review: ${describe(event, payload)}`,
        status: "pending",
        priority: "high",
        customer_id: payload?.customerId || payload?.customer_id || null,
        data: { source: "automation", ruleId: rule.id, event, payload },
      });
      return;
    }
    case "draft_followup_email": {
      let draft = "";
      try {
        const res = await fetchApi("/api/brain/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `Draft a short, friendly follow-up email after this event: ${EVENT_LABEL[event] || event}. Details: ${JSON.stringify(payload).slice(0, 600)}`,
            context: "landscaping client follow-up email",
          }),
        });
        const data = await res.json();
        draft = data?.text || "";
      } catch {
        /* AI draft is best-effort; still file the task */
      }
      await tasksRepo.create({
        title: `✉ Follow-up: ${describe(event, payload)}`,
        status: "pending",
        priority: "medium",
        customer_id: payload?.customerId || payload?.customer_id || null,
        notes: draft || undefined,
        data: { source: "automation", ruleId: rule.id, event, draft },
      });
      return;
    }
    default:
      return; // unknown action — no-op
  }
}

/**
 * Run every active rule whose trigger matches `event`. Records real run metadata
 * (runCount + lastRunTime) back onto the rules so the builder can show honest stats
 * instead of a fabricated chart. Swallows all errors.
 */
export async function runAutomations(event: AutomationEvent, payload: any = {}): Promise<void> {
  try {
    const tenant = await tenantsRepo.get();
    const all: any[] = tenant?.settings?.workflows || [];
    const matched = all.filter((r) => r?.active && r?.trigger === event);
    if (!matched.length) return;

    const stamp = new Date().toISOString();
    const ranIds = new Set<string>();
    const errors: Record<string, string> = {};
    for (const rule of matched) {
      try {
        await executeAction(rule, event, payload);
        ranIds.add(rule.id);
      } catch (e: any) {
        errors[rule.id] = e?.message || "failed";
        ranIds.add(rule.id); // still count the attempt + record the error
      }
    }

    // Persist run metadata (read-modify-write the whole workflows array).
    const updated = all.map((w) =>
      ranIds.has(w.id)
        ? {
            ...w,
            lastRunTime: stamp,
            runCount: (w.runCount || 0) + 1,
            lastError: errors[w.id] || null,
          }
        : w,
    );
    await tenantsRepo.updateSettings({ workflows: updated }).catch(() => {});
  } catch {
    /* automations must never break the action that triggered them */
  }
}
