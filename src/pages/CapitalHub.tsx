
import { useState } from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  ReceiptText,
  ShieldCheck,
  Activity,
  DollarSign,
  TrendingUp,
  Landmark,
  PieChart,
} from "lucide-react";
import RevenueHub from "./RevenueHub";
import Invoices from "./Invoices";
import Reports from "./Reports";

export default function CapitalHub() {
  const [activeTab, setActiveTab] = useState<"revenue" | "ledger" | "audit">(
    "revenue",
  );

  const tabs = [
    {
      id: "revenue",
      label: "Cash Flow",
      icon: BarChart3,
      color: "text-emerald-500",
    },
    {
      id: "ledger",
      label: "Invoices",
      icon: ReceiptText,
      color: "text-blue-500",
    },
    {
      id: "audit",
      label: "Reports",
      icon: ShieldCheck,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-40">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500 text-xs font-black uppercase tracking-widest text-emerald-500">
            <Landmark size={16} />
            Billing Hub
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Money
          </h1>
          <p className="text-white/60 font-bold text-lg italic uppercase tracking-widest leading-none">
            Track your earnings and invoices
          </p>
        </div>

        <div className="flex bg-black p-2 rounded-[32px] border-4 border-white/10 shrink-0 overflow-x-auto max-w-full">
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

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      >
        {activeTab === "revenue" && <RevenueHub />}
        {activeTab === "ledger" && <Invoices />}
        {activeTab === "audit" && <Reports />}
      </motion.div>
    </div>
  );
}
