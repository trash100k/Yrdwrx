// @ts-nocheck
// Crew time clock — clock in/out with a live elapsed timer and a week-hours rollup.
// Persists to the `timesheets` collection (best-effort) and stays usable with optimistic
// local state in demo / offline, so the field flow never blocks.
import React, { useEffect, useState } from "react";
import { getCurrentUser } from "../lib/supabase";
import { timesheetsRepo } from "../lib/repos";
import { Clock, Play, Square } from "lucide-react";
import { activeEntry, weekMinutes, formatDuration, minutesBetween } from "../lib/timesheets";

export function TimeClock() {
  const userId = getCurrentUser()?.uid || "demo-user";
  const userName = getCurrentUser()?.displayName || getCurrentUser()?.email || "You";

  const [serverEntries, setServerEntries] = useState<any[]>([]);
  const [localEntries, setLocalEntries] = useState<any[]>([]);
  const [now, setNow] = useState<number>(() => Date.parse(new Date(0).toISOString()) || 0);
  const [busy, setBusy] = useState(false);

  // Tick the elapsed timer every 30s (lazy — only matters while clocked in).
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 30000), 30000);
    setNow(new Date().getTime());
    return () => clearInterval(id);
  }, []);

  // Best-effort live subscription to this user's timesheets. The repo is tenant-scoped
  // by RLS and pushes a fresh full list on any change; we filter to the current user
  // client-side (the rollup + open-entry state are per-user).
  useEffect(() => {
    try {
      const unsub = timesheetsRepo.subscribe((rows) =>
        setServerEntries((rows || []).filter((r) => r.userId === userId)),
      );
      return unsub;
    } catch {
      /* supabase unavailable in demo — local state carries the UX */
    }
  }, [userId]);

  const entries = serverEntries.length ? serverEntries : localEntries;
  const open = activeEntry(entries);
  const nowDate = new Date(now || Date.now());
  const week = weekMinutes(entries, nowDate);
  const elapsed = open ? minutesBetween(open.clockIn, nowDate.toISOString()) : 0;

  const clockIn = async () => {
    if (open || busy) return;
    setBusy(true);
    const entry = { userId, userName, clockIn: new Date().toISOString(), clockOut: null };
    setLocalEntries((e) => [...e, { id: `local-${e.length}`, ...entry }]);
    try { await timesheetsRepo.create(entry); } catch { /* optimistic only */ }
    setBusy(false);
  };

  const clockOut = async () => {
    if (!open || busy) return;
    setBusy(true);
    const clockOutISO = new Date().toISOString();
    const durationMins = minutesBetween(open.clockIn, clockOutISO);
    setLocalEntries((e) => e.map((x) => (x.id === open.id || x.clockIn === open.clockIn ? { ...x, clockOut: clockOutISO, durationMins } : x)));
    setServerEntries((e) => e.map((x) => (x.id === open.id ? { ...x, clockOut: clockOutISO, durationMins } : x)));
    try { if (open.id && !String(open.id).startsWith("local-")) await timesheetsRepo.update(open.id, { clockOut: clockOutISO, durationMins }); } catch { /* optimistic only */ }
    setBusy(false);
  };

  return (
    <section className="bg-zinc-950 border border-white/5 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs md:text-[10px] font-bold tracking-widest text-forest-400 uppercase">Time Clock</span>
          <h4 className="text-lg sm:text-xl font-black text-white italic uppercase tracking-tight">
            {open ? "On the clock" : "Clocked out"}
          </h4>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">This week</p>
          <p className="text-xl font-black text-white tabular-nums">{formatDuration(week)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {open ? (
          <button
            onClick={clockOut}
            disabled={busy}
            className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Square size={16} /> Clock Out · {formatDuration(elapsed)}
          </button>
        ) : (
          <button
            onClick={clockIn}
            disabled={busy}
            className="flex-1 py-3.5 bg-forest-500 hover:bg-forest-400 disabled:opacity-60 text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Play size={16} /> Clock In
          </button>
        )}
        <div className="w-12 h-12 shrink-0 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400">
          <Clock size={20} />
        </div>
      </div>
      <p className="text-[10px] text-zinc-600">Tracked as {userName}. Entries feed weekly hours and payroll.</p>
    </section>
  );
}

export default TimeClock;
