// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { getAccessToken } from "../lib/supabase";
import {
  Mic,
  MicOff,
  Radio,
  Loader2,
  Sparkles,
  AlertCircle,
  Database,
  Calendar,
  FileText,
  X,
  Brain,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCuttyGuide } from "../contexts/CuttyGuideContext";
import { useToast } from "../contexts/ToastContext";
import { executeAgentAction } from "../lib/agentActions";
import { useRole } from "../hooks/useRole";
import { ConfirmDialog } from "./ConfirmDialog";

import { useFieldMode } from "../contexts/FieldModeContext";

// Actions that create/modify money, schedule, or delete data require an explicit
// user confirmation before we execute them. Anything that deletes is high-risk by
// prefix; the rest are enumerated. Read/status actions (load_client_data,
// update_crew_status, notes, inventory checks, etc.) run without a prompt.
const HIGH_RISK_ACTIONS = new Set<string>([
  "create_invoice",
  "create_quote",
  "schedule_job",
  "log_expense",
]);

const isHighRiskAction = (name: string): boolean =>
  HIGH_RISK_ACTIONS.has(name) || /^delete_/.test(name);

export default function LiveEar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setFocus, setJobStatus } = useCuttyGuide();
  const { toggleFieldMode } = useFieldMode();
  const { showToast } = useToast();
  const { role } = useRole();
  const rolePrefix = role === "employee" || role === "foreman" ? "/employee" : "/admin";
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [lastAction, setLastAction] = useState<Record<string, any> | null>(
    null,
  );
  // Loaded customer (from load_client_data) — carried across follow-up actions.
  const [loadedCustomer, setLoadedCustomer] = useState<Record<
    string,
    any
  > | null>(null);
  // Human-readable result of the most recently executed action.
  const [lastResult, setLastResult] = useState<string>("");
  // Running log of detected actions (most recent first) for the customer-facing panel
  const [actionLog, setActionLog] = useState<
    { id: number; name: string; args: Record<string, any>; at: number }[]
  >([]);
  // "idle" | "connecting" | "listening" | "error" | "closed"
  const [status, setStatus] = useState<
    "idle" | "connecting" | "listening" | "error" | "closed"
  >("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);

  // --- High-risk action confirmation gate ---
  // `confirmRequest` drives the ConfirmDialog; its `resolve` is awaited inside the
  // execution loop so a high-risk call pauses until the user approves or cancels.
  const [confirmRequest, setConfirmRequest] = useState<{
    title: string;
    description: string;
    resolve: (approved: boolean) => void;
  } | null>(null);

  // Open the confirm dialog and resolve true/false based on the user's choice.
  const requestConfirm = (title: string, description: string): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      setConfirmRequest({ title, description, resolve });
    });

  useEffect(() => {
    return () => {
      stopLiveEar();
    };
  }, []);

  const stopLiveEar = () => {
    setIsActive(false);
    setIsConnecting(false);
    setStatus((prev) => (prev === "error" || prev === "closed" ? prev : "idle"));
    try {
      wsRef.current?.close();
    } catch {}
    try {
      processorRef.current?.disconnect();
    } catch {}
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed")
        audioCtxRef.current.close();
    } catch {}
  };

  const startLiveEar = async () => {
    setIsConnecting(true);
    setStatus("connecting");
    setStatusMessage("");
    setTranscription("");
    try {
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      // Try grabbing video but don't fail if they don't have a camera
let stream;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("getUserMedia not supported");
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "environment" } });
      } catch (e) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch(audioErr) {
            console.error("Cannot access media devices", audioErr);
            setIsConnecting(false);
            return;
        }
      }
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Pass the Supabase access token so the server can authenticate the Live socket
      // (enforced when REQUIRE_AUTH is on; omitted/ignored in demo mode).
      const liveToken = await getAccessToken().catch(() => null);
      const ws = new WebSocket(
        `${wsProtocol}//${window.location.host}/api/live${liveToken ? `?token=${encodeURIComponent(liveToken)}` : ""}`,
      );
      wsRef.current = ws;

      // Setup video streaming
      const videoTrack = stream.getVideoTracks()[0];
      let videoInterval: any;
      if (videoTrack) {
        const videoEl = document.createElement("video");
        videoEl.srcObject = new MediaStream([videoTrack]);
        videoEl.play();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        videoInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN && videoEl.videoWidth > 0) {
            canvas.width = 640;
            canvas.height = 480;
            ctx?.drawImage(videoEl, 0, 0, 640, 480);
            try {
              const base64Jpeg = canvas.toDataURL("image/jpeg", 0.5).split(",")[1];
              ws.send(JSON.stringify({ image: base64Jpeg }));
            } catch(e) {
              console.warn("LiveEar: unable to extract frame from video element.", e);
            }
          }
        }, 3000); // Send a frame every 3 seconds for environmental context
      }

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
          }
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(pcmData.buffer)),
          );
          ws.send(JSON.stringify({ audio: base64 }));
        }
      };

      ws.onopen = () => {
        setIsConnecting(false);
        setIsActive(true);
        setStatus("listening");
        setStatusMessage("");
        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = async (event) => {
        // Guard against malformed payloads — the server may be in mock mode.
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          console.warn("LiveEar: ignoring non-JSON message", e);
          return;
        }
        if (!data || typeof data !== "object") return;

        if (typeof data.audio === "string" && data.audio) {
          try {
            playAudioChunk(data.audio);
          } catch (e) {
            console.warn("LiveEar: failed to play audio chunk", e);
          }
        }

        if (typeof data.transcription === "string") {
          setTranscription(data.transcription);
        }

        if (data.interrupted) {
          // Model was interrupted — flush any queued playback timeline.
          nextStartTimeRef.current = audioCtxRef.current?.currentTime ?? 0;
        }

        if (data.action) {
          handleDetectedAction(data.action);
        }
      };

      ws.onerror = (err) => {
        console.error("WS Error:", err);
        clearInterval(videoInterval);
        setStatus("error");
        setStatusMessage("Live Ear unavailable. Couldn't reach the assistant.");
        stopLiveEar();
      };

      ws.onclose = (ev) => {
        clearInterval(videoInterval);
        // A normal close after an active session just returns to idle; an
        // unexpected close (e.g. server in mock mode dropping us) surfaces a
        // gentle "unavailable" notice rather than failing silently.
        if (!ev || ev.wasClean === false) {
          setStatus("closed");
          setStatusMessage("Live Ear disconnected. Tap the mic to reconnect.");
        }
        stopLiveEar();
      };
    } catch (err: any) {
      console.error("Mic Access Error:", err);
      setStatus("error");
      setStatusMessage(err?.message || "Permission denied or mic unavailable.");
      showToast("Mic Access Error", err.message || "Permission denied or mic unavailable.", "error");
      setIsConnecting(false);
    }
  };

  const playAudioChunk = async (base64Audio: string) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcmData = new Int16Array(bytes.buffer);

    const buffer = ctx.createBuffer(1, pcmData.length, 16000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++)
      channelData[i] = pcmData[i] / 0x7fff;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  };

  const handleDetectedAction = (toolCall: Record<string, any>) => {
    if (
      !toolCall ||
      !Array.isArray(toolCall.functionCalls) ||
      toolCall.functionCalls.length === 0
    )
      return;
    // The model is told to chain related actions in one turn (e.g.
    // load_client_data → schedule_job → create_invoice), so run EVERY function call
    // in order, awaiting each so the loaded-customer state from one carries into the
    // next. A single call (the common case) just runs the one-element loop.
    const calls = toolCall.functionCalls.filter(
      (c: any) => c && typeof c.name === "string",
    );
    if (calls.length === 0) return;

    setLastAction(calls[0]);
    setActionLog((prev) =>
      [
        ...calls.map((c: any, i: number) => ({
          id: Date.now() + Math.random() + i,
          name: c.name,
          args: c.args || {},
          at: Date.now(),
        })),
        ...prev,
      ].slice(0, 6),
    );

    // Run the detected tool-calls through the shared executor: real Supabase mutations,
    // a confirmation message per call, and a navigation hint so the owner can verify.
    void (async () => {
      let navTarget: string | undefined; // last action's nav target wins
      // Local mirror of the loaded customer so chained calls see prior resolutions
      // synchronously (React state updates are async and wouldn't be visible mid-loop).
      let currentCustomer = loadedCustomer;
      for (const call of calls) {
        // Gate money/schedule/delete actions behind an explicit confirmation.
        if (isHighRiskAction(call.name)) {
          const summary = summarizeArgs(call.args || {});
          const approved = await requestConfirm(
            prettyActionName(call.name),
            summary
              ? `${prettyActionName(call.name)} — ${summary}. Execute this now?`
              : `Execute "${prettyActionName(call.name)}" now?`,
          );
          if (!approved) {
            setLastResult(`${prettyActionName(call.name)} skipped — not confirmed.`);
            try {
              showToast("Skipped — not confirmed.", "info");
            } catch {}
            continue;
          }
        }
        setJobStatus(`${prettyActionName(call.name)}…`);
        const result = await executeAgentAction(call, {
          navigate,
          rolePrefix,
          showToast,
          toggleFieldMode,
          getLoadedCustomer: () => currentCustomer,
          setLoadedCustomer: (c) => {
            currentCustomer = c;
            setLoadedCustomer(c);
          },
        });
        setLastResult(result.message);
        if (result.navigateTo) navTarget = result.navigateTo;
        try {
          showToast(
            prettyActionName(call.name),
            result.message,
            result.ok ? "success" : "info",
          );
        } catch {}
        // Mirror a confirmation line into the text agent's transcript.
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("cutty-action", { detail: { ...call, _result: result } }),
          );
        }, 200);
      }
      // Navigate once, after all calls — the last action's target wins.
      if (navTarget && location.pathname !== navTarget) {
        navigate(navTarget);
      }
    })();

    setTimeout(() => {
      setLastAction(null);
      setJobStatus("Ready to help");
    }, 5000);
  };

  // Friendly, customer-readable label for a detected action.
  const ACTION_LABELS: Record<string, string> = {
    schedule_job: "Schedule job",
    create_invoice: "Create invoice",
    load_client_data: "Open client",
    create_lead: "Add new lead",
    add_client_note: "Add client note",
    check_inventory: "Check inventory",
    load_employee_data: "Find crew member",
    enter_field_mode: "Enter field mode",
    log_expense: "Log expense",
    log_inventory_usage: "Log inventory usage",
    set_hoa_rules: "Save HOA rules",
    set_gate_code: "Save gate code",
    build_design_vision: "Open design studio",
    create_design: "Open design studio",
  };

  const prettyActionName = (name: string) =>
    ACTION_LABELS[name] ||
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Pull out the human-meaningful args for at-a-glance reading.
  const summarizeArgs = (args: Record<string, any>): string => {
    if (!args || typeof args !== "object") return "";
    const priority = [
      "clientName",
      "firstName",
      "lastName",
      "employeeName",
      "itemName",
      "amount",
      "quantity",
      "date",
      "service",
    ];
    const parts: string[] = [];
    for (const key of priority) {
      const v = args[key];
      if (v === undefined || v === null || v === "") continue;
      parts.push(key === "amount" ? `$${v}` : String(v));
      if (parts.length >= 2) break;
    }
    if (parts.length === 0) {
      // Fall back to the first scalar value present.
      for (const v of Object.values(args)) {
        if (v !== undefined && v !== null && typeof v !== "object") {
          parts.push(String(v));
          break;
        }
      }
    }
    return parts.join(" · ");
  };

  const statusLabel =
    status === "listening"
      ? "Listening"
      : status === "connecting"
        ? "Connecting"
        : status === "error"
          ? "Unavailable"
          : status === "closed"
            ? "Disconnected"
            : "Ready to help";

  const statusDotClass =
    status === "listening"
      ? "bg-forest-400"
      : status === "connecting"
        ? "bg-amber-400"
        : status === "error" || status === "closed"
          ? "bg-red-400"
          : "bg-zinc-500";

  const showPanel =
    isActive || isConnecting || status === "error" || status === "closed";

  return (
    <div className="relative flex items-center gap-4 bg-zinc-900 border border-white/5 molten-edge p-2 rounded-3xl shadow-xl">
      {/* High-risk action confirmation gate. onConfirm fires before onClose, so we
          resolve(true) there and only resolve(false) on a close that wasn't a confirm. */}
      <ConfirmDialog
        isOpen={!!confirmRequest}
        title={confirmRequest?.title || "Confirm action"}
        description={confirmRequest?.description || ""}
        confirmText="Yes, do it"
        cancelText="Skip"
        danger
        onConfirm={() => {
          confirmRequest?.resolve(true);
          setConfirmRequest(null);
        }}
        onClose={() => {
          // Cancel/backdrop path: if the request is still pending, treat as declined.
          setConfirmRequest((req) => {
            req?.resolve(false);
            return null;
          });
        }}
      />
      <div className="pl-4 pr-3 hidden sm:block">
        <p className="text-[12px] font-bold uppercase text-zinc-300 tracking-wider leading-none mb-1.5">
          Voice Assistant
        </p>
        <p className="text-[15px] font-bold text-white leading-none flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${statusDotClass} ${
              status === "listening" ? "animate-pulse" : ""
            }`}
          />
          {statusLabel}
        </p>
      </div>
      <button
        onClick={isActive ? stopLiveEar : startLiveEar}
        disabled={isConnecting}
        id="voice-assistant-trigger"
        className={`w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center transition-all duration-300 relative overflow-hidden ${
          isActive
            ? "bg-forest-500 text-black shadow-[0_0_20px_#10b981]"
            : "bg-white/5 text-forest-400 hover:bg-white/10 border border-forest-500/20"
        }`}
      >
        {isConnecting ? (
          <Loader2 className="animate-spin" size={24} />
        ) : isActive ? (
          <>
            <Mic size={24} className="relative z-10" />
            <motion.span
              animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 bg-white inline-block"
            />
          </>
        ) : (
          <Mic size={24} />
        )}
      </button>

      {/* Customer-facing live panel — vision transcript + detected actions */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="absolute top-full right-0 mt-4 w-[340px] max-w-[88vw] bg-zinc-950/95 border border-forest-500/25 rounded-[24px] shadow-2xl backdrop-blur-3xl z-50 pointer-events-auto overflow-hidden"
          >
            {/* Header / connection state */}
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${statusDotClass} ${
                    status === "listening" ? "animate-pulse" : ""
                  }`}
                />
                <div>
                  <p className="text-[9px] font-black uppercase text-forest-400 tracking-[0.2em] leading-none">
                    Live Ear
                  </p>
                  <p className="text-[13px] font-bold text-white leading-tight mt-1">
                    {statusLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={stopLiveEar}
                aria-label="Close Live Ear"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Error / closed state */}
            {(status === "error" || status === "closed") && (
              <div className="px-5 py-5 flex items-start gap-3">
                <AlertCircle
                  size={18}
                  className="text-red-400 shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-[9px] font-black uppercase text-red-400 tracking-[0.2em] mb-1">
                    Live Ear Unavailable
                  </p>
                  <p className="text-[13px] text-zinc-300 leading-snug">
                    {statusMessage ||
                      "The voice assistant couldn't connect. Tap the mic to try again."}
                  </p>
                </div>
              </div>
            )}

            {/* Connecting state */}
            {status === "connecting" && (
              <div className="px-5 py-5 flex items-center gap-3">
                <Radio size={18} className="text-amber-400 animate-pulse" />
                <p className="text-[13px] text-zinc-300">
                  Connecting to the assistant…
                </p>
              </div>
            )}

            {/* Live transcription */}
            {(status === "listening" || status === "connecting") && (
              <div className="px-5 py-4">
                <p className="text-[9px] font-black uppercase text-forest-400 tracking-[0.2em] mb-2 flex items-center gap-1.5">
                  <Mic size={11} /> Live Transcript
                </p>
                <p className="text-[14px] text-white/90 leading-relaxed min-h-[1.5rem]">
                  {transcription || (
                    <span className="text-zinc-500 italic">
                      Listening… speak naturally.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Loaded customer card */}
            {loadedCustomer && (
              <div className="px-5 pb-4 pt-1 border-t border-white/5">
                <p className="text-[9px] font-black uppercase text-forest-400 tracking-[0.2em] mb-2 flex items-center gap-1.5">
                  <Database size={11} /> Customer Found
                </p>
                <div className="rounded-xl bg-forest-500/5 border border-forest-500/25 px-3 py-2.5">
                  <p className="text-[14px] font-bold text-white leading-tight truncate">
                    {`${loadedCustomer.first_name || ""} ${
                      loadedCustomer.last_name || ""
                    }`.trim() || "Unnamed"}
                  </p>
                  {loadedCustomer.phone && (
                    <p className="text-[12px] text-zinc-300 leading-tight mt-1 truncate">
                      {loadedCustomer.phone}
                    </p>
                  )}
                  {loadedCustomer.address && (
                    <p className="text-[11px] text-zinc-400 leading-tight mt-0.5 truncate">
                      {loadedCustomer.address}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Last action result */}
            {lastResult && (
              <div className="px-5 pb-3 pt-1 border-t border-white/5">
                <p className="text-[11px] text-zinc-300 leading-snug flex items-center gap-1.5">
                  <Sparkles size={11} className="text-forest-400 shrink-0" />
                  <span className="font-semibold text-white/90">
                    Last action:
                  </span>{" "}
                  {lastResult}
                </p>
              </div>
            )}

            {/* Detected actions */}
            {actionLog.length > 0 && (
              <div className="px-5 pb-4 pt-1 border-t border-white/5">
                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-[0.2em] mb-2.5 flex items-center gap-1.5">
                  <Sparkles size={11} className="text-forest-400" /> Detected
                  Actions
                </p>
                <div className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {actionLog.map((a, i) => {
                      const summary = summarizeArgs(a.args);
                      const isLatest = i === 0 && lastAction?.name === a.name;
                      return (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${
                            isLatest
                              ? "bg-forest-500/10 border-forest-500/40"
                              : "bg-white/[0.02] border-white/5"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isLatest
                                ? "bg-forest-500 text-black"
                                : "bg-white/5 text-forest-400"
                            }`}
                          >
                            <Target size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-white leading-tight truncate">
                              {prettyActionName(a.name)}
                            </p>
                            {summary && (
                              <p className="text-[11px] text-zinc-400 leading-tight truncate mt-0.5">
                                {summary}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
