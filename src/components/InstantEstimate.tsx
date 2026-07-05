// @ts-nocheck
// InstantEstimate — address -> property measurement -> material takeoff -> draft estimate.
//
// HONESTY POLICY (important): this tool never pretends to have a survey-grade takeoff it
// doesn't have. The server (/api/measure/property) returns a normalized
//   { lawnSqft, bedSqft, hardscapeSqft, lotSqft, source, confidence, note }
// and we render the provenance truthfully:
//   - source === "provider"     -> a real parcel/measurement provider. Show a green badge +
//                                  the provider name + a confidence dot.
//   - source === "ai_estimate"  -> a Gemini guess. Loud amber "ROUGH AI ESTIMATE" badge +
//                                  confidence dot + the server note.
//   - source === "manual"       -> nothing configured; NO number invented. The operator
//                                  types the areas in by hand.
// Every returned area is EDITABLE — the measurement only prefills; the operator always
// overrides. Areas feed src/lib/takeoff.ts (sqftToQuantities / estimateLineItems) to derive
// orderable material quantities and priced line items, which become a DRAFT invoice.

import React, { useEffect, useMemo, useState } from "react";
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
  Layers,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { invoicesRepo } from "../lib/repos";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { sqftToQuantities, estimateLineItems } from "../lib/takeoff";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const DEFAULT_MOW_PER_SQFT = 0.02; // sensible default mowing rate ($/sqft)

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const money = (n: number) =>
  "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

const sqft = (n: number) =>
  Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

// value|null -> input string ("" for null/0)
const toStr = (v: any) => (v != null && Number(v) > 0 ? String(Math.round(Number(v))) : "");

// Small confidence indicator.
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

// Compact labelled numeric input used for both editable areas and rates.
function NumField({ label, suffix, value, onChange, step = "1", placeholder = "0" }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">{label}</label>
      <div className="relative flex items-center">
        <input
          type="number"
          min={0}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl h-11 pl-3.5 pr-14 text-sm font-bold text-white placeholder:text-zinc-600 focus:outline-none focus:border-forest-500/50 focus:ring-2 focus:ring-forest-500/20 transition-all"
        />
        {suffix && (
          <span className="absolute right-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
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

  // Editable measured areas (strings for the inputs). The measurement only PREFILLS these;
  // the operator can correct any of them (and must type them in the "manual" case).
  const [areas, setAreas] = useState({ lawnSqft: "", bedSqft: "", hardscapeSqft: "", lotSqft: "" });
  const setArea = (k: string) => (v: string) => setAreas((a) => ({ ...a, [k]: v }));

  // Unit rates — default from workspace settings, overridable inline. A priced line only
  // appears when its rate is > 0 (see takeoff.estimateLineItems), so mulch/sod stay hidden
  // until a rate is entered rather than double-counting the lawn.
  const s = (tenant as any)?.settings || {};
  const [rates, setRates] = useState({
    mowPerSqft: String(num(s.ratePerSqft) || DEFAULT_MOW_PER_SQFT),
    mulchPerYard: s.mulchPerYard ? String(num(s.mulchPerYard)) : "",
    sodPerSqft: s.sodPerSqft ? String(num(s.sodPerSqft)) : "",
  });
  const setRate = (k: string) => (v: string) => setRates((r) => ({ ...r, [k]: v }));

  // Prefill editable areas whenever a fresh measurement lands.
  useEffect(() => {
    if (!result) return;
    setAreas({
      lawnSqft: toStr(result.lawnSqft),
      bedSqft: toStr(result.bedSqft),
      hardscapeSqft: toStr(result.hardscapeSqft),
      lotSqft: toStr(result.lotSqft),
    });
  }, [result]);

  // Build the takeoff Measurement + derived quantities/line items from the editable state.
  const measurement = useMemo(
    () => ({
      lawnSqft: num(areas.lawnSqft),
      bedSqft: num(areas.bedSqft),
      hardscapeSqft: num(areas.hardscapeSqft),
      lotSqft: num(areas.lotSqft),
    }),
    [areas],
  );
  const quantities = useMemo(() => sqftToQuantities(measurement), [measurement]);
  const lineItems = useMemo(
    () =>
      estimateLineItems(measurement, {
        mowPerSqft: num(rates.mowPerSqft),
        mulchPerYard: num(rates.mulchPerYard),
        sodPerSqft: num(rates.sodPerSqft),
      }),
    [measurement, rates],
  );
  const computedTotal = useMemo(
    () => Math.round(lineItems.reduce((t, li) => t + num(li.amount), 0) * 100) / 100,
    [lineItems],
  );

  const [totalOverride, setTotalOverride] = useState<string>("");
  const total = totalOverride !== "" ? num(totalOverride) : computedTotal;

  const hasAnyArea = measurement.lawnSqft > 0 || measurement.bedSqft > 0;

  const measure = async () => {
    const addr = address.trim();
    if (!addr) {
      showToast("Enter a property address first.", "warning");
      return;
    }
    setMeasuring(true);
    setError(null);
    setResult(null);
    setTotalOverride("");
    try {
      const res = await fetchApi("/api/measure/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Measurement failed.");
      setResult(data);
      if (data?.source === "provider") showToast("Property measured from parcel data.", "success");
      else if (data?.source === "ai_estimate") showToast("Rough AI estimate ready — verify the areas.", "info");
      else showToast("Enter the areas manually — no measurement provider configured.", "info");
    } catch (e: any) {
      setError(e?.message || "Measurement failed.");
      showToast(e?.message || "Measurement failed.", "error");
    } finally {
      setMeasuring(false);
    }
  };

  const createEstimate = async () => {
    if (lineItems.length === 0 || total <= 0) {
      showToast("Enter at least one area and rate to quote.", "warning");
      return;
    }
    setCreating(true);
    try {
      await invoicesRepo.create({
        amount: total,
        items: lineItems.map((li) => ({ description: li.description, quantity: li.quantity, rate: li.rate })),
        status: "draft",
        data: {
          client: clientName.trim() || undefined,
          address: address.trim() || undefined,
          measurement,
          quantities,
          source: result?.source,
          confidence: result?.confidence,
          provider: result?.provider || undefined,
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

  const isProvider = result?.source === "provider";
  const isAiEstimate = result?.source === "ai_estimate";
  const isManual = result && !isProvider && !isAiEstimate;

  return (
    <div className="space-y-8">
      {/* Input card */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Property Address</label>
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
            className="rounded-2xl border border-white/10 bg-black/30 p-6 sm:p-8 space-y-7"
          >
            {/* Provenance badge — honest about where the number came from. */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              {isProvider && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forest-500/10 border border-forest-500/40 text-[10px] font-black uppercase tracking-widest text-forest-400">
                  <CheckCircle2 size={13} />
                  Provider Measurement{result.provider ? ` · ${result.provider}` : ""}
                </div>
              )}
              {isAiEstimate && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-[10px] font-black uppercase tracking-widest text-amber-400">
                  <Sparkles size={13} />
                  Rough AI Estimate
                </div>
              )}
              {isManual && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-500/10 border border-zinc-500/30 text-[10px] font-black uppercase tracking-widest text-zinc-300">
                  <Plug size={13} />
                  Manual Entry
                </div>
              )}
              {(isProvider || isAiEstimate) && <ConfidenceDot level={result.confidence} />}
            </div>

            {result.note && (
              <p className="text-[11px] text-zinc-500 leading-relaxed flex items-start gap-2">
                <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                {result.note}
              </p>
            )}

            {/* Editable areas — prefilled from the measurement, always overridable. */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <Ruler size={13} className="text-forest-400" />
                Measured Areas <span className="text-zinc-600 normal-case font-bold tracking-normal">(editable)</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <NumField label="Lawn" suffix="sqft" value={areas.lawnSqft} onChange={setArea("lawnSqft")} />
                <NumField label="Beds" suffix="sqft" value={areas.bedSqft} onChange={setArea("bedSqft")} />
                <NumField label="Hardscape" suffix="sqft" value={areas.hardscapeSqft} onChange={setArea("hardscapeSqft")} />
                <NumField label="Lot" suffix="sqft" value={areas.lotSqft} onChange={setArea("lotSqft")} />
              </div>
            </div>

            {hasAnyArea && (
              <>
                {/* Material takeoff quantities (from takeoff.sqftToQuantities). */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <Layers size={13} className="text-forest-400" />
                    Material Takeoff
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                      { label: "Mulch", val: `${quantities.mulchCubicYards}`, unit: "cu yd" },
                      { label: "Sod", val: sqft(quantities.sodSqft), unit: "sqft" },
                      { label: "Seed", val: `${quantities.seedLbs}`, unit: "lb" },
                      { label: "Fertilizer", val: `${quantities.fertilizerLbs}`, unit: "lb" },
                      { label: "Edging", val: sqft(quantities.edgingLinearFtEstimate), unit: "lf" },
                    ].map((q) => (
                      <div key={q.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">{q.label}</div>
                        <p className="text-lg font-black text-white italic tracking-tight leading-none">
                          {q.val} <span className="text-[10px] text-zinc-500 not-italic">{q.unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unit rates — inline overridable; a line shows only when its rate > 0. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <NumField label="Mow rate" suffix="$/sqft" step="0.001" value={rates.mowPerSqft} onChange={setRate("mowPerSqft")} />
                  <NumField label="Mulch rate" suffix="$/yd" step="0.01" value={rates.mulchPerYard} onChange={setRate("mulchPerYard")} />
                  <NumField label="Sod rate" suffix="$/sqft" step="0.01" value={rates.sodPerSqft} onChange={setRate("sodPerSqft")} />
                </div>

                {/* Priced line items (from takeoff.estimateLineItems). */}
                <div className="rounded-xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
                          <th className="text-left p-3.5">Service</th>
                          <th className="text-right p-3.5">Qty</th>
                          <th className="text-right p-3.5">Rate</th>
                          <th className="text-right p-3.5">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-xs text-zinc-500 font-medium">
                              Enter a rate above to price a service.
                            </td>
                          </tr>
                        ) : (
                          lineItems.map((li) => (
                            <tr key={li.description} className="border-b border-white/5 last:border-0">
                              <td className="p-3.5 font-bold text-zinc-200">{li.description}</td>
                              <td className="p-3.5 text-right text-zinc-400 tabular-nums">{sqft(li.quantity)}</td>
                              <td className="p-3.5 text-right text-zinc-400 tabular-nums">{money(li.rate)}</td>
                              <td className="p-3.5 text-right font-black text-white tabular-nums">{money(li.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total (overridable) + create. */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                  <div className="rounded-xl border border-forest-500/20 bg-forest-500/5 p-5 min-w-[200px]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Estimate Total</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg text-zinc-500 font-black">$</span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={totalOverride !== "" ? totalOverride : computedTotal}
                        onChange={(e) => setTotalOverride(e.target.value)}
                        className="w-full bg-transparent text-3xl font-black text-forest-400 italic tracking-tight focus:outline-none border-b border-transparent focus:border-forest-500/40"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1.5">Auto-summed from line items — editable.</p>
                  </div>
                  <button
                    onClick={createEstimate}
                    disabled={creating || lineItems.length === 0 || total <= 0}
                    className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest whitespace-nowrap bg-white text-black hover:bg-zinc-200 transition-colors shadow-xl shadow-white/10 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <FileText size={18} />
                    {creating ? "Creating…" : `Create Estimate — ${money(total)}`}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InstantEstimate;
