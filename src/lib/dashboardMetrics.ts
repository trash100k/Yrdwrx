// Pure, memo-friendly aggregate helpers for the owner/field Dashboard cockpit.
// Every function is a fold over the RLS-scoped repo arrays the Dashboard already
// subscribes to — no fabricated numbers, no network. Kept side-effect free and
// fully unit-tested (src/lib/dashboardMetrics.test.ts) so the widgets that render
// them can stay dumb presentational shells.

type Row = Record<string, any>;

/** Coerce Firestore Timestamp | ISO string | Date | epoch to a Date, or null. */
export function toDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t?.toDate === "function") {
    const d = t.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  const d = t instanceof Date ? t : new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const lc = (v: any): string => String(v ?? "").toLowerCase();
const uc = (v: any): string => String(v ?? "").toUpperCase();

/** USD, no cents — the house money format used across the dashboard. */
export const usd0 = (n: any): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num(n));

const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const dayKey = (d: Date): string => startOfDay(d).toISOString().slice(0, 10);

// --- Invoice status semantics ------------------------------------------------
// "Collectible" = money that has been issued and is still owed. Drafts aren't
// issued yet; paid/void/canceled/refunded are settled — none are cash-to-collect.
const SETTLED = new Set(["paid", "void", "voided", "canceled", "cancelled", "refunded", "writeoff", "write-off", "written_off"]);
const isCollectible = (inv: Row): boolean => {
  const s = lc(inv?.status);
  if (!s) return false;
  if (s === "draft") return false;
  if (SETTLED.has(s)) return false;
  return num(inv?.amount) > 0;
};

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}
export interface ArAging {
  outstanding: number; // total collectible balance (cash to collect)
  overdue: number; // portion past its due date
  overdueCount: number;
  count: number; // number of open (collectible) invoices
  buckets: AgingBucket[]; // Current, 1–30, 31–60, 61–90, 90+
}

/**
 * Accounts-receivable aging over the caller's invoices. Buckets by days past the
 * due date (falls back to the invoice date when no dueDate is set). An invoice
 * whose status is literally "overdue" is always treated as at least 1 day late.
 */
export function computeArAging(invoices: Row[] | null | undefined, now: Date = new Date()): ArAging {
  const buckets: AgingBucket[] = [
    { label: "Current", amount: 0, count: 0 },
    { label: "1–30", amount: 0, count: 0 },
    { label: "31–60", amount: 0, count: 0 },
    { label: "61–90", amount: 0, count: 0 },
    { label: "90+", amount: 0, count: 0 },
  ];
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  let count = 0;

  for (const inv of invoices || []) {
    if (!isCollectible(inv)) continue;
    const amt = num(inv.amount);
    outstanding += amt;
    count += 1;

    const due = toDate(inv.dueDate ?? inv.due_date ?? inv.date ?? inv.createdAt);
    let daysLate = due ? Math.floor((startOfDay(now).getTime() - startOfDay(due).getTime()) / 86_400_000) : 0;
    if (lc(inv.status) === "overdue" && daysLate < 1) daysLate = 1;

    let idx = 0;
    if (daysLate <= 0) idx = 0;
    else if (daysLate <= 30) idx = 1;
    else if (daysLate <= 60) idx = 2;
    else if (daysLate <= 90) idx = 3;
    else idx = 4;

    buckets[idx].amount += amt;
    buckets[idx].count += 1;
    if (idx > 0) {
      overdue += amt;
      overdueCount += 1;
    }
  }

  return { outstanding, overdue, overdueCount, count, buckets };
}

export interface CrewUtil {
  total: number;
  active: number; // on-site + in-transport
  onSite: number;
  transport: number;
  offDuty: number;
  pct: number; // active / total, 0–100 (0 when no crews)
}

/** Live crew utilization from the crew board's status field. */
export function computeCrewUtilization(crews: Row[] | null | undefined): CrewUtil {
  let onSite = 0;
  let transport = 0;
  let offDuty = 0;
  const list = crews || [];
  for (const c of list) {
    const s = uc(c?.status);
    if (s.includes("ON")) onSite += 1; // ON_SITE
    else if (s.includes("TRANS")) transport += 1; // TRANSPORT
    else offDuty += 1; // OFF_DUTY / unknown
  }
  const total = list.length;
  const active = onSite + transport;
  return { total, active, onSite, transport, offDuty, pct: total ? Math.round((active / total) * 100) : 0 };
}

export interface ReviewPulse {
  count: number;
  avg: number; // mean star rating, 1 decimal
  recent30: number; // reviews in the trailing 30 days
  fiveStar: number;
  fiveStarPct: number; // 0–100
}

/** Review pulse; null when the tenant has no ratings yet (widget shows empty state). */
export function computeReviewPulse(reviews: Row[] | null | undefined, now: Date = new Date()): ReviewPulse | null {
  const rated = (reviews || []).filter((r) => Number.isFinite(Number(r?.rating)) && num(r?.rating) > 0);
  if (!rated.length) return null;
  const sum = rated.reduce((s, r) => s + num(r.rating), 0);
  const cutoff = startOfDay(now).getTime() - 30 * 86_400_000;
  const recent30 = rated.filter((r) => {
    const d = toDate(r.createdAt ?? r.created_at ?? r.date);
    return d ? d.getTime() >= cutoff : false;
  }).length;
  const fiveStar = rated.filter((r) => num(r.rating) >= 5).length;
  return {
    count: rated.length,
    avg: Math.round((sum / rated.length) * 10) / 10,
    recent30,
    fiveStar,
    fiveStarPct: Math.round((fiveStar / rated.length) * 100),
  };
}

export interface LowStockItem {
  id: string;
  name: string;
  qty: number;
  min: number;
  unit: string;
}
export interface LowStock {
  count: number;
  items: LowStockItem[]; // most-depleted first
}

/**
 * Items at/under their reorder threshold. Normalizes across the Supabase inventory
 * shape ({stock, minThreshold}) and any legacy demo shape ({quantity, minQuantity})
 * so it never NaNs on real data.
 */
export function computeLowStock(inventory: Row[] | null | undefined): LowStock {
  const items: LowStockItem[] = [];
  for (const it of inventory || []) {
    const qty = num(it.quantity ?? it.stock);
    const min = num(it.minQuantity ?? it.minThreshold);
    if (min > 0 && qty <= min) {
      items.push({
        id: String(it.id ?? it.sku ?? it.name ?? Math.random()),
        name: String(it.name ?? it.item ?? "Item"),
        qty,
        min,
        unit: String(it.unit ?? "units"),
      });
    }
  }
  // Most depleted (lowest ratio-to-target) first.
  items.sort((a, b) => a.qty / (a.min || 1) - b.qty / (b.min || 1));
  return { count: items.length, items };
}

const isDoneOrDead = (job: Row): boolean => {
  const s = lc(job?.status);
  return ["completed", "complete", "done", "closed", "canceled", "cancelled"].includes(s);
};
const jobRevenue = (job: Row): number => num(job?.revenue ?? job?.amount ?? job?.data?.price);

export interface TodaySchedule {
  todayCount: number;
  todayRevenue: number;
  today: Row[]; // today's open jobs
  upcomingCount: number; // future-dated open jobs
  overdueCount: number; // dated before today and still not done
}

/** Today's route load + how much is behind schedule. Field-facing (no money gate). */
export function computeTodaySchedule(jobs: Row[] | null | undefined, now: Date = new Date()): TodaySchedule {
  const todayK = dayKey(startOfDay(now));
  const today: Row[] = [];
  let todayRevenue = 0;
  let upcomingCount = 0;
  let overdueCount = 0;

  for (const j of jobs || []) {
    if (isDoneOrDead(j)) continue;
    const d = toDate(j.date ?? j.scheduledFor ?? j.createdAt);
    if (!d) continue;
    const k = dayKey(d);
    if (k === todayK) {
      today.push(j);
      todayRevenue += jobRevenue(j);
    } else if (startOfDay(d).getTime() > startOfDay(now).getTime()) {
      upcomingCount += 1;
    } else {
      overdueCount += 1; // past-dated and still open
    }
  }
  return { todayCount: today.length, todayRevenue, today, upcomingCount, overdueCount };
}

export interface RiskItem {
  id: string;
  label: string;
  reason: string;
  level: "high" | "medium";
}
export interface JobsAtRisk {
  count: number;
  weatherRisk: boolean;
  items: RiskItem[];
}

/**
 * Jobs in jeopardy: past-dated-and-open (behind schedule) plus, when the live
 * forecast flags a high delay risk, today's outdoor stops. Empty => "on track".
 */
export function computeJobsAtRisk(
  jobs: Row[] | null | undefined,
  weather: Row | null | undefined,
  now: Date = new Date(),
): JobsAtRisk {
  const items: RiskItem[] = [];
  const todayK = dayKey(startOfDay(now));
  const weatherRisk = uc(weather?.delayRisk) === "HIGH";

  for (const j of jobs || []) {
    if (isDoneOrDead(j)) continue;
    const d = toDate(j.date ?? j.scheduledFor ?? j.createdAt);
    const title = String(j.title ?? j.client ?? j.address ?? "Job");
    const id = String(j.id ?? title);
    if (d && startOfDay(d).getTime() < startOfDay(now).getTime()) {
      items.push({ id, label: title, reason: "Past due — not completed", level: "high" });
    } else if (weatherRisk && d && dayKey(d) === todayK) {
      items.push({ id, label: title, reason: "Weather delay risk today", level: "medium" });
    }
  }
  // High severity first, then stable.
  items.sort((a, b) => (a.level === b.level ? 0 : a.level === "high" ? -1 : 1));
  return { count: items.length, weatherRisk, items };
}

/**
 * Top revenue services from paid invoices. Returns share-of-revenue (NOT a growth
 * trend) so the widget can label it honestly. Empty array => no paid data yet.
 */
export function computeTopServices(
  invoices: Row[] | null | undefined,
): { label: string; value: number; share: number }[] {
  const paid = (invoices || []).filter((i) => lc(i?.status) === "paid");
  const map: Record<string, number> = {};
  for (const inv of paid) {
    const label =
      inv.service ||
      inv.serviceType ||
      (Array.isArray(inv.items) && inv.items[0] && (inv.items[0].name || inv.items[0].description)) ||
      inv.description ||
      "General Service";
    map[label] = (map[label] || 0) + num(inv.amount);
  }
  const entries = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return entries.map(([label, value]) => ({
    label: String(label).slice(0, 40),
    value,
    share: Math.round((value / total) * 100),
  }));
}
