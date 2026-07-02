// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import {
  Mic,
  Square,
  Loader2,
  Radio,
  Sparkles,
  Truck,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
} from "lucide-react";

import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useToast } from "../contexts/ToastContext";
import { useTenant } from "../contexts/TenantContext";
import { fetchApi } from "../lib/api";
import { jobsRepo, invoicesRepo, knowledgeRepo, inventoryRepo } from "../lib/repos";

import { ActionCardStack } from "../components/closeout/ActionCardStack";
import { CloseoutDoneStrip } from "../components/closeout/CloseoutDoneStrip";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

type Phase = "listen" | "review" | "done";

const EXAMPLES = [
  "Finished the Johnson mow — bill them the usual, mark it done, and we used two bags of mulch.",
  "Wrapped up at 14 Oak Street. Invoice $180 for cleanup. Come back next Tuesday to trim the hedges.",
  "Done with the Garcia property. Log it complete and reorder fertilizer, we're running low.",
];

const CATALOG_FALLBACK = 150;

// Loosely parse a spoken "when" into an ISO date; returns "" if unparseable.
function parseWhen(when?: string | null): string {
  if (!when) return "";
  const txt = String(when).toLowerCase().trim();
  const now = new Date();
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  try {
    if (/tomorrow/.test(txt)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return d.toISOString();
    }
    if (/today|tonight/.test(txt)) return now.toISOString();
    if (/next week/.test(txt)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return d.toISOString();
    }
    const dayIdx = days.findIndex((d) => txt.includes(d));
    if (dayIdx >= 0) {
      const d = new Date(now);
      let delta = (dayIdx - d.getDay() + 7) % 7;
      if (delta === 0) delta = 7; // "next <day>" => upcoming, not today
      d.setDate(d.getDate() + delta);
      return d.toISOString();
    }
    const direct = Date.parse(txt);
    if (!Number.isNaN(direct)) return new Date(direct).toISOString();
  } catch {
    /* leave empty */
  }
  return "";
}

// Look up a catalog price by line-item description (fallback 150).
function catalogPrice(catalog: any[], description: string): number {
  const desc = (description || "").toLowerCase();
  if (!Array.isArray(catalog)) return CATALOG_FALLBACK;
  for (const group of catalog) {
    for (const svc of group?.services || []) {
      const name = (svc?.name || "").toLowerCase();
      if (name && (desc.includes(name) || name.includes(desc))) {
        return Number(svc.price) || CATALOG_FALLBACK;
      }
    }
  }
  return CATALOG_FALLBACK;
}

// Local (not UTC) YYYY-MM-DD, matching how the Scheduler stores job dates.
function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Money-adjacent action types that must never run against a guessed job.
const NEEDS_JOB_TYPES = ["invoice", "close_job"];

export default function Closeout() {
  const { showToast } = useToast();
  const { tenant } = useTenant();
  const { transcript: liveTranscript, isListening, startListening, stopListening, supported } =
    useSpeechRecognition();

  const [phase, setPhase] = useState<Phase>("listen");
  const [transcript, setTranscript] = useState("");
  // The job this closeout applies to — explicitly picked by the user (never
  // guessed). Once picked it carries through the whole session, including
  // "New Closeout", until the user changes it.
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [planning, setPlanning] = useState(false);
  const [summary, setSummary] = useState("");
  const [actions, setActions] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState<any[]>([]);

  const catalog = tenant?.settings?.serviceCatalog || [];

  // Keep local transcript synced with the live one while listening.
  useEffect(() => {
    if (isListening) setTranscript(liveTranscript);
  }, [liveTranscript, isListening]);

  // Load jobs for the picker. No auto-pick: the user chooses the job the
  // closeout applies to, so money actions never land on a guessed job.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const jobs = await jobsRepo.list();
        const flat = (jobs || []).map((r: any) => ({ ...(r.data || {}), ...r }));
        if (alive) setAllJobs(flat);
      } catch (e) {
        console.error("Failed to load jobs", e);
      } finally {
        if (alive) setJobsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pickJob = useCallback((job: any) => {
    setActiveJob(job);
    setPickerOpen(false);
  }, []);

  // --- STATE A: Listen -----------------------------------------------------
  const toggleMic = useCallback(() => {
    if (isListening) {
      stopListening();
      // small defer so the final transcript chunk lands
      setTimeout(() => sendTranscript(transcript || liveTranscript), 250);
    } else {
      startListening();
    }
  }, [isListening, transcript, liveTranscript]);

  const useExample = (text: string) => {
    setTranscript(text);
    sendTranscript(text);
  };

  // --- STATE B: Review (plan) ----------------------------------------------
  const sendTranscript = useCallback(
    async (text: string) => {
      const t = (text || "").trim();
      if (!t) {
        showToast("Nothing to process — try dictating again.", "info");
        return;
      }
      setPlanning(true);
      setPhase("review");
      try {
        const res = await fetchApi("/api/agent/closeout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: t, job: activeJob || {}, services: catalog }),
        });
        if (!res.ok) throw new Error("Planner returned " + res.status);
        const plan = await res.json();
        const withIds = (plan.actions || []).map((a: any, i: number) =>
          hydrateAction(a, i, catalog)
        );
        setSummary(plan.summary || "");
        setActions(withIds);
        // Risk defaults: low = pre-checked, medium = pre-checked (one-tap to undo),
        // high = selected but requires explicit confirm before execution.
        const sel: Record<string, boolean> = {};
        withIds.forEach((a: any) => {
          sel[a.id] = a.risk !== "high" ? true : true; // selected by default; gated by confirm
        });
        setSelected(sel);
        setConfirmed({});
        if (plan.simulated) showToast("Simulated plan (no AI key set).", "info");
      } catch (e) {
        console.error(e);
        showToast("Couldn't build a closeout plan. Try again.", "error");
        setPhase("listen");
      } finally {
        setPlanning(false);
      }
    },
    [activeJob, catalog, showToast]
  );

  // --- Card interactions ---------------------------------------------------
  const onToggle = (id: string, next: boolean) =>
    setSelected((s) => ({ ...s, [id]: next }));
  const onConfirm = (id: string) => setConfirmed((c) => ({ ...c, [id]: true }));
  const onChange = (id: string, patch: any) =>
    setActions((arr) => arr.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // True when the plan wants to bill or close a job but none is selected.
  const needsJob =
    !activeJob?.id &&
    actions.some((a) => selected[a.id] && NEEDS_JOB_TYPES.includes(a.type));

  // --- STATE C: Execute ----------------------------------------------------
  const doAll = async () => {
    const chosen = actions.filter((a) => selected[a.id]);
    if (!chosen.length) return;
    // Refuse money-adjacent actions when no job is picked — never guess who
    // to bill or which job to close.
    if (!activeJob?.id && chosen.some((a) => NEEDS_JOB_TYPES.includes(a.type))) {
      setPickerOpen(true);
      showToast("Pick the job first — I won't bill or close anything without one.", "info");
      return;
    }
    setExecuting(true);
    const results: any[] = [];
    for (const action of chosen) {
      try {
        const exec = await executeAction(action, { activeJob, catalog });
        results.push(exec);
      } catch (e: any) {
        console.error("Execute failed", action.type, e);
        results.push({
          id: action.id,
          type: action.type,
          title: action.title,
          ok: false,
        });
        showToast(`Failed to ${labelFor(action.type)}.`, "error");
      }
    }
    setExecuted(results);
    setPhase("done");
    setExecuting(false);
    const okN = results.filter((r) => r.ok).length;
    if (okN) showToast(`${okN} action${okN === 1 ? "" : "s"} executed.`, "success");
  };

  // "Review Each" runs them sequentially too, but only the explicitly-selected
  // subset (the user has already vetted each card inline) — same execution path.
  const reviewEach = () => doAll();

  const cancel = () => {
    setActions([]);
    setSummary("");
    setSelected({});
    setConfirmed({});
    setTranscript("");
    setPhase("listen");
  };

  const resetAll = () => {
    setExecuted([]);
    cancel();
  };

  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-forest-500/15 border border-forest-500/30 flex items-center justify-center">
            <Truck size={22} className="text-forest-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight leading-none">
              Tailgate Closeout
            </h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">
              {activeJob
                ? activeJob.title || activeJob.client || "Job selected"
                : jobsLoading
                ? "Loading jobs…"
                : "No job selected"}
            </p>
          </div>
        </div>

        {/* Job picker — the closeout applies to the job picked here. */}
        {phase !== "done" && (
          <JobPicker
            jobs={allJobs}
            loading={jobsLoading}
            activeJob={activeJob}
            open={pickerOpen}
            onOpen={() => setPickerOpen(true)}
            onClose={() => setPickerOpen(false)}
            onPick={pickJob}
          />
        )}

        <AnimatePresence mode="wait">
          {phase === "listen" && (
            <motion.div
              key="listen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ListenState
                isListening={isListening}
                transcript={transcript || liveTranscript}
                supported={supported}
                planning={planning}
                onMic={toggleMic}
                onExample={useExample}
              />
            </motion.div>
          )}

          {phase === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {planning ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <p className="text-center text-zinc-500 text-xs font-bold uppercase tracking-widest pt-2">
                    <Loader2 size={14} className="inline animate-spin mr-2" />
                    Building your closeout plan…
                  </p>
                </div>
              ) : actions.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="Nothing to do"
                  description="I couldn't find any actions in that. Try describing what you finished, what to bill, and anything for next time."
                  action={{ label: "Try Again", onClick: cancel }}
                />
              ) : (
                <>
                  {needsJob && (
                    <div className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
                      <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-300 text-sm font-bold leading-tight">
                          Pick the job first
                        </p>
                        <p className="text-amber-200/70 text-xs leading-relaxed mt-1">
                          Billing and closing need a job — choose one above so nothing
                          lands on the wrong customer.
                        </p>
                      </div>
                      <button
                        onClick={() => setPickerOpen(true)}
                        className="shrink-0 min-h-[40px] px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        Pick Job
                      </button>
                    </div>
                  )}
                  <ActionCardStack
                    summary={summary}
                    actions={actions}
                    selected={selected}
                    confirmed={confirmed}
                    onToggle={onToggle}
                    onConfirm={onConfirm}
                    onChange={onChange}
                    onDoAll={doAll}
                    onReviewEach={reviewEach}
                    onCancel={cancel}
                    executing={executing}
                  />
                </>
              )}
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <CloseoutDoneStrip executed={executed} onAgain={resetAll} />
              {/* Honest delivery: a drafted invoice is NOT sent — hand the
                  user straight to Invoices to review + send it. */}
              {executed.some((e) => e.type === "invoice" && e.ok) && (
                <Link
                  to="/admin/invoices"
                  className="mt-3 w-full flex items-center gap-3 rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-forest-500/40 p-4 transition-colors group"
                >
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <FileText size={18} className="text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold leading-tight">
                      Invoice drafted — nothing sent yet
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      Review &amp; send it from Invoices
                    </p>
                  </div>
                  <ArrowRight
                    size={18}
                    className="shrink-0 text-zinc-500 group-hover:text-forest-400 transition-colors"
                  />
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STATE A view
// ---------------------------------------------------------------------------
function ListenState({ isListening, transcript, supported, planning, onMic, onExample }: any) {
  return (
    <div className="flex flex-col items-center">
      {/* Live transcript ribbon */}
      <div className="w-full min-h-[88px] rounded-2xl bg-zinc-950/60 border border-white/5 p-5 mb-8 flex items-center">
        {transcript ? (
          <p className="text-white text-xl font-medium leading-relaxed">{transcript}</p>
        ) : (
          <p className="text-zinc-600 text-lg italic">
            {isListening ? "Listening…" : "Tap the mic and tell me how the job went."}
          </p>
        )}
      </div>

      {/* Big mic button */}
      <button
        onClick={onMic}
        disabled={planning || !supported}
        className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${
          isListening
            ? "bg-rose-500 text-white"
            : "bg-forest-500 text-black hover:bg-forest-400"
        }`}
        style={{ minWidth: 160, minHeight: 160 }}
      >
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full bg-rose-500/40 animate-ping" />
            <span className="absolute inset-[-12px] rounded-full border-2 border-rose-500/40 animate-pulse" />
          </>
        )}
        {planning ? (
          <Loader2 size={56} className="animate-spin" />
        ) : isListening ? (
          <Square size={52} fill="currentColor" />
        ) : (
          <Mic size={64} />
        )}
      </button>

      <p className="mt-5 text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
        {isListening ? (
          <>
            <Radio size={16} className="text-rose-400 animate-pulse" /> Tap to stop & plan
          </>
        ) : (
          "Tap to start"
        )}
      </p>

      {!supported && (
        <p className="mt-4 text-amber-400 text-xs font-bold uppercase tracking-wide text-center">
          Voice not supported in this browser — use Chrome.
        </p>
      )}

      {/* Example chips */}
      {!isListening && !transcript && (
        <div className="w-full mt-10">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 text-center">
            Or try saying
          </p>
          <div className="space-y-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => onExample(ex)}
                disabled={planning}
                className="w-full text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-4 text-sm text-zinc-300 leading-relaxed transition-colors disabled:opacity-50 min-h-[56px]"
              >
                “{ex}”
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job picker — explicit selection of the job the closeout applies to.
// Default list: in-progress + today's jobs; search reaches every job.
// ---------------------------------------------------------------------------
function JobPicker({ jobs, loading, activeJob, open, onOpen, onClose, onPick }: any) {
  const [query, setQuery] = useState("");
  const expanded = open || !activeJob;
  const today = localToday();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return (jobs || [])
        .filter((j: any) =>
          [j.title, j.client, j.address, j.location].some((v: any) =>
            String(v || "").toLowerCase().includes(q)
          )
        )
        .slice(0, 30);
    }
    const inProgress = (jobs || []).filter((j: any) => j.status === "IN_PROGRESS");
    const todays = (jobs || []).filter(
      (j: any) =>
        j.status !== "IN_PROGRESS" && String(j.date || "").slice(0, 10) === today
    );
    return [...inProgress, ...todays].slice(0, 30);
  }, [jobs, query, today]);

  // Collapsed: compact bar showing the picked job with a one-tap "Change".
  if (!expanded) {
    return (
      <div className="rounded-2xl bg-forest-500/10 border border-forest-500/20 p-4 mb-6 flex items-center gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-forest-500/15 border border-forest-500/30 flex items-center justify-center">
          <CheckCircle2 size={18} className="text-forest-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-forest-400">
            Closeout Job
          </p>
          <p className="text-white font-bold leading-tight truncate">
            {activeJob.title || activeJob.client || "Untitled job"}
          </p>
          {activeJob.client && activeJob.title && (
            <p className="text-zinc-400 text-xs truncate mt-0.5">{activeJob.client}</p>
          )}
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-950/60 border border-white/5 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          Which job is this closeout for?
        </p>
        {activeJob && (
          <button
            onClick={onClose}
            className="min-h-[32px] px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
          >
            Keep Current
          </button>
        )}
      </div>

      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all jobs…"
          className="w-full min-h-[48px] rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-forest-500/50"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-zinc-600 text-sm italic px-1 py-3">
          {query
            ? "No jobs match that search."
            : "No in-progress or today's jobs — search to find one."}
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {rows.map((job: any) => {
            const isActive = activeJob?.id === job.id;
            const isToday = String(job.date || "").slice(0, 10) === today;
            const pill =
              job.status === "IN_PROGRESS"
                ? { txt: "In Progress", cls: "bg-forest-500/15 text-forest-400 border-forest-500/30" }
                : isToday
                ? { txt: "Today", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
                : {
                    txt: String(job.date || "").slice(0, 10) || job.status || "—",
                    cls: "bg-white/5 text-zinc-400 border-white/10",
                  };
            return (
              <button
                key={job.id}
                onClick={() => onPick(job)}
                className={`w-full text-left rounded-xl border px-4 py-3 min-h-[56px] transition-colors ${
                  isActive
                    ? "bg-forest-500/15 border-forest-500/40"
                    : "bg-white/5 hover:bg-white/10 border-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold leading-tight truncate">
                      {job.title || job.client || "Untitled job"}
                    </p>
                    {job.client && job.title && (
                      <p className="text-zinc-500 text-xs truncate mt-0.5">{job.client}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${pill.cls}`}
                  >
                    {pill.txt}
                  </span>
                  {isActive && (
                    <CheckCircle2 size={16} className="text-forest-400 shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action hydration + execution helpers
// ---------------------------------------------------------------------------
function hydrateAction(a: any, idx: number, catalog: any[]) {
  const action = { ...a, id: a.id || `act-${idx}-${Math.random().toString(36).slice(2, 7)}` };
  if (action.type === "invoice") {
    const items = (action.lineItems || []).map((li: any) => {
      let amount = li.amount;
      if ((amount == null || amount === "") && li.fromCatalog) {
        amount = catalogPrice(catalog, li.description);
      }
      return { ...li, amount: amount == null ? CATALOG_FALLBACK : Number(amount) };
    });
    const total =
      action.total != null && action.total !== ""
        ? Number(action.total)
        : items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0);
    return { ...action, lineItems: items, total };
  }
  return action;
}

function labelFor(type: string) {
  return (
    {
      close_job: "close the job",
      invoice: "create the invoice",
      schedule: "schedule the visit",
      inventory: "update inventory",
      note: "save the note",
    }[type] || "run that action"
  );
}

async function executeAction(action: any, ctx: { activeJob: any; catalog: any[] }) {
  const { activeJob } = ctx;
  switch (action.type) {
    // CLOSE JOB -> mark COMPLETED, undo reopens to previous status.
    // Refuses without an explicitly-picked job — never closes a guessed one.
    case "close_job": {
      if (!activeJob?.id) {
        return {
          id: action.id,
          type: action.type,
          title: action.title || "Close job",
          detail: "No job picked — choose the job above, then run this again",
          ok: false,
        };
      }
      const prevStatus = activeJob.status || "IN_PROGRESS";
      await jobsRepo.update(activeJob.id, { status: "COMPLETED" });
      return {
        id: action.id,
        type: action.type,
        title: action.title || "Job marked complete",
        detail: activeJob.title || activeJob.client || "",
        ok: true,
        undo: async () => {
          try {
            await jobsRepo.update(activeJob.id, { status: prevStatus });
          } catch (e) {
            console.error("Undo close_job failed", e);
            throw e;
          }
        },
      };
    }

    // INVOICE -> create a DRAFT invoice for the picked job's customer. Nothing
    // is delivered here, so we never claim "sent" — the done screen links to
    // /admin/invoices to review + send. Refuses without a picked job.
    case "invoice": {
      if (!activeJob?.id) {
        return {
          id: action.id,
          type: action.type,
          title: action.title || "Invoice",
          detail: "No job picked — choose who to bill above, then run this again",
          ok: false,
        };
      }
      const customer = activeJob.client || activeJob.title || "customer";
      const total =
        action.total != null
          ? Number(action.total)
          : (action.lineItems || []).reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0);
      const created = await invoicesRepo.create({
        amount: total,
        items: action.lineItems || [],
        status: "draft",
        data: { client: customer, jobId: activeJob.id },
      });
      return {
        id: action.id,
        type: action.type,
        title: `Invoice drafted for ${customer}`,
        detail: `$${total.toFixed(2)} · not sent yet — review & send from Invoices`,
        ok: true,
        undo: async () => {
          try {
            await invoicesRepo.remove(created.id);
          } catch {
            // Fall back to voiding if delete is blocked.
            await invoicesRepo.update(created.id, { status: "void" });
          }
        },
      };
    }

    // SCHEDULE -> create a SCHEDULED job; undo removes it.
    case "schedule": {
      const date = parseWhen(action.when);
      const created = await jobsRepo.create({
        title: action.title || "Follow-up visit",
        status: "SCHEDULED",
        date: date || undefined,
        data: { client: activeJob?.client || activeJob?.title || "" },
      });
      return {
        id: action.id,
        type: action.type,
        title: action.title || "Visit scheduled",
        detail: date ? new Date(date).toLocaleDateString() : action.when || "date TBD",
        ok: true,
        undo: async () => {
          await jobsRepo.remove(created.id);
        },
      };
    }

    // INVENTORY -> best-effort: match an item and flag it; otherwise record a note.
    case "inventory": {
      let detail = action.item ? `${action.action || "reorder"} · ${action.item}` : action.title;
      let ok = true;
      try {
        const rows = await inventoryRepo.list();
        const flat = (rows || []).map((r: any) => ({ ...(r.data || {}), ...r }));
        const needle = (action.item || "").toLowerCase();
        const match =
          needle &&
          flat.find((it: any) =>
            (it.name || it.item || "").toLowerCase().includes(needle)
          );
        if (match?.id) {
          await inventoryRepo.update(match.id, { status: "LOW_STOCK" });
          detail = `Flagged ${match.name || match.item} for reorder`;
        } else {
          detail = `Noted: ${action.action || "reorder"} ${action.item || "item"} (no match in stock)`;
        }
      } catch (e) {
        console.error("inventory exec", e);
        ok = true; // non-fatal: still surface the note
      }
      return {
        id: action.id,
        type: action.type,
        title: action.title || "Inventory updated",
        detail,
        ok,
      };
    }

    // NOTE -> save to knowledge base; undo removes it.
    case "note": {
      const content = action.content || action.title || "";
      const created = await knowledgeRepo.create({ content });
      return {
        id: action.id,
        type: action.type,
        title: action.title || "Note saved",
        detail: content.slice(0, 80),
        ok: true,
        undo: async () => {
          await knowledgeRepo.remove(created.id);
        },
      };
    }

    default:
      return { id: action.id, type: action.type, title: action.title, ok: false };
  }
}
