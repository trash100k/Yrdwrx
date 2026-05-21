
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Calendar,
  ShieldCheck,
  Activity,
  Brain,
  Clock,
  ChevronRight,
  CloudRain,
  TrendingUp,
  MapPin,
  Zap,
} from "lucide-react";
import Scheduler from "./Scheduler";
import HOAPortal from "./HOAPortal";
import JobMap from "../components/JobMap";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useTenant } from "../contexts/TenantContext";
import { Job } from "../types";
import { format } from "date-fns";

export default function OperationsHub() {
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState<
    "scheduler" | "map" | "alliances" | "efficiency"
  >("scheduler");
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);

  const tabs = [
    {
      id: "scheduler",
      label: "Schedule",
      icon: Calendar,
      color: "text-blue-500",
    },
    { id: "map", label: "Tactical Map", icon: MapPin, color: "text-rose-500" },
    {
      id: "alliances",
      label: "Compliance",
      icon: ShieldCheck,
      color: "text-purple-500",
    },
    {
      id: "efficiency",
      label: "Velocity",
      icon: Activity,
      color: "text-emerald-500",
    },
  ];

  useEffect(() => {
    const tenantId = tenant?.id || "genesis-1";
    const q = query(
      collection(db, "jobs"),
      where("tenantId", "==", tenantId),
      // Optionally filter by date if needed, but for tactical map usually today or upcoming
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setActiveJobs(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as unknown as Job),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "jobs");
      },
    );

    return () => unsubscribe();
  }, [tenant]);

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-40">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 border-b border-white/10 pb-8 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500 text-xs font-black uppercase tracking-widest text-blue-500">
            <Activity size={16} />
            Operations Control
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Operations Hub
          </h1>
          <p className="text-white/60 font-bold text-lg italic uppercase tracking-widest leading-none">
            Resource Logic &amp; Execution Grid
          </p>
        </div>

        <div className="flex bg-black p-2 rounded-[32px] border-4 border-white/10 shrink-0 overflow-x-auto max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(
                  tab.id as "scheduler" | "map" | "alliances" | "efficiency",
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
        {activeTab === "scheduler" && <Scheduler />}
        {activeTab === "map" && (
          <div className="h-[800px] w-full rounded-[32px] overflow-hidden border-4 border-white/10 relative bg-black shadow-2xl">
            <JobMap jobs={activeJobs} onJobSelect={() => {}} />
          </div>
        )}
        {activeTab === "alliances" && <HOAPortal />}
        {activeTab === "efficiency" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-zinc-900 p-12 border-4 border-emerald-500 relative overflow-hidden group rounded-[32px] shadow-2xl">
              <header className="flex items-center gap-4 mb-10 relative z-10">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-black shadow-[4px_4px_0_0_#000]">
                  <CloudRain size={32} />
                </div>
                <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                  Job Conditionals
                </h3>
              </header>
              <div className="space-y-6 relative z-10">
                {[
                  {
                    label: "Precision Spraying",
                    status: "AUTHORIZED",
                    color: "text-black",
                    bg: "bg-emerald-400",
                    border: "border-black",
                  },
                  {
                    label: "Irrigation Testing",
                    status: "STABLE",
                    color: "text-black",
                    bg: "bg-blue-400",
                    border: "border-black",
                  },
                  {
                    label: "High-Heat Labor Protocol",
                    status: "PENDING 2PM",
                    color: "text-black",
                    bg: "bg-yellow-400",
                    border: "border-black",
                  },
                ].map((cond, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between group/cond p-6 bg-black rounded-3xl border-4 border-white/10 hover:border-emerald-500 gap-4 transition-colors"
                  >
                    <span className="text-2xl font-black text-white/60 group-hover/cond:text-white transition-colors uppercase italic tracking-tight">
                      {cond.label}
                    </span>
                    <span
                      className={`px-6 py-3 ${cond.bg} ${cond.color} rounded-2xl text-xs font-black uppercase tracking-widest border-4 ${cond.border} shadow-[4px_4px_0_0_rgba(255,255,255,0.2)] whitespace-nowrap text-center`}
                    >
                      {cond.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 p-12 border-4 border-white/10 rounded-[32px] space-y-10 flex flex-col shadow-2xl">
              <header className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 italic">
                    Performance Alpha
                  </h4>
                  <h3 className="text-4xl font-black italic text-white uppercase leading-none tracking-tighter">
                    Service Velocity
                  </h3>
                </div>
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-black border-4 border-black shadow-[4px_4px_0_0_#FFF]">
                  <TrendingUp size={32} />
                </div>
              </header>
              <div className="space-y-6 flex-grow flex flex-col justify-center">
                <div className="p-12 bg-black border-4 border-white/10 rounded-[40px] text-center shadow-inner">
                  <p className="text-8xl font-black italic text-white leading-none tracking-tighter mb-4">
                    0.85{" "}
                    <span className="text-2xl font-bold text-white/20 not-italic tracking-widest uppercase ml-2 block sm:inline">
                      jobs/hr
                    </span>
                  </p>
                  <p className="text-xs font-black text-white/40 uppercase tracking-[0.4em] italic mt-4">
                    Fleet Throughput Alpha
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-8 bg-black rounded-[32px] border-4 border-white/10 text-center">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">
                      Completed
                    </p>
                    <p className="text-5xl font-black italic text-white leading-none">
                      18
                    </p>
                  </div>
                  <div className="p-8 bg-black rounded-[32px] border-4 border-emerald-500 text-center shadow-[4px_4px_0_0_rgba(16,185,129,0.5)]">
                    <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest mb-3">
                      Efficiency
                    </p>
                    <p className="text-5xl font-black italic text-emerald-400 leading-none">
                      92%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
