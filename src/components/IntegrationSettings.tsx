import React, { useState } from "react";
import { Link, CheckCircle2, ShieldAlert } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { useTenant } from "../contexts/TenantContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export function IntegrationSettings() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [zapierWebhook, setZapierWebhook] = useState(
    (tenant?.settings as any)?.integrations?.zapierWebhook || ""
  );
  const [zapierNewJobWebhook, setZapierNewJobWebhook] = useState(
    (tenant?.settings as any)?.integrations?.zapierNewJobWebhook || ""
  );
  const [isSaving, setIsSaving] = useState(false);

  // Define the strict allowed ecosystem
  const approvedConnectors = [
    { name: "Zapier", category: "Automation" },
    { name: "Make.com", category: "Automation" },
    { name: "QuickBooks Online", category: "Accounting" },
    { name: "Xero", category: "Accounting" },
    { name: "CompanyCam", category: "Project Media" },
    { name: "Fleetio", category: "Fleet Management" },
    { name: "Gusto", category: "Payroll & HR" },
    { name: "NiceJob", category: "Reputation" },
    { name: "Mailchimp", category: "Email Marketing" },
    { name: "Klaviyo", category: "Email Marketing" },
    { name: "Constant Contact", category: "Email Marketing" },
    { name: "SendGrid", category: "Email Marketing" },
    { name: "Twilio", category: "SMS / Comms" },
    { name: "Slack", category: "Internal Comms" },
    { name: "Google Calendar", category: "Scheduling Hub Integration" },
    { name: "Asana", category: "Task Sync" },
  ];

  const hasActiveWorkflows = (tenant?.settings as any)?.workflows?.some((w: any) => w.active);
  const generalWebhookInvalid = zapierWebhook.length > 0 && !zapierWebhook.startsWith("https://");
  const newJobWebhookInvalid = zapierNewJobWebhook.length > 0 && !zapierNewJobWebhook.startsWith("https://");
  const generalWebhookEmptyWarning = hasActiveWorkflows && zapierWebhook.trim().length === 0;
  const newJobWebhookEmptyWarning = hasActiveWorkflows && zapierNewJobWebhook.trim().length === 0;

  const handleSave = async () => {
    if (!tenant) return;
    
    // Simple frontend validation for webhook structure if provided
    if (zapierWebhook && !zapierWebhook.startsWith("https://")) {
      showToast("General Webhook URL must be a secure HTTPS connection.", "error");
      return;
    }
    if (zapierNewJobWebhook && !zapierNewJobWebhook.startsWith("https://")) {
      showToast("New Job Webhook URL must be a secure HTTPS connection.", "error");
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "tenants", tenant.id), {
        "settings.integrations.zapierWebhook": zapierWebhook,
        "settings.integrations.zapierNewJobWebhook": zapierNewJobWebhook,
      });
      showToast("Integration settings saved", "success");
    } catch (error) {
      console.error("Error saving integration settings", error);
      showToast("Failed to save integration settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-zinc-900 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6 mt-12">
      <div>
        <h2 className="text-xl font-black text-white uppercase tracking-normal md:tracking-tighter flex items-center gap-3">
          <Link className="text-amber-400" size={24} /> Verified Integrations Hub
        </h2>
        <p className="text-xs text-white/50 leading-relaxed mt-1 max-w-2xl">
          CuttyOS serves as your central command hub. You can seamlessly connect approved external tools as "add-ons" to run alongside your core operations via Webhooks. By adding your custom webhook endpoints here, you assume full responsibility for these external data pipelines (as per Section 8 of our Terms of Service).
        </p>
      </div>
      
      {/* Approved Connectors Ecosystem */}
      <div className="bg-black/30 border border-white/5 rounded-2xl p-5 mb-6">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" /> Approved Trade Connectors
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {approvedConnectors.map((connector, idx) => (
            <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col justify-center items-center text-center">
              <span className="text-[11px] font-bold text-white">{connector.name}</span>
              <span className="text-[9px] text-white/40 uppercase tracking-wider mt-1">{connector.category}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <ShieldAlert size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-200/70 leading-relaxed font-semibold">
            API access is strictly bounded to the verified integrations listed above to prevent data leakage or arbitrary code execution. Connection attempts from unapproved API managers (e.g., Postman, cURL scraping) will be immediately blocked by Cloud Armor.
          </p>
        </div>
      </div>

      <div className="space-y-6 max-w-xl">
        <div>
          <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Zapier / Make.com General Webhook URL</label>
          <input
            type="url"
            value={zapierWebhook}
            onChange={(e) => setZapierWebhook(e.target.value)}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            className={`w-full bg-black/50 border rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none transition-colors text-sm ${
              generalWebhookInvalid
                ? 'border-red-500/50 focus:border-red-500'
                : generalWebhookEmptyWarning
                ? 'border-amber-500/50 focus:border-amber-500'
                : 'border-white/10 focus:border-blue-500'
            }`}
          />
          {generalWebhookInvalid && (
            <p className="text-[10px] text-red-400 mt-2 flex items-center gap-1.5 font-bold uppercase tracking-widest">
              <ShieldAlert size={12} /> URL must start with https://
            </p>
          )}
          {generalWebhookEmptyWarning && !generalWebhookInvalid && (
            <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1.5 font-bold uppercase tracking-widest">
              <ShieldAlert size={12} /> Warning: Empty webhook may break active workflows
            </p>
          )}
          <p className="text-xs text-white/40 mt-2">
            General events like "New Client Created" will be sent to this webhook URL with full payload details.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Zapier New Job Trigger (Field Reports)</label>
          <input
            type="url"
            value={zapierNewJobWebhook}
            onChange={(e) => setZapierNewJobWebhook(e.target.value)}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            className={`w-full bg-black/50 border rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none transition-colors text-sm ${
              newJobWebhookInvalid
                ? 'border-red-500/50 focus:border-red-500'
                : newJobWebhookEmptyWarning
                ? 'border-amber-500/50 focus:border-amber-500'
                : 'border-emerald-500/30 focus:border-emerald-400'
            }`}
          />
          {newJobWebhookInvalid && (
            <p className="text-[10px] text-red-400 mt-2 flex items-center gap-1.5 font-bold uppercase tracking-widest">
              <ShieldAlert size={12} /> URL must start with https://
            </p>
          )}
          {newJobWebhookEmptyWarning && !newJobWebhookInvalid && (
            <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1.5 font-bold uppercase tracking-widest">
              <ShieldAlert size={12} /> Warning: Empty webhook may break active workflows
            </p>
          )}
          <p className="text-xs text-white/40 mt-2">
            When a job is completed, field report summaries will be sent directly to this webhook. Perfect for triggering email marketing campaigns (e.g., Klaviyo, Mailchimp) automatically based on completed work.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-bold tracking-wide transition-all uppercase"
        >
          {isSaving ? "Saving..." : "Save Integrations"}
        </button>
      </div>
    </section>
  );
}
