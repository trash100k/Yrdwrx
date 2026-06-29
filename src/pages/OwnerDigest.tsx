// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Newspaper,
  RefreshCw,
  Mail,
  Sparkles,
  DollarSign,
  TrendingDown,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Lightbulb,
  Calendar,
  Users,
} from "lucide-react";
import {
  jobsRepo,
  invoicesRepo,
  expensesRepo,
  leadsRepo,
  timesheetsRepo,
  customersRepo,
  reviewsRepo,
} from "../lib/repos";
import { fetchApi } from "../lib/api";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

// Flatten a repo row: top-level cols win over the freeform jsonb in r.data.
const flat = (r: any) => ({ ...(r?.data || {}), ...r });

// Best-effort date parse off whatever timestamp a row carries.
const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v?.toDate) try { return v.toDate(); } catch { /* fall through */ }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const money = (n: any) =>
  typeof n === "number" && isFinite(n)
    ? `$${Math.round(n).toLocaleString()}`
    : "—";

// Period -> [start, end] window.
function periodWindow(period: "week" | "month"): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  if (period === "week") {
    const day = (start.getDay() + 6) % 7; // 0 = Monday
    start.setDate(start.getDate() - day);
  } else {
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

interface Metrics {
  revenue: number;
  cost: number;
  marginPct: number | null;
  jobsCompleted: number;
  overdueAr: number;
  newLeads: number;
  atRisk: number;
  utilizationPct?: number; // omitted when not derivable
}

interface DigestSection {
  title: string;
  items: string[];
}
interface Digest {
  headline?: string;
  summary?: string;
  sections?: DigestSection[];
  recommendations?: string[];
  simulated?: boolean;
}

export default function OwnerDigest() {
  const { tenant } = useTenant();
  const { showToast } = useToast();

  const [period, setPeriod] = useState<"week" | "month">("week");

  // Raw repo rows (subscribed once, re-scoped client-side by period).
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [digest, setDigest] = useState<Digest | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  // ---- Subscribe to every domain we aggregate over -------------------------
  useEffect(() => {
    let mounted = true;
    const pending = new Set([
      "jobs", "invoices", "expenses", "leads", "timesheets", "customers", "reviews",
    ]);
    const done = (k: string) => {
      pending.delete(k);
      if (mounted && pending.size === 0) setLoadingData(false);
    };
    const safe = (repo: any, key: string, set: (rows: any[]) => void) => {
      try {
        return repo.subscribe((rows: any[]) => {
          if (!mounted) return;
          set(Array.isArray(rows) ? rows.map(flat) : []);
          done(key);
        });
      } catch (e) {
        console.error(`[owner-digest] subscribe ${key} failed`, e);
        done(key);
        return () => {};
      }
    };
    const unsubs = [
      safe(jobsRepo, "jobs", setJobs),
      safe(invoicesRepo, "invoices", setInvoices),
      safe(expensesRepo, "expenses", setExpenses),
      safe(leadsRepo, "leads", setLeads),
      safe(timesheetsRepo, "timesheets", setTimesheets),
      safe(customersRepo, "customers", setCustomers),
      safe(reviewsRepo, "reviews", setReviews),
    ];
    // Safety: never hang the skeleton forever if a channel is silent.
    const t = setTimeout(() => mounted && setLoadingData(false), 8000);
    return () => {
      mounted = false;
      clearTimeout(t);
      unsubs.forEach((u) => { try { u && u(); } catch { /* noop */ } });
    };
  }, []);

  // ---- Compute aggregates for the active period ----------------------------
  const metrics = useMemo<Metrics>(() => {
    const { start, end } = periodWindow(period);
    const inWindow = (d: Date | null) => !!d && d >= start && d <= end;

    // Revenue: paid + sent invoices dated within the window.
    let revenue = 0;
    let overdueAr = 0;
    const now = new Date();
    for (const r of invoices) {
      const status = String(r.status || "").toUpperCase();
      const amt = Number(r.amount ?? r.total ?? 0) || 0;
      const issued = toDate(r.date || r.createdAt || r.created_at);
      const isRevenue = status === "PAID" || status === "SENT" || status === "PENDING";
      if (isRevenue && inWindow(issued)) revenue += amt;
      // Overdue AR: unpaid and past due (point-in-time, not period-scoped).
      const unpaid = status !== "PAID" && status !== "DRAFT" && status !== "VOID" && status !== "CANCELED";
      const due = toDate(r.dueDate || r.due_date);
      if (unpaid && due && due < now) overdueAr += amt;
    }

    // Cost: expenses dated within the window.
    let cost = 0;
    for (const r of expenses) {
      const d = toDate(r.date || r.createdAt || r.created_at);
      if (inWindow(d)) cost += Number(r.amount ?? r.cost ?? r.total ?? 0) || 0;
    }

    // Jobs completed in window (UPPERCASE status).
    let jobsCompleted = 0;
    for (const r of jobs) {
      if (String(r.status || "").toUpperCase() !== "COMPLETED") continue;
      const d = toDate(r.completedAt || r.completed_at || r.date || r.updatedAt || r.updated_at);
      // If a completed job has no usable date, count it for "month" (broad) but not "week".
      if (d ? inWindow(d) : period === "month") jobsCompleted += 1;
    }

    // New leads created in window.
    let newLeads = 0;
    for (const r of leads) {
      const d = toDate(r.createdAt || r.created_at || r.date);
      if (inWindow(d)) newLeads += 1;
    }

    // At-risk customers: cheaply derivable signal — a customer with a recent
    // negative review (rating <= 2). Only counts when reviews carry a rating.
    let atRisk = 0;
    const ratedNegative = reviews.filter((r) => {
      const rating = Number(r.rating ?? r.stars ?? NaN);
      return isFinite(rating) && rating <= 2;
    });
    if (ratedNegative.length) {
      const ids = new Set(
        ratedNegative
          .map((r) => r.customerId || r.customer_id || r.customer)
          .filter(Boolean),
      );
      atRisk = ids.size || ratedNegative.length;
    }

    // Crew utilization: only emit if we have real timesheet minutes in the window.
    // We have no reliable scheduled-capacity baseline, so we express utilization as
    // a rough ratio of logged hours to an 8h/day-per-active-worker assumption and
    // flag it "est." in the UI. If no timesheets, omit entirely (no faking).
    let utilizationPct: number | undefined = undefined;
    const periodTimesheets = timesheets.filter((t) =>
      inWindow(toDate(t.clockIn || t.clock_in)),
    );
    if (periodTimesheets.length) {
      let workedMins = 0;
      for (const t of periodTimesheets) {
        if (typeof t.durationMins === "number") workedMins += t.durationMins;
        else {
          const a = toDate(t.clockIn || t.clock_in);
          const b = toDate(t.clockOut || t.clock_out);
          if (a && b && b > a) workedMins += Math.floor((b.getTime() - a.getTime()) / 60000);
        }
      }
      const workers = new Set(
        periodTimesheets.map((t) => t.userId || t.user_id || t.userName).filter(Boolean),
      ).size || 1;
      const days = period === "week" ? 5 : 22; // rough working days in the window
      const capacityMins = workers * days * 8 * 60;
      if (capacityMins > 0) {
        utilizationPct = Math.min(100, Math.round((workedMins / capacityMins) * 100));
      }
    }

    const marginPct =
      revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : null;

    return {
      revenue,
      cost,
      marginPct,
      jobsCompleted,
      overdueAr,
      newLeads,
      atRisk,
      ...(utilizationPct != null ? { utilizationPct } : {}),
    };
  }, [period, jobs, invoices, expenses, leads, timesheets, reviews]);

  const hasAnyData =
    invoices.length || jobs.length || expenses.length || leads.length || customers.length;

  // ---- Generate the AI digest ----------------------------------------------
  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetchApi("/api/agent/owner-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metrics, // only the metrics we actually computed (utilization omitted when null)
          period: period === "week" ? "this week" : "this month",
        }),
      });
      if (!res.ok) {
        let msg = "Couldn't generate your digest.";
        try { const e = await res.json(); if (e?.error) msg = e.error; } catch { /* noop */ }
        throw new Error(msg);
      }
      const data = await res.json();
      setDigest(data);
      if (data?.simulated) {
        showToast("Digest generated in simulation mode (no AI key).", "info");
      }
    } catch (err: any) {
      console.error("[owner-digest] generate failed", err);
      setDigest(null);
      showToast(err?.message || "Couldn't generate your digest.", "error");
    } finally {
      setGenerating(false);
    }
  }, [metrics, period, showToast]);

  // Auto-generate once data is loaded (and when the period changes).
  useEffect(() => {
    if (loadingData) return;
    if (!hasAnyData) return;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, loadingData]);

  // ---- Owner email (for the "Email me this digest" action) -----------------
  const ownerEmail =
    tenant?.settings?.ownerEmail ||
    tenant?.contactEmail ||
    (tenant as any)?.email ||
    "";

  const digestPlainText = useMemo(() => {
    if (!digest) return "";
    const lines: string[] = [];
    if (digest.headline) lines.push(digest.headline.toUpperCase(), "");
    if (digest.summary) lines.push(digest.summary, "");
    lines.push(
      "KEY METRICS",
      `  Revenue: ${money(metrics.revenue)}`,
      `  Cost: ${money(metrics.cost)}`,
      `  Margin: ${metrics.marginPct != null ? metrics.marginPct + "%" : "—"}`,
      `  Jobs completed: ${metrics.jobsCompleted}`,
      `  Overdue AR: ${money(metrics.overdueAr)}`,
      `  New leads: ${metrics.newLeads}`,
      `  At-risk customers: ${metrics.atRisk}`,
      ...(metrics.utilizationPct != null
        ? [`  Crew utilization (est.): ${metrics.utilizationPct}%`]
        : []),
      "",
    );
    (digest.sections || []).forEach((s) => {
      lines.push((s.title || "").toUpperCase());
      (s.items || []).forEach((it) => lines.push(`  - ${it}`));
      lines.push("");
    });
    if (digest.recommendations?.length) {
      lines.push("RECOMMENDATIONS");
      digest.recommendations.forEach((r) => lines.push(`  - ${r}`));
    }
    return lines.join("\n");
  }, [digest, metrics]);

  const emailDigest = useCallback(async () => {
    if (!ownerEmail || !digest) return;
    setSending(true);
    try {
      const res = await fetchApi("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: ownerEmail,
          subject: digest.headline || "Your YardWorx business digest",
          text: digestPlainText,
        }),
      });
      if (!res.ok) {
        let msg = "Couldn't send the digest.";
        try { const e = await res.json(); if (e?.error) msg = e.error; } catch { /* noop */ }
        throw new Error(msg);
      }
      const data = await res.json();
      if (data?.sent) {
        showToast(`Digest emailed to ${ownerEmail}.`, "success");
      } else if (data?.simulated) {
        showToast(
          `Email simulated — not actually sent (${data?.reason || "email not configured"}).`,
          "info",
        );
      } else {
        showToast("Email request completed.", "info");
      }
    } catch (err: any) {
      console.error("[owner-digest] email failed", err);
      showToast(err?.message || "Couldn't send the digest.", "error");
    } finally {
      setSending(false);
    }
  }, [ownerEmail, digest, digestPlainText, showToast]);

  // ---- Metric tiles --------------------------------------------------------
  const tiles = [
    { label: "Revenue", value: money(metrics.revenue), icon: DollarSign, tone: "text-forest-400" },
    { label: "Cost", value: money(metrics.cost), icon: TrendingDown, tone: "text-amber-400" },
    {
      label: "Margin",
      value: metrics.marginPct != null ? `${metrics.marginPct}%` : "—",
      icon: Percent,
      tone: metrics.marginPct != null && metrics.marginPct < 0 ? "text-rose-400" : "text-celtic-400",
    },
    { label: "Jobs Done", value: String(metrics.jobsCompleted), icon: CheckCircle2, tone: "text-forest-400" },
    {
      label: "Overdue AR",
      value: money(metrics.overdueAr),
      icon: AlertTriangle,
      tone: metrics.overdueAr > 0 ? "text-rose-400" : "text-zinc-400",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-forest-500/15 text-forest-400 flex items-center justify-center border border-forest-500/20">
            <Newspaper size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">
              Owner Digest
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Your AI state-of-the-business brief
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Period toggle */}
          <div className="flex items-center rounded-2xl border border-white/10 bg-black/30 p-1">
            {([
              ["week", "This Week"],
              ["month", "This Month"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  period === key
                    ? "bg-white text-black shadow-lg"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <Calendar size={11} className="inline mr-1.5 -mt-0.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={generating || loadingData || !hasAnyData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw size={13} className={generating ? "animate-spin" : ""} />
            Regenerate
          </button>

          <button
            onClick={emailDigest}
            disabled={sending || !ownerEmail || !digest}
            title={!ownerEmail ? "No owner email on file (set it in Settings)" : "Email me this digest"}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-forest-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-forest-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            Email Me This
          </button>
        </div>
      </div>

      {!ownerEmail && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 -mt-4">
          No owner email on file — add one in Settings to enable emailing this digest.
        </p>
      )}

      {/* Metric tiles (transparent, computed client-side) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="rounded-2xl border border-white/5 bg-black/30 p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  {t.label}
                </span>
                <Icon size={14} className={t.tone} />
              </div>
              {loadingData ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <span className={`text-2xl font-black italic tracking-tight ${t.tone}`}>
                  {t.value}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Secondary metrics row (leads / at-risk / utilization) */}
      <div className="flex flex-wrap items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-white/50">
        <span>
          <span className="text-white font-black">{metrics.newLeads}</span> new leads
        </span>
        <span>
          <span className="text-white font-black">{metrics.atRisk}</span> at-risk customers
        </span>
        {metrics.utilizationPct != null && (
          <span className="flex items-center gap-1.5">
            <Users size={12} className="text-celtic-400" />
            <span className="text-white font-black">{metrics.utilizationPct}%</span> crew utilization (est.)
          </span>
        )}
      </div>

      {/* Digest body */}
      {loadingData ? (
        <DigestSkeleton />
      ) : !hasAnyData ? (
        <EmptyState
          icon={Newspaper}
          title="Nothing to brief yet"
          description="Once you've logged jobs, invoices, expenses or leads, your AI Owner Digest will summarize the state of your business here."
        />
      ) : generating ? (
        <DigestSkeleton />
      ) : !digest ? (
        <div className="rounded-3xl border border-white/5 bg-black/20 p-12 text-center space-y-4">
          <p className="text-sm font-bold text-white/60">
            We couldn't generate your digest right now.
          </p>
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
          >
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={period + (digest.headline || "")}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Headline + summary */}
            <div className="rounded-[32px] border border-white/10 bg-linear-to-br from-forest-500/10 to-celtic-500/5 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-forest-500/5 blur-3xl -mr-32 -mt-32" />
              <div className="flex items-center gap-2 mb-4 relative">
                <Sparkles size={15} className="text-forest-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-forest-400/70">
                  {digest.simulated ? "Simulated brief" : "AI brief"} ·{" "}
                  {period === "week" ? "This week" : "This month"}
                </span>
              </div>
              {digest.headline && (
                <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white leading-tight mb-4 relative">
                  {digest.headline}
                </h2>
              )}
              {digest.summary && (
                <p className="text-base md:text-lg font-medium text-white/80 leading-relaxed relative">
                  {digest.summary}
                </p>
              )}
            </div>

            {/* Sections as cards */}
            {!!digest.sections?.length && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {digest.sections.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/5 bg-black/30 p-6 space-y-4"
                  >
                    <h3 className="text-xs font-black uppercase tracking-widest text-celtic-400/80">
                      {s.title}
                    </h3>
                    <ul className="space-y-2.5">
                      {(s.items || []).map((it, j) => (
                        <li key={j} className="flex items-start gap-2.5">
                          <ChevronRight size={13} className="text-forest-400 mt-0.5 shrink-0" />
                          <span className="text-sm font-medium text-white/80 leading-snug">
                            {it}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {!!digest.recommendations?.length && (
              <div className="rounded-[32px] border border-forest-500/20 bg-forest-500/5 p-8">
                <div className="flex items-center gap-2 mb-6">
                  <Lightbulb size={16} className="text-forest-400" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">
                    Recommendations
                  </h3>
                </div>
                <ol className="space-y-3">
                  {digest.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="w-7 h-7 shrink-0 rounded-xl bg-forest-500/20 text-forest-400 text-xs font-black flex items-center justify-center border border-forest-500/30">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-white/85 leading-relaxed pt-1">
                        {r}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 text-center pt-2">
              Generated from your own logged data. Figures labeled "est." are approximations.
            </p>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function DigestSkeleton() {
  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-white/10 bg-black/20 p-8 space-y-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-black/30 p-6 space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
      <div className="rounded-[32px] border border-white/5 bg-black/20 p-8 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
