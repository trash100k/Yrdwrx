// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { jobsRepo, customersRepo } from "../lib/repos";
import { fetchApi } from "../lib/api";
import BeforeAfterSlider from "../components/BeforeAfterSlider";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  Loader2,
  Sparkles,
  CheckCircle2,
  Camera,
  ImageOff,
  Star,
  Send,
  Building2,
  Mail,
} from "lucide-react";

// Field Mode writes completion photos into the job's `data` jsonb (jobs has no photo
// columns), so departurePhotoUrl/arrivalPhotoUrl/snapshotNotes/varianceFound live there.
// Surface them at the top level for the render.
const adaptJob = (r: any) => ({ ...(r?.data || {}), ...r });
const adaptCustomer = (r: any) => ({ ...(r?.data || {}), ...r });

// Best-effort human name for a job's customer when no customer record resolves.
const jobClientName = (j: any) =>
  j.client || j.clientName || j.customerName || j.customer || "";

const customerDisplayName = (c: any) => {
  if (!c) return "";
  const full = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return c.companyName || full || c.name || "";
};

const jobDate = (j: any) =>
  j.date || j.completedAt || j.createdAt || j.created_at || null;

const fmtDate = (v: any) => {
  if (!v) return "";
  try {
    const ms =
      typeof v === "object" && v !== null && "seconds" in v
        ? (v as any).seconds * 1000
        : v;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

export default function Portfolio() {
  const { tenant } = useTenant();
  const { showToast } = useToast();

  // ── Existing slideshow state (UNCHANGED) ──────────────────────────────────
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── New Before/After state ────────────────────────────────────────────────
  // View toggle at top: "slideshow" | "beforeafter".
  const [view, setView] = useState<"slideshow" | "beforeafter">("slideshow");
  // All completed jobs that have at least a departure photo (superset of `photos`).
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  // Customer directory for resolving group names / emails (best-effort).
  const [customers, setCustomers] = useState<any[]>([]);
  // Per-customer "asking for review" in-flight flag.
  const [askingKey, setAskingKey] = useState<string | null>(null);

  useEffect(() => {
    // RLS scopes reads to the caller's tenant, so no tenantId/status where-clauses are
    // needed — we filter for completed jobs with a departure photo client-side.
    const unsub = jobsRepo.subscribe((rows) => {
      const jobs = (rows || [])
        .map(adaptJob)
        .filter((j) => j.status === "COMPLETED" && j.departurePhotoUrl);
      setPhotos(jobs);
      setCompletedJobs(jobs);
      setLoading(false);
    });

    // Customer directory (best-effort; non-fatal) for nicer group names + email.
    customersRepo
      .list()
      .then((rows) => setCustomers((rows || []).map(adaptCustomer)))
      .catch(() => {});

    // Safety: never spin forever if the data source is slow/unreachable — fall back to the empty state.
    const t = setTimeout(() => setLoading(false), 6000);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, [tenant?.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && photos.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, photos.length]);

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % photos.length);
  const handlePrev = () =>
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // ── Group completed jobs by property/customer ─────────────────────────────
  // Resolve a customer record by id (covers both customerId + customer_id since
  // repo reads camelCase, but we guard for raw rows too).
  const customerById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of customers) {
      if (c.id != null) m.set(String(c.id), c);
    }
    return m;
  }, [customers]);

  const groups = useMemo(() => {
    const byKey = new Map<
      string,
      { key: string; name: string; customer: any; jobs: any[] }
    >();
    for (const j of completedJobs) {
      const cid = j.customerId ?? j.customer_id ?? null;
      const cust = cid != null ? customerById.get(String(cid)) : null;
      const name =
        customerDisplayName(cust) || jobClientName(j) || "Unattributed Property";
      // Group by customer id when we have one, otherwise by the resolved name.
      const key = cid != null ? `id:${cid}` : `name:${name.toLowerCase()}`;
      if (!byKey.has(key)) {
        byKey.set(key, { key, name, customer: cust || null, jobs: [] });
      }
      byKey.get(key)!.jobs.push(j);
    }
    // Sort each group's jobs newest-first; sort groups by their most recent job.
    const arr = Array.from(byKey.values()).map((g) => {
      g.jobs.sort(
        (a, b) =>
          new Date(jobDate(b) || 0).getTime() -
          new Date(jobDate(a) || 0).getTime(),
      );
      return g;
    });
    arr.sort(
      (a, b) =>
        new Date(jobDate(b.jobs[0]) || 0).getTime() -
        new Date(jobDate(a.jobs[0]) || 0).getTime(),
    );
    return arr;
  }, [completedJobs, customerById]);

  // ── "Ask for a review" → draft a short review-request email via /api/email/send.
  // We use the email path (not /api/reviews/process, which analyzes inbound review
  // text — not an outbound request) so the action is honest about what it does.
  const askForReview = async (group: any) => {
    const cust = group.customer;
    const email = cust?.email || "";
    if (!email) {
      showToast("No email on file for this customer.", "warning");
      return;
    }
    const job = group.jobs[0] || {};
    const service = job.title || job.serviceType || job.service || "your service";
    const company =
      tenant?.name || tenant?.settings?.companyName || "our team";
    const greetName =
      cust?.firstName || customerDisplayName(cust) || "there";
    const subject = `How did we do at ${group.name}?`;
    const text = `Hi ${greetName},

Thanks for trusting ${company} with ${service}. We'd love to hear how it went — your feedback helps us keep raising the bar (and helps neighbors find us).

Would you take a moment to leave us a quick review?

Thank you,
${company}`;
    const html = `<p>Hi ${greetName},</p>
<p>Thanks for trusting <strong>${company}</strong> with ${service}. We'd love to hear how it went — your feedback helps us keep raising the bar (and helps neighbors find us).</p>
<p>Would you take a moment to leave us a quick review?</p>
<p>Thank you,<br/>${company}</p>`;

    setAskingKey(group.key);
    try {
      const res = await fetchApi("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject,
          text,
          html,
          replyTo: tenant?.settings?.replyTo || undefined,
        }),
      });
      if (!res.ok) {
        let msg = "Email send failed.";
        try {
          const err = await res.json();
          if (err?.error) msg = err.error;
        } catch {}
        showToast(msg, "error");
        return;
      }
      showToast(`Review request sent to ${email}.`, "success");
    } catch (e: any) {
      showToast(e?.message || "Could not send review request.", "error");
    } finally {
      setAskingKey(null);
    }
  };

  // ── Top toggle bar (shared by both views) ─────────────────────────────────
  const ViewToggle = ({ floating = false }: { floating?: boolean }) => (
    <div
      className={`flex bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 ${
        floating ? "" : "shadow-inner"
      }`}
      role="tablist"
    >
      {[
        { id: "slideshow", label: "Slideshow" },
        { id: "beforeafter", label: "Before / After" },
      ].map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={view === t.id}
          onClick={() => setView(t.id as any)}
          className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
            view === t.id
              ? "bg-white text-black shadow-lg"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    if (view === "beforeafter") {
      return (
        <div className="h-full w-full bg-zinc-950 text-white rounded-[40px] overflow-hidden border border-white/5 p-6 sm:p-10 space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-56" />
            <ViewToggle />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-3xl" />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center p-20 h-full w-full bg-zinc-950">
        <Loader2 className="animate-spin text-forest-500" size={48} />
      </div>
    );
  }

  // ── BEFORE / AFTER VIEW ───────────────────────────────────────────────────
  if (view === "beforeafter") {
    return (
      <div className="h-full w-full bg-zinc-950 text-white rounded-[40px] overflow-y-auto border border-white/5">
        <div className="p-6 sm:p-10 space-y-10 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                <Camera className="text-forest-500" />
                Before / After
              </h1>
              <p className="text-xs font-black uppercase tracking-widest text-forest-400 mt-1">
                Transformation Proof · By Property
              </p>
            </div>
            <ViewToggle />
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={ImageOff}
              title="No completed jobs with photos yet"
              description="Complete jobs and capture arrival/departure photos in Field Mode to build before/after transformations for each property."
              action={{
                label: "Open Slideshow",
                onClick: () => setView("slideshow"),
              }}
            />
          ) : (
            <div className="space-y-12">
              {groups.map((group) => {
                const email = group.customer?.email || "";
                const asking = askingKey === group.key;
                return (
                  <section key={group.key} className="space-y-6">
                    {/* Group header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 shrink-0 rounded-2xl bg-forest-500/10 border border-forest-500/20 flex items-center justify-center text-forest-400">
                          <Building2 size={22} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white truncate">
                            {group.name}
                          </h2>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">
                            {group.jobs.length} completed job
                            {group.jobs.length === 1 ? "" : "s"}
                            {email ? ` · ${email}` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => askForReview(group)}
                        disabled={asking || !email}
                        title={
                          email
                            ? "Email a short review request to this customer"
                            : "No email on file for this customer"
                        }
                        className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-celtic-600 hover:bg-celtic-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[10px] transition-all"
                      >
                        {asking ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : email ? (
                          <Star size={14} />
                        ) : (
                          <Mail size={14} />
                        )}
                        {asking ? "Sending…" : "Ask for a Review"}
                      </button>
                    </div>

                    {/* Job cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {group.jobs.map((job) => {
                        const hasPair =
                          !!job.arrivalPhotoUrl && !!job.departurePhotoUrl;
                        const title =
                          job.title ||
                          job.serviceType ||
                          job.service ||
                          "Completed Project";
                        const date = fmtDate(jobDate(job));
                        return (
                          <div
                            key={job.id}
                            className="rounded-3xl border border-white/5 bg-black/40 overflow-hidden shadow-2xl flex flex-col"
                          >
                            {hasPair ? (
                              <div className="relative h-72 bg-black flex">
                                <BeforeAfterSlider
                                  beforeImage={job.arrivalPhotoUrl}
                                  afterImage={job.departurePhotoUrl}
                                />
                              </div>
                            ) : (
                              <div className="relative h-72 bg-black">
                                <img
                                  src={job.departurePhotoUrl}
                                  alt={title}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="absolute bottom-4 right-4 px-3 py-1.5 bg-forest-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 z-10">
                                  <Sparkles size={12} className="text-black" />
                                  After
                                </span>
                              </div>
                            )}
                            {/* Caption */}
                            <div className="p-5 flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <h3 className="text-sm font-black uppercase tracking-tight text-white truncate">
                                  {title}
                                </h3>
                                {date && (
                                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">
                                    {date}
                                  </p>
                                )}
                              </div>
                              {job.varianceFound === false && (
                                <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-forest-500/20 text-forest-400 text-[9px] font-black uppercase tracking-widest">
                                  <CheckCircle2 size={12} />
                                  Verified
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── SLIDESHOW VIEW (EXISTING — preserved) ─────────────────────────────────
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 h-full w-full bg-zinc-950">
        <div className="absolute top-6 right-6 z-10">
          <ViewToggle floating />
        </div>
        <div className="w-24 h-24 mb-6 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
          <Sparkles size={48} />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">
          No Portfolio Items Yet
        </h2>
        <p className="text-zinc-500 font-bold max-w-sm text-center">
          Complete jobs with departure photos to build your automatic project
          showcase.
        </p>
      </div>
    );
  }

  const currentJob = photos[currentIndex];

  return (
    <div
      className={`flex flex-col bg-zinc-950 text-white ${
        isFullscreen
          ? "fixed inset-0 z-50"
          : "h-full w-full rounded-[40px] overflow-hidden border border-white/5"
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between p-6 shrink-0 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <Sparkles className="text-forest-500" />
            Project Showcase
          </h1>
          <p className="text-xs font-black uppercase tracking-widest text-forest-400 mt-1">
            Client Presentation Mode
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isFullscreen && <ViewToggle floating />}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all backdrop-blur-md"
          >
            {isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" className="ml-1" />
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all backdrop-blur-md"
          >
            <Maximize2 size={20} />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative group overflow-hidden bg-black flex flex-col justify-center">
        {/* Progress indicators */}
        <div className="absolute top-24 left-0 right-0 z-10 px-6 flex items-center justify-center gap-1">
          {photos.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-500 ${
                idx === currentIndex ? "w-8 bg-forest-500" : "w-2 bg-white/20"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={currentJob.departurePhotoUrl}
            alt={"Project " + currentJob.id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
        </AnimatePresence>

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" />

        {/* Content Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 md:p-20 z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex + "-text"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-4xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="px-4 py-2 bg-forest-500/20 text-forest-400 font-black uppercase tracking-widest text-xs rounded-[10px] border border-forest-500/20 backdrop-blur-md">
                  Completed Project
                </span>
                {currentJob.varianceFound === false && (
                  <span className="px-4 py-2 border border-white/20 text-white/80 font-black uppercase tracking-widest text-xs rounded-[10px] backdrop-blur-md flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-forest-500" />
                    AI Verified Quality
                  </span>
                )}
              </div>

              <h2 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight leading-[0.9] mb-6 shadow-2xl drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
                {currentJob.title || "Feature Property"}
              </h2>

              <p className="text-lg sm:text-xl text-zinc-300 font-bold max-w-2xl leading-relaxed drop-shadow-xl text-balance">
                {currentJob.snapshotNotes ||
                  currentJob.description ||
                  "Top tier landscaping and maintenance completed to strict quality standards."}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-6 top-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-3xl bg-black/40 border border-white/10 hover:bg-white/10 hover:scale-110 active:scale-95 transition-all text-white/50 hover:text-white backdrop-blur-xl z-20 group-hover:opacity-100 opacity-0"
        >
          <ChevronLeft size={32} />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-6 top-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-3xl bg-black/40 border border-white/10 hover:bg-white/10 hover:scale-110 active:scale-95 transition-all text-white/50 hover:text-white backdrop-blur-xl z-20 group-hover:opacity-100 opacity-0"
        >
          <ChevronRight size={32} />
        </button>
      </div>
    </div>
  );
}
