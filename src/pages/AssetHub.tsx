
import { useState } from "react";
import { motion } from "motion/react";
import {
  Package,
  Fuel,
  Settings2,
  Activity,
  Box,
  Truck,
  Zap,
  ShieldCheck,
} from "lucide-react";
import Inventory from "./Inventory";

export default function AssetHub() {
  const [activeTab, setActiveTab] = useState<
    "inventory" | "fleet" | "maintenance"
  >("inventory");

  const tabs = [
    {
      id: "inventory",
      label: "Material Matrix",
      icon: Package,
      color: "text-amber-500",
    },
    {
      id: "fleet",
      label: "Fleet Registry",
      icon: Truck,
      color: "text-blue-500",
    },
    {
      id: "maintenance",
      label: "Service Logs",
      icon: Settings2,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-40">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-amber-500/10 rounded-full border border-amber-500 text-xs font-black uppercase tracking-widest text-amber-500">
            <Zap size={16} className="animate-pulse" />
            Sensing:{" "}
            {activeTab === "inventory"
              ? "Stock Levels"
              : activeTab === "fleet"
                ? "GPS Signals"
                : "Sensor Array"}
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Asset Hub
          </h1>
          <p className="text-white/60 font-bold text-lg italic uppercase tracking-widest leading-none">
            Infrastructure Logistics
          </p>
        </div>

        <div className="flex bg-black p-2 rounded-[32px] border-4 border-white/10 shrink-0 overflow-x-auto max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(tab.id as "inventory" | "fleet" | "maintenance")
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
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      >
        {activeTab === "inventory" && <Inventory />}
        {activeTab === "fleet" && (
          <div className="bg-zinc-900 p-16 border-4 border-white/10 rounded-[32px] text-center space-y-10 shadow-2xl">
            <div className="w-32 h-32 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-blue-500/20">
              <Truck size={64} className="text-blue-500" />
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black italic text-white uppercase tracking-tighter">
                Fleet Matrix Incoming
              </h3>
              <p className="text-white/40 max-w-md mx-auto text-[10px] font-black uppercase tracking-widest leading-relaxed">
                Live GPS and vehicle tracking integration scheduled for next
                update cycle.
              </p>
            </div>
          </div>
        )}
        {activeTab === "maintenance" && (
          <div className="bg-zinc-900 p-16 border-4 border-white/10 rounded-[32px] text-center space-y-10 shadow-2xl">
            <div className="w-32 h-32 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-purple-500/20">
              <Settings2 size={64} className="text-purple-500" />
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black italic text-white uppercase tracking-tighter">
                Service Protocols
              </h3>
              <p className="text-white/40 max-w-md mx-auto text-[10px] font-black uppercase tracking-widest leading-relaxed">
                Maintenance scheduling and predictive failure matrix currently
                under evaluation.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
