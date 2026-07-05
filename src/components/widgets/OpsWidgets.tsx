// @ts-nocheck
// High-signal, real-data cockpit widgets. Every number here is a fold over the
// tenant's own RLS-scoped repo rows (computed in ../../lib/dashboardMetrics) — no
// fabricated figures, no placeholder crews/customers. Presentational only; the
// band memoizes the aggregates and hands each tile its slice.
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Banknote,
  Route as RouteIcon,
  AlertTriangle,
  HardHat,
  Star,
  Package,
  CheckCircle2,
} from "lucide-react";
import {
  computeArAging,
  computeTodaySchedule,
  computeJobsAtRisk,
  computeCrewUtilization,
  computeReviewPulse,
  computeLowStock,
  usd0,
} from "../../lib/dashboardMetrics";

// --- shared shell ------------------------------------------------------------
function TileShell({ to, accent, icon: Icon, kicker, children, ariaLabel }) {
  const body = (
    <div className="relative h-full bg-zinc-950 border border-white/5 molten-edge rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 overflow-hidden transition-all group hover:border-white/15">
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-40"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between relative z-10">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}1a`, color: accent }}
        >
          <Icon size={17} />
        </span>
        {to && (
          <ArrowUpRight
            size={15}
            className="text-zinc-600 group-hover:text-white transition-colors shrink-0"
          />
        )}
      </div>
      <div className="relative z-10 space-y-1">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">{kicker}</p>
        {children}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} aria-label={ariaLabel} className="block h-full focus:outline-none focus:ring-2 focus:ring-forest-500/50 rounded-2xl">
      {body}
    </Link>
  ) : (
    <div aria-label={ariaLabel} className="h-full">
      {body}
    </div>
  );
}

function TileSkeleton() {
  return <div className="h-[132px] rounded-2xl bg-zinc-950/60 border border-white/5 animate-pulse" />;
}

const BigNum = ({ children, className = "text-white" }) => (
  <p className={`text-2xl sm:text-3xl font-black italic tracking-tight leading-none ${className}`}>{children}</p>
);

// --- widgets -----------------------------------------------------------------

export function CashToCollectWidget({ aging, loading }) {
  if (loading) return <TileSkeleton />;
  const a = aging;
  const total = a.buckets.reduce((s, b) => s + b.amount, 0) || 1;
  const colors = ["#05A845", "#f49666", "#E85D04", "#C1292E", "#7b1d20"];
  return (
    <TileShell to="invoices" accent="#05A845" icon={Banknote} kicker="Cash to Collect" ariaLabel="Accounts receivable — open to invoices">
      <BigNum>{usd0(a.outstanding)}</BigNum>
      {a.count === 0 ? (
        <p className="text-[11px] font-semibold text-zinc-500">Nothing outstanding — all invoices settled.</p>
      ) : (
        <>
          <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/5 mt-1.5">
            {a.buckets.map((b, i) =>
              b.amount > 0 ? (
                <span key={b.label} style={{ width: `${(b.amount / total) * 100}%`, background: colors[i] }} />
              ) : null,
            )}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider">
            <span className={a.overdue > 0 ? "text-ember-400" : "text-forest-400"}>
              {a.overdue > 0 ? `${usd0(a.overdue)} overdue` : "Nothing overdue"}
            </span>
            <span className="text-zinc-600"> · {a.count} open</span>
          </p>
        </>
      )}
    </TileShell>
  );
}

export function TodayRouteWidget({ schedule, loading }) {
  if (loading) return <TileSkeleton />;
  const s = schedule;
  return (
    <TileShell to="routing" accent="#2ad16a" icon={RouteIcon} kicker="Today's Route" ariaLabel="Today's stops — open route optimizer">
      <div className="flex items-baseline gap-2">
        <BigNum>{s.todayCount}</BigNum>
        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
          stop{s.todayCount === 1 ? "" : "s"}
        </span>
      </div>
      {s.todayCount === 0 ? (
        <p className="text-[11px] font-semibold text-zinc-500">
          No jobs scheduled today.{s.upcomingCount > 0 ? ` ${s.upcomingCount} upcoming.` : ""}
        </p>
      ) : (
        <p className="text-[11px] font-bold uppercase tracking-wider">
          {s.todayRevenue > 0 && <span className="text-forest-400">{usd0(s.todayRevenue)} booked</span>}
          {s.overdueCount > 0 && <span className="text-ember-400">{s.todayRevenue > 0 ? " · " : ""}{s.overdueCount} behind</span>}
          {s.todayRevenue === 0 && s.overdueCount === 0 && <span className="text-zinc-500">Plan the drive order</span>}
        </p>
      )}
    </TileShell>
  );
}

export function JobsAtRiskWidget({ risk, loading }) {
  if (loading) return <TileSkeleton />;
  const r = risk;
  const clear = r.count === 0;
  return (
    <TileShell
      to="scheduler"
      accent={clear ? "#05A845" : "#E85D04"}
      icon={clear ? CheckCircle2 : AlertTriangle}
      kicker="Jobs at Risk"
      ariaLabel="Jobs at risk — open scheduler"
    >
      <div className="flex items-baseline gap-2">
        <BigNum className={clear ? "text-forest-400" : "text-ember-400"}>{r.count}</BigNum>
        {r.weatherRisk && <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">weather</span>}
      </div>
      {clear ? (
        <p className="text-[11px] font-semibold text-forest-400">On track — nothing behind or weather-blocked.</p>
      ) : (
        <p className="text-[11px] font-semibold text-zinc-400 line-clamp-2">
          {r.items[0].label}: <span className="text-zinc-500">{r.items[0].reason}</span>
          {r.count > 1 ? ` +${r.count - 1} more` : ""}
        </p>
      )}
    </TileShell>
  );
}

export function CrewUtilizationWidget({ util }) {
  const u = util;
  return (
    <TileShell to="crew-suite" accent="#2ad16a" icon={HardHat} kicker="Crew Utilization" ariaLabel="Crew utilization — open crew suite">
      {u.total === 0 ? (
        <>
          <BigNum className="text-zinc-500">—</BigNum>
          <p className="text-[11px] font-semibold text-zinc-500">No crews on the board yet.</p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <BigNum>{u.pct}%</BigNum>
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">deployed</span>
          </div>
          <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/5 mt-1.5">
            {u.active > 0 && <span style={{ width: `${(u.active / u.total) * 100}%` }} className="bg-forest-500" />}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <span className="text-forest-400">{u.onSite} on-site</span> · {u.transport} transit · {u.offDuty} off
          </p>
        </>
      )}
    </TileShell>
  );
}

export function ReviewPulseWidget({ pulse, loading }) {
  if (loading) return <TileSkeleton />;
  return (
    <TileShell to="reviews" accent="#f49666" icon={Star} kicker="Review Pulse" ariaLabel="Review pulse — open reviews">
      {!pulse ? (
        <>
          <BigNum className="text-zinc-500">—</BigNum>
          <p className="text-[11px] font-semibold text-zinc-500">No reviews yet — solicit your first.</p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <BigNum>{pulse.avg.toFixed(1)}</BigNum>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={11} className={n <= Math.round(pulse.avg) ? "text-amber-400 fill-amber-400" : "text-zinc-700"} />
              ))}
            </div>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <span className="text-forest-400">{pulse.count} total</span>
            {pulse.recent30 > 0 ? ` · ${pulse.recent30} in 30d` : ""}
          </p>
        </>
      )}
    </TileShell>
  );
}

export function LowStockWidget({ lowStock, loading }) {
  if (loading) return <TileSkeleton />;
  const ls = lowStock;
  const clear = ls.count === 0;
  return (
    <TileShell
      to="inventory"
      accent={clear ? "#05A845" : "#C1292E"}
      icon={Package}
      kicker="Low Stock"
      ariaLabel="Low stock items — open inventory"
    >
      <div className="flex items-baseline gap-2">
        <BigNum className={clear ? "text-forest-400" : "text-celtic-400"}>{ls.count}</BigNum>
        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">item{ls.count === 1 ? "" : "s"}</span>
      </div>
      {clear ? (
        <p className="text-[11px] font-semibold text-forest-400">Stock healthy — nothing under reorder.</p>
      ) : (
        <p className="text-[11px] font-semibold text-zinc-400 truncate">
          {ls.items[0].name}: <span className="text-celtic-400">{ls.items[0].qty}/{ls.items[0].min} {ls.items[0].unit}</span>
          {ls.count > 1 ? ` +${ls.count - 1}` : ""}
        </p>
      )}
    </TileShell>
  );
}

/**
 * The prioritized, role-scoped command band that opens the cockpit. Owners/admins
 * see the full money+ops picture; field roles (employee/foreman) get the ops tiles
 * and no financials. Receives the raw RLS-scoped arrays the Dashboard already
 * subscribes to and memoizes every aggregate here (null array => that tile skeletons).
 */
export function OperationsCommandBand({ role, invoices, jobs, crews, reviews, inventory, weather }) {
  const isOwner = role === "admin" || role === "owner";

  const aging = useMemo(() => computeArAging(invoices || []), [invoices]);
  const schedule = useMemo(() => computeTodaySchedule(jobs || []), [jobs]);
  const risk = useMemo(() => computeJobsAtRisk(jobs || [], weather), [jobs, weather]);
  const util = useMemo(() => computeCrewUtilization(crews || []), [crews]);
  const pulse = useMemo(() => computeReviewPulse(reviews || []), [reviews]);
  const lowStock = useMemo(() => computeLowStock(inventory || []), [inventory]);

  return (
    <section aria-label="Operations command band" className="space-y-3">
      <div className="flex items-center gap-2 pl-1">
        <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse shadow-[0_0_10px_#05A845]" />
        <h2 className="text-xs font-black uppercase tracking-widest text-forest-400">Operations</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Live · your data</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {isOwner && <CashToCollectWidget aging={aging} loading={invoices == null} />}
        <TodayRouteWidget schedule={schedule} loading={jobs == null} />
        <JobsAtRiskWidget risk={risk} loading={jobs == null} />
        <CrewUtilizationWidget util={util} />
        {isOwner && <ReviewPulseWidget pulse={pulse} loading={reviews == null} />}
        <LowStockWidget lowStock={lowStock} loading={inventory == null} />
      </div>
    </section>
  );
}
