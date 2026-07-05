import React, { useState, useEffect } from "react";
import { Brain, ArrowLeft, Heart, Scale, Sparkles, Zap, Gauge, CalendarClock, Receipt, Users, MessageSquare, Mic, Satellite, FileText, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchApi } from "../lib/api";

// Per-meter display metadata (order + icon + label + native unit), keyed by the server's meter id.
const METER_META: Record<string, { name: string; unit: string; Icon: any }> = {
  ai: { name: "AI Credits", unit: "credits", Icon: Sparkles },
  sms: { name: "Text Segments", unit: "segments", Icon: MessageSquare },
  live_min: { name: "Live-Ear Voice", unit: "min", Icon: Mic },
  aerial: { name: "Aerial Lookups", unit: "lookups", Icon: Satellite },
  pdf: { name: "PDF Renders", unit: "renders", Icon: FileText },
};

export default function AiUsage() {
  const [viewMode, setViewMode] = useState<"summary" | "verbatim" | "both">("both");

  const [credits, setCredits] = useState<{
    creditsRemaining?: number;
    used?: number;
    periodEnd?: string | number | null;
    tier?: string;
  } | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsError, setCreditsError] = useState(false);

  // Multi-meter usage + projected month-end bill (base + per-seat + metered overage).
  const [summary, setSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchApi("/api/usage/credits")
      .then((res) => {
        if (!res.ok) throw new Error("usage fetch failed");
        return res.json();
      })
      .then((data) => {
        if (active) setCredits(data);
      })
      .catch((err) => {
        // Expected when the credits endpoint is unavailable (demo / unconfigured) — the
        // UI already shows a graceful error state, so this is a warning, not an error.
        console.warn("AI usage credits unavailable", err?.message || err);
        if (active) setCreditsError(true);
      })
      .finally(() => {
        if (active) setCreditsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchApi("/api/usage/summary")
      .then((res) => {
        if (!res.ok) throw new Error("summary fetch failed");
        return res.json();
      })
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        console.warn("Usage summary unavailable", err?.message || err);
        if (active) setSummaryError(true);
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const fmtNum = (n: any) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";
  const fmtDate = (d: any) => {
    if (!d) return "—";
    const parsed = new Date(d);
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
  };
  // Integer cents → "$1,234.56". Non-finite collapses to "$0.00".
  const fmtCents = (c: any) => {
    const n = typeof c === "number" && Number.isFinite(c) ? c : 0;
    return `$${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  // Round a fractional unit for display (live minutes can be fractional) without trailing noise.
  const fmtUnit = (n: any) => {
    const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
  };

  const summaryCards = [
    {
      title: "1. The Scope of YardWorx AI",
      desc: "YardWorx uses advanced AI models to speed up invoice creation, draft quick customer quotes, plan routes, and listen to voice scheduling on-site. It's built to automate your administrative chores.",
    },
    {
      title: "2. The 'You Are the Boss' Rule",
      desc: "The AI is a digital helper, not the business owner. You and your administrators retain absolute liability for final authority. Always verify generated estimates, proposals, or texts to ensure accuracy before sending them to your clients.",
    },
    {
      title: "3. Friendly & Ethical Interaction",
      desc: "No hacking, jailbreaking, or attempting to force YardWorx to output harmful, illegal, or discriminatory content. Attempts to use the Assistant for spam or malicious code generation will result in immediate termination of service. Play nice and keep the assistant focused on landscaping growth.",
    },
    {
      title: "4. Locktight Isolated Training",
      desc: "Your company records and uploaded documents are 100% private. Your company data is absolutely never mixed into public training pools or used to help fine-tune global AI models used by competitors.",
    },
    {
      title: "5. Core Enterprise Workflows (No Autonomous Wildcards)",
      desc: "YardWorx is a tool, not a human replacement. We bound our AI rigidly to proven, enterprise-level workflows. We do not permit or deploy 'frontier', fully autonomous, 'finger-crossing' multi-agent loops that run wildly unchecked in the background. If you need chaotic rogue agents, look elsewhere.",
    },
  ];

  const verbatimSections = [
    {
      title: "1. The Scope of YardWorx AI",
      text: "YardWorx, operated by Gaelworx AI, integrates advanced machine learning models, including generative AI (LLMs) and computer vision, to assist with scheduling, routing, drafting communications, and analyzing terrain. These systems are designed to augment your operational capabilities, not replace final human judgment.",
    },
    {
      title: "2. Human-in-the-Loop Requirement",
      text: "AI-generated outputs—including proposals, invoices, predictive maintenance alerts, and semantic analysis of client requests—are provided as recommendations. You (the owner) and your designated administrators retain absolute liability for verifying the accuracy of these outputs before dispatching them to clients or acting upon them in the field.",
    },
    {
      title: "3. Ethical Interaction Bounds",
      text: "You agree not to bypass, jailbreak, or attempt to force the YardWorx AI agents to generate harmful, illegal, or discriminatory content. The internal cognitive engine (the 'Brain') is strictly scoped to landscape management, CRM, and operational heuristics. Attempts to utilize the models for unrelated mass-marketing spam or malicious code generation will result in immediate termination of service.",
    },
    {
      title: "4. Data Isolation",
      text: "Gaelworx AI ensures that any vectorization or embeddings created from your company documents (such as PDF contracts or client history) remain strictly within your tenant boundaries. Your proprietary data is never pooled or used to fine-tune the core inference models shared across other companies using YardWorx.",
    },
    {
      title: "5. Functional Boundaries & Agentic Limitations",
      text: "Gaelworx AI strictly enforces operational boundaries to maintain system deterministic integrity. The YardWorx generative components are strictly restricted to predefined, enterprise-level workflows (e.g., text summarization, data extraction, guided drafting). We do not deploy, authorize, or support unbounded, 'frontier-style' autonomous agentic loops capable of unverified, self-directed external actions. Any attempts to manipulate system prompts to achieve unbounded autonomous execution are strictly prohibited.",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-black text-white px-4 sm:px-6 py-8 sm:py-12 font-sans overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-forest-400 text-xs font-black uppercase tracking-widest hover:text-forest-300 transition-colors">
            <ArrowLeft size={14} /> Return Home
          </Link>
        </div>

        <header className="border-b border-white/5 molten-edge pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
              <Brain className="text-amber-500" size={24} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-none animate-fadeIn">Acceptable AI Usage & Ethics</h1>
              <p className="text-white/40 text-[10px] sm:text-xs tracking-widest uppercase font-bold mt-2">
                Operational Framework &bull; Gaelworx AI &bull; Updated May 2026
              </p>
            </div>
          </div>

          {/* Dual Reader Switcher */}
          <div className="bg-white/5 border border-white/10 p-1 rounded-2xl flex items-center self-start md:self-auto shrink-0 shadow-lg">
            <button
              onClick={() => setViewMode("summary")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-xs font-black uppercase tracking-widest transition-all ${
                viewMode === "summary" || viewMode === "both" && "md:bg-transparent"
                  ? "bg-forest-500 text-black md:bg-forest-500 md:text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Copilot Notes
            </button>
            <button
              onClick={() => setViewMode("verbatim")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-xs font-black uppercase tracking-widest transition-all ${
                viewMode === "verbatim"
                  ? "bg-celtic-500 text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Legalese
            </button>
            <button
              onClick={() => setViewMode("both")}
              className={`hidden md:block px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                viewMode === "both"
                  ? "bg-zinc-800 text-forest-400 border border-white/5"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Side-by-Side
            </button>
          </div>
        </header>

        {/* Live AI usage / credits (real data from /api/usage/credits) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5 molten-edge">
            <Zap size={16} className="text-forest-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-forest-400">
              Your AI Usage This Period
            </h2>
          </div>

          {creditsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/5 rounded-3xl p-6 h-32 animate-pulse"
                />
              ))}
            </div>
          ) : creditsError ? (
            <div className="bg-white/5 border border-white/5 rounded-3xl p-6 text-center">
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest">
                Usage data is unavailable right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/5 hover:border-forest-500/20 rounded-3xl p-6 transition-all space-y-3">
                <div className="flex items-center gap-2 text-forest-400">
                  <Gauge size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    Credits Remaining
                  </span>
                </div>
                <p className="text-4xl font-black italic tracking-tighter text-white">
                  {fmtNum(credits?.creditsRemaining)}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 hover:border-forest-500/20 rounded-3xl p-6 transition-all space-y-3">
                <div className="flex items-center gap-2 text-celtic-400">
                  <Zap size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    Used This Period
                  </span>
                </div>
                <p className="text-4xl font-black italic tracking-tighter text-white">
                  {fmtNum(credits?.used)}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 hover:border-forest-500/20 rounded-3xl p-6 transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400">
                    <CalendarClock size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                      Plan
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-forest-500/30 bg-forest-500/5 text-forest-400">
                    {credits?.tier || "—"}
                  </span>
                </div>
                <p className="text-sm font-black italic uppercase tracking-tight text-white/80">
                  Renews {fmtDate(credits?.periodEnd)}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Multi-meter usage + projected month-end bill (base + per-seat + metered overage) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5 molten-edge">
            <Receipt size={16} className="text-forest-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-forest-400">
              Metered Usage &amp; Projected Bill
            </h2>
          </div>

          {summaryLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-white/5 border border-white/5 rounded-2xl h-16 animate-pulse" />
              ))}
            </div>
          ) : summaryError || !summary ? (
            <div className="bg-white/5 border border-white/5 rounded-3xl p-6 text-center">
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest">
                Detailed usage is unavailable right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Per-meter bars */}
              <div className="lg:col-span-2 bg-white/5 border border-white/5 rounded-3xl p-5 sm:p-6 space-y-5">
                {(summary.meters || []).map((m: any) => {
                  const meta = METER_META[m.meter] || { name: m.meter, unit: "units", Icon: Gauge };
                  const allot = Number(m.allotment) || 0;
                  const used = Number(m.used) || 0;
                  const pct = allot > 0 ? Math.min(100, Math.round((used / allot) * 100)) : (used > 0 ? 100 : 0);
                  const over = Number(m.over) || 0;
                  const barColor = over > 0 ? "bg-amber-500" : pct >= 80 ? "bg-celtic-500" : "bg-forest-500";
                  const Icon = meta.Icon;
                  return (
                    <div key={m.meter} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon size={14} className="text-white/40 shrink-0" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-white/70 truncate">{meta.name}</span>
                        </div>
                        <span className="text-[11px] font-bold text-white/50 tabular-nums shrink-0">
                          {fmtUnit(used)} / {allot > 0 ? fmtUnit(allot) : "0"} {meta.unit}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      {over > 0 && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                          {fmtUnit(over)} {meta.unit} over &bull; {fmtCents(m.overageCents)} overage
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Projected bill */}
              <div className="bg-white/5 border border-white/5 rounded-3xl p-5 sm:p-6 space-y-3">
                <div className="flex items-center gap-2 text-forest-400">
                  <CalendarClock size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Projected This Month</span>
                </div>
                <p className="text-4xl font-black italic tracking-tighter text-white">{fmtCents(summary.projectedTotalCents)}</p>
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-white/40 uppercase tracking-widest">Base ({summary.tier})</span>
                    <span className="text-white/70 tabular-nums">{fmtCents(summary.baseCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-white/40 uppercase tracking-widest flex items-center gap-1">
                      <Users size={11} /> Seats ({fmtNum(summary.seats)}/{fmtNum(summary.includedSeats)} incl)
                    </span>
                    <span className="text-white/70 tabular-nums">{fmtCents(summary.seatsCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-white/40 uppercase tracking-widest">Metered Overage</span>
                    <span className={`tabular-nums ${Number(summary.overageCents) > 0 ? "text-amber-400" : "text-white/70"}`}>{fmtCents(summary.overageCents)}</span>
                  </div>
                </div>
                {summary.spendCapCents != null ? (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                    <Gauge size={11} /> Spend cap {fmtCents(summary.spendCapCents)}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 text-[10px] font-bold uppercase tracking-widest text-amber-400/70">
                    <AlertTriangle size={11} /> No spend cap set
                  </div>
                )}
                <p className="text-[10px] text-white/30 leading-relaxed">
                  Estimate for the current period. Overage bills in arrears at period close; set a
                  spend cap in Settings to bound it.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Visual Intro explaining the "Good People" pledge */}
        <div className="bg-forest-500/5 border border-forest-500/10 rounded-3xl p-6 flex flex-col md:flex-row items-start gap-4">
          <div className="p-3 bg-forest-500/10 rounded-2xl shrink-0 text-forest-400 mt-0.5">
            <Heart size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-forest-400">Our Mutual Handshake Pledge</h3>
            <p className="text-xs text-white/60 leading-relaxed mt-1 font-medium">
              We design software for good people empowering other good people. We built this interactive reader so you get ultimate transparency: <strong className="text-white">Copilot Notes</strong> shows friendly, human summaries, while <strong className="text-white">Legalese</strong> ensures the precise verbatim terms as written in state filings remain fully transparent and clear.
            </p>
          </div>
        </div>

        {/* Content Area split or full */}
        <div className={`grid gap-8 ${viewMode === "both" ? "md:grid-cols-2" : "grid-cols-1"}`}>
          
          {/* Summary View (Copilot Notes) */}
          {(viewMode === "summary" || viewMode === "both") && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5 molten-edge">
                <Sparkles size={16} className="text-amber-400" />
                <h2 className="text-xs font-black uppercase tracking-widest text-amber-400">Copilot Notes Translation (Plain English)</h2>
              </div>
              <div className="space-y-4">
                {summaryCards.map((card, i) => (
                  <div key={i} className="p-6 bg-white/5 border border-white/5 hover:border-forest-500/20 rounded-3xl transition-all space-y-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">{card.title}</h3>
                    <p className="text-xs text-white/70 leading-relaxed font-semibold italic">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verbatim View (Contract Legalese) */}
          {(viewMode === "verbatim" || viewMode === "both") && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5 molten-edge">
                <Scale size={16} className="text-celtic-400" />
                <h2 className="text-xs font-black uppercase tracking-widest text-celtic-400">Verbatim Contract (Legally Binding)</h2>
              </div>
              <div className="space-y-4">
                {verbatimSections.map((sec, i) => (
                  <div key={i} className="p-6 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-2">
                    <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest">{sec.title}</h3>
                    <p className="text-xs text-white/50 leading-relaxed font-mono">{sec.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
