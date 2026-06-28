// @ts-nocheck
import React from 'react';
import { useToast } from "../../contexts/ToastContext";

export default function AlertsWidget({ isReel, flexOrder, alerts }: { isReel: boolean, flexOrder?: number, alerts?: { type: string, label: string, text: string, level: string }[] }) {
  const { showToast } = useToast();
  const hasReal = Array.isArray(alerts);
  const SAMPLE = [
    { type: "WEATHER_WARN", label: "Rain disrupt check", text: "Rain predicted near 2:00 PM. Schedule modifications advised.", level: "high" },
    { type: "FUEL_ALERT", label: "Low Fuel Signal", text: "Mower #4 reporting <11% fuel reserves.", level: "high" },
    { type: "HOA_WINDOW", label: "Noise restrictions warning", text: "Arbor Lakes quiet window requires electric mowers only today.", level: "medium" },
  ];
  const items = hasReal ? alerts : SAMPLE;

  return (
    <div
      style={flexOrder !== undefined ? { order: flexOrder } : undefined}
      className={
        isReel
          ? "relative bg-zinc-950 border border-white/5 molten-edge rounded-2xl p-5 sm:p-8 shadow-2xl space-y-6 flex flex-col justify-between w-[85vw] md:w-[450px] max-w-full shrink-0 snap-start h-[500px]"
          : "bg-zinc-950 border border-white/5 molten-edge rounded-2xl sm:rounded-2xl p-5 sm:p-8 shadow-2xl space-y-6 flex flex-col justify-between"
      }
    >
      <div className="space-y-1">
        <span className="text-xs md:text-[10px] font-bold text-amber-500 tracking-widest uppercase">
          Operations Pulse
        </span>
        <div className="flex items-center gap-2">
          <h4 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">
            Action Items
          </h4>
          {hasReal ? (
            <span className="text-[9px] text-forest-400 font-bold bg-forest-500/10 border border-forest-500/20 px-2 py-0.5 rounded-md uppercase tracking-widest">Live</span>
          ) : (
            <span className="text-[9px] text-amber-400/80 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md uppercase tracking-widest">Sample</span>
          )}
        </div>
      </div>

      <div className="space-y-4 my-2 flex-1 overflow-y-auto max-h-[200px] pr-1 custom-scrollbar">
        {hasReal && items.length === 0 && (
          <div className="border border-dashed border-white/10 rounded-xl p-6 text-center h-full flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-forest-400">All clear</p>
            <p className="text-xs text-zinc-500 mt-1">No invoices overdue and no leads waiting.</p>
          </div>
        )}
        {items.map((alert, idx) => (
          <div
            key={idx}
            className="bg-zinc-900 border border-white/5 molten-edge p-4 rounded-xl flex items-start gap-3 text-xs"
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${alert.level === "high" ? "bg-red-500 animate-pulse" : "bg-amber-500"}`}
            />
            <div className="space-y-1 min-w-0">
              <span className="text-xs md:text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                {alert.label}
              </span>
              <p className="text-zinc-300 font-semibold leading-normal break-words">
                {alert.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {!hasReal && (
        <button
          onClick={() => showToast("Enriched local ordinances checked. Standard guidelines restored.")}
          className="w-full py-3.5 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all font-sans"
        >
          Clear Safety Logs
        </button>
      )}
    </div>
  );
}
