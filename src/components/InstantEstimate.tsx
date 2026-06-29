// @ts-nocheck
// InstantEstimate — address -> rough property measurement -> suggested quote -> draft invoice.
//
// HONESTY POLICY (important): this tool never pretends to have a survey-grade takeoff.
// The server (/api/measure/property) returns one of three shapes, and we render each
// truthfully:
//   - source === "unavailable"  -> no provider configured; show the server `message`,
//                                  no number, no price. We do NOT invent a measurement.
//   - source === "ai_estimate"  -> a Gemini guess; show the sqft with a loud "ROUGH AI
//                                  ESTIMATE" badge + a confidence dot + the server `note`.
//   - source === "provider"     -> a real measurement provider. Show the sqft normally
//                                  (currently the vendor takeoff may still be pending, in
//                                  which case lawnSqft is null and we surface the note).
//
// When a lawnSqft exists we compute a suggested price from tenant.settings.ratePerSqft
// (falling back to $0.02/sqft mowing) and offer "Create estimate", which writes a DRAFT
// invoice via invoicesRepo.create(). The user can always override the number before
// creating the estimate.

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  Ruler,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Plug,
  FileText,
  User,
  DollarSign,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { invoicesRepo } from "../lib/repos";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const DEFAULT_RATE_PER_SQFT = 0.02; // sensible default mowing rate ($/sqft)

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) =>
  "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

const sqft = (n: number) =>
  Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

// Small confidence indicator (the "ConfidenceDot" called for by the spec — kept inline
// here because this component owns the only assigned files).
function ConfidenceDot({ level }: { level?: string }) {
  const l = String(level || "low").toLowerCase();
  const cfg =
    l === "high"
      ? { color: "bg-forest-400", ring: "shadow-[0_0_10px_rgba(5,168,69,0.6)]", label: "High confidence" }
      : l === "medium"
        ? { color: "bg-amber-400", ring: "shadow-[0_0_10px_rgba(251,191,36,0.5)]", label: "Medium confidence" }
        : { color: "bg-rose-400", ring: "shadow-[0_0_10px_rgba(251,113,133,0.5)]", label: "Low confidence" };
  return (
    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.color} ${cfg.ring}`} />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

export function InstantEstimate() {
  const { tenant } = useTenant();
  const { showToast } = useToast();

  const [address, setAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const [measuring, setMeasuring] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-sqft rate: tenant override -> default. (settings may be undefined in demo mode.)
  const ratePerSqft = useMemo(() => {
    const r = num((tenant as any)?.settings?.ratePerSqft);
    return r > 0 ? r : DEFAULT_RATE_PER_SQFT;
  }, [tenant]);

  // Lawn area returned by the server (null when no real number is available).
  const lawnSqft = result?.lawnSqft != null ? num(result.lawnSqft) : null;
  const hasArea = lawnSqft != null && lawnSqft > 0;

  // Suggested quote — user-overridable.
  const suggested = hasArea ? Math.round(lawnSqft * ratePerSqft * 100) / 100 : 0;
  const [quoteOverride, setQuoteOverride] = useState<string>("");
  const quoteAmount = quoteOverride !== "" ? num(quoteOverride) : suggested;

  const measure = async () => {
    const addr = address.trim();
    if (!addr) {
      showToast("Enter a property address first.", "warning");
      return;
    }
    setMeasuring(true);
    setError(null);
    setResult(null);
    setQuoteOverride("");
    try {
      const res = await fetchApi("/api/measure/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Measurement failed.");
      }
      setResult(data);
      if (data?.source === "unavailable") {
        showToast("No measurement provider configured.", "info");
      } else if (data?.lawnSqft != null && num(data.lawnSqft) > 0) {
        showToast("Property measured.", "success");
      } else {
        showToast("No measurable area returned.", "info");
      }
    } catch (e: any) {
      setError(e?.message || "Measurement failed.");
      showToast(e?.message || "Measurement failed.", "error");
    } finally {
      setMeasuring(false);
    }
  };

  const createEstimate = async () => {
    if (!hasArea || quoteAmount <= 0) {
      showToast("Nothing to quote yet.", "warning");
      return;
    }
    setCreating(true);
    try {
      const desc = `Lawn service (~${sqft(lawnSqft)} sqft)`;
      await invoicesRepo.create({
        amount: quoteAmount,
        items: [{ description: desc, quantity: 1, rate: quoteAmount }],
        status: "draft",
        data: {
          client: clientName.trim() || undefined,
          address: address.trim() || undefined,
          lawnSqft,
          ratePerSqft,
          source: result?.source,
          confidence: result?.confidence,
          origin: "instant-estimate",
        },
      });
      showToast("Draft estimate created.", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to create estimate.", "error");
    } finally {
      setCreating(false);
    }
  };

  const isAiEstimate = result?.source === "ai_estimate";
  const isUnavailable = result?.source === "unavailable";
  const isProvider = result?.source === "provider";

  return (
    <div className="space-y-8">
      {/* Input card */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
              Property Address
            </label>
            <div className="relative flex items-center">
              <MapPin size={16} className="absolute left-3.5 text-zinc-500 pointer-events-none" />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && measure()}
                placeholder="123 Oak St, Austin, TX"
                className="w-full bg-black/40 border border-white/10 rounded-xl h-12 pl-11 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-forest-500/50 focus:ring-2 focus:ring-forest-500/20 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
              Client Name <span className="text-zinc-600 normal-case font-bold tracking-normal">(optional)</span>
            </label>
            <div className="relative flex items-center">
              <User size={16} className="absolute left-3.5 text-zinc-500 pointer-events-none" />
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-black/40 border border-white/10 rounded-xl h-12 pl-11 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-forest-500/50 focus:ring-2 focus:ring-forest-500/20 transition-all"
              />
            </div>
          </div>
        </div>

        <button
          onClick={measure}
          disabled={measuring}
          className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest whitespace-nowrap bg-forest-500 text-white hover:bg-forest-600 transition-colors shadow-xl shadow-forest-500/20 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Ruler size={18} className={measuring ? "animate-pulse" : ""} />
          {measuring ? "Measuring…" : "Measure"}
        </button>

        <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
          Rate: <span className="text-forest-400 font-black">{money(ratePerSqft)}/sqft</span>{" "}
          {num((tenant as any)?.settings?.ratePerSqft) > 0 ? "(from workspace settings)" : "(default mowing rate)"}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-200 font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.source}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Unavailable — be honest: no provider, no number, no price. */}
            {isUnavailable && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 sm:p-8 space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest text-amber-400">
                  <Plug size={13} />
                  Provider Needed
                </div>
                <p className="text-sm text-zinc-300 font-medium leading-relaxed max-w-xl">
                  {result.message || "Automated property measurement needs a measurement provider."}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Configure a measurement provider key to enable survey-grade takeoff.
                </p>
              </div>
            )}

            {/* Measured / estimated area + suggested quote */}
            {(isAiEstimate || isProvider) && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 sm:p-8 space-y-7">
                {/* Source badge */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {isAiEstimate ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-[10px] font-black uppercase tracking-widest text-amber-400">
                      <Sparkles size={13} />
                      Rough AI Estimate
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forest-500/10 border border-forest-500/40 text-[10px] font-black uppercase tracking-widest text-forest-400">
                      <CheckCircle2 size={13} />
                      Provider Measurement
                    </div>
                  )}
                  {isAiEstimate && <ConfidenceDot level={result.confidence} />}
                </div>

                {hasArea ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Area */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                        <Ruler size={13} className="text-forest-400" />
                        Lawn Area
                      </div>
                      <p className="text-3xl font-black text-white italic tracking-tight">
                        {sqft(lawnSqft)} <span className="text-lg text-zinc-500">sqft</span>
                      </p>
                    </div>
                    {/* Suggested quote */}
                    <div className="rounded-xl border border-forest-500/20 bg-forest-500/5 p-5">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                        <DollarSign size={13} className="text-forest-400" />
                        Suggested Quote
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg text-zinc-500 font-black">$</span>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={quoteOverride !== "" ? quoteOverride : suggested}
                          onChange={(e) => setQuoteOverride(e.target.value)}
                          className="w-full bg-transparent text-3xl font-black text-forest-400 italic tracking-tight focus:outline-none border-b border-transparent focus:border-forest-500/40"
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1.5">
                        {sqft(lawnSqft)} sqft × {money(ratePerSqft)}/sqft — editable
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 font-medium">
                    {result.note || "No measurable area was returned for this address."}
                  </p>
                )}

                {/* Honesty note */}
                {result.note && (
                  <p className="text-[11px] text-zinc-500 leading-relaxed flex items-start gap-2">
                    <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    {result.note}
                  </p>
                )}

                {/* Create estimate */}
                {hasArea && (
                  <button
                    onClick={createEstimate}
                    disabled={creating || quoteAmount <= 0}
                    className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest whitespace-nowrap bg-white text-black hover:bg-zinc-200 transition-colors shadow-xl shadow-white/10 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <FileText size={18} />
                    {creating ? "Creating…" : `Create Estimate — ${money(quoteAmount)}`}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InstantEstimate;
