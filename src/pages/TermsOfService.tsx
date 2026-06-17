import React, { useState } from "react";
import { FileText, ArrowLeft, Heart, Scale, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function TermsOfService() {
  const [viewMode, setViewMode] = useState<"summary" | "verbatim" | "both">("both");

  const summaryCards = [
    {
      title: "1. Who This Contract Is For",
      desc: "Our terms connect you (the entity owner), your hard-working crews operating on their mobile phones, and your clients reviewing work on their private portal. It represents our pledge to work safely, fairly, and respectably together.",
    },
    {
      title: "2. Your Account Security",
      desc: "You are the quarterback of your company's tenant account. Keep your passwords safe, and make sure your team uses the system professionally. If any keys or credentials are leaked, tell us right away and we will help lock things down.",
    },
    {
      title: "3. Professional Fair Play",
      desc: "We are all honest business operators. No using the system for malicious attempts, scraping, reverse-engineering our software, or trying to jailbreak the YardWorx AI model. Play by the rules, and we will protect your workspace.",
    },
    {
      title: "4. Practical Liability Limits & Leak Fixes",
      desc: "If any data is leaked, we will jump in to fix it immediately with no hesitation. However, since we implement rigorous, enterprise-grade security and top-tier best practices to guard your workspace, we are not financially liable for leaks. We build defenses like iron, but the digital frontier can have unexpected storms.",
    },
    {
      title: "5. Your Data Guarantee",
      desc: "Your clients, your schedules, and your business details are your sovereign property—not ours. You can download or export them to CSV anytime. We never sell or share your personal identities or private client files. However, you do grant us the right to commercialize and sell strictly anonymized, non-identifiable usage statistics (the 'trends') to help improve industry analytics.",
    },
    {
      title: "6. Bad Actors Policy (Immediate Term & No Refunds)",
      desc: "If you are found doing something even remotely malicious, abusive, or harmful on YardWorx, we reserve the right to ban you instantly with NO refund. This definition of a bad actor is a living document that can evolve, but 99% of honest folks have absolutely nothing to worry about.",
    },
    {
      title: "7. Steal, Cheat, or Lie (We Will Act Legally)",
      desc: "We are built on a moral handshake: good people empowering good people. If you are caught trying to steal, cheat, or lie to our network or to your clients using our app, we will come after you with full legal force. Dishonesty hurts all of us, and we will not stand for it.",
    },
    {
      title: "8. Third-Party Connections (Your Keys, Your Rules)",
      desc: "If you hook up any and all external third-party tools, platforms, or services to YardWorx using your own API keys or webhooks, that is purely your responsibility. We provide the socket, but you own the pipeline. If any external tools misfire or cause damage, we hold ZERO liability for those outside platforms.",
    },
    {
      title: "9. Service Level (The 'As-Is' Reality)",
      desc: "YardWorx is robust as hell and built on top-tier cloud architecture. But, we explicitly DO NOT guarantee 99.9% uptime or flawless perfection at all times. The platform is provided 'As-Is'. Sometimes the digital weather gets rough, and you accept that risk by operating here.",
    },
  ];

  const verbatimSections = [
    {
      title: "1. Acceptance of Terms",
      text: "By accessing or using the YardWorx platform, provided by Gaelworx AI, you agree to be bound by these Terms of Service. This applies collectively to you as the business owner, your authorized contractors/employees utilizing the field application, and your clients utilizing the client portal. YardWorx provides a business operations software solution for field service professionals.",
    },
    {
      title: "2. Account Responsibility",
      text: "You, the business owner, are completely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your tenant environment. You must ensure your contractors adhere to acceptable use policies within the field application. You must notify Gaelworx AI immediately upon becoming aware of any breach of security.",
    },
    {
      title: "3. Acceptable Use",
      text: "You agree not to use YardWorx for any unlawful purpose or to conduct any activity that would constitute a civil or criminal offense or violate any law. You may not attempt to reverse-engineer, disrupt, or compromise the integrity of Gaelworx AI's software or artificial intelligence pipelines. Client interfaces must not be abused for malicious intent.",
    },
    {
      title: "4. Limitation of Liability & Leak Rectification",
      text: "In the event of an unexpected data leak or security incident, Gaelworx AI pledges to act immediately to isolate, fix, and secure your workspace. However, because Gaelworx AI utilizes and maintains industry-leading, enterprise-grade security safeguards and top-tier best practices, Gaelworx AI holds no financial or operational liability for secondary or consequential damages arising from cyber threats or unforeseen outages.",
    },
    {
      title: "5. Data Rights & Portability",
      text: "Gaelworx AI ensures you have full, unencumbered rights to export your primary data at any time through our native platform tools to guarantee data portability. However, by using YardWorx, you grant Gaelworx AI the right to aggregate, anonymize, and commercialize strictly non-identifiable usage statistics and backend operational telemetry, which we may legally share or sell to third parties to improve industry analytics.",
    },
    {
      title: "6. Bad Actors Policy & Discretionary Termination",
      text: "Gaelworx AI operates a strict policy against disruptive, malicious, or abusive activities. If any tenant is discovered in breach of this conduct, Gaelworx AI reserves the absolute right to suspend or delete all tenant profiles instantly with no prior notice and zero eligibility for refunds. This definition of a 'bad actor' represents a living document subject to updates at Gaelworx AI's sole discretion. 99% of normal, well-meaning operators are fully protected under our co-equal system of good-faith partnerships.",
    },
    {
      title: "7. Fraud Prevention & Mandatory Court Redress",
      text: "YardWorx is founded upon a deep moral purpose: good people empowering good people. In the event that a tenant or user is caught attempting to steal, lie, cheat, defraud transaction paths, or submit fraudulent invoices to their clients through our integrations, Gaelworx AI reserves the absolute right to pursue civil litigation and criminal complaints in a court of law. Such unethical actions damage our collective reputation, raise server costs, and ruin community trust; we will meet them with unconditional legal opposition.",
    },
    {
      title: "8. Third-Party Integrations & API Non-Liability",
      text: "YardWorx may provide webhook endpoints, OAuth connections, or API key slots enabling integrations with any and all external third-party providers, platforms, or services. You expressly acknowledge that Gaelworx AI exercises no control over these external services. You remain solely responsible for the configuration, billing, and operational consequences of any integrated third-party pipelines. Gaelworx AI holds absolutely zero liability for data corruption, service interruptions, or unauthorized access stemming from third-party connections or user-supplied API keys.",
    },
    {
      title: "9. Service Level Agreement (SLA) Exclusion & 'As-Is' Provision",
      text: "While Gaelworx AI deploys enterprise-grade reliability measures, YardWorx is provided on a strictly 'AS-IS' and 'AS-AVAILABLE' basis with no express or implied warranty of uninterrupted service. Gaelworx AI explicitly disclaims any Service Level Agreement (SLA) guarantees, including any specific percentage of uptime (e.g., 99.9%). You waive any right to claim financial damages, lost revenue, or operational compensation arising from service downtime, degraded performance, or scheduled maintenance.",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white px-4 sm:px-6 py-8 sm:py-12 font-sans overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-forest-400 text-xs font-black uppercase tracking-widest hover:text-forest-300 transition-colors">
            <ArrowLeft size={14} /> Return Home
          </Link>
        </div>

        <header className="border-b border-white/5 molten-edge pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-celtic-500/10 rounded-2xl flex items-center justify-center">
              <FileText className="text-celtic-500" size={24} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-none">Terms of Service</h1>
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
                    <h3 className="text-sm font-black text-celtic-400 uppercase tracking-widest">{sec.title}</h3>
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
