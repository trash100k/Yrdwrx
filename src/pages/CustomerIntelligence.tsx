// @ts-nocheck
// Customer Intelligence — fuses CHURN-RISK RADAR with PER-CUSTOMER PROFITABILITY / LTV.
//
// The two things an owner actually pays for, on one screen:
//   1) Churn Radar      — which customers are about to leave, why, and a one-click save play.
//   2) Profitability    — what each customer is worth (LTV) vs. what they cost, with a verdict.
//
// All figures are computed best-effort from REAL repo rows. When a cost component cannot be
// resolved to a customer we either skip it or tag it "est." rather than fabricate a number.
//
// Per customer:
//   Lifetime revenue (LTV) = sum of that customer's invoices (matched by id, else by name).
//   Estimated cost         = labor (timesheet hours on their jobs × rate) + materials/expenses
//                            linked to those jobs. Tagged "est." when only partially resolvable.
//   Margin $/%             = revenue - cost. Color: forest >40%, amber 15-40%, rose <15%.
//   Health score 0-100     = 100 minus penalties (stale last job, overdue invoices, weak review
//                            sentiment, declined/cancelled jobs, at-risk/pending contracts).

import React, { useEffect, useMemo, useState } from "react";
import {
  Radar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  HeartPulse,
  AlertTriangle,
  RefreshCw,
  Info,
  Sparkles,
  X,
  Mail,
  Send,
  Users,
  ArrowUpRight,
  Percent,
  Loader2,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  customersRepo,
  jobsRepo,
  invoicesRepo,
  expensesRepo,
  timesheetsRepo,
  materialLogsRepo,
  reviewsRepo,
  contractsRepo,
} from "../lib/repos";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { fetchApi } from "../lib/api";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Flatten a repo row's freeform jsonb (data) under its top-level columns.
const flatten = (r: any) => ({ ...(r?.data || {}), ...r });

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const pct = (n: number) => `${n >= 0 ? "" : "-"}${Math.abs(n).toFixed(0)}%`;

const DAY = 1000 * 60 * 60 * 24;

const customerName = (c: any) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
  c.companyName ||
  c.name ||
  c.email ||
  "Unnamed Customer";

// Pull a customer id off a row under any of the common field names.
const customerIdOf = (r: any) =>
  r?.customerId ?? r?.customer_id ?? r?.clientId ?? r?.client_id ?? null;

// Pull a job id off a satellite row under any common field name.
const jobIdOf = (r: any) => r?.jobId ?? r?.job_id ?? r?.associatedJobId ?? null;

// Best-effort date parse -> epoch ms, or null.
const ms = (v: any) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

const fmtDate = (epoch: number | null) =>
  epoch ? new Date(epoch).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

// Margin color band: forest >40%, amber 15-40%, rose <15%.
const marginBand = (marginPct: number) => {
  if (marginPct >= 40)
    return { text: "text-forest-400", bg: "bg-forest-500/10", border: "border-forest-500/30", dot: "bg-forest-400" };
  if (marginPct >= 15)
    return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400" };
  return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", dot: "bg-rose-400" };
};

// Health buckets: Healthy >=70 forest, Watch 40-69 amber, At-risk <40 rose.
const healthBand = (score: number) => {
  if (score >= 70)
    return { label: "Healthy", text: "text-forest-400", bg: "bg-forest-500/10", border: "border-forest-500/30", dot: "bg-forest-400" };
  if (score >= 40)
    return { label: "Watch", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400" };
  return { label: "At-risk", text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", dot: "bg-rose-400" };
};

// Profitability verdict derived purely from margin %.
const verdictFor = (marginPct: number) => {
  if (marginPct < 15)
    return { label: "Raise price or drop", text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", icon: TrendingDown };
  if (marginPct <= 40)
    return { label: "Keep, monitor", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: Percent };
  return { label: "Keep + upsell", text: "text-forest-400", bg: "bg-forest-500/10", border: "border-forest-500/30", icon: ArrowUpRight };
};

// Inline estimate marker.
function EstTag({ title }: { title?: string }) {
  return (
    <span
      title={title || "Estimated — could not be fully resolved to this customer"}
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

export default function CustomerIntelligence() {
  const { tenant } = useTenant();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState<"radar" | "profit">("radar");

  // Save-play modal state.
  const [playFor, setPlayFor] = useState<any>(null); // the customer row the play is for
  const [play, setPlay] = useState<any>(null); // generated play payload
  const [playLoading, setPlayLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const hourlyRate = useMemo(() => {
    const s = (tenant?.settings as any) || {};
    return num(s.laborRate) || num(s.hourlyRate) || num(s.defaultHourlyRate) || num(s.crewHourlyRate) || 35;
  }, [tenant]);

  const load = async () => {
    setLoading(true);
    try {
      const [
        customerRowsRaw,
        jobRowsRaw,
        invoiceRowsRaw,
        expenseRowsRaw,
        timesheetRowsRaw,
        materialRowsRaw,
        reviewRowsRaw,
        contractRowsRaw,
      ] = await Promise.all([
        customersRepo.list(),
        jobsRepo.list().catch(() => []),
        invoicesRepo.list().catch(() => []),
        expensesRepo.list().catch(() => []),
        timesheetsRepo.list().catch(() => []),
        materialLogsRepo.list().catch(() => []),
        reviewsRepo.list().catch(() => []),
        contractsRepo.list().catch(() => []),
      ]);

      const customers = (customerRowsRaw || []).map(flatten);
      const jobs = (jobRowsRaw || []).map(flatten);
      const invoices = (invoiceRowsRaw || []).map(flatten);
      const expenses = (expenseRowsRaw || []).map(flatten);
      const timesheets = (timesheetRowsRaw || []).map(flatten);
      const materials = (materialRowsRaw || []).map(flatten);
      const reviews = (reviewRowsRaw || []).map(flatten);
      const contracts = (contractRowsRaw || []).map(flatten);

      const now = Date.now();

      // --- name -> customer lookup for invoices that only carry a client name -----
      const byNameLower: Record<string, any> = {};
      for (const c of customers) {
        const n = customerName(c).toLowerCase().trim();
        if (n) byNameLower[n] = c;
        if (c.companyName) byNameLower[String(c.companyName).toLowerCase().trim()] = c;
      }
      const matchInvoiceCustomerId = (inv: any) => {
        const direct = customerIdOf(inv);
        if (direct) return direct;
        const label = (inv.client || inv.customer || inv.customerName || "").toString().toLowerCase().trim();
        if (label && byNameLower[label]) return byNameLower[label].id;
        return null;
      };

      // --- jobs grouped by customer ---------------------------------------------
      const jobsByCustomer: Record<string, any[]> = {};
      const jobToCustomer: Record<string, string> = {};
      for (const j of jobs) {
        let cid = customerIdOf(j);
        if (!cid) {
          const label = (j.client || j.customerName || "").toString().toLowerCase().trim();
          if (label && byNameLower[label]) cid = byNameLower[label].id;
        }
        if (!cid) continue;
        (jobsByCustomer[cid] = jobsByCustomer[cid] || []).push(j);
        if (j.id) jobToCustomer[j.id] = cid;
      }

      // --- labor minutes by customer (via their jobs) ----------------------------
      const laborMinsByCustomer: Record<string, number> = {};
      let anyLaborResolved = false;
      for (const t of timesheets) {
        let mins = num(t.durationMins) || num(t.minutes);
        if (!mins && t.clockIn && t.clockOut) {
          mins = Math.max(0, (new Date(t.clockOut).getTime() - new Date(t.clockIn).getTime()) / 60000);
        }
        if (!mins) continue;
        const jid = jobIdOf(t);
        const cid = (jid && jobToCustomer[jid]) || customerIdOf(t);
        if (!cid) continue;
        laborMinsByCustomer[cid] = (laborMinsByCustomer[cid] || 0) + mins;
        anyLaborResolved = true;
      }

      // --- material + expense cost by customer (via their jobs) -------------------
      const otherCostByCustomer: Record<string, number> = {};
      const matLine = (m: any) =>
        num(m.quantity) * (num(m.unitCost) || num(m.unitPrice) || 0) || num(m.cost) || num(m.total) || 0;
      for (const m of materials) {
        if (m.type && String(m.type).toLowerCase() === "in") continue; // restock, not job cost
        const cost = matLine(m);
        if (!cost) continue;
        const jid = jobIdOf(m);
        const cid = (jid && jobToCustomer[jid]) || customerIdOf(m);
        if (!cid) continue;
        otherCostByCustomer[cid] = (otherCostByCustomer[cid] || 0) + cost;
      }
      for (const x of expenses) {
        const cost = num(x.amount) || num(x.cost) || num(x.total);
        if (!cost) continue;
        const jid = jobIdOf(x);
        const cid = (jid && jobToCustomer[jid]) || customerIdOf(x);
        if (!cid) continue;
        otherCostByCustomer[cid] = (otherCostByCustomer[cid] || 0) + cost;
      }

      // --- revenue (LTV) + overdue/unpaid flags by customer ----------------------
      const revenueByCustomer: Record<string, number> = {};
      const overdueByCustomer: Record<string, number> = {};
      for (const inv of invoices) {
        const cid = matchInvoiceCustomerId(inv);
        if (!cid) continue;
        const amt = num(inv.amount) || num(inv.total);
        revenueByCustomer[cid] = (revenueByCustomer[cid] || 0) + amt;
        const status = String(inv.status || "").toUpperCase();
        const due = ms(inv.dueDate);
        const isOverdue = status === "OVERDUE" || (status !== "PAID" && due && due < now);
        const isUnpaid = status === "PENDING" || status === "OVERDUE";
        if (isOverdue || isUnpaid) overdueByCustomer[cid] = (overdueByCustomer[cid] || 0) + 1;
      }

      // --- reviews (rating/sentiment) by customer --------------------------------
      const reviewByCustomer: Record<string, { rating: number | null; sentiment: string | null }> = {};
      for (const rv of reviews) {
        const cid = customerIdOf(rv);
        if (!cid) continue;
        const rating = Number.isFinite(Number(rv.rating)) ? Number(rv.rating) : null;
        const sentiment = (rv.sentiment || "").toString().toUpperCase() || null;
        const prev = reviewByCustomer[cid];
        // Keep the lowest signal (worst rating / negative sentiment) — that's what matters for churn.
        if (!prev) reviewByCustomer[cid] = { rating, sentiment };
        else {
          reviewByCustomer[cid] = {
            rating: rating != null && (prev.rating == null || rating < prev.rating) ? rating : prev.rating,
            sentiment: sentiment === "NEGATIVE" ? "NEGATIVE" : prev.sentiment || sentiment,
          };
        }
      }

      // --- contracts by customer (status) ----------------------------------------
      const contractStatusByCustomer: Record<string, string> = {};
      for (const ct of contracts) {
        const cid = customerIdOf(ct);
        if (!cid) continue;
        const st = String(ct.status || "").toLowerCase();
        if (st) contractStatusByCustomer[cid] = st;
      }

      // --- compose per-customer records ------------------------------------------
      const computed = customers.map((c) => {
        const id = c.id;
        const custJobs = jobsByCustomer[id] || [];

        // Last completed job date.
        let lastJobMs: number | null = null;
        let declinedCount = 0;
        for (const j of custJobs) {
          const st = String(j.status || "").toUpperCase();
          if (st === "COMPLETED") {
            const d = ms(j.completedAt) || ms(j.date) || ms(j.updatedAt) || ms(j.createdAt);
            if (d && (!lastJobMs || d > lastJobMs)) lastJobMs = d;
          }
          if (st === "CANCELED" || st === "CANCELLED" || st === "DECLINED") declinedCount++;
        }
        const daysSinceJob = lastJobMs ? Math.floor((now - lastJobMs) / DAY) : null;

        // Revenue / cost / margin.
        const revenue = revenueByCustomer[id] || 0;
        const ltv = revenue;
        const laborMins = laborMinsByCustomer[id] || 0;
        const laborCost = (laborMins / 60) * hourlyRate;
        const otherCost = otherCostByCustomer[id] || 0;
        const estCost = laborCost + otherCost;
        // Cost is "est." if we have revenue but couldn't resolve any cost component for this customer.
        const costResolved = laborMins > 0 || otherCost > 0;
        const costIsEst = revenue > 0 && !costResolved;
        const marginDollars = revenue - estCost;
        const marginPct = revenue > 0 ? (marginDollars / revenue) * 100 : 0;

        // --- health score + reasons ----------------------------------------------
        let score = 100;
        const reasons: string[] = [];

        if (daysSinceJob != null) {
          if (daysSinceJob > 180) {
            score -= 35;
            reasons.push(`No completed job in ${daysSinceJob} days`);
          } else if (daysSinceJob > 90) {
            score -= 20;
            reasons.push(`${daysSinceJob} days since last job`);
          } else if (daysSinceJob > 45) {
            score -= 8;
            reasons.push(`${daysSinceJob} days since last job`);
          }
        }

        const overdue = overdueByCustomer[id] || 0;
        if (overdue > 0) {
          score -= Math.min(25, 12 + overdue * 6);
          reasons.push(`${overdue} overdue / unpaid invoice${overdue === 1 ? "" : "s"}`);
        }

        const rv = reviewByCustomer[id];
        if (rv) {
          if (rv.sentiment === "NEGATIVE" || (rv.rating != null && rv.rating <= 2)) {
            score -= 25;
            reasons.push(rv.rating != null ? `Low review rating (${rv.rating}/5)` : "Negative review sentiment");
          } else if (rv.rating != null && rv.rating === 3) {
            score -= 10;
            reasons.push("Lukewarm review (3/5)");
          }
        }

        if (declinedCount > 0) {
          score -= Math.min(20, declinedCount * 10);
          reasons.push(`${declinedCount} declined / cancelled job${declinedCount === 1 ? "" : "s"}`);
        }

        const cStatus = contractStatusByCustomer[id];
        if (cStatus === "at_risk") {
          score -= 20;
          reasons.push("Contract flagged at-risk");
        } else if (cStatus === "pending_renewal" || cStatus === "pending") {
          score -= 12;
          reasons.push("Contract pending renewal");
        }

        score = Math.max(0, Math.min(100, Math.round(score)));

        return {
          id,
          customer: c,
          name: customerName(c),
          email: c.email || null,
          phone: c.phone || null,
          ltv,
          revenue,
          estCost,
          costIsEst,
          costResolved,
          marginDollars,
          marginPct,
          health: score,
          reasons: reasons.slice(0, 3),
          lastJobMs,
          daysSinceJob,
        };
      });

      setRows(computed);
    } catch (err: any) {
      console.error("[CustomerIntelligence] load failed", err);
      showToast("Could not load customer intelligence.", "error");
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
    const totalLtv = rows.reduce((a, r) => a + r.ltv, 0);
    const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
    const totalCost = rows.reduce((a, r) => a + r.estCost, 0);
    const blendedMarginPct = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
    const atRisk = rows.filter((r) => r.health < 40).length;
    const anyEst = rows.some((r) => r.costIsEst);
    return { totalLtv, blendedMarginPct, atRisk, anyEst };
  }, [rows]);

  // --- sorted views ----------------------------------------------------------
  const radarRows = useMemo(() => [...rows].sort((a, b) => a.health - b.health), [rows]);
  const profitRows = useMemo(
    () => [...rows].sort((a, b) => b.marginDollars - a.marginDollars),
    [rows],
  );

  // --- save play actions -----------------------------------------------------
  const draftPlay = async (row: any) => {
    setPlayFor(row);
    setPlay(null);
    setPlayLoading(true);
    try {
      const res = await fetchApi("/api/agent/save-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: row.customer, signals: row.reasons }),
      });
      if (!res.ok) {
        const e = await res.text().catch(() => "");
        throw new Error(e || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data || !data.message) throw new Error("Empty save play");
      setPlay(data);
    } catch (err: any) {
      console.error("[save-play]", err);
      showToast("Could not draft a save play. Try again.", "error");
      setPlayFor(null);
    } finally {
      setPlayLoading(false);
    }
  };

  const sendPlayEmail = async () => {
    if (!playFor?.email || !play) return;
    setSending(true);
    try {
      const res = await fetchApi("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: playFor.email,
          subject: play.subject || "A note from your landscaping team",
          text: play.message,
        }),
      });
      if (!res.ok) {
        const e = await res.text().catch(() => "");
        throw new Error(e || `HTTP ${res.status}`);
      }
      const data = await res.json();
      // Honest reporting: the server tells us whether it actually sent or just simulated.
      if (data?.sent) {
        showToast(`Save play emailed to ${playFor.email}.`, "success");
      } else {
        showToast(
          `Email simulated — not actually sent${data?.reason ? ` (${data.reason})` : " (no email provider configured)"}.`,
          "warning",
        );
      }
    } catch (err: any) {
      console.error("[email/send]", err);
      showToast("Email failed to send.", "error");
    } finally {
      setSending(false);
    }
  };

  const closePlay = () => {
    if (sending) return;
    setPlayFor(null);
    setPlay(null);
  };

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-forest-500/10 rounded-full border border-forest-500 text-xs font-black uppercase tracking-widest text-forest-400">
            <Radar size={16} />
            Customer Intel
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Customer Intelligence
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Churn Risk &amp; Profitability
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-black border border-white/5 text-xs font-black uppercase tracking-widest text-zinc-400">
            <HeartPulse size={14} className="text-forest-400" />
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

      {/* Summary tiles */}
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
            tone="forest"
            label="Total LTV"
            value={money(summary.totalLtv)}
            sub={`${rows.length} customer${rows.length === 1 ? "" : "s"} tracked`}
          />
          <MetricCard
            icon={summary.blendedMarginPct >= 15 ? TrendingUp : TrendingDown}
            tone={summary.blendedMarginPct >= 40 ? "forest" : summary.blendedMarginPct >= 15 ? "amber" : "rose"}
            label="Blended Margin"
            value={pct(summary.blendedMarginPct)}
            valueClass={marginBand(summary.blendedMarginPct).text}
            sub={summary.anyEst ? <>across all customers <EstTag /></> : "across all customers"}
          />
          <MetricCard
            icon={AlertTriangle}
            tone={summary.atRisk > 0 ? "rose" : "forest"}
            label="At-Risk Customers"
            value={String(summary.atRisk)}
            valueClass={summary.atRisk > 0 ? "text-rose-400" : "text-forest-400"}
            sub={summary.atRisk > 0 ? "health below 40 — act now" : "no customers in the danger zone"}
          />
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/5 w-fit">
        <TabButton active={tab === "radar"} onClick={() => setTab("radar")} icon={Radar} label="Churn Radar" />
        <TabButton active={tab === "profit"} onClick={() => setTab("profit")} icon={DollarSign} label="Profitability" />
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl p-8 space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add customers and start logging jobs, invoices, and reviews. Churn-risk health scores and per-customer profitability will appear here automatically."
        />
      ) : tab === "radar" ? (
        <ChurnRadar rows={radarRows} onDraft={draftPlay} />
      ) : (
        <Profitability rows={profitRows} />
      )}

      {/* Methodology footnote */}
      {!loading && rows.length > 0 && (
        <div className="flex items-start gap-3 px-6 py-5 rounded-2xl bg-black/40 border border-white/5 text-xs text-white/40 font-bold leading-relaxed">
          <Info size={16} className="text-forest-400 shrink-0 mt-0.5" />
          <p>
            LTV = sum of a customer's invoices. Est. cost = logged labor (timesheet hours on their jobs ×
            ${hourlyRate}/hr) plus materials and expenses linked to those jobs. Health starts at 100 and
            loses points for stale last-job dates, overdue/unpaid invoices, weak review sentiment,
            declined/cancelled jobs, and at-risk or pending contracts. Figures tagged{" "}
            <span className="inline-flex items-center gap-1 align-middle rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">
              <Info size={9} /> est.
            </span>{" "}
            could not be fully resolved to a customer.
          </p>
        </div>
      )}

      {/* Save play modal */}
      <SavePlayModal
        open={!!playFor}
        loading={playLoading}
        play={play}
        customer={playFor}
        sending={sending}
        onClose={closePlay}
        onSend={sendPlayEmail}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Churn Radar view
// ---------------------------------------------------------------------------

function ChurnRadar({ rows, onDraft }: { rows: any[]; onDraft: (r: any) => void }) {
  return (
    <section className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden">
      <div className="p-8 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Radar size={22} className="text-forest-400" />
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tight uppercase leading-none">
              Churn Radar
            </h3>
            <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em] mt-1.5 text-[10px]">
              Lowest health first
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
          <LegendDot color="bg-forest-400" label="Healthy ≥70" />
          <LegendDot color="bg-amber-400" label="Watch 40–69" />
          <LegendDot color="bg-rose-400" label="At-risk <40" />
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {rows.map((r, i) => {
          const band = healthBand(r.health);
          return (
            <motion.div
              key={r.id || i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              className="px-8 py-6 hover:bg-white/[0.02] transition-colors flex flex-col lg:flex-row lg:items-center gap-6"
            >
              {/* Name + health */}
              <div className="flex items-center gap-4 lg:w-64 shrink-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${band.dot} shadow-glow`} />
                <div className="min-w-0">
                  <p className="text-sm font-black text-white italic uppercase truncate">{r.name}</p>
                  <span
                    className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${band.bg} ${band.border} ${band.text}`}
                  >
                    {band.label} · {r.health}
                  </span>
                </div>
              </div>

              {/* Reasons */}
              <div className="flex-1 min-w-0">
                {r.reasons.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {r.reasons.map((reason: string, k: number) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest text-rose-300"
                      >
                        <AlertTriangle size={10} />
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/25">
                    No risk signals
                  </span>
                )}
              </div>

              {/* Last job + LTV */}
              <div className="flex items-center gap-8 lg:w-72 shrink-0">
                <div>
                  <p className="micro-label font-black text-white/20 uppercase tracking-widest text-[9px]">Last job</p>
                  <p className="text-sm font-black text-white/80 italic">{fmtDate(r.lastJobMs)}</p>
                </div>
                <div>
                  <p className="micro-label font-black text-white/20 uppercase tracking-widest text-[9px]">LTV</p>
                  <p className="text-sm font-black text-white italic">{money(r.ltv)}</p>
                </div>
              </div>

              {/* Action */}
              <div className="shrink-0">
                <button
                  onClick={() => onDraft(r)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-forest-500/10 text-forest-400 border border-forest-500/30 hover:bg-forest-500/20 transition-colors whitespace-nowrap"
                >
                  <Sparkles size={14} />
                  Draft save play
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Profitability view
// ---------------------------------------------------------------------------

function Profitability({ rows }: { rows: any[] }) {
  return (
    <section className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden">
      <div className="p-8 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <DollarSign size={22} className="text-forest-400" />
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tight uppercase leading-none">
              Profitability
            </h3>
            <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em] mt-1.5 text-[10px]">
              Highest margin first
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
          <LegendDot color="bg-forest-400" label=">40%" />
          <LegendDot color="bg-amber-400" label="15–40%" />
          <LegendDot color="bg-rose-400" label="<15%" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-white/30">
              <th className="px-8 py-4">Customer</th>
              <th className="px-4 py-4 text-right">LTV</th>
              <th className="px-4 py-4 text-right">Est. Cost</th>
              <th className="px-4 py-4 text-right">Margin $</th>
              <th className="px-4 py-4 text-right">Margin %</th>
              <th className="px-8 py-4 text-right">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r, i) => {
              const band = marginBand(r.marginPct);
              const verdict = verdictFor(r.marginPct);
              const VIcon = verdict.icon;
              return (
                <motion.tr
                  key={r.id || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="px-8 py-5 align-top">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${band.dot} shadow-glow`} />
                      <p className="text-sm font-black text-white italic uppercase truncate group-hover:text-forest-400 transition-colors">
                        {r.name}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-right align-top">
                    <span className="text-sm font-black text-white italic">{money(r.ltv)}</span>
                  </td>
                  <td className="px-4 py-5 text-right align-top">
                    <span className="text-sm font-black text-white/80 italic">{money(r.estCost)}</span>
                    {r.costIsEst ? <EstTag title="No labor/material/expense linked to this customer" /> : null}
                  </td>
                  <td className="px-4 py-5 text-right align-top">
                    <span className={`text-sm font-black italic ${band.text}`}>{money(r.marginDollars)}</span>
                  </td>
                  <td className="px-4 py-5 text-right align-top">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-black italic ${band.bg} ${band.border} border ${band.text}`}
                    >
                      {r.marginPct >= 15 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {r.revenue > 0 ? pct(r.marginPct) : "—"}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right align-top">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${verdict.bg} ${verdict.border} border ${verdict.text}`}
                    >
                      <VIcon size={12} />
                      {verdict.label}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Save Play modal
// ---------------------------------------------------------------------------

function SavePlayModal({
  open,
  loading,
  play,
  customer,
  sending,
  onClose,
  onSend,
}: {
  open: boolean;
  loading: boolean;
  play: any;
  customer: any;
  sending: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  const { showToast } = useToast();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10 max-h-[85vh] flex flex-col"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-forest-500/10 border border-forest-500/20 text-forest-400 flex items-center justify-center shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white italic uppercase tracking-tight leading-none truncate">
                    Save Play
                  </h3>
                  <p className="micro-label font-black text-white/30 uppercase tracking-widest text-[10px] mt-1 truncate">
                    {customer?.name || "Customer"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={sending}
                className="text-zinc-500 hover:text-white transition-colors shrink-0 disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 size={28} className="text-forest-400 animate-spin" />
                  <p className="text-xs font-black uppercase tracking-widest text-white/40">
                    Drafting retention play…
                  </p>
                </div>
              ) : play ? (
                <>
                  {play.channel && (
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50">
                        Channel: {play.channel}
                      </span>
                      {play.offer && (
                        <span className="px-2.5 py-1 rounded-lg bg-forest-500/10 border border-forest-500/20 text-forest-400">
                          Offer: {play.offer}
                        </span>
                      )}
                    </div>
                  )}

                  {play.subject && (
                    <div>
                      <p className="micro-label font-black text-white/30 uppercase tracking-widest text-[10px] mb-1.5">
                        Subject
                      </p>
                      <p className="text-sm font-bold text-white">{play.subject}</p>
                    </div>
                  )}

                  <div>
                    <p className="micro-label font-black text-white/30 uppercase tracking-widest text-[10px] mb-1.5">
                      Message
                    </p>
                    <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap rounded-xl bg-black/40 border border-white/5 p-4">
                      {play.message}
                    </p>
                  </div>

                  {Array.isArray(play.reasoning) && play.reasoning.length > 0 && (
                    <div>
                      <p className="micro-label font-black text-white/30 uppercase tracking-widest text-[10px] mb-1.5">
                        Why this play
                      </p>
                      <ul className="space-y-1.5">
                        {play.reasoning.map((why: string, k: number) => (
                          <li key={k} className="flex items-start gap-2 text-xs text-zinc-400 font-bold leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-forest-400 mt-1.5 shrink-0" />
                            {why}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {!loading && play && (
              <div className="p-6 border-t border-white/10 flex gap-3">
                <button
                  onClick={onClose}
                  disabled={sending}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-40"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      play.subject ? `${play.subject}\n\n${play.message}` : play.message,
                    );
                    showToast("Message copied.", "success");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  <Copy size={16} />
                  Copy message
                </button>
                {customer?.email ? (
                  <button
                    onClick={onSend}
                    disabled={sending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-forest-500 hover:bg-forest-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-forest-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {sending ? "Sending…" : "Send email"}
                  </button>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/30 bg-white/5 border border-white/5">
                    <Mail size={14} />
                    No email on file
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// small presentational pieces
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
        active ? "bg-forest-500/15 text-forest-400 border border-forest-500/30" : "text-white/40 hover:text-white/70 border border-transparent"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

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
        <p className="micro-label font-black text-white/30 uppercase tracking-[0.3em] text-[10px]">{label}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-4xl font-black italic tracking-tighter leading-none ${valueClass}`}>{value}</p>
      {sub != null && (
        <p className="micro-label font-black text-white/25 uppercase tracking-widest text-[10px] mt-4">{sub}</p>
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
