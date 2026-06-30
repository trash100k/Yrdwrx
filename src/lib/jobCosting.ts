// Pure job-costing rollup math — extracted from src/pages/JobCosting.tsx so the
// estimate-vs-actual margin computation can be unit-tested in isolation and reused.
//
// Dependency-free: takes already-flattened repo rows (top-level columns merged with
// their jsonb `data`) plus a labor rate, and returns the same per-job/aggregate shape
// the page renders. No behavior, constant, threshold, or formula changes vs. the page.

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Coerce any value to a finite number, else 0. */
export const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Margin color band: forest >=40%, amber 15-40%, rose <15%.
 * Returns the Tailwind class set + label the table/cards render.
 */
export const marginBand = (marginPct: number) => {
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

/** Pull the customer id off a job/invoice row under any of the common field names. */
export const customerIdOf = (r: any) =>
  r?.customerId ?? r?.customer_id ?? r?.clientId ?? r?.client_id ?? null;

/**
 * Pull the job id off a satellite row (timesheet/expense/material/invoice) under any
 * of the common field names; null if the row isn't linked to a job.
 */
export const jobIdOf = (r: any) =>
  r?.jobId ?? r?.job_id ?? r?.associatedJobId ?? null;

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export interface RollupJobCostsInput {
  jobs: any[];
  invoices: any[];
  expenses: any[];
  timesheets: any[];
  materialLogs: any[];
  inventory: any[];
  /** Hourly labor rate applied to logged/allocated timesheet hours. */
  laborRate: number;
}

export interface JobCostRow {
  id: any;
  title: string;
  client: any;
  status: string;
  revenue: number;
  revenueIsBilled: boolean;
  revenueIsEst: boolean;
  laborHours: number;
  laborCost: number;
  laborIsEst: boolean;
  materialCost: number;
  materialIsEst: boolean;
  totalCost: number;
  marginDollars: number;
  marginPct: number;
}

// ---------------------------------------------------------------------------
// rollup
// ---------------------------------------------------------------------------

/**
 * Build a per-line material-cost resolver against the supplied inventory rows.
 * Unit cost is sourced (in priority order) from inventory by itemId, inventory by
 * itemName, then the material line's own unitCost/unitPrice. Cost = quantity x unit.
 *
 * Exported so callers/tests can exercise the same costing the rollup uses internally.
 */
export function makeMaterialLineCost(inventory: any[]) {
  const unitCostById: Record<string, number> = {};
  const unitCostByName: Record<string, number> = {};
  for (const it of inventory || []) {
    const cost = num(it.unitCost) || num(it.unitPrice) || 0;
    if (it.id) unitCostById[it.id] = cost;
    if (it.name) unitCostByName[String(it.name).toLowerCase()] = cost;
  }
  return (m: any): number => {
    const unit =
      num(unitCostById[m.itemId]) ||
      num(unitCostByName[String(m.itemName || "").toLowerCase()]) ||
      num(m.unitCost) ||
      num(m.unitPrice) ||
      0;
    return num(m.quantity) * unit;
  };
}

export interface RollupJobCostsResult {
  rows: JobCostRow[];
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalLabor: number;
    totalMaterial: number;
    blendedMargin: number;
    blendedMarginPct: number;
    anyEst: boolean;
  };
}

/**
 * Roll up estimate-vs-actual margins per job.
 *
 * Buckets labor (timesheets), materials (materialLogs, consumption "out" only) and
 * expenses onto the job each row is linked to. Rows with no resolvable job link feed
 * a tenant-level pool that is evenly allocated across active jobs (the "est." fallback).
 * Revenue prefers job-linked invoices, else the job's own quoted amount.
 *
 * Returns per-job rows (sorted lowest-margin-first) plus the aggregate summary, matching
 * the shape src/pages/JobCosting.tsx renders.
 */
export function rollupJobCosts(input: RollupJobCostsInput): RollupJobCostsResult {
  const {
    jobs = [],
    invoices = [],
    expenses = [],
    timesheets = [],
    materialLogs = [],
    inventory = [],
    laborRate,
  } = input || ({} as RollupJobCostsInput);

  const hourlyRate = laborRate;

  // Recent / active jobs first — newest by date, cap to keep the table dense.
  const sortedJobs = [...jobs].sort((a, b) => {
    const da = new Date(a.date || a.createdAt || 0).getTime();
    const db = new Date(b.date || b.createdAt || 0).getTime();
    return db - da;
  });
  const activeJobs = sortedJobs.slice(0, 60);
  const activeJobIds = new Set(activeJobs.map((j) => j.id));
  const jobCount = activeJobs.length || 1;

  // --- inventory unit-cost lookup (for material costing) ------------------
  const materialLineCost = makeMaterialLineCost(inventory);

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
  for (const m of materialLogs) {
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

  const computed: JobCostRow[] = activeJobs.map((j) => {
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

  // --- summary rollups ----------------------------------------------------
  const totalRevenue = computed.reduce((a, r) => a + r.revenue, 0);
  const totalCost = computed.reduce((a, r) => a + r.totalCost, 0);
  const totalLabor = computed.reduce((a, r) => a + r.laborCost, 0);
  const totalMaterial = computed.reduce((a, r) => a + r.materialCost, 0);
  const blendedMargin = totalRevenue - totalCost;
  const blendedMarginPct =
    totalRevenue > 0 ? (blendedMargin / totalRevenue) * 100 : 0;
  const anyEst = computed.some(
    (r) => r.revenueIsEst || r.laborIsEst || r.materialIsEst,
  );

  return {
    rows: computed,
    summary: {
      totalRevenue,
      totalCost,
      totalLabor,
      totalMaterial,
      blendedMargin,
      blendedMarginPct,
      anyEst,
    },
  };
}
