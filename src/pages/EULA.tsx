import { ArrowLeft, Scale, Sparkles, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

export function EULA() {
  const [viewMode, setViewMode] = useState<"summary" | "verbatim" | "both">("both");

  const summaryCards = [
    {
      title: "1. Software Integrity",
      desc: "Good people empowering good people. You are welcome to use our software to run your business, but you are absolutely forbidden from reverse-engineering, cloning, forking, or scraping our code to build a competitor.",
    },
    {
      title: "2. Data Ownership",
      desc: "Your data is your data. Our code is our code. We will never hold your client list hostage, but you cannot steal our proprietary logic.",
    },
    {
      title: "3. Responsible Usage",
      desc: "You are responsible for what you do on CuttyOS. If you or your contractors misuse the software to harm others, we will shut down your account immediately.",
    },
  ];

  const verbatimSections = [
    {
      title: "1. Grant of License & Restrictions",
      text: "Gaelworx AI ('Licensor') grants you a revocable, non-exclusive, non-transferable, limited right to access and use the CuttyOS platform solely for your internal business operations. You shall not: (a) modify, translate, adapt, or otherwise create derivative works or improvements; (b) reverse engineer, disassemble, decompile, decode, or otherwise attempt to derive or gain access to the source code of the Software; (c) bypass or breach any security device or protection used by the Software; (d) rent, lease, lend, sell, sublicense, assign, distribute, publish, transfer, or otherwise make available the Software to any third party for any reason.",
    },
    {
      title: "2. Intellectual Property Rights",
      text: "You acknowledge and agree that the Software is provided under license, and not sold, to you. You do not acquire any ownership interest in the Software under this Agreement, or any other rights thereto other than to use the Software in accordance with the license granted. Licensor reserves and shall retain its entire right, title, and interest in and to the Software, including all copyrights, trademarks, and other intellectual property rights therein or relating thereto.",
    },
    {
      title: "3. Termination",
      text: "Licensor may terminate this Agreement at any time if you materially breach any provision of this Agreement. Upon termination, all rights granted to you under this Agreement will also terminate, and you must cease all use of the Software. Any attempt to clone, fork, or reproduce the CuttyOS software for competitive purposes will result in immediate termination, loss of all data, and potential legal action.",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white px-4 sm:px-6 py-8 sm:py-12 font-sans overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest hover:text-indigo-300 transition-colors">
            <ArrowLeft size={14} /> Return Home
          </Link>
        </div>

        <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
              <Scale className="text-indigo-500" size={24} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-none">End User License Agreement</h1>
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
                  ? "bg-indigo-500 text-black md:bg-indigo-500 md:text-black"
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
                  ? "bg-zinc-800 text-indigo-400 border border-white/5"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Side-by-Side
            </button>
          </div>
        </header>

        {/* Visual Intro explaining the "Good People" pledge */}
        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-6 flex flex-col md:flex-row items-start gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl shrink-0 text-indigo-400 mt-0.5">
            <Heart size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-indigo-400">Our Mutual Handshake Pledge</h3>
            <p className="text-xs text-white/60 leading-relaxed mt-1 font-medium">
              We design software for good people empowering other good people. You can trust us with your business operations, and we expect you to respect our engineering effort. This agreement explicitly protects CuttyOS from being cloned or reverse-engineered by bad actors.
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
                  <div key={i} className="p-6 bg-white/5 border border-white/5 hover:border-indigo-500/20 rounded-3xl transition-all space-y-2">
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
                    <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest">{sec.title}</h3>
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
