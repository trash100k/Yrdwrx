// @ts-nocheck
// SuggestedPalette — Phase 2 grounding for the Design Studio.
//
// Turns a USDA hardiness zone + a bed size into a zone-appropriate, PRICED plant
// palette the contractor can apply straight to their Design Studio placement.
//
// HONESTY POLICY
//  - Zone-fit, sun, deer pressure, native preference and "does it fit the bed" filtering
//    is delegated to the pure plantIntelligence layer (selectPlants).
//  - Quantities use a no-crowd square-packing estimate (noCrowdQuantity) at ~78% density.
//  - Pricing is DETERMINISTIC via estimateLineItems but is a BALLPARK retail + light
//    install estimate, NOT a quote — surfaced as a caption so nobody mistakes it for one.
//  - When no zone is set we still show picks (unfiltered) and nudge the user to set one.

import React, { useMemo, useState } from "react";
import { Leaf, DollarSign, Plus, Sun, Shield, Sprout, Info } from "lucide-react";
import { seedForZone } from "../../lib/plantCatalogSeed";
import {
  selectPlants,
  noCrowdQuantity,
  estimateLineItems,
} from "../../lib/plantIntelligence";
import { useTenant } from "../../contexts/TenantContext";

type SunOption =
  | "full_sun"
  | "part_sun"
  | "part_shade"
  | "full_shade";

interface SuggestedPaletteProps {
  zone?: number | null;
  defaultSun?: SunOption;
  onApply: (palette: {
    items: Array<{ item: any; qty: number }>;
    total: number;
    labels: string[];
  }) => void;
}

const SUN_OPTIONS: Array<{ value: SunOption; label: string }> = [
  { value: "full_sun", label: "Full Sun" },
  { value: "part_sun", label: "Part Sun" },
  { value: "part_shade", label: "Part Shade" },
  { value: "full_shade", label: "Full Shade" },
];

const MAX_PICKS = 5;

const money = (n: number) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(Number(n) || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

export default function SuggestedPalette({
  zone = null,
  defaultSun,
  onApply,
}: SuggestedPaletteProps) {
  const { tenant } = useTenant();

  const laborRate = useMemo(() => {
    const r = Number((tenant?.settings as any)?.laborRate);
    return Number.isFinite(r) && r > 0 ? r : 35;
  }, [tenant]);

  const [bedAreaSqft, setBedAreaSqft] = useState<number>(200);
  const [sun, setSun] = useState<SunOption>(defaultSun || "full_sun");
  const [nativeOnly, setNativeOnly] = useState<boolean>(false);
  const [deerPressure, setDeerPressure] = useState<boolean>(false);

  const hasZone = typeof zone === "number" && Number.isFinite(zone);

  // ---- compute the palette (pure, memoized on the inputs) -------------------
  const { rows, estimate } = useMemo(() => {
    const catalog = seedForZone(zone);
    const { picks } = selectPlants(catalog, {
      zone,
      sun,
      bedAreaSqft,
      deerPressure,
      nativeOnly,
    });

    // Keep only true plants for the palette (materials are placed separately in
    // the studio), then take the top ~5 best-scored picks.
    const plantPicks = picks
      .filter((p) => !p.kind || p.kind === "plant")
      .slice(0, MAX_PICKS);

    const computedRows = plantPicks.map((item) => {
      const spacingFt =
        typeof item.spacingFt === "number" && item.spacingFt > 0
          ? item.spacingFt
          : 4;
      const { recommended } = noCrowdQuantity(bedAreaSqft, spacingFt);
      const qty = Math.max(1, recommended || 0);
      return { item, qty };
    });

    const est = estimateLineItems(computedRows, laborRate);
    return { rows: computedRows, estimate: est };
  }, [zone, sun, bedAreaSqft, deerPressure, nativeOnly, laborRate]);

  // Map line items back to their rows for per-row display (same order).
  const lineByName = useMemo(() => {
    const m: Record<string, any> = {};
    for (const li of estimate.lineItems) m[li.name] = li;
    return m;
  }, [estimate]);

  const handleApply = () => {
    onApply({
      items: rows,
      total: estimate.total,
      labels: rows.map((r) => `${r.item.name}`),
    });
  };

  // ---------------------------------------------------------------------------
  return (
    <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-forest-500/20 bg-forest-500/10 text-forest-400 shrink-0">
          <Leaf size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black text-white italic tracking-tight uppercase leading-none">
            Suggested Palette
            {hasZone ? (
              <span className="text-forest-400"> — Zone {zone}</span>
            ) : null}
          </h3>
          <p className="micro-label font-black text-white/25 uppercase tracking-[0.3em] mt-1.5 text-[10px]">
            Zone-Aware · Priced
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 border-b border-white/10">
        {/* Bed area */}
        <label className="space-y-2">
          <span className="micro-label font-black text-white/30 uppercase tracking-[0.3em] text-[10px]">
            Bed Area (sq ft)
          </span>
          <input
            type="number"
            min={0}
            value={bedAreaSqft}
            onChange={(e) => {
              const n = Number(e.target.value);
              setBedAreaSqft(Number.isFinite(n) && n >= 0 ? n : 0);
            }}
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-white italic focus:outline-none focus:border-forest-500/50 transition-colors"
          />
        </label>

        {/* Sun */}
        <label className="space-y-2">
          <span className="micro-label font-black text-white/30 uppercase tracking-[0.3em] text-[10px] flex items-center gap-1.5">
            <Sun size={11} className="text-forest-400" />
            Sun Exposure
          </span>
          <select
            value={sun}
            onChange={(e) => setSun(e.target.value as SunOption)}
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-white italic uppercase focus:outline-none focus:border-forest-500/50 transition-colors"
          >
            {SUN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-black">
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {/* Toggles */}
        <Toggle
          icon={Sprout}
          label="Native Only"
          active={nativeOnly}
          onClick={() => setNativeOnly((v) => !v)}
        />
        <Toggle
          icon={Shield}
          label="Deer Pressure"
          active={deerPressure}
          onClick={() => setDeerPressure((v) => !v)}
        />
      </div>

      {/* Zone hint */}
      {!hasZone && (
        <div className="px-6 pt-5 flex items-start gap-2.5 text-[11px] text-white/40 font-bold leading-relaxed">
          <Info size={14} className="text-forest-400 shrink-0 mt-0.5" />
          <p>
            Set a USDA zone to tailor the palette to your climate. Showing common
            picks unfiltered for now.
          </p>
        </div>
      )}

      {/* Picks */}
      <div className="p-6 space-y-3">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs font-black uppercase tracking-widest text-white/25">
            No plants fit these conditions — relax a filter.
          </div>
        ) : (
          rows.map((r, i) => {
            const li = lineByName[r.item.name];
            const lineTotal = li ? li.lineTotal : 0;
            return (
              <div
                key={r.item.id || i}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-black border border-white/5 hover:border-forest-500/30 transition-colors group"
              >
                <span className="w-2 h-2 rounded-full bg-forest-400 shadow-glow shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white italic uppercase truncate group-hover:text-forest-400 transition-colors">
                    {r.item.name}
                  </p>
                  {r.item.botanicalName ? (
                    <p className="micro-label font-bold italic text-white/25 tracking-wide text-[10px] mt-0.5 truncate">
                      {r.item.botanicalName}
                    </p>
                  ) : null}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-white italic">
                    {money(lineTotal)}
                  </p>
                  <p className="micro-label font-black text-white/20 uppercase tracking-widest text-[9px] mt-0.5">
                    {r.qty} × {money(r.item.unitPrice || 0)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer total + apply */}
      <div className="p-6 border-t border-white/10 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-white/30">
            <span>Material {money(estimate.materialCost)}</span>
            <span className="text-white/15">·</span>
            <span>Labor {money(estimate.laborCost)}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-forest-400" />
            <span className="text-2xl font-black italic tracking-tighter leading-none text-white">
              {money(estimate.total)}
            </span>
          </div>
        </div>

        <button
          onClick={handleApply}
          disabled={rows.length === 0}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest border-4 border-transparent bg-forest-500/10 text-forest-400 hover:bg-forest-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          Apply To Design
        </button>

        <p className="flex items-start gap-2 text-[10px] text-white/30 font-bold leading-relaxed">
          <Info size={11} className="text-white/30 shrink-0 mt-0.5" />
          Prices are ballpark estimates (retail + light install @ ${laborRate}/hr),
          not a quote. Confirm with your local grower.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// small presentational pieces (kept local — component-only)
// ---------------------------------------------------------------------------

function Toggle({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-black uppercase tracking-widest transition-colors ${
        active
          ? "bg-forest-500/10 border-forest-500/30 text-forest-400"
          : "bg-black border-white/10 text-white/40 hover:text-white/70"
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon size={14} />
        {label}
      </span>
      <span
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          active ? "bg-forest-400 shadow-glow" : "bg-white/15"
        }`}
      />
    </button>
  );
}
