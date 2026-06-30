// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import {
  Megaphone, Sparkles, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Send, X,
  MessageSquare, Smartphone, Ban, UserCheck, Clock, LayoutTemplate,
} from "lucide-react";
import { Customer } from "../types";
import { fetchApi } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { customersRepo, designVisionsRepo } from "../lib/repos";
import { countSmsSegments, OPT_OUT_FOOTER, canReceiveMarketing } from "../lib/smsCampaign";
import { CAMPAIGN_TEMPLATES, TEMPLATE_CATEGORIES } from "../lib/smsCampaignTemplates";
import Sms10DLCSetup from "../components/Sms10DLCSetup";
import { motion, AnimatePresence } from "motion/react";

type Segment = "all" | "priority" | "lapsed" | "design" | "proposal";

interface SmsDraft {
  customerId: string;
  name: string;
  phone: string;
  message: string;
  consent: string;
  optedOut: boolean;
}

export default function TextCampaigns() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  // customerId -> design-vision rollup (drives the Design Studio pipeline segments).
  const [visionByCustomer, setVisionByCustomer] = useState<Record<string, { approved: boolean }>>({});
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [segment, setSegment] = useState<Segment>("priority");
  const [targetService, setTargetService] = useState("");
  const [directives, setDirectives] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [drafts, setDrafts] = useState<SmsDraft[]>([]);
  const [sending, setSending] = useState(false);
  const [savingConsent, setSavingConsent] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<any>(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  // Prefill the builder from one of the 20 ready-made campaigns.
  const applyTemplate = (t: any) => {
    setSegment(t.segment);
    setTargetService(t.targetService);
    setDirectives(t.directives);
    setActiveTemplate(t.id);
    showToast(`Loaded "${t.name}". Review the audience and draft when ready.`, "success");
  };

  useEffect(() => {
    customersRepo.list().then((rows) => setCustomers(rows || [])).catch(() => setCustomers([]));
    // Pull design visions so we can target customers with a saved vision (seasonal re-design
    // upsell) and those whose proposal was sent but not yet approved (abandoned-proposal recovery).
    designVisionsRepo.list().then((rows) => {
      const m: Record<string, { approved: boolean }> = {};
      for (const v of (rows as any[]) || []) {
        const cid = v.customerId;
        if (!cid) continue;
        const approved = !!(v.proposal && v.proposal.approved);
        m[cid] = { approved: (m[cid]?.approved || approved) };
      }
      setVisionByCustomer(m);
    }).catch(() => {});
  }, []);

  // Segment, then require a phone number on file (can't text without one).
  const targeted = useMemo(() => {
    return (customers || []).filter((c) => {
      if (!c.phone) return false;
      if (segment === "all") return true;
      if (segment === "priority") return (c.aiScore ?? 0) >= 80;
      if (segment === "lapsed") return (c.aiScore ?? 100) < 40;
      if (segment === "design") return !!visionByCustomer[c.id];
      if (segment === "proposal") return !!visionByCustomer[c.id] && !visionByCustomer[c.id].approved;
      return true;
    }).slice(0, 100);
  }, [customers, segment, visionByCustomer]);

  // Compliance snapshot of the targeted set: how many can lawfully receive a marketing text.
  const consentBreakdown = useMemo(() => {
    let consented = 0, noConsent = 0, optedOut = 0;
    for (const c of targeted) {
      if (c.smsOptOutAt) optedOut++;
      else if (canReceiveMarketing(c)) consented++;
      else noConsent++;
    }
    return { consented, noConsent, optedOut };
  }, [targeted]);

  const handleGenerate = async () => {
    if (!targetService.trim()) return showToast("Tell us what you're promoting first.", "error");
    if (!targeted.length) return showToast("No customers with a phone number in this segment.", "error");
    setIsDrafting(true);
    setResult(null);
    try {
      const res = await fetchApi("/api/outbound/draft-personalized-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "sms",
          targetService,
          instructions: directives,
          customers: targeted.map((c) => ({
            id: c.id, name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
            address: c.address, notes: c.notes, tags: c.tags, score: c.aiScore,
          })),
        }),
      });
      const data = await res.json();
      const byId: Record<string, Customer> = Object.fromEntries(targeted.map((c) => [c.id, c]));
      const enriched: SmsDraft[] = (data.drafts || []).map((d: any) => {
        const c = byId[d.customerId] || {};
        return {
          customerId: d.customerId,
          name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Customer",
          phone: c.phone || "",
          message: d.message || "",
          consent: c.smsConsent || "none",
          optedOut: !!c.smsOptOutAt,
        };
      }).filter((d: SmsDraft) => d.phone);
      if (!enriched.length) return showToast("No drafts generated. Try again.", "error");
      setDrafts(enriched);
    } catch (e) {
      showToast("Error generating drafts.", "error");
    } finally {
      setIsDrafting(false);
    }
  };

  const updateDraft = (i: number, message: string) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, message } : d)));
  const removeDraft = (i: number) => setDrafts((prev) => prev.filter((_, idx) => idx !== i));

  const isSendable = (d: SmsDraft) => !d.optedOut && d.consent === "marketing";
  const sendableDrafts = drafts.filter(isSendable);

  // Inline opt-in capture (TCPA): record marketing consent on a contact so they become
  // sendable. The button copy makes clear the operator must actually have consent.
  const recordOptIn = async (d: SmsDraft) => {
    setSavingConsent((s) => ({ ...s, [d.customerId]: true }));
    try {
      const res = await fetchApi("/api/sms/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: d.customerId, consent: "marketing", source: "campaign" }),
      });
      if (!res.ok) throw new Error();
      setDrafts((prev) => prev.map((x) => (x.customerId === d.customerId ? { ...x, consent: "marketing", optedOut: false } : x)));
      setCustomers((prev) => prev.map((c) => (c.id === d.customerId ? { ...c, smsConsent: "marketing", smsOptOutAt: undefined } : c)));
      showToast("Opt-in recorded.", "success");
    } catch {
      showToast("Couldn't record opt-in.", "error");
    } finally {
      setSavingConsent((s) => ({ ...s, [d.customerId]: false }));
    }
  };

  const handleSend = async () => {
    if (!sendableDrafts.length) return showToast("No consented recipients to send to.", "error");
    setSending(true);
    try {
      const res = await fetchApi("/api/sms/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: targetService || "Text campaign",
          targetService,
          segment,
          recipients: sendableDrafts.map((d) => ({ customerId: d.customerId, phone: d.phone, message: d.message })),
          ...(scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Send failed");
      setResult(data);
      setDrafts([]);
      if (data.scheduled) {
        showToast(`Scheduled ${data.total} texts for ${new Date(data.scheduledFor).toLocaleString()}.`, "success");
      } else {
        showToast(
          data.simulated ? `Simulated ${data.total} sends (Twilio not configured).` : `Sent ${data.sent} / ${data.total} texts.`,
          data.simulated ? "info" : "success",
        );
      }
      setScheduledFor("");
    } catch (e: any) {
      showToast(e?.message || "Send failed.", "error");
    } finally {
      setSending(false);
    }
  };

  // ---- Agreement gate (TCPA-specific) -------------------------------------
  if (!agreementAccepted) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-zinc-900 border-2 border-amber-500/30 rounded-3xl mt-8">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-4">Text Campaign — Compliance Acknowledgement</h2>
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed font-medium mb-8">
          <p>You're about to send <strong>SMS marketing</strong>. US texting law (TCPA/CTIA) is strict and the penalties are real (up to $500–$1,500 per message).</p>
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-amber-400 font-bold mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Before you send</p>
            <ul className="list-disc list-inside text-xs space-y-2 text-amber-500/80">
              <li><strong>Consent:</strong> Only text people who gave you written permission to send marketing texts. This tool only sends to contacts marked with marketing consent.</li>
              <li><strong>Opt-out:</strong> Every message auto-appends "{OPT_OUT_FOOTER}" and inbound STOP/HELP are handled automatically.</li>
              <li><strong>Registration:</strong> Carrier delivery requires A2P 10DLC registration of your business + campaign (see your setup checklist).</li>
              <li><strong>You are the human-in-the-loop</strong> — review every message before it goes out.</li>
            </ul>
          </div>
          <p className="text-xs text-zinc-500">You accept responsibility for consent, content, and compliance of all texts sent from this tool.</p>
        </div>
        <button
          onClick={() => setAgreementAccepted(true)}
          className="w-full py-4 bg-forest-600 hover:bg-forest-500 text-white font-black uppercase tracking-widest text-sm rounded-xl transition-all shadow-lg shadow-forest-500/20 flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={18} /> I Understand & Will Review Every Message
        </button>
      </div>
    );
  }

  // ---- Review queue -------------------------------------------------------
  if (drafts.length > 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-5 mt-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
            <MessageSquare className="text-forest-500" /> Review Texts
          </h3>
          <div className="flex items-center gap-2 text-xs font-bold font-mono">
            <span className="px-3 py-1.5 bg-forest-500/10 text-forest-400 border border-forest-500/20 rounded-full">
              {sendableDrafts.length} READY
            </span>
            {drafts.length - sendableDrafts.length > 0 && (
              <span className="px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                {drafts.length - sendableDrafts.length} NEED OPT-IN
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {drafts.map((d, i) => {
            const seg = countSmsSegments(`${d.message} ${OPT_OUT_FOOTER}`);
            const ready = isSendable(d);
            return (
              <div key={d.customerId + i} className={`bg-zinc-900 border rounded-2xl p-4 ${ready ? "border-forest-500/20" : "border-amber-500/20"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Smartphone size={16} className="text-zinc-500 shrink-0" />
                    <span className="font-bold text-white truncate">{d.name}</span>
                    <span className="text-xs text-zinc-500 font-mono truncate">{d.phone}</span>
                  </div>
                  <button onClick={() => removeDraft(i)} className="text-zinc-600 hover:text-white shrink-0"><X size={16} /></button>
                </div>
                <textarea
                  className="w-full h-20 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-forest-500 resize-none leading-relaxed"
                  value={d.message}
                  onChange={(e) => updateDraft(i, e.target.value)}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] font-mono text-zinc-500">
                    {seg.units} chars · {seg.segments} SMS · {seg.encoding} · +"{OPT_OUT_FOOTER}"
                  </span>
                  {ready ? (
                    <span className="text-[11px] font-bold uppercase tracking-widest text-forest-400 flex items-center gap-1"><CheckCircle2 size={13} /> Consented</span>
                  ) : d.optedOut ? (
                    <span className="text-[11px] font-bold uppercase tracking-widest text-red-400 flex items-center gap-1"><Ban size={13} /> Opted out</span>
                  ) : (
                    <button
                      onClick={() => recordOptIn(d)}
                      disabled={savingConsent[d.customerId]}
                      className="text-[11px] font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300 flex items-center gap-1 disabled:opacity-50"
                      title="Only do this if you actually have the customer's written marketing consent."
                    >
                      {savingConsent[d.customerId] ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />} Record opt-in
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-4 bg-zinc-950/80 backdrop-blur p-3 rounded-2xl border border-white/5 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Clock size={14} className="text-zinc-500" />
            <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Schedule (optional)</label>
            <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
              className="ml-auto bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-forest-500" />
            {scheduledFor && <button onClick={() => setScheduledFor("")} className="text-zinc-500 hover:text-white" aria-label="Clear schedule"><X size={14} /></button>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDrafts([])} className="flex-1 py-3.5 border-2 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 font-black uppercase tracking-widest text-sm rounded-xl transition-all">
              Discard
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !sendableDrafts.length}
              className="flex-[2] py-3.5 bg-forest-600 hover:bg-forest-500 text-white font-black uppercase tracking-widest text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-forest-500/20 disabled:opacity-50 disabled:grayscale"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : scheduledFor ? <Clock size={18} /> : <Send size={18} />}
              {sending ? "Working…" : scheduledFor ? `Schedule ${sendableDrafts.length} Text${sendableDrafts.length === 1 ? "" : "s"}` : `Send ${sendableDrafts.length} Text${sendableDrafts.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Builder ------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto space-y-6 mt-8">
      <Sms10DLCSetup />

      {/* Ready-made campaigns */}
      <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 sm:p-8">
        <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2 mb-1">
          <LayoutTemplate className="text-forest-500" /> Start From a Campaign
        </h3>
        <p className="text-sm text-zinc-500 font-medium mb-5">20 ready-made campaigns built for landscaping. Tap one to load the audience + AI directives below, then review and send.</p>
        <div className="space-y-5">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <div key={cat}>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">{cat}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CAMPAIGN_TEMPLATES.filter((t) => t.category === cat).map((t) => (
                  <button key={t.id} onClick={() => applyTemplate(t)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${activeTemplate === t.id ? "bg-forest-500/10 border-forest-500/50" : "border-white/10 hover:border-white/30 bg-black/20"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white truncate">{t.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest shrink-0 ${t.channel === "marketing" ? "bg-amber-500/10 text-amber-400" : "bg-celtic-500/10 text-celtic-400"}`}>
                        {t.channel === "marketing" ? "Mktg" : "Service"}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{t.preview}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 sm:p-8">
        <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2 mb-1">
          <Megaphone className="text-forest-500" /> Text Campaign
        </h3>
        <p className="text-sm text-zinc-500 font-medium mb-6">Pick who to reach, say what you're offering — YardWorx writes a personalized text for each customer. You review every one before it sends.</p>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">1. Audience</label>
            <div className="flex gap-3 flex-wrap">
              {([
                ["priority", "Priority (Score > 80)"],
                ["lapsed", "Lapsed (Score < 40)"],
                ["design", "Has Design Vision"],
                ["proposal", "Proposal Not Approved"],
                ["all", "All Customers"],
              ] as [Segment, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setSegment(key)}
                  className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all ${segment === key ? "bg-forest-500/10 border-forest-500/50 text-forest-400" : "border-white/10 text-zinc-400 hover:border-white/30"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">2. What are you promoting?</label>
            <input type="text" value={targetService} onChange={(e) => setTargetService(e.target.value)}
              placeholder="e.g. Spring Aeration & Overseeding"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500" />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">3. Directives (optional)</label>
            <textarea value={directives} onChange={(e) => setDirectives(e.target.value)}
              placeholder="e.g. Mention we're booking April now. Friendly, local tone."
              className="w-full h-20 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 resize-none" />
          </div>

          {/* Consent-aware targeting snapshot */}
          <div className="pt-4 border-t border-white/5 grid grid-cols-3 gap-3 text-center">
            <div className="bg-black/30 rounded-xl py-3 border border-forest-500/10">
              <p className="text-2xl font-black text-forest-400">{consentBreakdown.consented}</p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Can text now</p>
            </div>
            <div className="bg-black/30 rounded-xl py-3 border border-amber-500/10">
              <p className="text-2xl font-black text-amber-400">{consentBreakdown.noConsent}</p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Need opt-in</p>
            </div>
            <div className="bg-black/30 rounded-xl py-3 border border-red-500/10">
              <p className="text-2xl font-black text-red-400">{consentBreakdown.optedOut}</p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Opted out</p>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={isDrafting || !targetService || !targeted.length}
            className="w-full py-3.5 bg-forest-600 hover:bg-forest-500 text-white font-black uppercase tracking-widest text-sm rounded-xl transition-all shadow-lg shadow-forest-500/20 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2">
            {isDrafting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {isDrafting ? "Writing texts…" : `Draft ${targeted.length} Personalized Text${targeted.length === 1 ? "" : "s"}`}
          </button>
          {!targeted.length && (
            <p className="text-center text-xs text-zinc-600">No customers with a phone number in this segment yet. Add phone numbers in the CRM.</p>
          )}
        </div>
      </div>

      {/* Last send result (honest status) */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-zinc-900 border border-white/5 rounded-3xl p-6">
            <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-forest-500" size={16} /> Last Campaign
              {result.simulated && <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full">SIMULATED</span>}
            </h4>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div><p className="text-2xl font-black text-white">{result.total}</p><p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Targeted</p></div>
              <div><p className="text-2xl font-black text-forest-400">{result.simulated ? result.simulatedCount : result.sent}</p><p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{result.simulated ? "Simulated" : "Sent"}</p></div>
              <div><p className="text-2xl font-black text-red-400">{result.failed}</p><p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Failed</p></div>
              <div><p className="text-2xl font-black text-zinc-400">{result.skipped}</p><p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Skipped</p></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
