// @ts-nocheck
// Estimate Studio — fast, honest instant quoting from a property address.
//
// Hosts <InstantEstimate/>: type an address, get a (clearly-flagged) lawn area + a
// suggested quote, and spin up a draft invoice in one click. The heavy lifting and the
// honesty policy around measurement confidence live in the component itself.

import React from "react";
import { Ruler, Sparkles } from "lucide-react";
import { InstantEstimate } from "../components/InstantEstimate";

export default function EstimateStudio() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header block */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-forest-500/10 rounded-full border border-forest-500 text-xs font-black uppercase tracking-widest text-forest-400">
            <Ruler size={16} />
            Instant Estimate
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Estimate Studio
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Address In, Quote Out
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-black border border-white/5 text-xs font-black uppercase tracking-widest text-zinc-400">
          <Sparkles size={14} className="text-forest-400" />
          Confidence-Flagged
        </div>
      </header>

      <InstantEstimate />
    </div>
  );
}
