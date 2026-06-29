import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Workflow, Play, Download, Search, AlertTriangle } from "lucide-react";
import { fetchApi } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

// Stop polling after this many attempts so a stuck/never-completing operation
// doesn't poll forever (10s interval => ~5 minutes of polling).
const MAX_POLL_ATTEMPTS = 30;

export function DeepResearchTab() {
    const { showToast } = useToast();
    const [prompt, setPrompt] = useState("");
    const [status, setStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
    const [report, setReport] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [interactionId, setInteractionId] = useState("");
    const attemptsRef = useRef(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === "pending" && interactionId) {
            attemptsRef.current = 0;
            interval = setInterval(async () => {
                attemptsRef.current += 1;
                if (attemptsRef.current > MAX_POLL_ATTEMPTS) {
                    setStatus("failed");
                    setErrorMsg("Research timed out before it finished. Please try again.");
                    clearInterval(interval);
                    return;
                }
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
                        setErrorMsg(data.error || "The research agent reported a failure.");
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
        setErrorMsg("");
        setReport("");
        try {
            const res = await fetchApi("/api/research/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json().catch(() => ({}));
            // Mock mode / unconfigured backend returns 503 (or no interactionId). Fail fast
            // instead of spinning forever waiting on a status that will never arrive.
            if (!res.ok || !data.interactionId) {
                setStatus("failed");
                setErrorMsg(
                    data.error ||
                    "Deep Research is unavailable right now (the AI backend is not configured)."
                );
                return;
            }
            setInteractionId(data.interactionId);
        } catch(e) {
            setStatus("failed");
            setErrorMsg("Could not reach the research service. Please try again.");
        }
    };

    return (
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto w-full">
            <div className="max-w-3xl mx-auto space-y-6 w-full">
                <div className="flex items-center gap-3 mb-6">
                    <Search className="text-forest-500" />
                    <h3 className="text-xl font-bold text-white">Deep Research Assistant</h3>
                </div>
                <div className="bg-zinc-900 border border-white/5 molten-edge rounded-2xl p-6">
                    <p className="text-sm text-zinc-400 mb-4">Leverages Deep Research Preview to exhaustively analyze market competitors, property data, and local codes.</p>
                    <textarea 
                        className="w-full h-32 bg-black/50 border border-forest-500/30 rounded-xl p-4 text-white resize-none focus:outline-none"
                        placeholder="e.g. Research local landscaping competitors in Meridian, MS and give me their pricing models..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    <button 
                        disabled={status === "pending" || !prompt}
                        onClick={startResearch}
                        className="mt-4 px-6 py-3 bg-forest-600 hover:bg-forest-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {status === "pending" ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                        {status === "pending" ? "Researching Deeply..." : "Start Deep Research"}
                    </button>
                    
                    {status === "pending" && (
                        <div className="mt-6 p-4 bg-forest-500/10 border border-forest-500/20 rounded-xl">
                            <p className="text-xs font-mono text-forest-400 uppercase tracking-widest animate-pulse">
                                Deep Research Agent dispatched. Consolidating dozens of sources. This may take a few minutes...
                            </p>
                        </div>
                    )}
                    {status === "failed" && (
                        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Research Failed</p>
                                <p className="text-sm text-red-200/80">
                                    {errorMsg || "Something went wrong while running deep research."}
                                </p>
                            </div>
                        </div>
                    )}
                    {status === "completed" && (
                        <div className="mt-6">
                            <h4 className="text-forest-400 font-bold uppercase tracking-widest text-xs mb-3">Research Findings</h4>
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
    const { showToast } = useToast();
    const [prompt, setPrompt] = useState("");
    const [status, setStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [operationName, setOperationName] = useState("");
    const attemptsRef = useRef(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === "pending" && operationName) {
            attemptsRef.current = 0;
            interval = setInterval(async () => {
                attemptsRef.current += 1;
                if (attemptsRef.current > MAX_POLL_ATTEMPTS) {
                    setStatus("failed");
                    setErrorMsg("Video generation timed out before it finished. Please try again.");
                    clearInterval(interval);
                    return;
                }
                try {
                    const res = await fetchApi("/api/marketing/video-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ operationName })
                    });
                    const data = await res.json();
                    if (data.error) {
                        setStatus("failed");
                        setErrorMsg(typeof data.error === "string" ? data.error : "Video generation failed.");
                        clearInterval(interval);
                    } else if (data.done) {
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
        setErrorMsg("");
        try {
            const res = await fetchApi("/api/marketing/generate-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json().catch(() => ({}));
            // Mock mode / unconfigured backend returns 503 (or no operationName). Fail fast
            // instead of polling a status endpoint that will never report done.
            if (!res.ok || !data.operationName) {
                setStatus("failed");
                setErrorMsg(
                    data.error ||
                    "Video generation is unavailable right now (the AI backend is not configured)."
                );
                return;
            }
            setOperationName(data.operationName);
        } catch(e) {
            setStatus("failed");
            setErrorMsg("Could not reach the video service. Please try again.");
        }
    };

    const downloadVideo = async () => {
        try {
            const res = await fetchApi("/api/marketing/video-download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ operationName })
            });
            const contentType = res.headers.get("content-type") || "";
            // Only treat the response as a video if the request succeeded and the payload
            // is actually a video (an error response is JSON, not a playable MP4).
            if (!res.ok || !contentType.includes("video")) {
                showToast("Could not download the video. Please try generating it again.", "error");
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "promo_video.mp4";
            a.click();
            URL.revokeObjectURL(url);
        } catch(e) {
            console.error(e);
            showToast("Could not download the video. Please try again.", "error");
        }
    };

    return (
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto w-full">
            <div className="max-w-3xl mx-auto space-y-6 w-full">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Play className="text-forest-500" />
                        <h3 className="text-xl font-bold text-white">Veo Video Marketing</h3>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 font-bold uppercase tracking-widest text-[9px] rounded-full border border-amber-500/20">
                        AI Video
                    </span>
                </div>
                <div className="bg-zinc-900 border border-white/5 molten-edge rounded-2xl p-6">
                    <p className="text-sm text-zinc-400 mb-4">Generate promotional video clips for ad campaigns using AI video generation.</p>
                    <textarea 
                        className="w-full h-24 bg-black/50 border border-forest-500/30 rounded-xl p-4 text-white resize-none focus:outline-none"
                        placeholder="e.g. A cinematic drone shot flying over a newly landscaped green lawn with perfect stripes"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    <button 
                        disabled={status === "pending" || !prompt}
                        onClick={startVideo}
                        className="mt-4 px-6 py-3 bg-forest-600 hover:bg-forest-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {status === "pending" ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                        {status === "pending" ? "Rendering AI Video..." : "Generate Reel"}
                    </button>
                    
                    {status === "pending" && (
                        <div className="mt-6 p-4 bg-forest-500/10 border border-forest-500/20 rounded-xl flex items-center gap-3">
                            <div className="w-4 h-4 border-2 border-forest-500/20 border-t-forest-500 rounded-full animate-spin"></div>
                            <p className="text-xs font-mono text-forest-400 uppercase tracking-widest">
                                Rendering Frames... This typically takes a few minutes.
                            </p>
                        </div>
                    )}

                    {status === "completed" && (
                        <div className="mt-6 p-6 bg-black/30 border border-white/5 rounded-2xl flex flex-col items-center text-center">
                            <Sparkles className="text-forest-500 mb-3" size={32} />
                            <h4 className="text-forest-400 font-bold uppercase tracking-widest text-sm mb-4">Video Rendering Complete</h4>
                            <button 
                                onClick={downloadVideo}
                                className="px-6 py-3 bg-forest-600 hover:bg-forest-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors"
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
