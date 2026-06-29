// @ts-nocheck
// Job Costing — real-time estimate-vs-actual margins per job.
//
// The metric serious landscapers buy software for: did this job actually make money?
// We pull REAL rows from the repos and compute, per job:
//   Revenue       = invoice(s) tied to the job  ->  else job.revenue/amount/total/price
//   Labor cost    = (sum of timesheet hours for the job) x hourly rate
//   Material cost = material-log quantities x inventory unit cost  +  linked expenses
//   Gross margin  = revenue - (labor + material), and margin %
//
// Honesty policy: when a cost component cannot be resolved PER JOB (no job link on the
// timesheet/expense/material row) we fall back to a tenant-level even allocation across
// active jobs and tag that figure "est." in the UI rather than pretending it is exact.

import React, { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  RefreshCw,
  Clock,
  Package,
  Receipt,
  Info,
} from "lucide-react";
import { motion } from "motion/react";
import {
  jobsRepo,
  invoicesRepo,
  expensesRepo,
  timesheetsRepo,
  materialLogsRepo,
  inventoryRepo,
} from "../lib/repos";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Flatten a repo row's freeform jsonb (data) over its top-level columns so per-row
// extras (e.g. jobId nested in data) are visible alongside real columns.
const flatten = (r: any) => ({ ...(r?.data || {}), ...r });

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const pct = (n: number) =>
  `${n >= 0 ? "" : "-"}${Math.abs(n).toFixed(0)}%`;

// Margin color band: forest >40%, amber 15-40%, rose <15%.
const marginBand = (marginPct: number) => {
  if (marginPct >= 40)
    return {
      text: "text-forest-400",
      bg: "bg-forest-500/10",
      border: "border-forest-500/30",
      dot: "bg-forest-400",
      label: "Healthy",
    };
  if (marginPct >= 15)
    return {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      dot: "bg-amber-400",
      label: "Thin",
    };
  return {
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    dot: "bg-rose-400",
    label: "At Risk",
  };
};

// Pull the customer id off a job/invoice row under any of the common field names.
const customerIdOf = (r: any) =>
  r?.customerId ?? r?.customer_id ?? r?.clientId ?? r?.client_id ?? null;

// Pull the job id off a satellite row (timesheet/expense/material/invoice) under any
// of the common field names; null if the row isn't linked to a job.
const jobIdOf = (r: any) =>
  r?.jobId ?? r?.job_id ?? r?.associatedJobId ?? null;

// Inline confidence/estimate marker — small pill that flags a figure as an estimate
// rather than an exact, per-job-resolved number.
function EstTag({ title }: { title?: string }) {
  return (
    <span
      title={title || "Estimated — could not be resolved to this job exactly"}
      className="ml-1.5 inline-flex items-center gap-1 align-middle rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-400"
    >
      <Info size={9} />
      est.
    </span>
  );
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export default function JobCosting() {
  const { tenant } = useTenant();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  // Default labor rate: tenant.settings.laborRate / hourlyRate, else $35/hr.
  const hourlyRate = useMemo(() => {
    const s = (tenant?.settings as any) || {};
    return (
      num(s.laborRate) ||
      num(s.hourlyRate) ||
      num(s.defaultHourlyRate) ||
      num(s.crewHourlyRate) ||
      35
    );
  }, [tenant]);

  const load = async () => {
    setLoading(true);
    try {
      const [
        jobRowsRaw,
        invoiceRowsRaw,
        expenseRowsRaw,
        timesheetRowsRaw,
        materialRowsRaw,
        inventoryRowsRaw,
      ] = await Promise.all([
        jobsRepo.list(),
        invoicesRepo.list().catch(() => []),
        expensesRepo.list().catch(() => []),
        timesheetsRepo.list().catch(() => []),
        materialLogsRepo.list().catch(() => []),
        inventoryRepo.list().catch(() => []),
      ]);

      const jobs = (jobRowsRaw || []).map(flatten);
      const invoices = (invoiceRowsRaw || []).map(flatten);
      const expenses = (expenseRowsRaw || []).map(flatten);
      const timesheets = (timesheetRowsRaw || []).map(flatten);
      const materials = (materialRowsRaw || []).map(flatten);
      const inventory = (inventoryRowsRaw || []).map(flatten);

      // Recent / active jobs first — newest by date, cap to keep the table dense.
      const sortedJobs = [...jobs].sort((a, b) => {
        const da = new Date(a.date || a.createdAt || 0).getTime();
        const db = new Date(b.date || b.createdAt || 0).getTime();
        return db - da;
      });
      const activeJobs = sortedJobs.slice(0, 60);
      const activeJobIds = new Set(activeJobs.map((j) => j.id));
      const jobCount = activeJobs.length || 1;

      // --- inventory unit-cost lookup (for material costing) ----------------
      const unitCostById: Record<string, number> = {};
      const unitCostByName: Record<string, number> = {};
      for (const it of inventory) {
        const cost = num(it.unitCost) || num(it.unitPrice) || 0;
        if (it.id) unitCostById[it.id] = cost;
        if (it.name) unitCostByName[String(it.name).toLowerCase()] = cost;
      }
      const materialLineCost = (m: any) => {
        const unit =
          num(unitCostById[m.itemId]) ||
          num(unitCostByName[String(m.itemName || "").toLowerCase()]) ||
          num(m.unitCost) ||
          num(m.unitPrice) ||
          0;
        return num(m.quantity) * unit;
      };

      // --- bucket the satellite rows by job, tracking the unallocated pool ----
      // Labor (hours)
      const laborMinsByJob: Record<string, number> = {};
      let unallocatedLaborMins = 0;
      for (const t of timesheets) {
        let mins = num(t.durationMins);
        if (!mins && t.clockIn && t.clockOut) {
          mins = Math.max(
            0,
            (new Date(t.clockOut).getTime() - new Date(t.clockIn).getTime()) /
              60000,
          );
        }
        if (!mins) continue;
        const jid = jobIdOf(t);
        if (jid && activeJobIds.has(jid)) {
          laborMinsByJob[jid] = (laborMinsByJob[jid] || 0) + mins;
        } else {
          unallocatedLaborMins += mins;
        }
      }

      // Material (consumption "out" only — "in" is restock, not job cost)
      const materialCostByJob: Record<string, number> = {};
      let unallocatedMaterialCost = 0;
      for (const m of materials) {
        if (m.type && String(m.type).toLowerCase() === "in") continue;
        const cost = materialLineCost(m);
        if (!cost) continue;
        const jid = jobIdOf(m);
        if (jid && activeJobIds.has(jid)) {
          materialCostByJob[jid] = (materialCostByJob[jid] || 0) + cost;
        } else {
          unallocatedMaterialCost += cost;
        }
      }

      // Expenses (other direct costs — also rolled into "material/other" cost)
      const expenseCostByJob: Record<string, number> = {};
      let unallocatedExpenseCost = 0;
      for (const x of expenses) {
        const cost = num(x.amount);
        if (!cost) continue;
        const jid = jobIdOf(x);
        if (jid && activeJobIds.has(jid)) {
          expenseCostByJob[jid] = (expenseCostByJob[jid] || 0) + cost;
        } else {
          unallocatedExpenseCost += cost;
        }
      }

      // Revenue: invoices linked to a job win; otherwise we fall back to the job's
      // own revenue field. Track which jobs had a real invoice match so the UI can
      // be honest about job.revenue being a quote/estimate vs. billed.
      const invoiceRevByJob: Record<string, number> = {};
      for (const inv of invoices) {
        const jid = jobIdOf(inv);
        if (jid && activeJobIds.has(jid)) {
          invoiceRevByJob[jid] = (invoiceRevByJob[jid] || 0) + num(inv.amount);
        }
      }

      // Tenant-level even allocation of the unresolved pools across active jobs.
      const laborMinsPerJobEst = unallocatedLaborMins / jobCount;
      const materialCostPerJobEst =
        (unallocatedMaterialCost + unallocatedExpenseCost) / jobCount;

      const computed = activeJobs.map((j) => {
        const id = j.id;

        // Revenue ---------------------------------------------------------
        const billed = invoiceRevByJob[id] || 0;
        const jobRevenue =
          num(j.revenue) || num(j.amount) || num(j.total) || num(j.price);
        const revenue = billed > 0 ? billed : jobRevenue;
        const revenueIsBilled = billed > 0;
        const revenueIsEst = !revenueIsBilled; // job.revenue is a quote/estimate

        // Labor -----------------------------------------------------------
        const directLaborMins = laborMinsByJob[id] || 0;
        const laborMins = directLaborMins || laborMinsPerJobEst;
        const laborHours = laborMins / 60;
        const laborCost = laborHours * hourlyRate;
        const laborIsEst = directLaborMins <= 0;

        // Material + other direct cost -----------------------------------
        const directMaterial =
          (materialCostByJob[id] || 0) + (expenseCostByJob[id] || 0);
        const materialCost = directMaterial || materialCostPerJobEst;
        const materialIsEst = directMaterial <= 0;

        const totalCost = laborCost + materialCost;
        const marginDollars = revenue - totalCost;
        const marginPct = revenue > 0 ? (marginDollars / revenue) * 100 : 0;

        return {
          id,
          title:
            j.title ||
            j.serviceType ||
            j.service ||
            j.type ||
            "Untitled Job",
          client: j.client || j.customerName || customerIdOf(j) || "—",
          status: (j.status || "").toString().toUpperCase(),
          revenue,
          revenueIsBilled,
          revenueIsEst,
          laborHours,
          laborCost,
          laborIsEst,
          materialCost,
          materialIsEst,
          totalCost,
          marginDollars,
          marginPct,
        };
      });

      // Sort by margin % ascending so the at-risk jobs surface at the top —
      // that is where the operator's attention needs to go.
      computed.sort((a, b) => a.marginPct - b.marginPct);

      setRows(computed);
    } catch (err: any) {
      console.error("[JobCosting] load failed", err);
      showToast("Could not load job costing data.", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  // --- summary rollups -------------------------------------------------------
  const summary = useMemo(() => {
    const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
    const totalCost = rows.reduce((a, r) => a + r.totalCost, 0);
    const totalLabor = rows.reduce((a, r) => a + r.laborCost, 0);
    const totalMaterial = rows.reduce((a, r) => a + r.materialCost, 0);
    const blendedMargin = totalRevenue - totalCost;
    const blendedMarginPct =
      totalRevenue > 0 ? (blendedMargin / totalRevenue) * 100 : 0;
    const anyEst = rows.some(
      (r) => r.revenueIsEst || r.laborIsEst || r.materialIsEst,
    );
    return {
      totalRevenue,
      totalCost,
      totalLabor,
      totalMaterial,
      blendedMargin,
      blendedMarginPct,
      anyEst,
    };
  }, [rows]);

  const blendedBand = marginBand(summary.blendedMarginPct);

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header block */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-forest-500/10 rounded-full border border-forest-500 text-xs font-black uppercase tracking-widest text-forest-400">
            <Calculator size={16} />
            Profit Intel
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Job Costing
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Estimate vs. Actual Margin
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-black border border-white/5 text-xs font-black uppercase tracking-widest text-zinc-400">
            <Clock size={14} className="text-forest-400" />
            Labor @ ${hourlyRate}/hr
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest whitespace-nowrap border-4 border-transparent bg-forest-500/10 text-forest-400 hover:bg-forest-500/20 transition-colors shrink-0 disabled:opacity-40"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Recompute
          </button>
        </div>
      </header>

      {/* Summary metric cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            icon={DollarSign}
            tone="celtic"
            label="Total Revenue"
            value={money(summary.totalRevenue)}
            sub={`${rows.length} job${rows.length === 1 ? "" : "s"} tracked`}
          />
          <MetricCard
            icon={Receipt}
            tone="rose"
            label="Total Cost"
            value={money(summary.totalCost)}
            sub={
              <>
                Labor {money(summary.totalLabor)} · Mat/Other{" "}
                {money(summary.totalMaterial)}
                {summary.anyEst ? <EstTag /> : null}
              </>
            }
          />
          <MetricCard
            icon={summary.blendedMarginPct >= 15 ? TrendingUp : TrendingDown}
            tone={
              summary.blendedMarginPct >= 40
                ? "forest"
                : summary.blendedMarginPct >= 15
                  ? "amber"
                  : "rose"
            }
            label="Blended Margin"
            value={pct(summary.blendedMarginPct)}
            sub={`${money(summary.blendedMargin)} gross profit`}
            valueClass={blendedBand.text}
          />
        </div>
      )}

      {/* Per-job table */}
      <section className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-8 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Percent size={22} className="text-forest-400" />
            <div>
              <h3 className="text-xl font-black text-white italic tracking-tight uppercase leading-none">
                Margin By Job
              </h3>
              <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em] mt-1.5 text-[10px]">
                Lowest margin first
              </p>
            </div>
          </div>
          {!loading && rows.length > 0 && (
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
              <LegendDot color="bg-forest-400" label=">40%" />
              <LegendDot color="bg-amber-400" label="15–40%" />
              <LegendDot color="bg-rose-400" label="<15%" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Calculator}
              title="No jobs to cost yet"
              description="Once you schedule jobs and log revenue, labor, and materials, real-time margins will appear here — sorted by the jobs that need attention first."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-white/30">
                  <th className="px-8 py-4">Job</th>
                  <th className="px-4 py-4 text-right">Revenue</th>
                  <th className="px-4 py-4 text-right">Labor</th>
                  <th className="px-4 py-4 text-right">Material / Other</th>
                  <th className="px-4 py-4 text-right">Margin $</th>
                  <th className="px-8 py-4 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r, i) => {
                  const band = marginBand(r.marginPct);
                  return (
                    <motion.tr
                      key={r.id || i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.4) }}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Job + client + status */}
                      <td className="px-8 py-5 align-top">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${band.dot} shadow-glow`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white italic uppercase truncate group-hover:text-forest-400 transition-colors">
                              {r.title}
                            </p>
                            <p className="micro-label font-black text-white/25 uppercase tracking-widest text-[10px] mt-0.5 truncate">
                              {String(r.client)} ·{" "}
                              {r.status || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Revenue */}
                      <td className="px-4 py-5 text-right align-top">
                        <span className="text-sm font-black text-white italic">
                          {money(r.revenue)}
                        </span>
                        {r.revenueIsEst && r.revenue > 0 ? (
                          <EstTag title="From job estimate (no billed invoice linked)" />
                        ) : null}
                        <p className="micro-label font-black text-white/20 uppercase tracking-widest text-[9px] mt-0.5">
                          {r.revenueIsBilled ? "Billed" : "Quoted"}
                        </p>
                      </td>

                      {/* Labor */}
                      <td className="px-4 py-5 text-right align-top">
                        <span className="text-sm font-black text-white/80 italic">
                          {money(r.laborCost)}
                        </span>
                        {r.laborIsEst ? <EstTag title="Allocated — no timesheet linked to this job" /> : null}
                        <p className="micro-label font-black text-white/20 uppercase tracking-widest text-[9px] mt-0.5">
                          {r.laborHours.toFixed(1)} hrs
                        </p>
                      </td>

                      {/* Material / other */}
                      <td className="px-4 py-5 text-right align-top">
                        <span className="text-sm font-black text-white/80 italic">
                          {money(r.materialCost)}
                        </span>
                        {r.materialIsEst ? <EstTag title="Allocated — no material logs/expenses linked to this job" /> : null}
                      </td>

                      {/* Margin $ */}
                      <td className="px-4 py-5 text-right align-top">
                        <span
                          className={`text-sm font-black italic ${band.text}`}
                        >
                          {money(r.marginDollars)}
                        </span>
                      </td>

                      {/* Margin % */}
                      <td className="px-8 py-5 text-right align-top">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-black italic ${band.bg} ${band.border} border ${band.text}`}
                        >
                          {r.marginPct >= 15 ? (
                            <TrendingUp size={13} />
                          ) : (
                            <TrendingDown size={13} />
                          )}
                          {pct(r.marginPct)}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Methodology footnote — honesty about how figures are derived */}
      {!loading && rows.length > 0 && (
        <div className="flex items-start gap-3 px-6 py-5 rounded-2xl bg-black/40 border border-white/5 text-xs text-white/40 font-bold leading-relaxed">
          <Info size={16} className="text-forest-400 shrink-0 mt-0.5" />
          <p>
            Revenue uses billed invoices when a job is linked, otherwise the job's
            quoted amount. Labor = logged timesheet hours × ${hourlyRate}/hr.
            Material / other = material-log consumption (× inventory unit cost) plus
            linked expenses. Figures tagged{" "}
            <span className="inline-flex items-center gap-1 align-middle rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">
              <Info size={9} /> est.
            </span>{" "}
            could not be resolved to a specific job and are evenly allocated across
            active jobs.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// small presentational pieces (kept local — page-only)
// ---------------------------------------------------------------------------

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "forest",
  valueClass = "text-white",
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "forest" | "celtic" | "amber" | "rose";
  valueClass?: string;
}) {
  const tones: Record<string, string> = {
    forest: "text-forest-400 bg-forest-500/10 border-forest-500/20",
    celtic: "text-celtic-400 bg-celtic-500/10 border-celtic-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl p-8 relative overflow-hidden group"
    >
      <div className="flex items-center justify-between mb-6">
        <p className="micro-label font-black text-white/30 uppercase tracking-[0.3em] text-[10px]">
          {label}
        </p>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center border ${tones[tone]}`}
        >
          <Icon size={18} />
        </div>
      </div>
      <p
        className={`text-4xl font-black italic tracking-tighter leading-none ${valueClass}`}
      >
        {value}
      </p>
      {sub != null && (
        <p className="micro-label font-black text-white/25 uppercase tracking-widest text-[10px] mt-4">
          {sub}
        </p>
      )}
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-white/30">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
