import { fetchApi } from "../lib/api";
// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { reviewsRepo, jobsRepo } from "../lib/repos";
import {
  handleFirestoreError,
  OperationType,
  logSystemEvent,
} from "../lib/firebase";
import {
  Star,
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Filter,
  ThumbsUp,
  MoreHorizontal,
  MessageCircle,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { syncService } from "../services/syncService";
import { useWorkspaceOutbox } from "../contexts/WorkspaceOutboxContext";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

export default function Reviews() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const { addLog } = useWorkspaceOutbox();
  const [reviews, setReviews] = useState<
    {
      id: string;
      customerName: string;
      rating: number;
      text: string;
      platform: string;
      priority?: boolean;
      aiDraft?: string;
      action?: string;
      isReplied?: boolean;
      replyPosted?: boolean;
      sentiment?: "positive" | "negative" | "neutral" | string;
      source?: string;
      createdAt?: string;
      autoReplyDraft?: string;
      data?: any;
    }[]
  >([]);
  const [activeTab, setActiveTab] = useState("All");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Edited reply text, keyed by review id, so "Deploy Response" persists what the
  // user actually typed in the textarea (it was previously discarded).
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  // Recently completed jobs (real) that drive the review-solicitation hub, replacing
  // the hardcoded "4 clients".
  const [recentCompletedJobs, setRecentCompletedJobs] = useState<any[]>([]);
  const [soliciting, setSoliciting] = useState(false);

  // Surface non-column Firestore-era fields (customerName, platform, source,
  // autoReplyDraft, summary, isReplied, repliedAt, priority) that now live in the
  // `data` jsonb. Top-level columns win over data keys of the same name.
  const adaptReview = (r: any): any => ({ ...(r?.data || {}), ...r });

  useEffect(() => {
    const unsubscribe = reviewsRepo.subscribe((rows) => {
      setReviews((rows || []).map(adaptReview));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenant]);

  // Pull real recently-completed jobs so the outreach hub targets actual clients
  // (best-effort; non-fatal if it fails).
  useEffect(() => {
    let active = true;
    jobsRepo
      .list()
      .then((rows) => {
        if (!active) return;
        const jobs = (rows || []).map((r: any) => ({ ...(r.data || {}), ...r }));
        const completed = jobs
          .filter((j: any) => ["completed", "complete", "done", "closed"].includes(String(j.status || "").toLowerCase()))
          .sort(
            (a: any, b: any) =>
              new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime(),
          )
          .slice(0, 10);
        setRecentCompletedJobs(completed);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [tenant]);

  // Dispatch a personalized review-solicitation message to the outbox for each
  // recently-completed job's client (real targets, real count).
  const solicitRecentJobs = async () => {
    if (!recentCompletedJobs.length) {
      showToast("No recently completed jobs to solicit.", "info");
      return;
    }
    setSoliciting(true);
    // A review request with a one-click link converts far better. Pulled from Business
    // Defaults (Settings → Google Review Link); omitted cleanly when not set.
    const reviewUrl = (tenant?.settings as any)?.googleReviewUrl || "";
    try {
      let sent = 0; // genuinely delivered via Resend
      let simulated = 0; // accepted by the server but NOT actually emailed (unconfigured)
      let failed = 0; // send errored
      let noEmail = 0; // no address on the job -> can't send

      for (const job of recentCompletedJobs) {
        const client =
          job.client || job.clientName || job.customerName || job.customer || "Client";
        const to =
          job.clientEmail ||
          job.email ||
          job.customerEmail ||
          job.contactEmail ||
          job.data?.email ||
          "";
        const subject = "How did we do?";
        const content = `Hi ${client}, thanks for choosing us for "${job.title || "your recent service"}". We'd love a quick review of your experience.${reviewUrl ? ` Leave one here: ${reviewUrl}` : ""}`;

        if (!to) {
          // No address — we can't actually send, so log it as a draft, not "sent".
          noEmail++;
          addLog({ type: "email", recipient: client, subject, content }, "draft");
          continue;
        }

        try {
          const res = await fetchApi("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to, subject, text: content }),
          });
          // Guard res.ok BEFORE reading the body.
          if (!res.ok) {
            let reason = `HTTP ${res.status}`;
            try {
              const errBody = await res.json();
              reason = errBody?.error || reason;
            } catch {
              /* non-JSON error body */
            }
            failed++;
            addLog(
              { type: "email", recipient: `${client} <${to}>`, subject, content: `${content}\n\n[failed: ${reason}]` },
              "failed",
            );
            continue;
          }
          let body: any = {};
          try {
            body = await res.json();
          } catch {
            /* tolerate empty/non-JSON body */
          }
          // A genuine send: server says sent !== false and not simulated/unconfigured.
          const reallySent =
            body?.sent !== false &&
            body?.simulated !== true &&
            body?.configured !== false;
          if (reallySent) {
            sent++;
            addLog({ type: "email", recipient: `${client} <${to}>`, subject, content }, "sent");
          } else {
            simulated++;
            addLog({ type: "email", recipient: `${client} <${to}>`, subject, content }, "draft");
          }
        } catch (e: any) {
          failed++;
          addLog(
            { type: "email", recipient: `${client} <${to}>`, subject, content: `${content}\n\n[error: ${e?.message || "send failed"}]` },
            "failed",
          );
        }
      }

      // Report honestly, leading with the most severe outcome.
      if (failed > 0) {
        showToast(
          `${failed} review request${failed === 1 ? "" : "s"} failed to send.${sent ? ` ${sent} sent.` : ""}${simulated || noEmail ? ` ${simulated + noEmail} saved as draft.` : ""}`,
          "error",
        );
      } else if (sent > 0 && simulated === 0 && noEmail === 0) {
        showToast(
          `Sent ${sent} review request${sent === 1 ? "" : "s"}.`,
          "success",
        );
      } else if (sent === 0) {
        // Nothing actually went out — don't pretend it did.
        showToast(
          `Email isn't configured yet — ${simulated + noEmail} review request${simulated + noEmail === 1 ? "" : "s"} weren't actually sent (saved as drafts). Set RESEND_API_KEY and client emails to deliver.`,
          "info",
        );
      } else {
        // Mixed: some real, some not.
        showToast(
          `Sent ${sent}; ${simulated + noEmail} saved as draft (not configured / no email).`,
          "info",
        );
      }
    } finally {
      setSoliciting(false);
    }
  };

  const analyzeReview = async (review: {
    id: string;
    customerName: string;
    rating: number;
    text: string;
    platform: string;
    priority?: boolean;
    aiDraft?: string;
    action?: string;
    data?: any;
  }) => {
    setIsProcessing(review.id);
    const tenantId = tenant?.id || "genesis-1";
    try {
      const res = await fetchApi("/api/reviews/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review: review.text }),
      });
      // Guard res.ok BEFORE parsing — a failed analysis must not be swallowed.
      if (!res.ok) {
        let reason = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          reason = errBody?.error || reason;
        } catch {
          /* non-JSON error body */
        }
        showToast(`Couldn't draft a reply: ${reason}`, "error");
        return;
      }
      const data = await res.json();

      if (navigator.onLine) {
        // `sentiment` is a real column; autoReplyDraft/summary have no columns ->
        // merge into the `data` jsonb (preserving existing data keys).
        await reviewsRepo.update(review.id, {
          sentiment: data.sentiment,
          data: {
            ...(review.data || {}),
            autoReplyDraft: data.autoReplyDraft,
            summary: data.summary,
          },
        });
      } else {
        await syncService.queueAction(
          "UPDATE",
          "reviews",
          {
            sentiment: data.sentiment,
            data: {
              ...(review.data || {}),
              autoReplyDraft: data.autoReplyDraft,
              summary: data.summary,
            },
          },
          tenantId,
          review.id,
        );
      }
      await logSystemEvent("REVIEW_ANALYZED", {
        reviewId: review.id,
        sentiment: data.sentiment,
        tenantId,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviews/${review.id}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const confirmReply = async (review: {
    id: string;
    customerName: string;
    rating: number;
    text: string;
    platform: string;
    priority?: boolean;
    aiDraft?: string;
    autoReplyDraft?: string;
    action?: string;
    data?: any;
  }) => {
    const tenantId = tenant?.id || "genesis-1";
    // Persist the EDITED textarea content (falls back to the AI draft if untouched).
    const reply =
      replyDrafts[review.id] ?? review.autoReplyDraft ?? review.data?.autoReplyDraft ?? "";
    if (!reply.trim()) {
      showToast("Nothing to deploy — write a response first.", "info");
      return;
    }
    // Whether the reply actually reached the platform. There is currently NO
    // review-platform posting integration (no Google/Yelp reply API wired up),
    // so a "Deploy" only SAVES the reply — it does not publish it. Be honest
    // about that instead of toasting a fabricated "deployed".
    let posted = false;
    let postError = "";
    try {
      const res = await fetchApi("/api/reviews/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: review.id,
          platform: review.platform || (review as any).source,
          reply,
        }),
      });
      if (res.ok) {
        let body: any = {};
        try {
          body = await res.json();
        } catch {
          /* tolerate empty/non-JSON body */
        }
        // A genuine post requires the platform send to be real, not simulated.
        posted =
          body?.posted === true ||
          (body?.sent !== false &&
            body?.simulated !== true &&
            body?.configured !== false &&
            (body?.success === true || body?.posted === true));
        if (!posted) {
          postError =
            body?.reason ||
            "review-platform posting isn't configured";
        }
      } else {
        // Endpoint missing (404) or errored — fall through to draft-only save.
        try {
          const errBody = await res.json();
          postError = errBody?.error || `HTTP ${res.status}`;
        } catch {
          postError = `HTTP ${res.status}`;
        }
      }
    } catch (e: any) {
      // No reply-posting endpoint reachable — treat as draft-only, report below.
      postError = e?.message || "no posting integration available";
    }

    // reply/isReplied/repliedAt/replyPosted have no columns -> merge into `data` jsonb.
    // `replyPosted` records whether this reply was genuinely published vs. saved as a
    // draft, so the status badge can stay honest after a reload.
    const patch = {
      data: {
        ...(review.data || {}),
        reply,
        isReplied: true,
        replyPosted: posted,
        repliedAt: new Date().toISOString(),
      },
    };

    try {
      if (navigator.onLine) {
        await reviewsRepo.update(review.id, patch);
      } else {
        await syncService.queueAction("UPDATE", "reviews", patch, tenantId, review.id);
      }
      await logSystemEvent("REVIEW_REPLY_SAVED", {
        reviewId: review.id,
        posted,
        tenantId,
      });
      if (posted) {
        showToast("Response posted to the review platform.", "success");
      } else {
        showToast(
          `Saved as a draft reply — not posted yet (${postError}). Connect a review platform to publish.`,
          "info",
        );
      }
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `reviews/${review.id}/reply`,
      );
    }
  };

  const filteredReviews = reviews.filter(
    (r) =>
      activeTab === "All" ||
      (activeTab === "Pending" && !r.isReplied) ||
      (activeTab === "Negative" && r.sentiment === "Negative"),
  );

  // Sentiment Delta — computed from real reviews[].sentiment (and star rating as a
  // fallback for un-analyzed rows) instead of the previously fabricated 92/5/3%.
  const sentimentStats = useMemo(() => {
    let pos = 0,
      neg = 0,
      neu = 0;
    for (const r of reviews) {
      const s = (r.sentiment || "").toString().toLowerCase();
      if (s === "positive") pos++;
      else if (s === "negative") neg++;
      else if (s === "neutral") neu++;
      else if (typeof r.rating === "number") {
        // Un-analyzed: infer from stars.
        if (r.rating >= 4) pos++;
        else if (r.rating <= 2) neg++;
        else neu++;
      } else neu++;
    }
    const total = reviews.length || 0;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    return { total, pos: pct(pos), neu: pct(neu), neg: pct(neg) };
  }, [reviews]);

  // Real-derived tags: surface the platforms/sources actually present in the feed.
  const cognitiveTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of reviews) {
      const src = r.source || r.platform;
      if (src) set.add(String(src));
    }
    return Array.from(set).slice(0, 8);
  }, [reviews]);

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-celtic-500/10 rounded-full border border-celtic-500 text-xs font-black uppercase tracking-widest text-celtic-500">
            <Star size={16} className="fill-celtic-500" />
            Brand Sentiment
          </div>
          <h1 className="text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Reputation
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            AI-driven Response Systems
          </p>
        </div>

        <div
          className="flex bg-black p-2 rounded-2xl border border-white/5 shrink-0 overflow-x-auto max-w-full shadow-inner"
          role="tablist"
        >
          {["All", "Pending", "Negative"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-transform whitespace-nowrap border-4 ${
                activeTab === tab
                  ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105"
                  : "border-transparent text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {loading &&
            [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-6 sm:p-10"
              >
                <div className="flex justify-between items-start mb-10">
                  <div className="flex gap-6">
                    <Skeleton className="w-16 h-16 rounded-[24px]" />
                    <div className="space-y-3 pt-1">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-28 rounded-full" />
                </div>
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ))}
          {!loading &&
            filteredReviews.map((review) => (
            <motion.div
              layout
              key={review.id}
              className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-6 sm:p-10 hover:border-celtic-500/50 transition-all duration-700 overflow-hidden group relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-900 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-forest-500/5 transition-colors" />

              <div className="flex justify-between items-start mb-10 relative z-10">
                <div className="flex gap-6">
                  <div className="w-16 h-16 bg-zinc-900 rounded-[24px] flex items-center justify-center text-white shrink-0 font-black text-xl sm:text-2xl border border-white/5 group-hover:bg-white group-hover:text-black transition-all duration-700">
                    {review.customerName?.[0] || "U"}
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white italic tracking-tight mb-2 leading-none uppercase">
                      {review.customerName || "Verified Asset"}
                    </h2>
                    <div className="flex items-center gap-4">
                      <div
                        className="flex text-amber-500 gap-1"
                        aria-label={`${review.rating} stars`}
                      >
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            fill={i < review.rating ? "currentColor" : "none"}
                            className={i < review.rating ? "shadow-glow" : ""}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      <span className="micro-label font-black text-zinc-400 uppercase tracking-[0.2em]">
                        {review.source} •{" "}
                        {new Date(
                          typeof review.createdAt === 'object' && review.createdAt !== null && 'seconds' in review.createdAt ? (review.createdAt as any).seconds * 1000 : review.createdAt || Date.now()
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className={`px-4 py-2 rounded-full micro-label font-black uppercase tracking-[0.2em] border shadow-glow ${
                    review.sentiment === "Positive"
                      ? "bg-forest-500/10 border-forest-500/20 text-forest-400"
                      : review.sentiment === "Negative"
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-white/5 border-white/10 text-zinc-400"
                  }`}
                >
                  {review.sentiment || "Cognitive Scan..."}
                </div>
              </div>

              <div className="bg-zinc-900 rounded-2xl p-5 sm:p-8 border border-white/5 mb-10 italic text-zinc-300 text-lg leading-relaxed shadow-inner">
                "{review.text}"
              </div>

              {!review.isReplied && (
                <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-forest-400">
                      <Sparkles size={20} className="shadow-glow" />
                      <span className="micro-label font-black uppercase tracking-[0.3em]">
                        AI Synthesis Prompt
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      {!review.autoReplyDraft && (
                        <button
                          onClick={() => analyzeReview(review)}
                          disabled={isProcessing === review.id}
                          className="micro-label font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white disabled:opacity-50 transition-colors"
                        >
                          {isProcessing === review.id
                            ? "Processing..."
                            : "Engage Logic"}
                        </button>
                      )}
                      {/* For owners who replied outside the app — clear it from Pending
                          without publishing or saving a draft. Marks data.isReplied. */}
                      <button
                        onClick={async () => {
                          await reviewsRepo.update(review.id, {
                            data: { ...(review.data || {}), isReplied: true },
                          });
                          showToast("Marked as handled.", "success");
                        }}
                        className="micro-label font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors"
                      >
                        Mark Handled
                      </button>
                    </div>
                  </div>

                  {review.autoReplyDraft && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <label
                        htmlFor={`reply-draft-${review.id}`}
                        className="sr-only"
                      >
                        Response draft for {review.customerName}
                      </label>
                      <textarea
                        id={`reply-draft-${review.id}`}
                        className="w-full min-w-0 bg-zinc-900 border border-forest-500/20 rounded-2xl p-5 sm:p-8 text-base sm:text-sm text-forest-100 leading-relaxed focus:outline-none focus:bg-white/5 transition-all shadow-inner placeholder:text-zinc-500 italic"
                        value={replyDrafts[review.id] ?? review.autoReplyDraft ?? ""}
                        onChange={(e) =>
                          setReplyDrafts((d) => ({ ...d, [review.id]: e.target.value }))
                        }
                        rows={3}
                      />
                      <div className="flex justify-end gap-4 mt-6">
                        <button
                          onClick={async () => {
                            // autoReplyDraft has no column -> merge into `data` jsonb.
                            await reviewsRepo.update(review.id, {
                              data: {
                                ...(review.data || {}),
                                autoReplyDraft: null,
                              },
                            });
                          }}
                          className="px-6 py-3 micro-label font-black uppercase text-zinc-500 hover:text-white transition-colors"
                        >
                          Recalibrate
                        </button>
                        <button
                          onClick={() => confirmReply(review)}
                          className="bg-white text-black px-10 py-4 rounded-[20px] micro-label font-black uppercase tracking-[0.3em] flex items-center gap-3 shadow-[0_15px_30px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all"
                        >
                          <Send size={16} /> Deploy Response
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {review.isReplied &&
                (review.replyPosted ?? review.data?.replyPosted ? (
                  <div className="flex items-center gap-4 text-forest-400 bg-forest-500/5 px-8 py-5 rounded-[24px] border border-forest-500/20 shadow-glow relative z-10">
                    <CheckCircle2 size={24} />
                    <span className="micro-label font-black uppercase tracking-[0.3em] leading-none">
                      Reply Posted • Sentiment Stabilized
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 text-amber-400 bg-amber-500/5 px-8 py-5 rounded-[24px] border border-amber-500/20 relative z-10">
                    <AlertCircle size={24} />
                    <span className="micro-label font-black uppercase tracking-[0.3em] leading-none">
                      Reply Saved As Draft • Not Yet Posted
                    </span>
                  </div>
                ))}
            </motion.div>
            ))}
          {!loading && filteredReviews.length === 0 && (
            <EmptyState
              icon={Star}
              title={activeTab === "All" ? "No reviews yet" : "No signal in this filter"}
              description={
                activeTab === "All"
                  ? "Customer reviews will appear here as they arrive. Use the Outreach Hub to solicit reviews from recently completed jobs."
                  : "No reviews match the selected filter. Switch to All to see your full feed."
              }
            />
          )}
        </div>

        <aside className="space-y-10">
          <div className="border border-white/5 shadow-2xl bg-black rounded-2xl p-6 sm:p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-forest-500/5 rounded-full blur-[80px] -mr-32 -mt-32" />
            <div className="flex items-center justify-between mb-10 relative z-10">
              <h3 className="micro-label font-black uppercase tracking-[0.3em] text-white/50 leading-none italic">
                Sentiment Delta
              </h3>
              <TrendingUp size={24} className="text-forest-400 shadow-glow" />
            </div>
            <div className="space-y-8 relative z-10">
              <div>
                <div className="flex justify-between items-end mb-4">
                  <span className="micro-label font-black text-white/30 uppercase italic">
                    Alpha (Pos)
                  </span>
                  <span className="text-2xl sm:text-3xl sm:text-4xl font-black italic tracking-normal md:tracking-tighter">
                    {sentimentStats.pos}%
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${sentimentStats.pos}%` }}
                    className="h-full bg-forest-500 rounded-full shadow-glow"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-4">
                  <span className="micro-label font-black text-white/30 uppercase italic">
                    Neutral
                  </span>
                  <span className="text-xl sm:text-2xl font-black italic tracking-normal md:tracking-tighter opacity-60">
                    {sentimentStats.neu}%
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${sentimentStats.neu}%` }}
                    className="h-full bg-celtic-400 rounded-full opacity-40 shadow-glow"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-4">
                  <span className="micro-label font-black text-white/30 uppercase italic">
                    Deviation (Neg)
                  </span>
                  <span className="text-xl sm:text-2xl font-black italic tracking-normal md:tracking-tighter text-red-400">
                    {sentimentStats.neg}%
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${sentimentStats.neg}%` }}
                    className="h-full bg-red-400 rounded-full shadow-glow"
                  />
                </div>
              </div>
            </div>
            <p className="mt-12 micro-label text-zinc-500 italic leading-relaxed font-black uppercase tracking-widest border-t border-white/10 pt-8">
              {sentimentStats.total === 0
                ? "No reviews yet — sentiment delta populates as feedback arrives."
                : `Based on ${sentimentStats.total} review${sentimentStats.total === 1 ? "" : "s"} across your connected platforms.`}
            </p>
          </div>

          <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl p-6 sm:p-10">
            <h3 className="micro-label font-black uppercase tracking-[0.3em] text-white/20 mb-8 italic">
              Active Platforms
            </h3>
            {cognitiveTags.length === 0 ? (
              <p className="micro-label text-white/20 italic font-black uppercase tracking-widest">
                No review sources yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {cognitiveTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-5 py-2.5 bg-white/5 border border-white/5 rounded-[20px] micro-label font-black text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-crosshair"
                  >
                    #{String(tag).replace(/\s+/g, "_").toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-celtic-900/10 border-4 border-celtic-500/20 shadow-2xl rounded-2xl p-6 sm:p-10 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-celtic-500/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
             <div className="flex justify-between items-center mb-6 relative z-10">
                 <h3 className="text-xl font-black italic uppercase text-white tracking-tight">Review Outreach Hub</h3>
                 <MessageCircle className="text-celtic-400 shadow-glow" />
             </div>
             <p className="text-sm font-medium text-zinc-400 mb-8 relative z-10">
                 Automatically dispatch personalized review solicitation emails to clients upon job completion via your connected Google Workspace (Gmail).
             </p>
             <div className="space-y-4 relative z-10">
                 <button
                  onClick={solicitRecentJobs}
                  disabled={soliciting || recentCompletedJobs.length === 0}
                  className="w-full bg-celtic-600 hover:bg-celtic-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[9px] py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                     <Send size={14} /> Solicit Recent Jobs ({recentCompletedJobs.length})
                 </button>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
