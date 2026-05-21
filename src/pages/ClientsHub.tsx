
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Heart,
  ShieldCheck,
  BadgeAlert,
  Sparkles,
  ChevronRight,
  MessageSquare,
  Briefcase,
} from "lucide-react";
import CRM from "./CRM";

export default function ClientsHub() {
  const [activeTab, setActiveTab] = useState<"all" | "priority" | "leads">(
    "all",
  );

  const tabs = [
    {
      id: "all",
      label: "Client Registry",
      icon: Users,
      color: "text-blue-400",
    },
    {
      id: "priority",
      label: "High Priority",
      icon: ShieldCheck,
      color: "text-emerald-400",
    },
    {
      id: "leads",
      label: "Expansion Leads",
      icon: Sparkles,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500 text-xs font-black uppercase tracking-widest text-blue-500">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]" />
            Intelligence Core Active
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Clients Hub
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Neural Relationship Management Core
          </p>
        </div>

        <div className="flex bg-black p-2 rounded-[32px] border-4 border-white/10 shrink-0 overflow-x-auto max-w-full shadow-inner">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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

      {/* Strategic Intelligence Summary */}
      <div
        id="clients-hub-stats"
        className="grid grid-cols-1 md:grid-cols-3 gap-8"
      >
        <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 rounded-[32px] flex flex-col justify-between group hover:border-blue-500/50 transition-all relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-blue-400 border-4 border-white/10 italic font-black">
                CRM
              </div>
              <span className="micro-label font-black text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-blue-500/20">
                Active Index
              </span>
            </div>
            <p className="micro-label opacity-60 font-black uppercase tracking-widest mb-2 italic">
              Total Relationships
            </p>
            <h3 className="text-5xl font-black text-white italic tracking-tighter leading-none">
              1,284
            </h3>
          </div>
        </div>

        <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 rounded-[32px] flex flex-col justify-between group hover:border-blue-500/50 transition-all relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-emerald-400 border-4 border-white/10">
                <Heart size={24} />
              </div>
              <span className="micro-label font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-emerald-500/20">
                Retention High
              </span>
            </div>
            <p className="micro-label opacity-60 font-black uppercase tracking-widest mb-2 italic">
              Satisfaction Delta
            </p>
            <h3 className="text-5xl font-black text-white italic tracking-tighter leading-none">
              +4.2%
            </h3>
          </div>
        </div>

        <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 rounded-[32px] flex flex-col justify-between group hover:border-blue-500/50 transition-all relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-purple-400 border-4 border-white/10">
                <Sparkles size={24} />
              </div>
              <span className="micro-label font-black text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-purple-500/20">
                Expansion Alpha
              </span>
            </div>
            <p className="micro-label opacity-60 font-black uppercase tracking-widest mb-2 italic">
              Conversion Leads
            </p>
            <h3 className="text-5xl font-black text-white italic tracking-tighter leading-none">
              42
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-[40px] border-4 border-white/10 p-12">
        <CRM />
      </div>
    </div>
  );
}
