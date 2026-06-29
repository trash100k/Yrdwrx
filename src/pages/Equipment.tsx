// @ts-nocheck
// Equipment & Fleet — maintenance / service tracker.
//
// The operational nag that keeps mowers, trucks, and handhelds from grenading
// mid-route: for each asset we track a meter (engine HOURS or odometer MILES),
// a service interval, and the last-service baseline, then compute how far you've
// run since the last service vs. the interval. Three signals drive the UI:
//
//   used    = currentReading - lastServiceReading
//   DUE     when  used >= interval                 (rose)
//   DUE SOON when used >= 0.9 * interval           (amber)
//   OK      otherwise                              (forest)
//   UNKNOWN when no interval is set                (zinc)
//
// Everything reads/writes through equipmentRepo (Supabase seam). Crews come from
// crewsRepo for the "assigned to" dropdown (with a free-text fallback). Live updates
// via subscribe(); inline reading updates + one-tap "Log service" keep the field
// crew honest without forms.

import React, { useEffect, useMemo, useState } from "react";
import {
  Truck,
  Wrench,
  Plus,
  X,
  Gauge,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Tag,
  Users,
  CircleDot,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { equipmentRepo, crewsRepo } from "../lib/repos";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Flatten a repo row's freeform jsonb (data) over its top-level columns so per-row
// extras nested in `data` are visible alongside real columns.
const flatten = (r: any) => ({ ...(r?.data || {}), ...r });

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) =>
  "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const todayISO = () => new Date().toISOString().slice(0, 10);

const EQUIPMENT_TYPES = [
  "Mower",
  "Truck",
  "Trimmer",
  "Blower",
  "Aerator",
  "Other",
];

// Format a reading with its unit suffix.
const fmtReading = (meterType: string, val: number) =>
  meterType === "mileage"
    ? `${val.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi`
    : `${val.toLocaleString(undefined, { maximumFractionDigits: 0 })} h`;

const unitShort = (meterType: string) => (meterType === "mileage" ? "mi" : "h");

// ---------------------------------------------------------------------------
// PURE service-due helper
// ---------------------------------------------------------------------------
// Returns the service health of one asset:
//   { status, label, message, used, interval, remaining, meterType }
// status: 'due' | 'soon' | 'ok' | 'unknown'
function serviceStatus(e: any) {
  const meterType = e.meterType === "mileage" ? "mileage" : "hours";

  const current =
    meterType === "mileage" ? num(e.mileage) : num(e.hoursMeter);
  const lastService =
    meterType === "mileage"
      ? num(e.lastServiceMileage)
      : num(e.lastServiceHours);
  const interval =
    meterType === "mileage"
      ? num(e.serviceIntervalMiles)
      : num(e.serviceIntervalHours);

  const u = unitShort(meterType);

  if (interval <= 0) {
    return {
      status: "unknown",
      meterType,
      label: "No Interval",
      message: "Set a service interval to track due dates",
      used: Math.max(0, current - lastService),
      interval: 0,
      remaining: 0,
    };
  }

  const used = Math.max(0, current - lastService);
  const remaining = interval - used;

  if (used >= interval) {
    return {
      status: "due",
      meterType,
      label: "Service Due",
      message: `Service due — ${Math.round(used - interval)}${u} over`,
      used,
      interval,
      remaining,
    };
  }
  if (used >= 0.9 * interval) {
    return {
      status: "soon",
      meterType,
      label: "Due Soon",
      message: `Due soon — ${Math.round(remaining)}${u} to service`,
      used,
      interval,
      remaining,
    };
  }
  return {
    status: "ok",
    meterType,
    label: "OK",
    message: `OK — ${Math.round(remaining)}${u} to service`,
    used,
    interval,
    remaining,
  };
}

// Status -> Tailwind color band.
const STATUS_BAND: Record<string, any> = {
  due: {
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    dot: "bg-rose-400",
    bar: "bg-rose-400",
    icon: AlertTriangle,
  },
  soon: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
    icon: Clock,
  },
  ok: {
    text: "text-forest-400",
    bg: "bg-forest-500/10",
    border: "border-forest-500/30",
    dot: "bg-forest-400",
    bar: "bg-forest-400",
    icon: CheckCircle2,
  },
  unknown: {
    text: "text-zinc-400",
    bg: "bg-white/5",
    border: "border-white/10",
    dot: "bg-zinc-500",
    bar: "bg-zinc-600",
    icon: CircleDot,
  },
};

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export default function Equipment() {
  const { tenant } = useTenant();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [crews, setCrews] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Live subscription — equipmentRepo pushes a fresh full list on any change.
  useEffect(() => {
    setLoading(true);
    const unsub = equipmentRepo.subscribe((list) => {
      setRows((list || []).map(flatten));
      setLoading(false);
    });
    crewsRepo
      .list()
      .then((c) => setCrews((c || []).map(flatten)))
      .catch(() => setCrews([]));
    return () => {
      try {
        unsub && unsub();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  // --- summary rollups -------------------------------------------------------
  const summary = useMemo(() => {
    const totalAssets = rows.length;
    let dueCount = 0;
    let fleetValue = 0;
    for (const e of rows) {
      const s = serviceStatus(e);
      if (s.status === "due") dueCount += 1;
      fleetValue += num(e.purchaseCost);
    }
    return { totalAssets, dueCount, fleetValue };
  }, [rows]);

  // Sort: due first, then soon, then ok, then unknown — surface what needs work.
  const sorted = useMemo(() => {
    const rank: Record<string, number> = { due: 0, soon: 1, ok: 2, unknown: 3 };
    return [...rows].sort((a, b) => {
      const ra = rank[serviceStatus(a).status] ?? 9;
      const rb = rank[serviceStatus(b).status] ?? 9;
      if (ra !== rb) return ra - rb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [rows]);

  // --- mutations -------------------------------------------------------------

  const handleCreate = async (payload: any) => {
    try {
      await equipmentRepo.create(payload);
      showToast(`${payload.name} added to the fleet`, "success");
      setShowForm(false);
    } catch (err: any) {
      console.error("[Equipment] create failed", err);
      showToast("Could not add equipment.", "error");
    }
  };

  // Inline meter update — writes hoursMeter OR mileage based on the asset's meterType.
  const handleUpdateReading = async (e: any, value: string) => {
    const v = num(value);
    const field = e.meterType === "mileage" ? "mileage" : "hoursMeter";
    if (num(e[field]) === v) return; // no change
    setBusyId(e.id);
    try {
      await equipmentRepo.update(e.id, { [field]: v });
      showToast("Reading updated", "success");
    } catch (err: any) {
      console.error("[Equipment] update reading failed", err);
      showToast("Could not update reading.", "error");
    } finally {
      setBusyId(null);
    }
  };

  // One-tap "Log service": stamp today + carry the current reading into the
  // last-service baseline so the meter resets to zero-used.
  const handleLogService = async (e: any) => {
    setBusyId(e.id);
    const patch: any = { lastServiceDate: todayISO() };
    if (e.meterType === "mileage") {
      patch.lastServiceMileage = num(e.mileage);
    } else {
      patch.lastServiceHours = num(e.hoursMeter);
    }
    try {
      await equipmentRepo.update(e.id, patch);
      showToast("Service logged", "success");
    } catch (err: any) {
      console.error("[Equipment] log service failed", err);
      showToast("Could not log service.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (e: any) => {
    if (
      !window.confirm(
        `Delete "${e.name || "this asset"}" from the fleet? This cannot be undone.`,
      )
    )
      return;
    setBusyId(e.id);
    try {
      await equipmentRepo.remove(e.id);
      showToast("Equipment removed", "success");
    } catch (err: any) {
      console.error("[Equipment] delete failed", err);
      showToast("Could not remove equipment.", "error");
    } finally {
      setBusyId(null);
    }
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
            <Truck size={16} />
            Fleet Ops
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Equipment &amp; Fleet
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Maintenance &amp; Service Tracker
          </p>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest whitespace-nowrap border-4 border-transparent bg-forest-500/10 text-forest-400 hover:bg-forest-500/20 transition-colors shrink-0"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Close" : "Add Equipment"}
        </button>
      </header>

      {/* Summary metric tiles */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            icon={Truck}
            tone="forest"
            label="Total Assets"
            value={String(summary.totalAssets)}
            sub={summary.totalAssets === 1 ? "asset tracked" : "assets tracked"}
          />
          <MetricCard
            icon={Wrench}
            tone={summary.dueCount > 0 ? "rose" : "forest"}
            label="Service Due"
            value={String(summary.dueCount)}
            sub={
              summary.dueCount > 0
                ? "needs service now"
                : "everything on schedule"
            }
            valueClass={summary.dueCount > 0 ? "text-rose-400" : "text-white"}
          />
          <MetricCard
            icon={DollarSign}
            tone="celtic"
            label="Fleet Value"
            value={money(summary.fleetValue)}
            sub="total purchase cost"
          />
        </div>
      )}

      {/* Add-equipment inline panel */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <AddEquipmentForm
              crews={crews}
              onCancel={() => setShowForm(false)}
              onSubmit={handleCreate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fleet grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Wrench size={22} className="text-forest-400" />
            <div>
              <h3 className="text-xl font-black text-white italic tracking-tight uppercase leading-none">
                The Fleet
              </h3>
              <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em] mt-1.5 text-[10px]">
                Service due first
              </p>
            </div>
          </div>
          {!loading && rows.length > 0 && (
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
              <LegendDot color="bg-rose-400" label="Due" />
              <LegendDot color="bg-amber-400" label="Soon" />
              <LegendDot color="bg-forest-400" label="OK" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No equipment tracked yet"
            description="Add your mowers, trucks, trimmers, and handhelds to track engine hours, mileage, and service intervals — so nothing grenades mid-route."
            action={{ label: "Add Equipment", onClick: () => setShowForm(true) }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sorted.map((e, i) => (
              <EquipmentCard
                key={e.id || i}
                e={e}
                index={i}
                busy={busyId === e.id}
                onUpdateReading={handleUpdateReading}
                onLogService={handleLogService}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipment card
// ---------------------------------------------------------------------------

function EquipmentCard({
  e,
  index,
  busy,
  onUpdateReading,
  onLogService,
  onDelete,
}: any) {
  const s = serviceStatus(e);
  const band = STATUS_BAND[s.status];
  const BandIcon = band.icon;
  const meterType = s.meterType;
  const current = meterType === "mileage" ? num(e.mileage) : num(e.hoursMeter);

  const [reading, setReading] = useState(String(current));
  useEffect(() => {
    setReading(String(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Progress toward the next service (0–100). Unknown intervals show empty.
  const progress =
    s.interval > 0 ? Math.min(100, Math.round((s.used / s.interval) * 100)) : 0;

  const identifier = e.identifier || e.vin || e.serial || e.plate || "";
  const subtitle = [e.make, e.model, e.year].filter(Boolean).join(" ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl p-6 flex flex-col gap-5 relative overflow-hidden group"
    >
      {/* Header row: name + type + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${band.dot} shadow-glow`}
            />
            <h4 className="text-lg font-black text-white italic uppercase truncate leading-none group-hover:text-forest-400 transition-colors">
              {e.name || "Unnamed Asset"}
            </h4>
          </div>
          <p className="micro-label font-black text-white/25 uppercase tracking-widest text-[10px] mt-1.5 truncate">
            {e.type || "Other"}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${band.bg} ${band.border} ${band.text}`}
        >
          <BandIcon size={11} />
          {s.label}
        </span>
      </div>

      {/* Identifier + assigned crew chips */}
      <div className="flex flex-wrap gap-2">
        {identifier ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/50">
            <Tag size={11} className="text-forest-400" />
            {identifier}
          </span>
        ) : null}
        {e.assignedCrew ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/50">
            <Users size={11} className="text-forest-400" />
            {e.assignedCrew}
          </span>
        ) : null}
      </div>

      {/* Service status message + progress bar */}
      <div className={`rounded-xl border p-4 ${band.bg} ${band.border}`}>
        <p className={`text-sm font-black italic ${band.text}`}>{s.message}</p>
        <div className="mt-3 h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
          <div
            className={`h-full rounded-full ${band.bar} transition-all`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="micro-label font-black text-white/30 uppercase tracking-widest text-[9px] mt-2">
          {s.interval > 0
            ? `${Math.round(s.used)} / ${Math.round(s.interval)} ${unitShort(meterType)} since last service`
            : "No interval set"}
        </p>
      </div>

      {/* Current reading — inline update */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="micro-label font-black text-white/30 uppercase tracking-[0.3em] text-[9px] flex items-center gap-1.5">
            <Gauge size={11} className="text-forest-400" />
            {meterType === "mileage" ? "Odometer (mi)" : "Engine Hours"}
          </label>
          <input
            type="number"
            min={0}
            value={reading}
            onChange={(ev) => setReading(ev.target.value)}
            onBlur={() => onUpdateReading(e, reading)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") ev.currentTarget.blur();
            }}
            disabled={busy}
            className="mt-1.5 w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-sm font-black text-white italic focus:outline-none focus:border-forest-500 transition-colors disabled:opacity-40"
          />
        </div>
        <div className="text-right pb-1">
          <p className="micro-label font-black text-white/20 uppercase tracking-widest text-[9px]">
            Last Service
          </p>
          <p className="text-xs font-black text-white/60 italic mt-0.5">
            {e.lastServiceDate || "—"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={() => onLogService(e)}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border border-forest-500/30 bg-forest-500/10 text-forest-400 hover:bg-forest-500/20 transition-colors disabled:opacity-40"
        >
          <Wrench size={14} />
          Log Service
        </button>
        <button
          onClick={() => onDelete(e)}
          disabled={busy}
          aria-label="Delete equipment"
          className="flex items-center justify-center w-11 h-[42px] rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400/70 hover:bg-rose-500/15 hover:text-rose-400 transition-colors disabled:opacity-40"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Add-equipment form (inline panel)
// ---------------------------------------------------------------------------

function AddEquipmentForm({ crews, onCancel, onSubmit }: any) {
  const [f, setF] = useState<any>({
    name: "",
    type: "Mower",
    make: "",
    model: "",
    year: "",
    identifier: "",
    meterType: "hours",
    reading: "",
    interval: "",
    lastServiceDate: "",
    lastServiceReading: "",
    assignedCrew: "",
    purchaseDate: "",
    purchaseCost: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const isMileage = f.meterType === "mileage";

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!f.name.trim() || submitting) return;
    setSubmitting(true);

    // Map the form into the camelCase equipment columns; the meter fields are
    // written under the pair that matches meterType.
    const payload: any = {
      name: f.name.trim(),
      type: f.type,
      make: f.make.trim() || null,
      model: f.model.trim() || null,
      year: f.year ? num(f.year) : null,
      identifier: f.identifier.trim() || null,
      meterType: f.meterType,
      assignedCrew: f.assignedCrew.trim() || null,
      lastServiceDate: f.lastServiceDate || null,
      purchaseDate: f.purchaseDate || null,
      purchaseCost: f.purchaseCost ? num(f.purchaseCost) : null,
      notes: f.notes.trim() || null,
    };

    if (isMileage) {
      payload.mileage = f.reading ? num(f.reading) : 0;
      payload.serviceIntervalMiles = f.interval ? num(f.interval) : null;
      payload.lastServiceMileage = f.lastServiceReading
        ? num(f.lastServiceReading)
        : 0;
    } else {
      payload.hoursMeter = f.reading ? num(f.reading) : 0;
      payload.serviceIntervalHours = f.interval ? num(f.interval) : null;
      payload.lastServiceHours = f.lastServiceReading
        ? num(f.lastServiceReading)
        : 0;
    }

    await onSubmit(payload);
    setSubmitting(false);
  };

  return (
    <form
      onSubmit={submit}
      className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl p-8 space-y-6"
    >
      <div className="flex items-center gap-3">
        <Plus size={20} className="text-forest-400" />
        <h3 className="text-xl font-black text-white italic tracking-tight uppercase leading-none">
          Add Equipment
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Field label="Name *" className="sm:col-span-2 lg:col-span-1">
          <input
            required
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Exmark Lazer Z #2"
            className={inputCls}
          />
        </Field>

        <Field label="Type">
          <select
            value={f.type}
            onChange={(e) => set("type", e.target.value)}
            className={inputCls}
          >
            {EQUIPMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Meter Type">
          <select
            value={f.meterType}
            onChange={(e) => set("meterType", e.target.value)}
            className={inputCls}
          >
            <option value="hours">Engine Hours</option>
            <option value="mileage">Mileage</option>
          </select>
        </Field>

        <Field label="Make">
          <input
            value={f.make}
            onChange={(e) => set("make", e.target.value)}
            placeholder="Exmark"
            className={inputCls}
          />
        </Field>

        <Field label="Model">
          <input
            value={f.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder="Lazer Z X-Series"
            className={inputCls}
          />
        </Field>

        <Field label="Year">
          <input
            type="number"
            value={f.year}
            onChange={(e) => set("year", e.target.value)}
            placeholder="2023"
            className={inputCls}
          />
        </Field>

        <Field label="Identifier (VIN / Serial / Plate)">
          <input
            value={f.identifier}
            onChange={(e) => set("identifier", e.target.value)}
            placeholder="SN-4471829"
            className={inputCls}
          />
        </Field>

        <Field label={isMileage ? "Current Mileage" : "Current Hours"}>
          <input
            type="number"
            min={0}
            value={f.reading}
            onChange={(e) => set("reading", e.target.value)}
            placeholder={isMileage ? "42000" : "320"}
            className={inputCls}
          />
        </Field>

        <Field
          label={
            isMileage ? "Service Interval (mi)" : "Service Interval (hours)"
          }
        >
          <input
            type="number"
            min={0}
            value={f.interval}
            onChange={(e) => set("interval", e.target.value)}
            placeholder={isMileage ? "5000" : "100"}
            className={inputCls}
          />
        </Field>

        <Field label="Last Service Date">
          <input
            type="date"
            value={f.lastServiceDate}
            onChange={(e) => set("lastServiceDate", e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field
          label={
            isMileage ? "Last Service Mileage" : "Last Service Hours"
          }
        >
          <input
            type="number"
            min={0}
            value={f.lastServiceReading}
            onChange={(e) => set("lastServiceReading", e.target.value)}
            placeholder={isMileage ? "40000" : "250"}
            className={inputCls}
          />
        </Field>

        <Field label="Assigned Crew">
          {/* Crew dropdown when crews exist, otherwise free-text. */}
          {crews && crews.length > 0 ? (
            <input
              list="equipment-crew-options"
              value={f.assignedCrew}
              onChange={(e) => set("assignedCrew", e.target.value)}
              placeholder="Crew A"
              className={inputCls}
            />
          ) : (
            <input
              value={f.assignedCrew}
              onChange={(e) => set("assignedCrew", e.target.value)}
              placeholder="Crew A"
              className={inputCls}
            />
          )}
          <datalist id="equipment-crew-options">
            {(crews || []).map((c: any) => {
              const label = c.name || c.crewName || c.title || c.id;
              return <option key={c.id || label} value={label} />;
            })}
          </datalist>
        </Field>

        <Field label="Purchase Date">
          <input
            type="date"
            value={f.purchaseDate}
            onChange={(e) => set("purchaseDate", e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Purchase Cost ($)">
          <input
            type="number"
            min={0}
            value={f.purchaseCost}
            onChange={(e) => set("purchaseCost", e.target.value)}
            placeholder="12500"
            className={inputCls}
          />
        </Field>

        <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
          <textarea
            rows={2}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Hydro leak watch — recheck deck belt next service."
            className={`${inputCls} resize-none`}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!f.name.trim() || submitting}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest border-4 border-transparent bg-forest-500/10 text-forest-400 hover:bg-forest-500/20 transition-colors disabled:opacity-40"
        >
          <Plus size={15} />
          {submitting ? "Adding…" : "Add To Fleet"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// small presentational pieces (page-only)
// ---------------------------------------------------------------------------

const inputCls =
  "mt-1.5 w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-forest-500 transition-colors placeholder:text-white/20";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="micro-label font-black text-white/30 uppercase tracking-[0.3em] text-[9px]">
        {label}
      </span>
      {children}
    </label>
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
