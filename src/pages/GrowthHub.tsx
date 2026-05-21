
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  Rocket,
  Star,
  Users,
  ArrowUpRight,
  TrendingUp,
  Target,
  Search,
  ShieldCheck,
} from "lucide-react";
import MarketInsights from "./MarketInsights";
import Outbound from "./Outbound";
import Reviews from "./Reviews";
import CRM from "./CRM";

export default function GrowthHub() {
  const [activeTab, setActiveTab] = useState<
    "insights" | "outbound" | "reviews" | "crm"
  >("insights");

  const tabs = [
    {
      id: "insights",
      label: "Market Matrix",
      icon: Brain,
      color: "text-purple-400",
    },
    { id: "crm", label: "Client Core", icon: Users, color: "text-emerald-400" },
    {
      id: "outbound",
      label: "Lead Alpha",
      icon: Rocket,
      color: "text-blue-400",
    },
    { id: "reviews", label: "Brand Echo", icon: Star, color: "text-amber-400" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-40">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-purple-500/10 rounded-full border border-purple-500 text-xs font-black uppercase tracking-widest text-purple-500">
            <Sparkles size={16} />
            Growth Engine Active
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Growth Hub
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Influence & Market Capture Matrix
          </p>
        </div>

        <div className="flex bg-black p-2 rounded-[32px] border-4 border-white/10 shrink-0 overflow-x-auto max-w-full shadow-inner">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(
                  tab.id as "insights" | "outbound" | "reviews" | "crm",
                )
              }
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-transform whitespace-nowrap border-4 ${
                activeTab === tab.id
                  ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105"
                  : "border-transparent text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              <tab.icon
                size={20}
                className={activeTab === tab.id ? "text-black" : tab.color}
              />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      >
        {activeTab === "insights" && <MarketInsights />}
        {activeTab === "outbound" && <Outbound />}
        {activeTab === "reviews" && <Reviews />}
        {activeTab === "crm" && <CRM />}
      </motion.div>
    </div>
  );
}

function Sparkles({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
