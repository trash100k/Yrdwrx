import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, Workflow, Play, Download, Search } from "lucide-react";
import { fetchApi } from "../lib/api";

export function DeepResearchTab() {
    const [prompt, setPrompt] = useState("");
    const [status, setStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
    const [report, setReport] = useState("");
    const [interactionId, setInteractionId] = useState("");

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === "pending" && interactionId) {
            interval = setInterval(async () => {
                try {
                    const res = await fetchApi("/api/research/status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ interactionId })
                    });
                    const data = await res.json();
                    if (data.status === "completed") {
                        setStatus("completed");
                        setReport(data.report);
                        clearInterval(interval);
                    } else if (data.status === "failed") {
                        setStatus("failed");
                        clearInterval(interval);
                    }
                } catch(e) { console.error(e); }
            }, 10000); // 10s poll limit as per guidelines for deep research
        }
        return () => clearInterval(interval);
    }, [status, interactionId]);

    const startResearch = async () => {
        if (!prompt) return;
        setStatus("pending");
        try {
            const res = await fetchApi("/api/research/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();
            setInteractionId(data.interactionId);
        } catch(e) {
            setStatus("failed");
        }
    };

    return (
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto w-full">
            <div className="max-w-3xl mx-auto space-y-6 w-full">
                <div className="flex items-center gap-3 mb-6">
                    <Search className="text-emerald-500" />
                    <h3 className="text-xl font-bold text-white">Deep Research Assistant</h3>
                </div>
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6">
                    <p className="text-sm text-zinc-400 mb-4">Leverages Deep Research Preview to exhaustively analyze market competitors, property data, and local codes.</p>
                    <textarea 
                        className="w-full h-32 bg-black/50 border border-emerald-500/30 rounded-xl p-4 text-white resize-none focus:outline-none"
                        placeholder="e.g. Research local landscaping competitors in Meridian, MS and give me their pricing models..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    <button 
                        disabled={status === "pending" || !prompt}
                        onClick={startResearch}
                        className="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {status === "pending" ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                        {status === "pending" ? "Researching Deeply..." : "Start Deep Research"}
                    </button>
                    
                    {status === "pending" && (
                        <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest animate-pulse">
                                Deep Research Agent dispatched. Consolidating dozens of sources. This may take a few minutes...
                            </p>
                        </div>
                    )}
                    {status === "completed" && (
                        <div className="mt-6">
                            <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-3">Research Findings</h4>
                            <div className="p-6 bg-black/50 border border-white/5 rounded-xl text-sm text-zinc-300 leading-relaxed max-height-96 overflow-y-auto">
                                {report}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function VideoMarketingTab() {
    const [prompt, setPrompt] = useState("");
    const [status, setStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
    const [operationName, setOperationName] = useState("");

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === "pending" && operationName) {
            interval = setInterval(async () => {
                try {
                    const res = await fetchApi("/api/marketing/video-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ operationName })
                    });
                    const data = await res.json();
                    if (data.done) {
                        setStatus("completed");
                        clearInterval(interval);
                    }
                } catch(e) { console.error(e); }
            }, 10000);
        }
        return () => clearInterval(interval);
    }, [status, operationName]);

    const startVideo = async () => {
        if (!prompt) return;
        setStatus("pending");
        try {
            const res = await fetchApi("/api/marketing/generate-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();
            setOperationName(data.operationName);
        } catch(e) {
            setStatus("failed");
        }
    };

    const downloadVideo = async () => {
        try {
            const res = await fetchApi("/api/marketing/video-download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ operationName })
            });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "promo_video.mp4";
            a.click();
        } catch(e) { console.error(e); }
    };

    return (
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto w-full">
            <div className="max-w-3xl mx-auto space-y-6 w-full">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Play className="text-emerald-500" />
                        <h3 className="text-xl font-bold text-white">Veo Video Marketing</h3>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 font-bold uppercase tracking-widest text-[9px] rounded-full border border-amber-500/20">
                        Veo 3.1
                    </span>
                </div>
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6">
                    <p className="text-sm text-zinc-400 mb-4">Generate 1080p promotional video clips for ad campaigns using Veo 3.1.</p>
                    <textarea 
                        className="w-full h-24 bg-black/50 border border-emerald-500/30 rounded-xl p-4 text-white resize-none focus:outline-none"
                        placeholder="e.g. A cinematic drone shot flying over a newly landscaped green lawn with perfect stripes"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    <button 
                        disabled={status === "pending" || !prompt}
                        onClick={startVideo}
                        className="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {status === "pending" ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                        {status === "pending" ? "Rendering AI Video..." : "Generate Reel"}
                    </button>
                    
                    {status === "pending" && (
                        <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                            <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                            <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest">
                                Rendering Frames... This typically takes a few minutes.
                            </p>
                        </div>
                    )}

                    {status === "completed" && (
                        <div className="mt-6 p-6 bg-black/30 border border-white/5 rounded-2xl flex flex-col items-center text-center">
                            <Sparkles className="text-emerald-500 mb-3" size={32} />
                            <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-sm mb-4">Video Rendering Complete</h4>
                            <button 
                                onClick={downloadVideo}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors"
                            >
                                <Download size={18} /> Download Reel (MP4)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
