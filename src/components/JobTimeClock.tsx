// @ts-nocheck
// Crew time clock — a big-target, sunlight-readable clock-in / clock-out control tied to
// the crew member's CURRENT JOB. Every shift stamps jobId + customerId so labor hours roll
// up to the right job (Job Costing) and customer, and feed the shipped payroll export
// (src/lib/payroll.ts → summarizePayroll). An open shift is 0 payroll hours until closed.
//
// Behavior:
//   • Optional GEOFENCE on clock-in: if the job has cached coords (from the geocoding layer)
//     and the device grants a fix, we warn when the worker is outside the radius but NEVER
//     block — missing coords / denied permission just proceed ("unavailable").
//   • Live open-shift status + elapsed timer.
//   • OFFLINE-SAFE: writes go straight to the RLS-scoped timesheetsRepo; on failure/offline
//     they fall back to the syncService queue (flushed when connectivity returns). The open
//     shift is mirrored to localStorage so a reload / crash mid-shift doesn't lose it.
//
// Pure decision logic (geofence math + clock-out write plan) lives in src/lib/timeclock.ts
// (typed + unit-tested); this component wires it to the repo, the device, and the DOM.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Play, Square, MapPin, WifiOff, AlertTriangle } from "lucide-react";
import { timesheetsRepo, jobsRepo, getCurrentProfile } from "../lib/repos";
import { syncService } from "../services/syncService";
import { getCurrentUser } from "../lib/supabase";
import { safeStorage } from "../lib/storage";
import { logSystemEvent } from "../lib/firebase";
import { activeEntry } from "../lib/timesheets";
import {
  evaluateGeofence,
  buildClockInEntry,
  planClockOut,
  DEFAULT_GEOFENCE_RADIUS_M,
  type OpenShift,
} from "../lib/timeclock";

// Flatten a job row (data jsonb + columns) and normalize the fields we need. Handles both
// camelCase (repo reads) and raw snake_case (customer_id) so any caller's shape works.
function adaptJob(r: any) {
  if (!r) return null;
  const j = { ...(r.data || {}), ...r };
  if (j.customerId == null && r.customer_id != null) j.customerId = r.customer_id;
  const lat = Number(j.lat);
  const lng = Number(j.lng);
  return {
    id: j.id,
    title: j.title || j.name || "Untitled Job",
    client: j.client || j.customerName || j.customer || "",
    customerId: j.customerId ?? null,
    status: j.status,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    raw: j,
  };
}

const isOpenJob = (j: any) => {
  const s = String(j?.status || "").toUpperCase();
  return s !== "COMPLETED" && s !== "CANCELLED" && s !== "CANCELED" && s !== "ARCHIVED";
};

const jobLabel = (j: any) =>
  !j ? "" : j.client ? `${j.title} — ${j.client}` : j.title;

const jobCoords = (j: any) =>
  j && Number.isFinite(j.lat) && Number.isFinite(j.lng) ? { lat: j.lat, lng: j.lng } : null;

// Live HH:MM:SS for the on-clock display (updates each second).
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(r)}`;
}

// Best-effort device position; resolves null on no-support / denial / timeout (never throws).
function getDevicePosition(timeoutMs = 8000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
      );
    } catch {
      resolve(null);
    }
  });
}

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * @param job          Lock the clock to this job (Field Mode active job). If omitted, a
 *                     picker is shown over `jobs` (or self-loaded open jobs).
 * @param jobs         Candidate jobs for the picker (CrewSuite passes its loaded list).
 * @param highContrast Sunlight-readable high-contrast palette (Field Mode tactical/sun mode).
 * @param radiusMeters Geofence radius for clock-in (default 150m).
 */
export function JobTimeClock({
  job: lockedJobProp = null,
  jobs: jobsProp = null,
  highContrast = false,
  radiusMeters = DEFAULT_GEOFENCE_RADIUS_M,
  onToast,
  className = "",
}: {
  job?: any;
  jobs?: any[] | null;
  highContrast?: boolean;
  radiusMeters?: number;
  onToast?: (msg: string, kind?: "success" | "error" | "info" | "warning") => void;
  className?: string;
}) {
  const user = getCurrentUser();
  const userId = user?.uid || "demo-user";
  const userName = user?.displayName || user?.email || "Field Crew";
  const storageKey = `yw_timeclock_open:${userId}`;
  const tenantIdRef = useRef<string>("");
  // Server ids we've just closed — so the realtime subscription doesn't briefly re-adopt
  // a shift as "open" during the window before our clock-out update propagates back.
  const closedIdsRef = useRef<Set<string>>(new Set());

  const lockedJob = useMemo(() => adaptJob(lockedJobProp), [lockedJobProp]);

  const [loadedJobs, setLoadedJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  // Pending geofence confirmation (worker is outside the radius): { distanceMeters, radiusMeters, coords }.
  const [pendingGeofence, setPendingGeofence] = useState<any>(null);

  const toast = (msg: string, kind: any = "info") => {
    try {
      onToast?.(msg, kind);
    } catch {
      /* toast is best-effort */
    }
  };

  // Resolve the tenant id once (used to tag queued offline ops; RLS still auto-scopes writes).
  useEffect(() => {
    let alive = true;
    getCurrentProfile()
      .then((p) => {
        if (alive && p?.tenant_id) tenantIdRef.current = p.tenant_id;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Live elapsed timer (only meaningful while clocked in, but cheap to always run).
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Hydrate any open shift from localStorage first (offline / reload resilience).
  useEffect(() => {
    try {
      const raw = safeStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.clockIn && !parsed.clockOut) setOpenShift(parsed);
      }
    } catch {
      /* corrupt local state — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Self-load open jobs for the picker only when the caller supplied neither a locked job
  // nor a jobs list. RLS scopes to tenant.
  useEffect(() => {
    if (lockedJobProp || jobsProp) return;
    let alive = true;
    (async () => {
      try {
        const rows = await jobsRepo.list();
        const flat = (rows || []).map(adaptJob).filter(Boolean).filter(isOpenJob);
        if (!alive) return;
        setLoadedJobs(flat);
        setSelectedJobId((prev) => prev || flat[0]?.id || "");
      } catch {
        /* picker simply shows no jobs */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedJobProp, jobsProp]);

  // Keep the picker default in sync when a jobs list is supplied by the caller.
  const pickerJobs = useMemo(() => {
    if (lockedJob) return [];
    const src = jobsProp ? jobsProp.map(adaptJob).filter(Boolean).filter(isOpenJob) : loadedJobs;
    return src;
  }, [lockedJob, jobsProp, loadedJobs]);

  useEffect(() => {
    if (lockedJob) return;
    setSelectedJobId((prev) => prev || pickerJobs[0]?.id || "");
  }, [lockedJob, pickerJobs]);

  // Adopt an existing OPEN shift from the server (e.g. clocked in on another device, or a
  // reload after an online clock-in) — but never clobber this device's local-only offline
  // shift (which has no serverId yet).
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = timesheetsRepo.subscribe((rows) => {
        const mine = (rows || []).filter((r: any) => r.userId === userId);
        const found = activeEntry(mine);
        // Don't resurrect a shift we just closed (realtime lag after our own update).
        const serverOpen = found && !closedIdsRef.current.has(found.id) ? found : null;
        setOpenShift((prev) => {
          if (prev && !prev.serverId) return prev; // keep local offline shift
          if (serverOpen) {
            const adopted: OpenShift = {
              id: serverOpen.id,
              serverId: serverOpen.id,
              jobId: serverOpen.jobId ?? null,
              customerId: serverOpen.customerId ?? null,
              userId: serverOpen.userId ?? userId,
              userName: serverOpen.userName ?? userName,
              clockIn: serverOpen.clockIn,
              clockOut: null,
              clockInLat: serverOpen.clockInLat ?? null,
              clockInLng: serverOpen.clockInLng ?? null,
            };
            persistOpen(adopted);
            return adopted;
          }
          // No server-open row: if our current shift WAS server-backed and is now gone
          // (closed elsewhere), clear it. Otherwise leave as-is.
          if (prev && prev.serverId) {
            clearOpen();
            return null;
          }
          return prev;
        });
      });
    } catch {
      /* supabase unavailable in demo — local state carries the UX */
    }
    return () => {
      try {
        unsub();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const resolvedJob = lockedJob || pickerJobs.find((j: any) => j.id === selectedJobId) || null;

  const persistOpen = (s: OpenShift) => {
    try {
      safeStorage.setItem(storageKey, JSON.stringify(s));
    } catch {}
  };
  const clearOpen = () => {
    try {
      safeStorage.removeItem(storageKey);
    } catch {}
  };

  // Create a timesheet row resiliently: if the DB predates migration 0012 (no customer_id /
  // clock_in_lat / clock_in_lng columns), retry with only the always-present columns so the
  // hours still land in payroll — the linkage returns once the migration is applied.
  const createTimesheet = async (row: any) => {
    try {
      return await timesheetsRepo.create(row);
    } catch (e) {
      const { customerId, clockInLat, clockInLng, ...safe } = row;
      return await timesheetsRepo.create(safe);
    }
  };

  const elapsedSeconds = openShift?.clockIn
    ? Math.max(0, Math.floor((nowTs - new Date(openShift.clockIn).getTime()) / 1000))
    : 0;

  // --- Clock IN ---------------------------------------------------------------
  const doClockIn = async (bypassGeofence = false) => {
    if (openShift || busy) return;
    const job = resolvedJob;
    if (!job?.id) {
      toast("Pick a job to clock into first.", "error");
      return;
    }
    setBusy(true);
    try {
      const site = jobCoords(job);
      let coords: { lat: number; lng: number } | null = null;

      if (site) {
        coords = await getDevicePosition();
        if (!bypassGeofence) {
          const geo = evaluateGeofence(site, coords, radiusMeters);
          if (geo.status === "outside") {
            // Outside the fence — surface it, but let the worker proceed explicitly.
            setPendingGeofence({
              distanceMeters: geo.distanceMeters,
              radiusMeters: geo.radiusMeters,
              coords,
            });
            setBusy(false);
            return;
          }
        }
      }

      const clockInISO = new Date().toISOString();
      const entry = buildClockInEntry({
        jobId: job.id,
        customerId: job.customerId ?? null,
        userId,
        userName,
        clockInISO,
        coords,
      });

      let serverId: string | null = null;
      if (!isOffline()) {
        try {
          const created = await createTimesheet(entry);
          serverId = created?.id ?? null;
        } catch {
          serverId = null; // write failed — keep a local-only open shift
        }
      }

      const shift: OpenShift = { ...entry, serverId, id: serverId || `local-${Date.now()}` };
      persistOpen(shift);
      setOpenShift(shift);
      setPendingGeofence(null);
      logSystemEvent("TIMECLOCK_IN", {
        jobId: job.id,
        customerId: job.customerId ?? null,
        offline: !serverId,
      });
      toast(serverId ? `Clocked in to ${jobLabel(job)}.` : "Clocked in (offline — will sync).", "success");
    } catch (err: any) {
      console.error("Clock-in failed:", err);
      toast(err?.message || "Failed to clock in.", "error");
    } finally {
      setBusy(false);
    }
  };

  // --- Clock OUT --------------------------------------------------------------
  const doClockOut = async () => {
    if (!openShift || busy) return;
    setBusy(true);
    try {
      const clockOutISO = new Date().toISOString();
      const plan = planClockOut(openShift, clockOutISO);
      const mins = plan.mode === "update" ? plan.patch.durationMins : plan.row.durationMins;
      // Remember this server row as closed so the realtime subscription won't re-adopt it
      // as "open" during the propagation window.
      if (openShift.serverId) closedIdsRef.current.add(openShift.serverId);

      let queued = false;
      if (isOffline()) {
        queued = true;
      } else {
        try {
          if (plan.mode === "update") await timesheetsRepo.update(plan.id, plan.patch);
          else await createTimesheet(plan.row);
        } catch {
          queued = true;
        }
      }

      if (queued) {
        // Offline / write failed → queue for the syncService flusher (RLS-scoped repo
        // dispatch, idempotent). UPDATE targets the existing server row; CREATE writes the
        // one complete row for a shift that never reached the server.
        const tenantId = tenantIdRef.current || "";
        if (plan.mode === "update") {
          syncService.queueAction("UPDATE", "timesheets", plan.patch, tenantId, plan.id);
        } else {
          syncService.queueAction("CREATE", "timesheets", plan.row, tenantId);
        }
      }

      logSystemEvent("TIMECLOCK_OUT", {
        jobId: openShift.jobId ?? null,
        customerId: openShift.customerId ?? null,
        durationMins: mins,
        queued,
      });
      clearOpen();
      setOpenShift(null);
      const label = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      toast(queued ? `Clocked out (offline — ${label} will sync).` : `Clocked out — ${label} logged.`, "success");
    } catch (err: any) {
      console.error("Clock-out failed:", err);
      toast(err?.message || "Failed to clock out.", "error");
    } finally {
      setBusy(false);
    }
  };

  // --- Styling (dark default · high-contrast sunlight mode) --------------------
  const hc = highContrast;
  const shell = hc
    ? "bg-white border-black text-black shadow-[8px_8px_0_0_#000]"
    : "bg-zinc-900 border-white/10 text-white";
  const label = hc ? "text-black/60" : "text-white/40";
  const subtle = hc ? "text-black/50" : "text-zinc-500";
  const inClass = hc
    ? "bg-black text-white border-black"
    : "bg-forest-500 text-black border-forest-500 shadow-[0_0_20px_rgba(5,168,69,0.35)]";
  const outClass = hc
    ? "bg-rose-600 text-white border-black"
    : "bg-rose-500 text-white border-rose-400";

  const canClockIn = !!resolvedJob?.id && !openShift && !busy;

  return (
    <section className={`rounded-3xl border-4 p-5 sm:p-6 ${shell} ${className}`}>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center border-2 ${
              hc ? "border-black bg-black text-white" : "border-white/10 bg-forest-500/10 text-forest-400"
            }`}
          >
            <Clock size={20} />
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest ${hc ? "text-black/60" : "text-forest-400"}`}>
              Time Clock
            </p>
            <h4 className="text-lg font-black italic uppercase tracking-tight leading-none truncate">
              {openShift ? "On the clock" : "Clocked out"}
            </h4>
          </div>
        </div>
        {openShift && (
          <div className="text-right shrink-0">
            <p className={`text-[10px] font-black uppercase tracking-widest ${label}`}>Elapsed</p>
            <p className="text-2xl font-black tabular-nums leading-none mt-1">{formatClock(elapsedSeconds)}</p>
          </div>
        )}
      </div>

      {/* Job context — locked (Field Mode) vs picker (CrewSuite) */}
      {lockedJob ? (
        <div className={`mb-4 flex items-center gap-2 rounded-2xl border-2 px-4 py-3 ${hc ? "border-black bg-black/5" : "border-white/10 bg-black/40"}`}>
          <MapPin size={16} className={hc ? "text-black/60" : "text-forest-400"} />
          <span className="text-sm font-black uppercase tracking-tight truncate">{jobLabel(lockedJob)}</span>
        </div>
      ) : (
        <div className="mb-4">
          <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${label}`}>Job</label>
          <select
            className={`w-full rounded-2xl border-2 px-4 py-3.5 text-sm font-bold outline-none transition-colors disabled:opacity-50 ${
              hc
                ? "bg-white border-black text-black"
                : "bg-black border-white/10 text-white focus:border-forest-500"
            }`}
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            disabled={!!openShift || pickerJobs.length === 0}
          >
            {pickerJobs.length === 0 ? (
              <option value="">No active jobs available</option>
            ) : (
              pickerJobs.map((j: any) => (
                <option key={j.id} value={j.id}>
                  {jobLabel(j)}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* Geofence "outside the fence" confirmation — never blocks, just asks. */}
      {pendingGeofence && (
        <div className={`mb-4 rounded-2xl border-2 p-4 ${hc ? "border-black bg-amber-300" : "border-amber-500/40 bg-amber-500/10"}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className={hc ? "text-black" : "text-amber-400"} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black uppercase tracking-tight ${hc ? "text-black" : "text-amber-300"}`}>
                {pendingGeofence.distanceMeters != null
                  ? `~${pendingGeofence.distanceMeters}m from the site`
                  : "Outside the job site"}
              </p>
              <p className={`text-xs mt-0.5 ${hc ? "text-black/70" : "text-amber-200/70"}`}>
                That's beyond the {pendingGeofence.radiusMeters}m clock-in fence. Clock in anyway?
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPendingGeofence(null)}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 ${
                hc ? "border-black text-black" : "border-white/20 text-white/70 hover:text-white"
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => doClockIn(true)}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 ${
                hc ? "bg-black text-white border-black" : "bg-amber-500 text-black border-amber-400"
              }`}
            >
              Clock in anyway
            </button>
          </div>
        </div>
      )}

      {/* Big-target action button */}
      {openShift ? (
        <button
          type="button"
          onClick={doClockOut}
          disabled={busy}
          className={`w-full min-h-[64px] flex items-center justify-center gap-3 rounded-2xl border-4 font-black text-base uppercase tracking-widest transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60 ${outClass}`}
        >
          <Square size={22} fill="currentColor" /> Clock Out
        </button>
      ) : (
        <button
          type="button"
          onClick={() => doClockIn(false)}
          disabled={!canClockIn}
          className={`w-full min-h-[64px] flex items-center justify-center gap-3 rounded-2xl border-4 font-black text-base uppercase tracking-widest transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${inClass}`}
        >
          <Play size={22} /> {busy ? "Working…" : "Clock In"}
        </button>
      )}

      <p className={`mt-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${subtle}`}>
        {openShift && !openShift.serverId && <WifiOff size={12} />}
        Tracked as {userName}
        {openShift && !openShift.serverId ? " · offline, will sync" : " · feeds Job Costing + Payroll"}
      </p>
    </section>
  );
}

export default JobTimeClock;
