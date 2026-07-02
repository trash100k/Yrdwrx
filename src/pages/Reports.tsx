import { fetchApi } from "../lib/api";
import { csvCell } from "../lib/csv";
// @ts-nocheck
import {
  BarChart3,
  TrendingDown,
  Users,
  DollarSign,
  ArrowUpRight,
  Download,
  Sparkles,
  AlertCircle,
  Package,
  Calendar,
  Star,
  ShieldCheck,
  Clock,
  Activity,
  ShieldAlert,
} from "lucide-react";
import LossLeaderAnalyzer from "../components/LossLeaderAnalyzer";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useState, useEffect } from "react";
import { handleFirestoreError, OperationType } from "../lib/firebase";
import {
  systemLogsRepo,
  customersRepo,
  jobsRepo,
  inventoryRepo,
} from "../lib/repos";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";

export default function Reports() {
  const { tenant } = useTenant();
  const [performanceData, setPerformanceData] = useState<
    { service: string; count: number; revenue: number }[]
  >([]);
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
  const [maintenance, setMaintenance] = useState<
    {
      vehicleId?: string;
      riskScore?: number;
      recommendedAction?: string;
      timeToFailure?: string;
      reason?: string;
      urgency?: string;
      name?: string;
      suggestion?: string;
    }[]
  >([]);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);
  const [inventory, setInventory] = useState<
    {
      id?: string;
      name?: string;
      currentStock?: number;
      predictedRunout?: string;
      confidence?: number;
      item?: string;
      reason?: string;
      quantity?: string | number;
      costEstimate?: number | string;
    }[]
  >([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<
    {
      id?: string;
      action: string;
      user: string;
      timestamp: string | number | Date;
      metadata?: Record<string, string>;
    }[]
  >([]);
  const [activeView, setActiveView] = useState<"analytics" | "audit" | "loss-leaders">(
    "analytics",
  );

  useEffect(() => {
    fetchPredictiveMaintenance();
    fetchInventoryForecast();
    fetchRevenueBreakdown();

    // Audit feed — fresh full list on any change (repo is tenant-scoped by RLS).
    // systemLogs rows are camelCase: event, userId, metadata, createdAt, level, message.
    const unsubscribe = systemLogsRepo.subscribe((rows) => {
      setAuditLogs(
        (rows || []).slice(0, 25).map((r: any) => ({
          id: r.id,
          action: r.event || r.action || r.message || "EVENT",
          user: r.userId || r.user || "system",
          timestamp: r.createdAt || r.timestamp || r.created_at,
          metadata: r.metadata || {},
        })),
      );
    });

    return () => unsubscribe();
  }, [tenant]);

  const fetchPredictiveMaintenance = async () => {
    setIsMaintenanceLoading(true);
    const tenantId = tenant?.id || "genesis-1";
    try {
      const customerRows = await customersRepo.list();
      // Flatten the freeform jsonb blob so AI body sees the real per-row extras.
      const customers = (customerRows || []).map((r: any) => ({
        ...(r.data || {}),
        ...r,
      }));
      const res = await fetchApi("/api/reports/predictive-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers, tenantId }),
      });
      const data = await res.json();
      setMaintenance(data);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "reports/predictive");
    } finally {
      setIsMaintenanceLoading(false);
    }
  };

  // Compute the revenue breakdown from REAL completed jobs grouped by service.
  const fetchRevenueBreakdown = async () => {
    setIsPerformanceLoading(true);
    const tenantId = tenant?.id || "genesis-1";
    try {
      const jobRows = await jobsRepo.list();
      // Flatten the freeform jsonb blob so service/amount extras are visible.
      const jobs = (jobRows || []).map((r: any) => ({ ...(r.data || {}), ...r }));

      // Job status is UPPERCASE (SCHEDULED | IN_PROGRESS | COMPLETED); lowercase to
      // match a tolerant set of "done" synonyms.
      const isCompleted = (status: any) =>
        typeof status === "string" &&
        ["completed", "complete", "done", "paid", "closed"].includes(
          status.toLowerCase(),
        );

      const groups: Record<string, { count: number; revenue: number }> = {};
      for (const job of jobs) {
        if (!isCompleted(job.status)) continue;
        const service =
          job.serviceType ||
          job.serviceName ||
          job.service ||
          job.type ||
          job.title ||
          "Other";
        const revenue =
          Number(job.amount ?? job.revenue ?? job.total ?? job.price ?? 0) || 0;
        if (!groups[service]) groups[service] = { count: 0, revenue: 0 };
        groups[service].count += 1;
        groups[service].revenue += revenue;
      }

      const breakdown = Object.entries(groups)
        .map(([service, { count, revenue }]) => ({ service, count, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

      setPerformanceData(breakdown);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "reports/revenue-breakdown");
      setPerformanceData([]);
    } finally {
      setIsPerformanceLoading(false);
    }
  };

  // Client-side CSV export of the currently active view (revenue breakdown for
  // analytics, audit feed for the activity log). Uses a Blob download — no server.
  const exportCsv = () => {
    // csvCell (../lib/csv) both quote-escapes AND neutralizes formula-injection leads
    // (= + - @) — the old esc() only quoted, so a job title like "=WEBSERVICE(...)" flowing
    // into the revenue-breakdown export would execute as a formula when opened in a spreadsheet.
    const esc = csvCell;
    let rows: any[][] = [];
    let filename = "report.csv";

    if (activeView === "audit") {
      filename = "activity-log.csv";
      rows = [["Timestamp", "Action", "User", "Details"]];
      for (const log of auditLogs) {
        const details = Object.entries(log.metadata || {})
          .map(([k, val]) => `${k}=${typeof val === "object" ? JSON.stringify(val) : val}`)
          .join("; ");
        rows.push([
          new Date(log.timestamp).toISOString(),
          log.action,
          log.user || "system",
          details,
        ]);
      }
    } else {
      filename = "revenue-breakdown.csv";
      rows = [["Service", "Completed Jobs", "Revenue"]];
      for (const p of performanceData) {
        rows.push([p.service, String(p.count), String(p.revenue)]);
      }
    }

    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fetchInventoryForecast = async () => {
    setIsInventoryLoading(true);
    const tenantId = tenant?.id || "genesis-1";
    try {
      // Jobs drive material consumption; inventory gives current stock context.
      const [jobRows, inventoryRows] = await Promise.all([
        jobsRepo.list(),
        inventoryRepo.list(),
      ]);
      const jobs = (jobRows || []).map((r: any) => ({ ...(r.data || {}), ...r }));
      const inventory = (inventoryRows || []).map((r: any) => ({
        ...(r.data || {}),
        ...r,
      }));
      const res = await fetchApi("/api/inventory/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs, inventory, tenantId }),
      });
      const data = await res.json();
      setInventory(data);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.GET,
        "reports/inventory-forecast",
      );
    } finally {
      setIsInventoryLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-500/10 rounded-full border border-slate-500 text-xs font-black uppercase tracking-widest text-slate-400">
            <BarChart3 size={16} />
            Intel & Reports
          </div>
          <h1 className="text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Analytics
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Professional Business Tracking
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div
            className="flex bg-black p-2 rounded-2xl border border-white/5 shrink-0 overflow-x-auto max-w-full shadow-inner"
            role="tablist"
          >
            {[
              { id: "analytics", label: "Stats", icon: BarChart3 },
              { id: "loss-leaders", label: "Loss-Leader Analysis", icon: TrendingDown },
              { id: "audit", label: "Activity Log", icon: ShieldCheck },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as "analytics" | "audit" | "loss-leaders")}
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-transform whitespace-nowrap border-4 ${
                  activeView === tab.id
                    ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105"
                    : "border-transparent text-white/40 hover:text-white hover:bg-white/5"
                }`}
              >
                <tab.icon size={20} />
                {tab.label}
              </button>
            ))}
          </div>
          {activeView !== "loss-leaders" && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest whitespace-nowrap border-4 border-transparent bg-forest-500/10 text-forest-400 hover:bg-forest-500/20 transition-colors shrink-0"
              title="Export current view as CSV"
            >
              <Download size={20} />
              Export CSV
            </button>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeView === "analytics" ? (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-10"
          >
            {/* Predictive Maintenance */}
            <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl p-10 text-white relative overflow-hidden group">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <Sparkles
                    size={24}
                    className="text-forest-400 shadow-glow"
                  />
                  <h3 className="text-xl font-black italic tracking-tight uppercase">
                    upcoming service needs.
                  </h3>
                </div>
                <button
                  onClick={fetchPredictiveMaintenance}
                  className="micro-label font-black text-forest-400 uppercase tracking-widest hover:text-white transition-colors italic"
                >
                  Sync
                </button>
              </div>

              <div className="space-y-6">
                {isMaintenanceLoading ? (
                  <div className="micro-label text-white/10 animate-pulse py-8 italic font-black uppercase tracking-widest">
                    Loading maintenance needs...
                  </div>
                ) : (
                  maintenance.map((m, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-6 p-6 rounded-2xl bg-zinc-900 border border-white/5 molten-edge hover:border-celtic-500/50 transition-all duration-700 group/item"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xl transition-transform group-hover/item:scale-110 ${
                          m.urgency === "high"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20 shadow-red-500/10"
                            : "bg-forest-500/10 text-forest-400 border border-forest-500/20 shadow-forest-500/10"
                        }`}
                      >
                        <AlertCircle size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-black text-white italic truncate uppercase">
                            {m.name}
                          </p>
                          <span
                            className={`micro-label font-black uppercase tracking-widest italic ${
                              m.urgency === "high"
                                ? "text-red-400 shadow-glow"
                                : "text-forest-400 shadow-glow"
                            }`}
                          >
                            {m.urgency}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 italic mb-2 leading-relaxed">
                          "{m.suggestion}"
                        </p>
                        <p className="micro-label font-black text-white/20 uppercase tracking-widest lowercase">
                          {m.reason}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {maintenance.length === 0 && !isMaintenanceLoading && (
                  <p className="micro-label text-white/10 italic text-center py-8 font-black uppercase">
                    No upcoming needs found.
                  </p>
                )}
              </div>
            </div>

            {/* Supply and Materials */}
            <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl p-10 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4 text-white">
                  <Package size={24} className="text-celtic-400 shadow-glow" />
                  <h3 className="text-xl font-black italic tracking-tight uppercase">
                    Supply & Materials
                  </h3>
                </div>
              </div>

              <div className="space-y-6">
                {isInventoryLoading ? (
                  <div className="micro-label text-white/10 animate-pulse py-8 italic font-black uppercase tracking-widest text-center">
                    Projecting material needs...
                  </div>
                ) : (
                  inventory.map((item, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between items-center p-6 rounded-2xl bg-zinc-900 border border-white/5 molten-edge hover:border-celtic-500/50 transition-all group/inv"
                    >
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-white italic uppercase truncate group-hover/inv:text-celtic-400 transition-colors">
                          {item.item}
                        </h4>
                        <p className="micro-label font-black text-white/20 uppercase tracking-normal md:tracking-tighter mt-1 italic">
                          {item.reason}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-white italic tracking-normal md:tracking-tighter">
                          {item.quantity}
                        </p>
                        <p className="micro-label font-black text-celtic-400 uppercase mt-1 italic tracking-widest">
                          Est. ${item.costEstimate}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {inventory.length === 0 && !isInventoryLoading && (
                  <p className="micro-label text-white/10 italic text-center py-8 font-black uppercase tracking-widest">
                    Inventory is fully stocked.
                  </p>
                )}
              </div>
            </div>

            {/* Revenue breakdown */}
            <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-12 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-zinc-900 rounded-full blur-3xl -mr-40 -mt-40 group-hover:bg-zinc-900 transition-colors" />
              <div className="flex items-center justify-between mb-12 relative z-10">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white italic tracking-normal md:tracking-tighter leading-none mb-2 lowercase">
                    revenue breakdown.
                  </h3>
                  <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em]">
                    Services Revenue
                  </p>
                </div>
                <BarChart3
                  className="text-white/10 group-hover:text-white transition-colors duration-1000"
                  size={32}
                />
              </div>
              <div className="h-[400px] relative z-10">
                {isPerformanceLoading ? (
                  <div className="h-full flex items-center justify-center micro-label text-white/10 animate-pulse italic font-black uppercase tracking-widest">
                    Tallying completed jobs...
                  </div>
                ) : performanceData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                    <BarChart3 className="text-white/10" size={40} />
                    <p className="micro-label text-white/20 italic font-black uppercase tracking-widest">
                      No completed jobs yet
                    </p>
                    <p className="text-xs text-white/30 font-bold max-w-xs leading-relaxed">
                      Revenue breaks down by service once jobs are marked complete.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={performanceData}
                      layout="vertical"
                      margin={{ left: 40, right: 40 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="service"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "rgba(255,255,255,0.2)",
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: "0.1em",
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.02)" }}
                        contentStyle={{
                          backgroundColor: "#050505",
                          borderRadius: "24px",
                          border: "1px solid rgba(255,255,255,0.1)",
                          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                          fontSize: "12px",
                          color: "white",
                        }}
                        itemStyle={{ color: "#10b981", fontWeight: "bold" }}
                      />
                      <Bar dataKey="revenue" radius={[0, 20, 20, 0]} barSize={32}>
                        {performanceData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              index % 2 === 0
                                ? "#10b981"
                                : "rgba(255,255,255,0.05)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden group">
              <div className="p-12 border-b border-white/10 flex items-center justify-between bg-zinc-900">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center text-black shadow-2xl relative group-hover:scale-110 transition-transform duration-700">
                    <Activity size={32} />
                    <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full -z-10 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white italic tracking-normal md:tracking-tighter leading-none mb-2 lowercase">
                      detailed activity log.
                    </h3>
                    <p className="micro-label font-black uppercase text-white/20 tracking-[0.3em] italic">
                      History of all actions taken in the app
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-forest-500/10 border border-forest-500/20 text-forest-400 rounded-full micro-label font-black uppercase tracking-widest shadow-glow">
                  <ShieldCheck size={18} />
                  History Log
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-10 hover:border-celtic-500/50 transition-all duration-700 flex flex-col lg:flex-row lg:items-center justify-between gap-8 group/row"
                  >
                    <div className="flex items-start gap-8">
                      <div
                        className={`mt-1 p-3 rounded-[16px] shadow-2xl transition-all duration-700 group-hover/row:scale-110 ${
                          log.action.includes("ERROR")
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : log.action.includes("CREATE")
                              ? "bg-forest-500/10 text-forest-400 border border-forest-500/20"
                              : log.action.includes("DELETE")
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-celtic-500/10 text-celtic-400 border border-celtic-500/20"
                        }`}
                      >
                        {log.action.includes("ERROR") ? (
                          <ShieldAlert size={20} />
                        ) : (
                          <Clock size={20} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-xl font-black text-white italic tracking-tight group-hover/row:text-forest-400 transition-colors uppercase leading-none">
                            {log.action}
                          </span>
                          <span className="micro-label font-black text-white/10 uppercase tracking-widest">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          {Object.entries(log.metadata || {}).map(
                            ([key, val]) => (
                              <div
                                key={key}
                                className="flex items-center gap-2 group-hover/row:translate-x-1 transition-transform"
                              >
                                <span className="micro-label font-black text-white/10 uppercase tracking-widest text-xs md:text-[10px]">
                                  {key}
                                </span>
                                <span className="text-sm font-black text-white/60 italic">
                                  {typeof val === "object"
                                    ? JSON.stringify(val).slice(0, 50)
                                    : String(val)}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 lg:border-l lg:border-white/10 lg:pl-10">
                      <p className="micro-label font-black text-white/10 uppercase tracking-[0.2em] mb-2 italic">
                        AUTH_SIG: {log.user?.slice(0, 12)}
                      </p>
                      <p className="text-xs font-black text-white/20 italic uppercase tracking-widest">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="p-32 text-center text-white/10 italic font-black uppercase tracking-[0.4em]">
                    Activity log is empty.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl bg-amber-500/5 border border-amber-500/20 rounded-2xl p-10 group hover:bg-amber-500/10 transition-all duration-700">
                  <div className="flex items-center gap-4 text-amber-400 mb-6 group-hover:scale-105 transition-transform">
                    <ShieldAlert size={28} />
                    <h4 className="text-xl font-black italic tracking-tight uppercase">
                      System Security
                    </h4>
                  </div>
                  <p className="text-sm text-white/60 font-bold italic leading-relaxed">
                    This log keeps track of all changes for your records. It
                    cannot be edited to ensure accuracy.
                  </p>
                </div>
                <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl bg-forest-500/5 border border-forest-500/20 rounded-2xl p-10 group hover:bg-forest-500/10 transition-all duration-700">
                  <div className="flex items-center gap-4 text-forest-400 mb-6 group-hover:scale-105 transition-transform">
                    <ShieldCheck size={28} />
                    <h4 className="text-xl font-black italic tracking-tight uppercase">
                      Data Privacy
                    </h4>
                  </div>
                  <p className="text-sm text-white/60 font-bold italic leading-relaxed">
                    Your data is kept private and secure. Only authorized users
                    can see detailed logs.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeView === "loss-leaders" && (
          <motion.div
            key="loss-leaders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-10"
          >
            <LossLeaderAnalyzer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StaffRow({
  name,
  jobs,
  satisfaction,
}: {
  name: string;
  jobs: string;
  satisfaction: string;
}) {
  return (
    <div className="flex items-center justify-between group hover:bg-slate-50 p-2 rounded-xl transition-all">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-white text-xs">
          {name[0]}
        </div>
        <div>
          <div className="font-bold text-slate-900 text-sm">{name}</div>
          <div className="text-xs md:text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {jobs} jobs tracked
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 bg-forest-50 px-2 py-0.5 rounded text-forest-600 text-xs md:text-[10px] font-black">
        <Star size={10} className="fill-current" />
        {satisfaction}
      </div>
    </div>
  );
}
