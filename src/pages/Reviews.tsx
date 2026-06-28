import { fetchApi } from "../lib/api";
// @ts-nocheck
import { useState, useEffect } from "react";
import { reviewsRepo } from "../lib/repos";
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
import { syncService } from "../services/syncService";
import { useWorkspaceOutbox } from "../contexts/WorkspaceOutboxContext";

export default function Reviews() {
  const { tenant } = useTenant();
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
    action?: string;
    data?: any;
  }) => {
    const tenantId = tenant?.id || "genesis-1";
    try {
      if (navigator.onLine) {
        // isReplied/repliedAt have no columns -> merge into the `data` jsonb.
        await reviewsRepo.update(review.id, {
          data: {
            ...(review.data || {}),
            isReplied: true,
            repliedAt: new Date().toISOString(),
          },
        });
      } else {
        await syncService.queueAction(
          "UPDATE",
          "reviews",
          {
            data: {
              ...(review.data || {}),
              isReplied: true,
              repliedAt: new Date().toISOString(),
            },
          },
          tenantId,
          review.id,
        );
      }
      await logSystemEvent("REVIEW_REPLY_SENT", {
        reviewId: review.id,
        tenantId,
      });
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
          {filteredReviews.map((review) => (
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
                        defaultValue={review.autoReplyDraft}
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

              {review.isReplied && (
                <div className="flex items-center gap-4 text-forest-400 bg-forest-500/5 px-8 py-5 rounded-[24px] border border-forest-500/20 shadow-glow relative z-10">
                  <CheckCircle2 size={24} />
                  <span className="micro-label font-black uppercase tracking-[0.3em] leading-none">
                    Review Sent • Sentiment Stabilized
                  </span>
                </div>
              )}
            </motion.div>
          ))}
          {filteredReviews.length === 0 && (
            <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-32 text-center space-y-8 rounded-2xl">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                <Star size={48} className="text-white/10" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white/50 italic tracking-normal md:tracking-tighter uppercase">
                No Signal within specified filters.
              </h3>
            </div>
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
                    92%
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "92%" }}
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
                    5%
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "5%" }}
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
                    3%
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "3%" }}
                    className="h-full bg-red-400 rounded-full shadow-glow"
                  />
                </div>
              </div>
            </div>
            <p className="mt-12 micro-label text-zinc-500 italic leading-relaxed font-black uppercase tracking-widest border-t border-white/10 pt-8">
              "Hyper-Performance observed in horticultural precision categories.
              Strategic engagement optimal."
            </p>
          </div>

          <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl p-6 sm:p-10">
            <h3 className="micro-label font-black uppercase tracking-[0.3em] text-white/20 mb-8 italic">
              Cognitive Tags
            </h3>
            <div className="flex flex-wrap gap-3">
              {[
                "Precision",
                "Hyper-Punctual",
                "Asset Integrity",
                "Status Quo+",
                "Clean Room Outbound",
                "Southern Logic",
              ].map((tag) => (
                <span
                  key={tag}
                  className="px-5 py-2.5 bg-white/5 border border-white/5 rounded-[20px] micro-label font-black text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-crosshair"
                >
                  #{tag.replace(" ", "_").toUpperCase()}
                </span>
              ))}
            </div>
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
                  onClick={() => {
                      const ans = window.confirm("Deploy optimized review requests to 4 recently completed clients via Gmail?");
                      if(ans) addLog({ type: "email", recipient: "Client", subject: "How did we do?", content: "Please leave us a review." });
                  }}
                  className="w-full bg-celtic-600 hover:bg-celtic-500 text-white font-black uppercase tracking-widest text-[9px] py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                     <Send size={14} /> Solicit Recent Jobs (4)
                 </button>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
