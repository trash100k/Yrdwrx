import React, { useState } from "react";
import { Database, ArrowLeft, Heart, Scale, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function DataMap() {
  const [viewMode, setViewMode] = useState<"summary" | "verbatim" | "both">("both");

  const summaryCards = [
    {
      title: "1. Isolated Islands of Data",
      desc: "Every landscape contractor on our system gets their own completely secluded, sandboxed tenant database. Your financials, client names, and notes are physically isolated from everyone else.",
    },
    {
      title: "2. The System Shield (Threat Blocker)",
      desc: "To prevent malicious code and malware from crashing our system, we block dangerous uploads like .exe files, .pbix aggregates, or shell scripts. They get deleted before they reach the data layer.",
    },
    {
      title: "3. Pure Data Portability",
      desc: "No locked digital traps. Your client roster of addresses and phone numbers can be fully exported to standard CSV at any moment from settings. We believe in keeping you with great service, not data fences.",
    },
    {
      title: "4. Your Profile & Trends Overview",
      desc: "Your setup details remain secure. Sometimes completely anonymous, generic average trend points are extracted (like national average pricing metrics) to help make algorithms smarter, and we reserve the right to commercialize or sell this completely anonymized data to improve industry metrics, keeping your personal identity always locked.",
    },
    {
      title: "5. Crews and Shift Tracking",
      desc: "Crew members have their location and shift photos processed ONLY while actively on the clock. This proves to clients that work was completed and generates on-site timecards.",
    },
    {
      title: "6. Client Portal Peace of Mind",
      desc: "Your clients can log in to view maps, pay outstanding bills safely, and request cleanups. They have full autonomy to manage their portal records with absolute simplicity.",
    },
    {
      title: "7. Secure External Connections",
      desc: "We route billing safely via Stripe (using fully encrypted tokens), store data in Firebase, and utilize Google GenAI APIs for smart features. Minimal data is sent via secure channels, and third parties are strictly prohibited from harvesting your local databases to train generic public models.",
    },
  ];

  const verbatimSections = [
    {
      title: "1. Data Architecture & Enterprise Lineage",
      text: "This Data Processing Map explains how data flows through the YardWorx platform, developed and maintained by Gaelworx AI. You (the owner), your contractors (employees/crews), and your clients are all actors within the system. All data generated and processed within this ecosystem is strictly segregated by tenant to ensure privacy, data lineage, and audit compliance.",
    },
    {
      title: "2. Active Governance & Threat Exclusion",
      text: "YardWorx utilizes enterprise-grade middleware to protect tenant environments from advanced persistent threats, including automated pentesting, DAX (Data Analysis Expressions) injection, and malicious raw binaries. Specifically, the system explicitly rejects and blackholes risky file types such as .pbix, .exe, and shell scripts prior to them ever reaching the database layer. Every incoming payload is strictly validated against expected JSON structures to maintain unbreakable lineage.",
    },
    {
      title: "3. Data Portability",
      text: "We believe you should stay with YardWorx because of its features, ease of use, and revenue-adding capabilities—not because of a data moat. You maintain full ownership of your data with transparent data portability. Complete import and export functionalities (e.g., CSV client exports) are provided natively so your data is never held hostage.",
    },
    {
      title: "4. Owner Data & Aggregation",
      text: "As the owner, your billing data, business registration, client lists, and operational configurations are stored securely within your tenant environment. While you retain ultimate ownership of this core data, Gaelworx AI may aggregate and anonymize non-identifiable usage statistics and backend operational metadata. This completely anonymized data may be commercialized or sold by Gaelworx AI to improve broader industry heuristics, provided it complies with full legal process securely and transparently.",
    },
    {
      title: "5. Contractor Data",
      text: "Data related to your contractors (crews) including GPS locations during active shifts, time tracking, job completion photos, and voice memos are processed to facilitate proof-of-work protocols, dynamic scheduling, and payroll integrations. Your contractors have the right to view their own logged hours and performance transcripts.",
    },
    {
      title: "6. Client Data",
      text: "Client data including property boundaries, service history, payment methods (via Stripe tokenization), and communication logs are stored for the purpose of CRM management and service fulfillment. Clients have access to their designated portal where they can manage their profiles and oversee project milestones in YardWorx.",
    },
    {
      title: "7. External Providers",
      text: "Our ecosystem leverages third-party services including Stripe (for payments), Firebase (for database/auth), and Google GenAI APIs (for semantic processing). Minimal data necessary for execution is transmitted to these providers via TLS encrypted channels. Gaelworx AI explicitly restricts third parties from using your data to train their fundamental models unconsented.",
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
            <div className="w-12 h-12 bg-ember-500/10 rounded-2xl flex items-center justify-center">
              <Database className="text-ember-500" size={24} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-none">Data Processing Map</h1>
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
                    <h3 className="text-sm font-black text-ember-400 uppercase tracking-widest">{sec.title}</h3>
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
