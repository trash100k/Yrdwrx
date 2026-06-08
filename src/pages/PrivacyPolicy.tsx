import React, { useState } from "react";
import { Shield, ArrowLeft, Heart, Scale, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  const [viewMode, setViewMode] = useState<"summary" | "verbatim" | "both">("both");

  const summaryCards = [
    {
      title: "1. What We Handle & Protect",
      desc: "We collect your business details, crew GPS locations strictly during active shifts (so they can be safely routed and get paid), client communications, and standard telemetry like IP addresses and device usage data. Your records are walled off safely and treated with high confidentiality.",
    },
    {
      title: "2. How We Use and Anonymize",
      desc: "We use details to organize daily schedules, send clients automated 'on the way' messages, and track machinery. We never sell your personal identity, customer names, or emails. We do, however, reserve the right to commercialize or sell completely anonymized backend stats and usage data to improve industry analytics.",
    },
    {
      title: "3. Your California (CCPA) Rights",
      desc: "For operators under California jurisdiction: you can view the exact items of personal data gathered over the last 12 months, demand deletion, and exercise absolute control without penalty. Your profiles remain yours.",
    },
    {
      title: "4. Your Worldwide (GDPR) Protections",
      desc: "No locked digital traps. Under European or Global rules, you retain deep ownership to retrieve structured exports as simple, standard CSV bundles or execute a dry wipe of historical records anytime from settings.",
    },
    {
      title: "5. The Right to Be Forgotten",
      desc: "If you choose to close your storefront or move on from YardWorx, you can click 'Delete' to securely clean out all association telemetry, client rosters, and job maps instantly and permanently.",
    },
  ];

  const verbatimSections = [
    {
      title: "1. Information We Collect",
      text: "We collect personal information that you provide to us when you register for YardWorx, operated by Gaelworx AI. For owners, this includes business details, billing information, and operational metrics. For contractors, this includes location data during shifts and performance logs. For clients, this includes property metrics and communication histories. We also automatically collect telemetry such as IP addresses and device usage data.",
    },
    {
      title: "2. How We Use Information",
      text: "Gaelworx AI uses the information we collect to operate, maintain, and provide the features of YardWorx. Your data may be used to deliver targeted notifications to clients, improve algorithmic scheduling for contractors, and train localized heuristics for the owner's tenant environment. While we do not sell any personally identifiable data, we may aggregate and anonymize backend operational capabilities and usage metadata. This completely anonymized data may be commercialized or sold by Gaelworx AI in compliance with standard legal processes to improve broader industry analytics and heuristics.",
    },
    {
      title: "3. CCPA Data Rights (California)",
      text: "The California Consumer Privacy Act (CCPA) provides California residents with specific rights regarding their personal information. You have the right to request access to the specific pieces of personal information we have collected about you over the past 12 months. You have the right to request deletion of your data. You have the right to non-discrimination for exercising your privacy rights. YardWorx does not sell personal information as defined by the CCPA, though it may commercialize anonymized aggregates as described above.",
    },
    {
      title: "4. Data Portability & Rights (EU/UK & Global)",
      text: "We are dedicated to transparent data portability. You maintain full ownership and access to your data, rather than being locked in by a data moat. Standard import/export features (such as CSV exports) are natively provided. In addition, under the General Data Protection Regulation (GDPR), users in the European Economic Area (EEA) and the UK have the right to access, rectify, port, and delete their personal data. Our lawful basis for processing your data is to fulfill contractual obligations and pursue legitimate business interests. To request a complete structured data export or invoke your right to be forgotten, use the 'Delete Data' action in your Settings or contact our Data Protection Officer.",
    },
    {
      title: "5. Your Controls ('Right to be Forgotten')",
      text: "You maintain full control over your personal data. If you wish to terminate your relationship with YardWorx and exercise your right to be forgotten, you may securely delete all profile metadata, tenant association, and operational history from our servers using the Settings dashboard.",
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
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
              <Shield className="text-emerald-500" size={24} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-none">Privacy Policy</h1>
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
                    <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest">{sec.title}</h3>
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
