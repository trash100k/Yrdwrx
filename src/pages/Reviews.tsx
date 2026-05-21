
import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  where,
} from "firebase/firestore";
import {
  db,
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";
import { syncService } from "../services/syncService";

export default function Reviews() {
  const { tenant } = useTenant();
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
    }[]
  >([]);
  const [activeTab, setActiveTab] = useState("All");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    const tenantId = tenant?.id || "genesis-1";
    const q = query(
      collection(db, "reviews"),
      where("tenantId", "==", tenantId),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as any,
        );
        setReviews(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "reviews");
      },
    );
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
  }) => {
    setIsProcessing(review.id);
    const tenantId = tenant?.id || "genesis-1";
    try {
      const res = await fetch("/api/reviews/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review: review.text }),
      });
      const data = await res.json();

      if (navigator.onLine) {
        await updateDoc(doc(db, "reviews", review.id), {
          sentiment: data.sentiment,
          autoReplyDraft: data.autoReplyDraft,
          summary: data.summary,
          tenantId,
          updatedAt: serverTimestamp(),
        });
      } else {
        await syncService.queueAction(
          "UPDATE",
          "reviews",
          {
            sentiment: data.sentiment,
            autoReplyDraft: data.autoReplyDraft,
            summary: data.summary,
            updatedAt: new Date().toISOString(),
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
  }) => {
    const tenantId = tenant?.id || "genesis-1";
    try {
      if (navigator.onLine) {
        await updateDoc(doc(db, "reviews", review.id), {
          isReplied: true,
          repliedAt: serverTimestamp(),
          tenantId,
          updatedAt: serverTimestamp(),
        });
      } else {
        await syncService.queueAction(
          "UPDATE",
          "reviews",
          {
            isReplied: true,
            repliedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500 text-xs font-black uppercase tracking-widest text-blue-500">
            <Star size={16} className="fill-blue-500" />
            Brand Sentiment
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Reputation
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            AI-driven Response Systems
          </p>
        </div>

        <div
          className="flex bg-black p-2 rounded-[32px] border-4 border-white/10 shrink-0 overflow-x-auto max-w-full shadow-inner"
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
              className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 hover:border-blue-500/50 transition-all duration-700 overflow-hidden group relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-900 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-emerald-500/5 transition-colors" />

              <div className="flex justify-between items-start mb-10 relative z-10">
                <div className="flex gap-6">
                  <div className="w-16 h-16 bg-zinc-900 rounded-[24px] flex items-center justify-center text-white shrink-0 font-black text-2xl border-4 border-white/10 group-hover:bg-white group-hover:text-black transition-all duration-700">
                    {review.customerName?.[0] || "U"}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white italic tracking-tight mb-2 leading-none uppercase">
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
                          review.createdAt?.seconds * 1000,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className={`px-4 py-2 rounded-full micro-label font-black uppercase tracking-[0.2em] border shadow-glow ${
                    review.sentiment === "Positive"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : review.sentiment === "Negative"
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-white/5 border-white/10 text-zinc-400"
                  }`}
                >
                  {review.sentiment || "Cognitive Scan..."}
                </div>
              </div>

              <div className="bg-zinc-900 rounded-[32px] p-8 border-4 border-white/10 mb-10 italic text-zinc-300 text-lg leading-relaxed shadow-inner">
                "{review.text}"
              </div>

              {!review.isReplied && (
                <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-emerald-400">
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
                        className="w-full bg-zinc-900 border border-emerald-500/20 rounded-[32px] p-8 text-sm text-emerald-100 leading-relaxed focus:outline-none focus:bg-white/5 transition-all shadow-inner placeholder:text-zinc-500 italic"
                        defaultValue={review.autoReplyDraft}
                        rows={3}
                      />
                      <div className="flex justify-end gap-4 mt-6">
                        <button
                          onClick={async () => {
                            await updateDoc(doc(db, "reviews", review.id), {
                              autoReplyDraft: null,
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
                <div className="flex items-center gap-4 text-emerald-400 bg-emerald-500/5 px-8 py-5 rounded-[24px] border border-emerald-500/20 shadow-glow relative z-10">
                  <CheckCircle2 size={24} />
                  <span className="micro-label font-black uppercase tracking-[0.3em] leading-none">
                    Review Sent • Sentiment Stabilized
                  </span>
                </div>
              )}
            </motion.div>
          ))}
          {filteredReviews.length === 0 && (
            <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-32 text-center space-y-8 rounded-[40px]">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border-4 border-white/10">
                <Star size={48} className="text-white/10" />
              </div>
              <h3 className="text-2xl font-black text-white/50 italic tracking-tighter uppercase">
                No Signal within specified filters.
              </h3>
            </div>
          )}
        </div>

        <aside className="space-y-10">
          <div className="border-4 border-white/10 shadow-2xl bg-black rounded-[32px] p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -mr-32 -mt-32" />
            <div className="flex items-center justify-between mb-10 relative z-10">
              <h3 className="micro-label font-black uppercase tracking-[0.3em] text-white/50 leading-none italic">
                Sentiment Delta
              </h3>
              <TrendingUp size={24} className="text-emerald-400 shadow-glow" />
            </div>
            <div className="space-y-8 relative z-10">
              <div>
                <div className="flex justify-between items-end mb-4">
                  <span className="micro-label font-black text-white/30 uppercase italic">
                    Alpha (Pos)
                  </span>
                  <span className="text-4xl font-black italic tracking-tighter">
                    92%
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border-4 border-white/10 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "92%" }}
                    className="h-full bg-emerald-500 rounded-full shadow-glow"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-4">
                  <span className="micro-label font-black text-white/30 uppercase italic">
                    Neutral
                  </span>
                  <span className="text-2xl font-black italic tracking-tighter opacity-60">
                    5%
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border-4 border-white/10 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "5%" }}
                    className="h-full bg-blue-400 rounded-full opacity-40 shadow-glow"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-4">
                  <span className="micro-label font-black text-white/30 uppercase italic">
                    Deviation (Neg)
                  </span>
                  <span className="text-2xl font-black italic tracking-tighter text-red-400">
                    3%
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border-4 border-white/10 p-0.5">
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

          <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl rounded-[32px] p-10">
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
                  className="px-5 py-2.5 bg-white/5 border-4 border-white/10 rounded-[20px] micro-label font-black text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-crosshair"
                >
                  #{tag.replace(" ", "_").toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
