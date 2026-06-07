import React, { useState } from "react";
import { Brain, ArrowLeft, Heart, Scale, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function AiUsage() {
  const [viewMode, setViewMode] = useState<"summary" | "verbatim" | "both">("both");

  const summaryCards = [
    {
      title: "1. The Scope of Cutty AI",
      desc: "Cutty uses advanced AI models to speed up invoice creation, draft quick customer quotes, plan routes, and listen to voice scheduling on-site. It's built to automate your administrative chores.",
    },
    {
      title: "2. The 'You Are the Boss' Rule",
      desc: "The AI is a digital helper, not the business owner. You and your administrators retain absolute liability for final authority. Always verify generated estimates, proposals, or texts to ensure accuracy before sending them to your clients.",
    },
    {
      title: "3. Friendly & Ethical Interaction",
      desc: "No hacking, jailbreaking, or attempting to force Cutty to output harmful, illegal, or discriminatory content. Attempts to use the Assistant for spam or malicious code generation will result in immediate termination of service. Play nice and keep the assistant focused on landscaping growth.",
    },
    {
      title: "4. Locktight Isolated Training",
      desc: "Your company records and uploaded documents are 100% private. Your company data is absolutely never mixed into public training pools or used to help fine-tune global AI models used by competitors.",
    },
    {
      title: "5. Core Enterprise Workflows (No Autonomous Wildcards)",
      desc: "Cutty is a tool, not a human replacement. We bound our AI rigidly to proven, enterprise-level workflows. We do not permit or deploy 'frontier', fully autonomous, 'finger-crossing' multi-agent loops that run wildly unchecked in the background. If you need chaotic rogue agents, look elsewhere.",
    },
  ];

  const verbatimSections = [
    {
      title: "1. The Scope of CuttyOS AI",
      text: "CuttyOS, operated by Gaelworx AI, integrates advanced machine learning models, including generative AI (LLMs) and computer vision, to assist with scheduling, routing, drafting communications, and analyzing terrain. These systems are designed to augment your operational capabilities, not replace final human judgment.",
    },
    {
      title: "2. Human-in-the-Loop Requirement",
      text: "AI-generated outputs—including proposals, invoices, predictive maintenance alerts, and semantic analysis of client requests—are provided as recommendations. You (the owner) and your designated administrators retain absolute liability for verifying the accuracy of these outputs before dispatching them to clients or acting upon them in the field.",
    },
    {
      title: "3. Ethical Interaction Bounds",
      text: "You agree not to bypass, jailbreak, or attempt to force the CuttyOS AI agents to generate harmful, illegal, or discriminatory content. The internal cognitive engine (the 'Brain') is strictly scoped to landscape management, CRM, and operational heuristics. Attempts to utilize the models for unrelated mass-marketing spam or malicious code generation will result in immediate termination of service.",
    },
    {
      title: "4. Data Isolation",
      text: "Gaelworx AI ensures that any vectorization or embeddings created from your company documents (such as PDF contracts or client history) remain strictly within your tenant boundaries. Your proprietary data is never pooled or used to fine-tune the core inference models shared across other companies using CuttyOS.",
    },
    {
      title: "5. Functional Boundaries & Agentic Limitations",
      text: "Gaelworx AI strictly enforces operational boundaries to maintain system deterministic integrity. The CuttyOS generative components are strictly restricted to predefined, enterprise-level workflows (e.g., text summarization, data extraction, guided drafting). We do not deploy, authorize, or support unbounded, 'frontier-style' autonomous agentic loops capable of unverified, self-directed external actions. Any attempts to manipulate system prompts to achieve unbounded autonomous execution are strictly prohibited.",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-black text-white px-4 sm:px-6 py-8 sm:py-12 font-sans overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest hover:text-emerald-300 transition-colors">
            <ArrowLeft size={14} /> Return Home
          </Link>
        </div>

        <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
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
                  ? "bg-emerald-500 text-black md:bg-emerald-500 md:text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Copilot Notes
            </button>
            <button
              onClick={() => setViewMode("verbatim")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-xs font-black uppercase tracking-widest transition-all ${
                viewMode === "verbatim"
                  ? "bg-blue-500 text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Legalese
            </button>
            <button
              onClick={() => setViewMode("both")}
              className={`hidden md:block px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                viewMode === "both"
                  ? "bg-zinc-800 text-emerald-400 border border-white/5"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Side-by-Side
            </button>
          </div>
        </header>

        {/* Visual Intro explaining the "Good People" pledge */}
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 flex flex-col md:flex-row items-start gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl shrink-0 text-emerald-400 mt-0.5">
            <Heart size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">Our Mutual Handshake Pledge</h3>
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
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <Sparkles size={16} className="text-amber-400" />
                <h2 className="text-xs font-black uppercase tracking-widest text-amber-400">Copilot Notes Translation (Plain English)</h2>
              </div>
              <div className="space-y-4">
                {summaryCards.map((card, i) => (
                  <div key={i} className="p-6 bg-white/5 border border-white/5 hover:border-emerald-500/20 rounded-3xl transition-all space-y-2">
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
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <Scale size={16} className="text-blue-400" />
                <h2 className="text-xs font-black uppercase tracking-widest text-blue-400">Verbatim Contract (Legally Binding)</h2>
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
