
import React, { useState, useEffect } from "react";
import {
  Search,
  ShieldAlert,
  BadgeInfo,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Package,
  Star,
  ShieldCheck,
  Zap,
  Ghost,
  Eye,
  Info,
  Brain,
  Activity,
  Clock,
  Check,
  Network,
  Cpu,
  Globe,
  Rocket,
  Target,
  Shield,
  Workflow,
  Layers,
  Box,
  Cpu as Processor,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "../contexts/ToastContext";

const painPoints = [
  {
    category: "Residential Churn",
    icon: Ghost,
    color: "bg-amber-500",
    items: [
      {
        title: "The 'Ghosting' Pandemic",
        detail:
          "62% of homeowners report contractors stop responding mid-project.",
        solution: "Automated AI Follow-ups",
      },
      {
        title: "Surprise Billing",
        detail: "Hidden fees cause 40% of negative reviews.",
        solution: "Digital Itemized Estimates",
      },
      {
        title: "Property Damage",
        detail: "Sprinklers and gates are the top liability claims.",
        solution: "GPS Job Exit Checklist",
      },
    ],
  },
  {
    category: "Enterprise/Commercial",
    icon: ShieldCheck,
    color: "bg-blue-600",
    items: [
      {
        title: "Lack of Proactive Care",
        detail:
          "Commercial managers cancel contracts because they don't 'see' the value beyond mowing.",
        solution: "Weekly AI Video/Photo Reports",
      },
      {
        title: "Security Liability",
        detail: "HOA boards fear unidentified crews on property.",
        solution: "Crew ID & Verified Background Badges",
      },
      {
        title: "Scope Creep",
        detail:
          "Doing 'favors' for managers costs $10k+ in unbilled labor annually.",
        solution: "One-Tap 'Change Order' Log",
      },
    ],
  },
  {
    category: "The HOA Battleground",
    icon: ShieldAlert,
    color: "bg-purple-600",
    items: [
      {
        title: "The 500-Boss Problem",
        detail:
          "Every resident thinks they are the crew's boss. 70% of technician stress comes from resident interruptions.",
        solution: "Resident-Facing 'Next Visit' Portal",
      },
      {
        title: "Invisible Value",
        detail:
          "Boards fire landscapers because they 'don't see them working'.",
        solution: "GPS Presence Heatmaps & Digital Sign-off",
      },
      {
        title: "The 'Favor' Drain",
        detail:
          "Verbal requests for 'just one quick limb' cause $5k+ in unbilled annual labor.",
        solution: "Mobile Change-Order Capture",
      },
    ],
  },
  {
    category: "The Profit Leaks",
    icon: Zap,
    color: "bg-red-500",
    items: [
      {
        title: "The '10-Minute' Tax",
        detail:
          "Losing 10 mins per property across 5 crews is a $32k/yr bottom-line hit.",
        solution: "Route Density & Sync Optimization",
      },
      {
        title: "The 'Parts Run' Trap",
        detail:
          "Average crew loses 3.2 hours a week at hardware stores for minor bits.",
        solution: "Automated Kit Inventory Sync",
      },
      {
        title: "Fuel Shrinkage",
        detail: "15% of fuel spend is often 'off-route' or theft.",
        solution: "GPS Fuel Monitoring Integrations",
      },
    ],
  },
];

const strategicLayers = [
  {
    id: "ingestion",
    title: "Data Ingestion (The Eyes)",
    icon: Eye,
    focus: "Vision AI & IoT",
    desc: "Every crew visit is a multi-spectral scan. We don't just mow; we index. Soil pH, equipment tracking, gate security, and botanical health are streamed in real-time.",
    result: "Eliminates the 'Blind Spot' of traditional field labor.",
  },
  {
    id: "logic",
    title: "The Logic Engine (The Brain)",
    icon: Brain,
    focus: "Predictive Valuation",
    desc: "Cutty processes field data against regional real-estate benchmarks to calculate 'Curb Appeal Lift'. We convert mulch into equity, presenting clients with investment ROI, not bills.",
    result: "Turns a commodity service into a financial asset management tool.",
  },
  {
    id: "logistics",
    title: "Logistics Nexus (The Muscle)",
    icon: Network,
    focus: "Dynamic Proximity",
    desc: "Our scheduler isn't a calendar; it's a swarm-optimizer. It re-routes fleets in milliseconds based on weather shifts, supply availability, and emergency neighbor requests.",
    result: "Achieves 100% density, maximizing profit per linear mile.",
  },
  {
    id: "capture",
    title: "Market Capture (The Colony)",
    icon: Globe,
    focus: "Satellite Dominance",
    desc: "The Property Scout identifies the 'Gold Coast' of unserved accounts. It automates high-trust broadcasts to neighbors of current high-value jobs, creating service monopolies.",
    result:
      "Aggressive, low-cost expansion through social and structural proximity.",
  },
];

export default function MarketInsights() {
  const { showToast } = useToast();
  const [activeSegment, setActiveSegment] = useState(0);
  const [leakResult, setLeakResult] = useState<number | null>(null);
  const [crews, setCrews] = useState(3);
  const [properties, setProperties] = useState(15);

  const calculateLeak = () => {
    // 10 mins lost per property * properties * crews * 5 days * 52 weeks * $45/hr (avg rate)
    const annualLoss = (10 / 60) * properties * crews * 5 * 52 * 45;
    setLeakResult(Math.round(annualLoss));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-20 pb-40">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500 text-xs font-black uppercase tracking-widest text-emerald-500">
            <Brain size={16} />
            Market Intelligence Platform
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Operational Analytics
          </h1>
          <p className="max-w-2xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            Data-driven insights into regional performance and site compliance.
          </p>
        </div>

        <div className="flex bg-black p-4 rounded-[32px] border-4 border-white/10 shrink-0 shadow-inner">
          <div className="flex items-center gap-10 px-8 py-2">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 italic">
                Network Index
              </span>
              <span className="text-4xl font-black italic tracking-tighter text-white">
                v2.0.4
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-16 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-purple-500/10 text-purple-400 rounded-full micro-label font-black border border-purple-500/20 shadow-inner">
              <ShieldAlert size={16} />
              Conflict Resolution Algorithm
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-white mt-10 mb-6 tracking-tighter italic leading-none">
              The Resident <br /> Ghosting Metric.
            </h2>
            <p className="text-zinc-300 font-bold text-lg mb-12 italic leading-relaxed">
              When a resident interrupts field labor, operational momentum is
              lost. Calculated annually, this "Chat Tax" is the single largest
              hidden deficit in residential landscaping.
            </p>

            <div className="space-y-10">
              <div className="space-y-4">
                <div className="flex justify-between items-center micro-label text-zinc-500 font-black uppercase tracking-widest">
                  <span id="pulse-intensity-label">Pulse Intensity</span>
                  <span className="text-purple-400">
                    {crews * 10} hits / week
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={crews * 10}
                  aria-labelledby="pulse-intensity-label"
                  onChange={(e) =>
                    setCrews(
                      Math.max(1, Math.floor(parseInt(e.target.value) / 10)),
                    )
                  }
                  className="w-full accent-purple-500 h-2 bg-white/5 rounded-full appearance-none cursor-pointer border-4 border-white/10"
                />
              </div>
            </div>
          </div>

          <div className="mt-16 relative z-10">
            <div className="bg-black/40 border-4 border-white/10 rounded-[40px] p-10 text-center shadow-2xl relative overflow-hidden group/box">
              <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover/box:opacity-100 transition-opacity" />
              <p className="micro-label font-black text-purple-400 uppercase tracking-[0.3em] mb-3 relative">
                Annual Labor Leak Identification
              </p>
              <p className="text-7xl lg:text-8xl font-black text-white italic tracking-tighter relative">
                ${(crews * 10 * 0.2 * 52 * 45).toLocaleString()}
              </p>
              <p className="micro-label font-black text-white/20 mt-6 relative tracking-widest">
                NEURAL SOLUTION: RESIDENT-FACING BIOMETRIC PORTAL
              </p>
            </div>
          </div>
        </section>

        <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-16 flex flex-col justify-center items-center text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="w-24 h-24 bg-white rounded-[32px] shadow-2xl flex items-center justify-center text-black mb-10 group-hover:scale-110 transition-transform duration-700 relative z-10">
            <TrendingUp size={48} />
          </div>
          <h3 className="text-4xl font-black text-white mb-6 italic tracking-tighter relative z-10 leading-none">
            HOA Retainability <br /> Invariant.
          </h3>
          <p className="text-white/40 font-bold text-lg mb-14 max-w-sm italic leading-relaxed relative z-10">
            Contracts are won on price but <strong>secured</strong> on
            transparency. Cutty transforms your workforce into a 100% visible
            operational grid.
          </p>
          <div className="grid grid-cols-2 gap-6 w-full relative z-10">
            {[
              { label: "Contract Integrity", val: "94%" },
              { label: "Dispute Reduction", val: "-62%" },
              { label: "Liability Mitigation", val: "-45%" },
              { label: "Trust Delta", val: "MAX" },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/5 p-6 rounded-[28px] border-4 border-white/10 shadow-xl transition-all hover:bg-white/10 hover:scale-105 active:scale-95 group/stat"
              >
                <p className="text-3xl font-black text-white italic tracking-tighter mb-1">
                  {stat.val}
                </p>
                <p className="micro-label opacity-30 font-black uppercase tracking-widest text-emerald-400 group-hover/stat:opacity-100 transition-opacity">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
        {painPoints.map((segment, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 1 }}
            className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 flex flex-col group hover:border-blue-500/50 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[40px] -mr-16 -mt-16 group-hover:bg-white/10 transition-all" />
            <div className="flex items-center gap-5 mb-10 relative">
              <div
                className={`w-14 h-14 ${segment.color} rounded-[22px] flex items-center justify-center text-black font-black shadow-2xl group-hover:scale-110 transition-transform duration-500`}
              >
                <segment.icon size={28} />
              </div>
              <h2 className="text-2xl font-black text-white italic tracking-tighter lowercase leading-none">
                {segment.category}
              </h2>
            </div>

            <div className="space-y-10 flex-1 relative">
              {segment.items.map((item, i) => (
                <div key={i} className="space-y-3 group/item">
                  <h3 className="font-black text-white text-base tracking-tight uppercase leading-snug group-hover/item:text-emerald-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-zinc-400 font-bold italic leading-relaxed group-hover/item:text-zinc-300 transition-colors">
                    "{item.detail}"
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-2xl">
                      <ShieldCheck
                        size={12}
                        className="text-emerald-400 shadow-glow"
                      />
                    </div>
                    <span className="micro-label font-black uppercase text-emerald-400 tracking-[0.2em] group-hover/item:translate-x-1 transition-transform">
                      {item.solution}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-16 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
        <header className="mb-16 relative z-10">
          <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-blue-500/10 text-blue-400 rounded-full micro-label font-black border border-blue-500/20 shadow-inner mb-6">
            <Globe size={16} />
            Regional Opportunity Heatmap
          </div>
          <h2 className="text-5xl font-black italic tracking-tighter text-white leading-none mb-6">
            Neural Domain <br /> Expansion Grid.
          </h2>
          <p className="text-zinc-400 font-bold text-xl italic max-w-2xl leading-snug">
            Every block in Meridian is indexed by service density. Cutty
            prioritizes "Blue Ocean" neighborhoods where legacy contractors have
            &gt;40% churn rates.
          </p>
        </header>

        <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-2 relative z-10">
          {Array.from({ length: 48 }).map((_, i) => {
            const intensity = ((i * 17) % 100) / 100; // Deterministic intensity
            const isTarget = intensity > 0.85;
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg border transition-all duration-300 cursor-default group/node relative ${
                  isTarget
                    ? "bg-emerald-500 border-emerald-400"
                    : intensity > 0.5
                      ? "bg-white/10 border-white/10"
                      : "bg-white/5 border-white/10 opacity-40"
                }`}
              >
                {isTarget && (
                  <div className="absolute inset-0 bg-white/20 rounded-lg pointer-events-none" />
                )}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-4 bg-black border-4 border-white/10 rounded-2xl opacity-0 group-hover/node:opacity-100 transition-opacity z-20 pointer-events-none w-48 shadow-2xl">
                  <p className="micro-label font-black text-white/40 uppercase tracking-widest mb-2 italic">
                    Sector {Math.floor(i / 4)}-{i % 4}
                  </p>
                  <p className="text-sm font-black text-white italic mb-1 uppercase tracking-tight">
                    {isTarget ? "Opportunity" : "Stable Region"}
                  </p>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                    ROI: +{Math.floor(intensity * 40)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-glow" />
            <span className="micro-label font-black text-white/40 uppercase tracking-widest italic">
              High Conversion Target
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-white/10 rounded-full" />
            <span className="micro-label font-black text-white/40 uppercase tracking-widest italic">
              Established Domain
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-white/5 rounded-full" />
            <span className="micro-label font-black text-white/40 uppercase tracking-widest italic">
              Low Density Hub
            </span>
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-16 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row items-center gap-16 relative z-10">
          <div className="flex-1 space-y-8 text-center md:text-left">
            <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-black text-emerald-400 rounded-full micro-label font-black border-4 border-white/10 shadow-inner">
              <Zap size={16} className="text-amber-400" />
              Live Action Plan
            </div>
            <h2 className="text-5xl lg:text-6xl font-black text-white leading-[0.9] tracking-tighter italic">
              The "Fort Knox" <br /> Service Protocol.
            </h2>
            <p className="text-white/40 font-bold text-xl italic leading-relaxed">
              To eliminate the #1 reason for churn—Lack of Trust—Cutty enforces
              the <strong>Closed-Gate Protocol</strong>. Technicians must upload
              a timestamped biometric verification of the secured gate before
              job completion.
            </p>
            <button
              onClick={() =>
                showToast(
                  "Security Lock Protocol Enabled: Closed-Gate Verification now MANDATORY for all community jobs.",
                )
              }
              className="bg-white text-black px-12 py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.3em] shadow-[0_40px_80px_rgba(255,255,255,0.1)] active:scale-95 transition-all hover:scale-105"
            >
              Enable Security Lock
            </button>
          </div>
          <div className="flex-1 w-full relative group/audit">
            <div className="aspect-square bg-zinc-900 rounded-[40px] border-4 border-white/10 overflow-hidden flex items-center justify-center p-16 shadow-inner group-hover/audit:border-emerald-500/30 transition-all duration-700">
              <div className="w-full bg-black/60 rounded-[32px] shadow-2xl border-4 border-white/10 p-10 space-y-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60" />
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-white border-4 border-white/10 shadow-inner">
                      <Clock size={20} />
                    </div>
                    <span className="micro-label font-black uppercase tracking-[0.2em] opacity-40">
                      Post-Job Audit
                    </span>
                  </div>
                  <span className="px-4 py-1.5 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-black border border-amber-500/20 animate-pulse">
                    PENDING_SYNC
                  </span>
                </div>
                <div className="aspect-[4/3] bg-zinc-900 rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center gap-6 group cursor-pointer hover:bg-zinc-900 hover:border-emerald-500/50 transition-all relative group/photo">
                  <ShieldAlert
                    size={48}
                    className="text-white/10 group-hover/photo:text-emerald-500 transition-colors"
                  />
                  <span className="micro-label font-black uppercase tracking-[0.3em] text-white/20 group-hover/photo:text-white transition-colors">
                    Capture Gate Scan
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-6 relative">
                  <div className="p-5 bg-white/5 rounded-2xl border-4 border-white/10 shadow-inner">
                    <p className="micro-label opacity-20 font-black tracking-widest uppercase mb-1">
                      Timestamp
                    </p>
                    <p className="text-sm font-black italic">14:22:08:92</p>
                  </div>
                  <div className="p-5 bg-white/5 rounded-2xl border-4 border-white/10 shadow-inner">
                    <p className="micro-label opacity-20 font-black tracking-widest uppercase mb-1">
                      GPS Delta
                    </p>
                    <p className="text-sm font-black italic">± 0.2m</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-emerald-500 rounded-full blur-[80px] opacity-10 animate-pulse" />
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl rounded-[40px] p-16 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        <div className="flex flex-col lg:flex-row gap-20 items-center relative z-10">
          <div className="flex-1 space-y-10">
            <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-white/5 text-emerald-400 rounded-full micro-label font-black border-4 border-white/10 shadow-inner">
              <Eye size={16} />
              Service Proximity Cluster
            </div>
            <h2 className="text-6xl font-black italic tracking-tighter leading-[0.8] sf-text-gradient cursor-default">
              Property <br /> Scout.
            </h2>
            <p className="text-white/40 font-bold text-xl leading-relaxed max-w-lg italic">
              Cutty identifies high-yield clusters in Meridian. On job
              completion, the system automates discovery broadcasts to verified
              adjacent accounts.
            </p>
            <div className="space-y-6">
              <div className="flex items-center gap-6 p-6 bg-zinc-900 rounded-[32px] border-4 border-white/10 shadow-2xl hover:bg-white/10 transition-all cursor-default">
                <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-inner">
                  <Star size={28} />
                </div>
                <div>
                  <p className="text-lg font-black text-white italic tracking-tight uppercase leading-none mb-1">
                    Segment Priority: Alpha
                  </p>
                  <p className="micro-label opacity-30 font-black tracking-widest uppercase">
                    Target Unit Potential: CRITICAL
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 p-6 bg-zinc-900 rounded-[32px] border-4 border-white/10 shadow-2xl hover:bg-white/10 transition-all cursor-default">
                <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-inner">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <p className="text-lg font-black text-white italic tracking-tight uppercase leading-none mb-1">
                    Trust Barrier: ABSOLUTE
                  </p>
                  <p className="micro-label opacity-30 font-black tracking-widest uppercase">
                    Credentialed Agents Only
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:w-[500px] space-y-6">
            <div className="bg-black/60 rounded-[32px] p-12 text-white relative h-[400px] flex flex-col justify-end overflow-hidden group shadow-2xl border-4 border-white/10">
              <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&q=80&w=1000')] bg-cover bg-center group-hover:scale-125 transition-transform duration-[3000ms] grayscale" />
              <div className="relative z-10">
                <p className="micro-label font-black text-emerald-400 uppercase tracking-[0.4em] mb-4">
                  Autonomous Pulse Dispatch
                </p>
                <h3 className="text-3xl font-black italic tracking-tighter leading-snug">
                  "I'm at the Gable Estate now. Protocol allows a health scan of
                  your site while I'm on location. Engage?"
                </h3>
              </div>
            </div>
            <div className="bg-white text-black rounded-[32px] p-12 shadow-[0_40px_100px_rgba(255,255,255,0.1)] group/stat relative overflow-hidden">
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover/stat:opacity-100 transition-opacity" />
              <h4 className="text-7xl font-black italic tracking-tighter mb-2 relative z-10 leading-none">
                3.2x
              </h4>
              <p className="micro-label font-black uppercase tracking-[0.4em] opacity-40 relative z-10">
                Conversion Lift in HNW Zones
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-16 relative overflow-hidden">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16 relative z-10">
          <div>
            <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-white rounded-full micro-label font-black border-4 border-white/10 shadow-2xl text-black mb-6">
              <Brain size={16} className="text-emerald-600" />
              Intelligence Sentinel
            </div>
            <h2 className="text-6xl font-black italic tracking-tighter leading-[0.8] sf-text-gradient cursor-default lowercase">
              Strategic <br /> Horizon.
            </h2>
          </div>
          <p className="text-white/30 font-bold text-xl max-w-xs text-right hidden md:block italic leading-tight">
            Projecting the collision of field labor and autonomous
            infrastructure.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
          {/* Industry 2027 Checklist */}
          <div className="bg-zinc-900 rounded-[32px] p-12 border-4 border-white/10 shadow-inner group">
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-3xl font-black text-white italic tracking-tighter lowercase leading-none">
                Operational Trends
              </h3>
              <div className="px-4 py-1.5 bg-white text-black rounded-full micro-label font-black scale-90">
                20 SCAN_PTS
              </div>
            </div>
            <div className="space-y-4 max-h-[600px] overflow-auto pr-4 custom-scrollbar">
              {[
                "Fully Autonomous Mowing Fleets",
                "Smart Irrigation via Local Weather Micro-patterns",
                "Carbon-Neutral Service Certification",
                "Predictive Pest Outbreak Prevention",
                "AR-Guided Crew Training & Site Prep",
                "Direct-to-Board Real-time Governance Portals",
                "Algorithmic Dynamic Pricing for Storm Events",
                "IoT-Enabled Real-time Tool Tracking",
                "Soil Microbiome Data-as-a-Service",
                "Drone-based Property Scan Valuation",
                "Hyper-local Native Bio-fencing Implementation",
                "Zero-noise Displacement Ordinance Compliance",
                "Predictive Crew Retention Behavior Models",
                "Automated Just-in-Time Material Procurement",
                "Smart HOA Covenant Enforcement Sensors",
                "Digital Twin Property Simulations for Design",
                "Gamified Sustainable Landscape Incentives",
                "AI-Negotiated Vendor & Supply Contracts",
                "Real-time Equity Impact Reporting for Clients",
                "Cross-Neighbor Resource Sharing Optimizers",
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-5 bg-zinc-900 rounded-2xl border-4 border-white/10 transition-all hover:bg-white/5 hover:translate-x-2 cursor-pointer group/line"
                >
                  <div className="w-6 h-6 rounded-lg border-2 border-white/10 flex items-center justify-center group-hover/line:bg-emerald-500 group-hover/line:border-emerald-500 transition-all">
                    <Check
                      size={14}
                      className="text-black opacity-0 group-hover/line:opacity-100"
                    />
                  </div>
                  <span className="text-sm font-black italic text-white/40 group-hover/line:text-white transition-colors">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Seasonal Sync Milestones */}
          <div className="bg-emerald-500 rounded-[32px] p-12 text-black relative overflow-hidden shadow-[0_40px_100px_rgba(16,185,129,0.2)] group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none opacity-50" />
            <div className="flex items-center justify-between mb-12 relative z-10">
              <h3 className="text-3xl font-black italic tracking-tighter lowercase leading-none">
                Seasonal Milestones
              </h3>
              <div className="px-4 py-1.5 bg-black text-white rounded-full micro-label font-black scale-90">
                20 NODES
              </div>
            </div>
            <div className="space-y-4 relative z-10 max-h-[600px] overflow-auto pr-4 custom-scrollbar dark-scrollbar">
              {[
                "Pre-Spring Soil Health Indexing",
                "Q1 Equipment Stress Testing & Calibration",
                "Early Season Labor Demand Capacity Locking",
                "Spring Flush Growth Regulation Protocols",
                "Peak Growth Schedule Dynamic Rebalancing",
                "Q2 Quality Control Audit Sprints",
                "Summer Drought Mitigation Activation",
                "Mid-Season Site Performance Deep-Dive",
                "High-Heat Emergency Crew Safety Shift",
                "Fall Transition Material Staging Audit",
                "Q3 Inventory Reconciliation & ROI Check",
                "Leaf Management Route Optimization",
                "Winterization Structural Site Hardening",
                "Q4 Financial Integrity & Leak Audit",
                "Next-Year Strategic Asset Acquisition",
                "Off-Season Advanced Skill Upgrading",
                "Holiday Service Logistical Optimization",
                "Deep System Architecture Integrity Clean",
                "Annual Client Value & Growth Reporting",
                "Regional Strategic Master Planning V.3",
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-5 bg-black/[0.05] rounded-2xl border border-black/5 hover:bg-black/10 transition-all cursor-pointer group/milestone"
                >
                  <div className="w-6 h-6 rounded-lg border-2 border-black/20 flex items-center justify-center group-hover/milestone:bg-black group-hover/milestone:border-black transition-all">
                    <Star
                      size={14}
                      className="text-emerald-400 opacity-0 group-hover/milestone:opacity-100"
                    />
                  </div>
                  <span className="text-sm font-black italic text-black/60 group-hover/milestone:text-black transition-colors">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Google-Grade Strategic Blueprint Section */}
      <section className="bg-white text-black rounded-[40px] p-20 relative overflow-hidden shadow-[0_60px_150px_rgba(255,255,255,0.1)] border border-white/20 group">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[150px] -mr-60 -mt-60 animate-pulse" />

        <header className="relative z-10 space-y-8 mb-24">
          <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-black text-white rounded-full micro-label font-black border border-black/10 shadow-2xl tracking-[0.3em]">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              <div className="w-2 h-2 bg-yellow-400 rounded-full" />
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
            Strategic Alpha: The Google Methodology
          </div>
          <h2 className="text-8xl font-black italic tracking-tighter leading-[0.8] max-w-5xl">
            Landscaping as a <br /> Digital Asset Class.
          </h2>
          <p className="text-black/40 text-2xl font-bold max-w-3xl leading-snug italic">
            What would Google do? They would treat your service area as a
            **logistical data grid**. This is the self-driving empire blueprint.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-20 relative z-10">
          <div className="space-y-10 group/sec">
            <h3 className="text-emerald-600 font-black text-sm uppercase tracking-[0.4em] border-b-2 border-black/5 pb-6">
              The Focus
            </h3>
            <div className="space-y-12">
              <div className="group/item">
                <p className="text-3xl font-black italic tracking-tight mb-4 group-hover/item:translate-x-2 transition-transform">
                  Granular Density
                </p>
                <p className="text-lg text-black/40 font-bold italic leading-relaxed">
                  Owning 80% of a single neighborhood results in the highest
                  operational alpha in tech history.
                </p>
              </div>
              <div className="group/item">
                <p className="text-3xl font-black italic tracking-tight mb-4 group-hover/item:translate-x-2 transition-transform">
                  Predictive Health
                </p>
                <p className="text-lg text-black/40 font-bold italic leading-relaxed">
                  Using Vision AI to diagnose site issues before the client,
                  converting reactive tasks into high-margin upgrades.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-10 group/sec">
            <h3 className="text-blue-600 font-black text-sm uppercase tracking-[0.4em] border-b-2 border-black/5 pb-6">
              The Plan
            </h3>
            <div className="space-y-12">
              <div className="group/item">
                <p className="text-3xl font-black italic tracking-tight mb-4 group-hover/item:translate-x-2 transition-transform">
                  Satellite Ops
                </p>
                <p className="text-lg text-black/40 font-bold italic leading-relaxed">
                  Eliminating site-visits for quotes. Using Satellite APIs to
                  generate structural estimates with 99.8% measurement accuracy.
                </p>
              </div>
              <div className="group/item">
                <p className="text-3xl font-black italic tracking-tight mb-4 group-hover/item:translate-x-2 transition-transform">
                  Weather Orchestration
                </p>
                <p className="text-lg text-black/40 font-bold italic leading-relaxed">
                  A fleet that moves with the moisture. Dynamic scheduling that
                  shifts based on precipitation and soil data.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-10 group/sec">
            <h3 className="text-amber-600 font-black text-sm uppercase tracking-[0.4em] border-b-2 border-black/5 pb-6">
              The Outcome
            </h3>
            <div className="space-y-12">
              <div className="group/item">
                <p className="text-3xl font-black italic tracking-tight mb-4 group-hover/item:translate-x-2 transition-transform">
                  Service Monopolies
                </p>
                <p className="text-lg text-black/40 font-bold italic leading-relaxed">
                  Building an "Unfair Competitive Advantage" where legacy
                  competitors simply cannot compete with your speed.
                </p>
              </div>
              <div className="group/item">
                <p className="text-3xl font-black italic tracking-tight mb-4 group-hover/item:translate-x-2 transition-transform">
                  Wealth Integration
                </p>
                <p className="text-lg text-black/40 font-bold italic leading-relaxed">
                  The final result: Landscaping becomes a wealth-management
                  service that builds real-equity for home owners.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-20 flex flex-col md:flex-row items-center gap-10 p-10 bg-white/5 rounded-[40px] border-4 border-white/10 relative z-10 transition-all hover:bg-white/[0.07]">
        <div className="flex -space-x-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-16 h-16 rounded-full border-4 border-slate-900 bg-slate-800 flex items-center justify-center text-xs font-black shadow-2xl"
            >
              M{i}
            </div>
          ))}
        </div>
        <div>
          <p className="text-sm font-black text-white italic">
            "This is the shift from Mowing to Asset Management."
          </p>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">
            — Cutty Internal Strategy Brief 2027
          </p>
        </div>
      </div>
      {/* The Neural Grid: How It All Collects */}
      <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-16 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-20 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-[3000ms]">
          <Workflow size={600} />
        </div>

        <header className="mb-20 relative z-10">
          <div className="inline-flex items-center gap-3 px-6 py-2 bg-emerald-500/10 text-emerald-400 rounded-full micro-label font-black border border-emerald-500/20 shadow-inner">
            <Processor size={16} />
            System Architecture
          </div>
          <h2 className="text-6xl font-black italic tracking-tighter leading-[0.8] mb-10 mt-10">
            The Unified <br /> Neural Nexus.
          </h2>
          <p className="text-white/40 font-bold text-2xl max-w-3xl leading-snug italic">
            Cutty doesn't solve one problem; it solves the **entire industrial
            chain**. Every module communicates via a shared logic layer to
            ensure zero-latency execution and perfect data integrity.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 relative z-10">
          {strategicLayers.map((layer, i) => (
            <div
              key={layer.id}
              className="bg-zinc-900 border-4 border-white/10 shadow-2xl rounded-[32px] p-10 flex flex-col group/layer hover:bg-zinc-900 hover:-translate-y-4 transition-all duration-700"
            >
              <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center mb-10 shadow-2xl group-hover/layer:scale-110 group-hover/layer:bg-emerald-500 transition-all duration-500 text-black">
                <layer.icon size={32} />
              </div>
              <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight italic leading-none">
                {layer.title}
              </h3>
              <p className="micro-label font-black text-emerald-400 tracking-[0.3em] uppercase mb-6 opacity-40 group-hover/layer:opacity-100 transition-opacity">
                {layer.focus}
              </p>
              <p className="text-base text-white/40 font-bold leading-relaxed mb-10 flex-1 italic">
                "{layer.desc}"
              </p>
              <div className="pt-8 border-t border-white/10">
                <p className="micro-label opacity-20 font-black tracking-widest uppercase mb-2">
                  Operational Result
                </p>
                <p className="text-sm font-black italic text-white/80">
                  {layer.result}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 p-12 bg-black/60 rounded-[40px] text-white flex flex-col lg:flex-row items-center justify-between gap-12 border-4 border-white/10 shadow-2xl relative overflow-hidden group/nexus">
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover/nexus:opacity-100 transition-opacity" />
          <div className="flex items-center gap-8 relative z-10">
            <div className="w-20 h-20 bg-emerald-500 rounded-[28px] flex items-center justify-center text-black shadow-2xl animate-pulse">
              <Rocket size={40} />
            </div>
            <div>
              <h4 className="text-3xl font-black tracking-tighter italic leading-none mb-2">
                Google Moonshot Validation
              </h4>
              <p className="text-white/30 text-lg font-bold italic">
                This model achieves "Industrial Singularity" in the field labor
                sector.
              </p>
            </div>
          </div>
          <div className="flex gap-12 relative z-10">
            <div className="text-center px-10">
              <p className="text-5xl font-black text-white italic tracking-tighter leading-none">
                99.2%
              </p>
              <p className="micro-label font-black uppercase text-white/20 tracking-widest mt-3">
                Logic Integrity
              </p>
            </div>
            <div className="text-center px-10 border-l border-white/10">
              <p className="text-5xl font-black text-white italic tracking-tighter leading-none">
                0.4s
              </p>
              <p className="micro-label font-black uppercase text-white/20 tracking-widest mt-3">
                Decision Latency
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl rounded-[40px] p-20 text-white relative overflow-hidden">
        <div className="flex items-center gap-6 mb-10 relative">
          <Info size={32} className="text-blue-400" />
          <h3 className="text-4xl font-black italic tracking-tighter lowercase leading-none">
            Field Meta-Game.
          </h3>
        </div>
        <p className="text-white/40 font-bold text-2xl mb-16 max-w-3xl italic leading-snug">
          We've identified that the 'Weekend Warrior' DIY cycle causes peak
          frustration every Saturday. Cutty allows you to schedule 'Express
          Recovery' jobs for failed DIY projects at a 20% alpha premium.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-white/5 p-10 rounded-[40px] border-4 border-white/10 shadow-inner">
            <h4 className="text-emerald-400 font-black text-5xl italic tracking-tighter mb-1">
              4.8x
            </h4>
            <p className="micro-label font-black uppercase tracking-[0.2em] opacity-30">
              ROI on DIY Repairs
            </p>
          </div>
          <div className="bg-white/5 p-10 rounded-[40px] border-4 border-white/10 shadow-inner">
            <h4 className="text-blue-400 font-black text-5xl italic tracking-tighter mb-1">
              12%
            </h4>
            <p className="micro-label font-black uppercase tracking-[0.2em] opacity-30">
              Churn Reduction
            </p>
          </div>
          <div className="bg-white/5 p-10 rounded-[40px] border-4 border-white/10 shadow-inner">
            <h4 className="text-amber-400 font-black text-5xl italic tracking-tighter mb-1">
              ZERO
            </h4>
            <p className="micro-label font-black uppercase tracking-[0.2em] opacity-30">
              Escaped Domain
            </p>
          </div>
          <div className="bg-white/5 p-10 rounded-[40px] border-4 border-white/10 shadow-inner">
            <h4 className="text-white font-black text-5xl italic tracking-tighter mb-1">
              100%
            </h4>
            <p className="micro-label font-black uppercase tracking-[0.2em] opacity-30">
              Data Obsidian
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
