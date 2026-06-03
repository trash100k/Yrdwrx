// @ts-nocheck
import React from 'react';
import { useToast } from "../../contexts/ToastContext";

export default function AlertsWidget({ isReel, flexOrder }: { isReel: boolean, flexOrder?: number }) {
  const { showToast } = useToast();
  
  return (
    <div
      style={flexOrder !== undefined ? { order: flexOrder } : undefined}
      className={
        isReel
          ? "relative bg-zinc-950 border border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl space-y-6 flex flex-col justify-between w-[85vw] md:w-full md:w-[450px] max-w-full shrink-0 snap-start h-[500px]"
          : "bg-zinc-950 border border-white/5 rounded-2xl sm:rounded-2xl p-5 sm:p-8 shadow-2xl space-y-6 flex flex-col justify-between"
      }
    >
      <div className="space-y-1">
        <span className="text-xs md:text-[10px] font-bold text-amber-500 tracking-widest uppercase">
          System Compliance Pulse
        </span>
        <h4 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">
          Compliance Logs
        </h4>
      </div>

      <div className="space-y-4 my-2 flex-1 overflow-y-auto max-h-[200px] pr-1 custom-scrollbar">
        {[
          {
            type: "WEATHER_WARN",
            label: "Rain disrupt check",
            text: "Rain predicted near 2:00 PM. Schedule modifications advised.",
            level: "high",
          },
          {
            type: "FUEL_ALERT",
            label: "Low Fuel Signal",
            text: "Mower #4 reporting <11% fuel reserves.",
            level: "high",
          },
          {
            type: "HOA_WINDOW",
            label: "Noise restrictions warning",
            text: "Arbor Lakes quiet window requires electric mowers only today.",
            level: "medium",
          },
        ].map((alert, idx) => (
          <div
            key={idx}
            className="bg-zinc-900 border border-white/5 p-4 rounded-xl flex items-start gap-3 text-xs"
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${alert.level === "high" ? "bg-red-500 animate-pulse" : "bg-amber-500"}`}
            />
            <div className="space-y-1">
              <span className="text-xs md:text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                {alert.label}
              </span>
              <p className="text-zinc-300 font-semibold leading-normal">
                {alert.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() =>
          showToast(
            "Enriched local ordinances checked. Standard guidelines restored.",
          )
        }
        className="w-full py-3.5 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all font-sans"
      >
        Clear Safety Logs
      </button>
    </div>
  );
}
