
import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
  logSystemEvent,
} from "../lib/firebase";
import {
  Users,
  Truck,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  MoreVertical,
  Smartphone,
  MapPin,
  Shield,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";

export default function CrewSuite() {
  const { tenant } = useTenant();
  const [crews, setCrews] = useState<
    {
      id: string;
      name: string;
      status: string;
      jobTime: number;
      etaTime: number;
      phone: string;
      items: string[];
      nextJob: string;
      lat: number;
      lng: number;
      pingTime: string;
      efficiency: number;
      batteryLevels: Record<string, number>;
    }[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "incidents" | "late"
  >("all");

  useEffect(() => {
    const q = query(collection(db, "crews"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as any,
        );
        setCrews(docs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "crews");
        /* setCrews(crews) removed */
      },
    );

    return () => unsub();
  }, []);

  const filteredCrews = crews.filter((crew) => {
    const matchesSearch =
      crew.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crew.leader.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeFilter === "all") return matchesSearch;
    if (activeFilter === "active")
      return matchesSearch && crew.status === "active";
    if (activeFilter === "incidents")
      return matchesSearch && crew.incidents > 0;
    if (activeFilter === "late") return matchesSearch && crew.status === "late";
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500 text-xs font-black uppercase tracking-widest text-emerald-500">
            <Users size={16} />
            Crew Control Active
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Crew Suite
          </h1>
          <p className="max-w-xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            Field Teams & Equipment Matrix
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-end gap-6 shrink-0 mt-6 lg:mt-0 w-full lg:w-auto">
          <div className="relative w-full lg:w-72">
            <label htmlFor="crew-search" className="sr-only">
              Query crews
            </label>
            <Search
              className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-400 transition-colors"
              size={24}
              aria-hidden="true"
            />
            <input
              id="crew-search"
              type="text"
              placeholder="Query crews..."
              className="w-full pl-16 pr-8 py-5 bg-black border-4 border-white/10 rounded-3xl text-sm font-black tracking-widest uppercase focus:bg-zinc-900 focus:border-emerald-500/50 focus:outline-none placeholder:text-zinc-600 transition-all shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div
            className="flex bg-black p-2 rounded-[32px] border-4 border-white/10 shrink-0 overflow-x-auto max-w-full shadow-inner"
            role="tablist"
            aria-label="Crew filters"
          >
            {(["all", "active", "late", "incidents"] as const).map((filter) => (
              <button
                key={filter}
                role="tab"
                aria-selected={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-transform whitespace-nowrap border-4 ${activeFilter === filter ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Global Efficiency Monitor */}
        <section className="col-span-1 md:col-span-2 bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 bg-black/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -mr-32 -mt-32" />
          <header className="flex items-center justify-between mb-10 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black italic text-white uppercase leading-none">
                  Performance Stats
                </h3>
                <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-1">
                  Real-time aggregate performance
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black italic text-emerald-400">92%</p>
              <p className="text-[9px] font-bold text-emerald-500/40 uppercase tracking-widest mt-1">
                Grid Target Hit
              </p>
            </div>
          </header>

          <div className="space-y-8 relative z-10">
            {crews.map((crew, i) => (
              <div key={crew.id} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-white italic uppercase">
                      {crew.name}
                    </span>
                    <span className="micro-label opacity-40">
                      Tech Lead: {crew.leader}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-black italic ${crew.efficiency > 90 ? "text-emerald-400" : crew.efficiency > 80 ? "text-blue-400" : "text-amber-400"}`}
                  >
                    {crew.efficiency}%
                  </span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${crew.efficiency}%` }}
                    transition={{ delay: i * 0.1, duration: 1 }}
                    className={`h-full ${crew.efficiency > 90 ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-white text-white shadow-xl"}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Crew Leaderboard */}
        <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 flex flex-col justify-between">
          <header className="space-y-2 mb-8">
            <div className="flex items-center gap-3">
              <Trophy size={20} className="text-amber-400 shadow-2xl" />
              <h3 className="text-xl font-black italic text-white uppercase leading-none">
                Top Teams
              </h3>
            </div>
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
              Best performing crews this week
            </p>
          </header>

          <div className="space-y-6">
            {crews
              .sort((a, b) => b.efficiency - a.efficiency)
              .map((crew, i) => (
                <div key={crew.id} className="flex items-center gap-6 group">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/20 font-black italic border-4 border-white/10 group-hover:bg-white group-hover:text-black group-hover:border-transparent transition-all">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-white italic uppercase leading-none mb-1">
                      {crew.name}
                    </p>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      {crew.incidents} Incidents
                    </p>
                  </div>
                  <div className="text-right">
                    <Zap
                      size={14}
                      className="text-yellow-400 mb-1 ml-auto"
                      aria-hidden="true"
                    />
                    <p className="text-[10px] font-black text-white uppercase tracking-tight">
                      {crew.efficiency} E/S
                    </p>
                  </div>
                </div>
              ))}
          </div>

          <button className="w-full mt-8 py-4 bg-white/5 border-4 border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all">
            Cycle History
          </button>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence>
          {filteredCrews.map((crew) => (
            <motion.div
              layout
              key={crew.id}
              className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-8 hover:border-white/20 transition-all relative overflow-hidden group/card bg-black/40"
            >
              {/* Battery Alert Visual */}
              {Object.values(crew.batteryLevels).some(
                (lvl: number) => lvl < 20,
              ) && (
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-transparent animate-pulse" />
              )}

              <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl relative",
                      crew.status === "active"
                        ? "bg-emerald-500 text-black"
                        : crew.status === "late"
                          ? "bg-amber-500 text-black animate-pulse"
                          : "bg-white/5 text-white/20",
                    )}
                  >
                    <Users size={22} aria-hidden="true" />
                    {crew.status === "active" && (
                      <Smartphone
                        size={10}
                        className="absolute -bottom-1 -right-1 text-emerald-400"
                        aria-label="Connected device"
                      />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-black italic tracking-tighter text-white uppercase leading-none mb-1">
                      {crew.name}
                    </h4>
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest",
                        crew.status === "active"
                          ? "text-emerald-400"
                          : "text-amber-500",
                      )}
                    >
                      {crew.status === "active"
                        ? "Everything Synced"
                        : "Behind Schedule"}
                    </span>
                  </div>
                </div>
                <button
                  className="p-3 text-white/20 hover:text-white rounded-xl transition-all"
                  aria-label={`Settings for ${crew.name}`}
                >
                  <MoreVertical size={20} />
                </button>
              </header>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-zinc-900 border-4 border-white/10 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-white/20" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                      Current Job
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-white uppercase italic truncate max-w-[120px]">
                    {crew.currentJob}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-900 border-4 border-white/10 rounded-2xl space-y-1">
                    <p className="micro-label opacity-20 uppercase text-[7px]">
                      Efficiency
                    </p>
                    <p className="text-xl font-black italic text-white leading-none">
                      {crew.efficiency}%
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-900 border-4 border-white/10 rounded-2xl space-y-1">
                    <p className="micro-label opacity-20 uppercase text-[7px]">
                      Incidents
                    </p>
                    <p
                      className={`text-xl font-black italic leading-none ${crew.incidents > 0 ? "text-rose-500 animate-pulse" : "text-white"}`}
                    >
                      {crew.incidents}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                      Hardware Telemetry
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">
                        Live Sync
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(crew.batteryLevels).map(
                      ([equip, level]: [string, number]) => (
                        <div
                          key={equip}
                          className="p-3 bg-black/40 border border-white/10 rounded-2xl relative overflow-hidden group/hw"
                        >
                          {/* BG level fill */}
                          <div
                            className={`absolute bottom-0 left-0 w-full opacity-20 transition-all ${level < 20 ? "bg-rose-500" : "bg-emerald-500"}`}
                            style={{ height: `${level}%` }}
                          />

                          <div className="relative z-10 flex flex-col gap-2">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[8px] font-black text-white uppercase tracking-widest truncate">
                                {equip}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-black italic",
                                  level < 20
                                    ? "text-rose-500 animate-pulse"
                                    : "text-emerald-400",
                                )}
                              >
                                {level}%
                              </span>
                            </div>

                            {/* Mini diagnostics matrix */}
                            <div className="flex gap-1">
                              <div
                                className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover/hw:bg-emerald-500 transition-colors tooltip-target"
                                title="Voltage Ripple: Nominal"
                              />
                              <div
                                className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover/hw:bg-emerald-500 transition-colors tooltip-target"
                                title="Thermal Limits: PASS"
                              />
                              <div
                                className={`w-1.5 h-1.5 rounded-full tooltip-target ${level < 20 ? "bg-rose-500 animate-ping" : "bg-white/20 group-hover/hw:bg-emerald-500"}`}
                                title="Cell Balance: OK"
                              />
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>

              <footer className="mt-8 pt-8 border-t border-white/10 flex gap-4">
                <button className="flex-1 py-3 bg-white text-black rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">
                  Call Crew
                </button>
                <button className="flex-1 py-3 bg-zinc-900 border-4 border-white/10 shadow-2xl text-white font-black text-[9px] uppercase tracking-widest hover:bg-white/5 transition-all">
                  View Progress
                </button>
              </footer>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 bg-black/40 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/60 border border-white/10">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black italic text-white uppercase leading-none">
                Field Diagnostic Center
              </h3>
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-2">
                ASAE S474.1 Compliant Hardware Diagnostics Matrix
              </p>
            </div>
          </div>
          <button className="px-6 py-3 bg-white text-black rounded-xl font-black text-[9px] uppercase tracking-widest shadow-2xl hover:scale-105 transition-all">
            Run Network Diagnostic Override
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-zinc-950 border border-white/5 rounded-[32px] flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Torque Sensors
              </span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-white italic">ALL GREEN</p>
            <div className="flex gap-1 mt-auto">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 flex-1 bg-emerald-500/20 rounded-sm border border-emerald-500/40"
                />
              ))}
            </div>
          </div>

          <div className="p-6 bg-zinc-950 border border-white/5 rounded-[32px] flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Hydraulic Limits
              </span>
              <AlertTriangle size={16} className="text-amber-500" />
            </div>
            <p className="text-2xl font-black text-white italic">2800 PSI</p>
            <div className="relative h-4 mt-auto">
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/20" />
              <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 bg-amber-500 border-2 border-black rounded-full shadow-[0_0_10px_#f59e0b]" />
            </div>
          </div>

          <div className="p-6 bg-zinc-950 border border-white/5 rounded-[32px] flex flex-col gap-4 relative overflow-hidden group">
            <div className="flex justify-between items-start relative z-10">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Battery Thermal
              </span>
              <AlertTriangle
                size={16}
                className="text-rose-500 animate-pulse"
              />
            </div>
            <p className="text-2xl font-black text-white italic relative z-10">
              45°C PEAK
            </p>
            <div className="flex gap-1 mt-auto relative z-10">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`h-4 flex-1 rounded-sm border ${i > 4 ? "bg-rose-500/40 border-rose-500/50" : "bg-emerald-500/20 border-emerald-500/40"}`}
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-rose-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div className="p-6 bg-zinc-950 border border-white/5 rounded-[32px] flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Blade Wear
              </span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-white italic">NOMINAL</p>
            <div className="w-full flex mt-auto items-center">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 bg-black flex items-center justify-center animate-spin">
                <span className="text-[8px] font-black text-emerald-500">
                  12K
                </span>
              </div>
              <div className="flex-1 border-b-2 border-dashed border-white/20 ml-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}
