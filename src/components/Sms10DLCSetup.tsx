// @ts-nocheck
import React, { useEffect, useState } from "react";
import {
  ShieldCheck, ChevronDown, Loader2, Bot, CheckCircle2, AlertTriangle, Send, Settings,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { registrationReadiness } from "../lib/smsCampaign";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Not registered", cls: "bg-zinc-700/40 text-zinc-300 border-white/10" },
  collecting: { label: "Draft saved", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  pending: { label: "Pending carrier review", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  approved: { label: "Registered", cls: "bg-forest-500/10 text-forest-400 border-forest-500/20" },
  failed: { label: "Registration failed", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const FIELD_LABELS: Record<string, string> = {
  legalBusinessName: "Legal business name", businessType: "Business type", vertical: "Industry",
  contactEmail: "Contact email", useCase: "Use case", description: "Campaign description",
  optInDescription: "How customers opt in", sampleMessages: "At least one sample message",
};

const AUTO_MODES: { key: string; label: string; desc: string }[] = [
  { key: "off", label: "Off", desc: "No automatic replies." },
  { key: "draft", label: "Suggest drafts", desc: "AI drafts a reply for you to review — never auto-sends." },
  { key: "auto", label: "Auto-reply & book", desc: "AI replies instantly and can capture a booking as a job request to confirm." },
];

export default function Sms10DLCSetup() {
  const { showToast } = useToast();
  const [reg, setReg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () => {
    fetchApi("/api/sms/registration")
      .then((r) => r.json())
      .then((d) => setReg(d.registration || {}))
      .catch(() => setReg({}))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const set = (k: string, v: any) => setReg((p: any) => ({ ...(p || {}), [k]: v }));
  const setSample = (i: number, v: string) => {
    const arr = [...(reg?.sampleMessages || [])];
    arr[i] = v;
    set("sampleMessages", arr);
  };

  const persist = async (patch: any, msg?: string) => {
    setSaving(true);
    try {
      const res = await fetchApi("/api/sms/registration", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      if (msg) showToast(msg, "success");
    } catch {
      showToast("Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = () => persist({ ...reg }, "Registration details saved.");

  const setAutoMode = (mode: string) => {
    set("autoReplyMode", mode);
    persist({ autoReplyMode: mode, autoReplyInstructions: reg?.autoReplyInstructions }, "Auto-reply updated.");
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await persist({ ...reg }); // ensure latest details are saved first
      const res = await fetchApi("/api/sms/registration/submit", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        const miss = (d.missing || []).map((m: string) => FIELD_LABELS[m] || m).join(", ");
        showToast(miss ? `Still needed: ${miss}` : (d.error || "Couldn't submit."), "error");
        return;
      }
      set("status", "pending");
      showToast(d.simulated ? "Recorded — finish carrier registration in Twilio (keys not set)." : "Submitted for carrier registration.", "info");
    } catch {
      showToast("Couldn't submit registration.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-2 text-zinc-500 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading texting setup…
      </div>
    );
  }

  const status = reg?.status || "not_started";
  const meta = STATUS_META[status] || STATUS_META.not_started;
  const readiness = registrationReadiness(reg);
  const mode = reg?.autoReplyMode || "off";

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2.5">
          <Settings size={18} className="text-zinc-400" />
          <span className="font-black uppercase tracking-widest text-xs text-white">Texting Setup &amp; Automation</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-widest ${meta.cls}`}>{meta.label}</span>
          {mode !== "off" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-forest-500/20 bg-forest-500/10 text-forest-400 font-bold uppercase tracking-widest flex items-center gap-1">
              <Bot size={11} /> Auto-reply: {mode}
            </span>
          )}
        </div>
        <ChevronDown size={18} className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/5 p-5 space-y-7">
          {/* --- A2P 10DLC registration --- */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-forest-500" />
              <h4 className="text-xs font-black uppercase tracking-widest text-white">Carrier Registration (A2P 10DLC)</h4>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              US carriers require every business texting number to be registered. Fill this in to register your brand + campaign.
              Marketing texts also require written opt-in consent (TCPA).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Legal business name" value={reg?.legalBusinessName} onChange={(v) => set("legalBusinessName", v)} placeholder="Green Acres LLC" />
              <Field label="Business type" value={reg?.businessType} onChange={(v) => set("businessType", v)} placeholder="LLC / Sole Proprietor / Corp" />
              <Field label="EIN / Tax ID (skip if sole proprietor)" value={reg?.ein} onChange={(v) => set("ein", v)} placeholder="12-3456789" />
              <Field label="Industry" value={reg?.vertical} onChange={(v) => set("vertical", v)} placeholder="Landscaping / Home services" />
              <Field label="Contact email" value={reg?.contactEmail} onChange={(v) => set("contactEmail", v)} placeholder="owner@greenacres.com" />
              <Field label="Website" value={reg?.website} onChange={(v) => set("website", v)} placeholder="https://…" />
            </div>
            <Field label="Campaign description (what you'll text about)" value={reg?.description} onChange={(v) => set("description", v)} placeholder="Appointment reminders, quotes, and seasonal offers to our customers." textarea />
            <Field label="How customers opt in" value={reg?.optInDescription} onChange={(v) => set("optInDescription", v)} placeholder="Customers opt in on our booking form and by texting START." textarea />
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Sample messages</label>
              {[0, 1, 2].map((i) => (
                <input key={i} value={(reg?.sampleMessages || [])[i] || ""} onChange={(e) => setSample(i, e.target.value)}
                  placeholder={i === 0 ? "Hi {name}, your YardWorx crew is on the way!" : "Another example text…"}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-forest-500" />
              ))}
            </div>

            {!readiness.ready && (
              <div className="text-[11px] text-amber-400/90 flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>Still needed: {readiness.missing.map((m) => FIELD_LABELS[m] || m).join(", ")}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={saveDetails} disabled={saving}
                className="flex-1 py-2.5 border-2 border-white/10 text-zinc-300 hover:bg-white/5 font-black uppercase tracking-widest text-xs rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save details
              </button>
              <button onClick={submit} disabled={submitting || !readiness.ready || status === "pending" || status === "approved"}
                className="flex-1 py-2.5 bg-forest-600 hover:bg-forest-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg shadow-forest-500/20 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {status === "pending" ? "Submitted" : "Submit to carriers"}
              </button>
            </div>
            {reg?.messagingServiceSid && (
              <p className="text-[10px] text-zinc-600 font-mono">Messaging Service: {reg.messagingServiceSid}</p>
            )}
          </section>

          {/* --- Agentic auto-reply --- */}
          <section className="space-y-3 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-forest-500" />
              <h4 className="text-xs font-black uppercase tracking-widest text-white">AI Auto-Reply</h4>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              When a customer texts back, the AI can answer instantly (grounded in their record + your services) and capture a booking as a job request for you to confirm.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {AUTO_MODES.map((m) => (
                <button key={m.key} onClick={() => setAutoMode(m.key)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${mode === m.key ? "bg-forest-500/10 border-forest-500/50" : "border-white/10 hover:border-white/30"}`}>
                  <p className={`text-sm font-bold ${mode === m.key ? "text-forest-400" : "text-zinc-300"}`}>{m.label}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{m.desc}</p>
                </button>
              ))}
            </div>
            {mode !== "off" && (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Reply guidance (optional)</label>
                <input value={reg?.autoReplyInstructions || ""} onChange={(e) => set("autoReplyInstructions", e.target.value)}
                  onBlur={() => persist({ autoReplyMode: mode, autoReplyInstructions: reg?.autoReplyInstructions })}
                  placeholder="e.g. Always offer a free on-site estimate. Mention we book ~1 week out."
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-forest-500" />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea }: any) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">{label}</label>
      {textarea ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full h-16 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-forest-500 resize-none" />
      ) : (
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-forest-500" />
      )}
    </div>
  );
}
