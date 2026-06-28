// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
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
import {
  customersRepo,
  jobsRepo,
  invoicesRepo,
  leadsRepo,
} from "../lib/repos";

import { useFieldMode } from "../contexts/FieldModeContext";

export default function LiveEar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setFocus, setJobStatus } = useCuttyGuide();
  const { toggleFieldMode } = useFieldMode();
  const { showToast } = useToast();
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
      const ws = new WebSocket(
        `${wsProtocol}//${window.location.host}/api/live`,
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

  // Actually run the detected voice tool-call against the data layer.
  // Each branch is independently guarded so a single failure never crashes the panel.
  const executeAction = async (call: Record<string, any>) => {
    const name = call?.name;
    const args = call?.args || {};
    try {
      switch (name) {
        case "load_client_data": {
          const query = args.clientName || args.name || "";
          const matches = await customersRepo.findByNameOrPhone(query);
          if (matches && matches.length > 0) {
            const c = matches[0];
            setLoadedCustomer(c);
            const full = `${c.first_name || ""} ${c.last_name || ""}`.trim();
            setLastResult(`Customer found: ${full || query}`);
          } else {
            setLoadedCustomer(null);
            setLastResult("No match — create lead?");
          }
          break;
        }
        case "create_lead": {
          const leadName =
            [args.firstName, args.lastName].filter(Boolean).join(" ") ||
            args.name ||
            "New Lead";
          await leadsRepo.create({ name: leadName, notes: args.notes });
          setLastResult(`Lead created: ${leadName}`);
          showToast("Lead created", leadName, "success");
          break;
        }
        case "schedule_job": {
          const jobRow: Record<string, any> = {
            title: args.serviceType || "Service",
            status: "SCHEDULED",
            date: args.date || null,
          };
          if (loadedCustomer?.id) jobRow.customer_id = loadedCustomer.id;
          await jobsRepo.create(jobRow);
          setLastResult(`Job scheduled: ${jobRow.title}`);
          showToast("Job scheduled", jobRow.title, "success");
          break;
        }
        case "create_invoice": {
          const amount = Number(args.amount) || 0;
          await invoicesRepo.create({
            amount,
            status: "DRAFT",
            data: { serviceDescription: args.serviceDescription },
          });
          setLastResult(`Invoice drafted: $${amount}`);
          showToast("Invoice created", `Draft for $${amount}`, "success");
          break;
        }
        case "add_client_note": {
          if (loadedCustomer?.id) {
            const note = args.note || "";
            const merged =
              (loadedCustomer.notes ? loadedCustomer.notes + "\n" : "") + note;
            const updated = await customersRepo.update(loadedCustomer.id, {
              notes: merged,
            });
            setLoadedCustomer(updated || { ...loadedCustomer, notes: merged });
            setLastResult("Note added to client");
            showToast("Note added", note, "success");
          } else {
            setLastResult("No client loaded — say the client name first");
            showToast(
              "No client loaded",
              "Load a client before adding a note.",
              "info",
            );
          }
          break;
        }
        case "build_design_vision":
        case "enter_field_mode": {
          setLastResult("Opening Design Studio…");
          showToast("Opening Design Studio…", "", "info");
          if (loadedCustomer) {
            navigate("/design-studio", { state: { customer: loadedCustomer } });
          } else {
            navigate("/design-studio");
          }
          break;
        }
        default: {
          // Unknown — already logged to the actions panel; nothing to execute.
          break;
        }
      }
    } catch (err: any) {
      console.error("LiveEar: action execution failed", name, err);
      setLastResult(`Action failed: ${prettyActionName(name)}`);
      try {
        showToast(
          "Action failed",
          err?.message || `Couldn't run ${prettyActionName(name)}`,
          "error",
        );
      } catch {}
    }
  };

  const handleDetectedAction = (toolCall: Record<string, any>) => {
    if (
      !toolCall ||
      !Array.isArray(toolCall.functionCalls) ||
      toolCall.functionCalls.length === 0
    )
      return;
    const call = toolCall.functionCalls[0];
    if (!call || typeof call.name !== "string") return;
    setLastAction(call);
    setActionLog((prev) =>
      [
        {
          id: Date.now() + Math.random(),
          name: call.name,
          args: call.args || {},
          at: Date.now(),
        },
        ...prev,
      ].slice(0, 6),
    );

    // Actually execute the detected tool-call against the data layer.
    void executeAction(call);

    // YardWorx Guidance Logic
    if (call.name === "schedule_job") {
      setJobStatus(`Scheduling Job...`);
      if (location.pathname !== "/scheduler") navigate("/scheduler");
    } else if (call.name === "create_invoice") {
      setJobStatus(`Preparing Invoice for ${call.args.clientName}...`);
      if (location.pathname !== "/invoices") navigate("/invoices");
    } else if (call.name === "load_client_data") {
      setJobStatus(`Opening Client: ${call.args.clientName}`);
      if (location.pathname !== "/crm") navigate("/crm");
    } else if (call.name === "create_lead") {
      setJobStatus(`Adding ${call.args.firstName} as a Lead`);
      if (location.pathname !== "/crm") navigate("/crm");
    } else if (call.name === "add_client_note") {
      setJobStatus(`Adding note for ${call.args.clientName}`);
      if (location.pathname !== "/crm") navigate("/crm");
    } else if (call.name === "check_inventory") {
      setJobStatus(
        `Checking inventory for ${call.args.itemName || "items"}...`,
      );
      if (location.pathname !== "/inventory") navigate("/inventory");
    } else if (call.name === "load_employee_data") {
      setJobStatus(`Locating ${call.args.employeeName}...`);
      if (location.pathname !== "/crew-suite") navigate("/crew-suite");
    } else if (call.name === "enter_field_mode") {
      setJobStatus(`Activating Field Mode...`);
      toggleFieldMode();
    } else if (call.name === "log_expense") {
      setJobStatus(`Scanning expense for $${call.args.amount}...`);
      if (location.pathname !== "/invoices") navigate("/invoices");
    } else if (call.name === "log_inventory_usage") {
      setJobStatus(
        `Logging usage of ${call.args.quantity}x ${call.args.itemName}...`,
      );
      if (location.pathname !== "/inventory") navigate("/inventory");
    }

    setTimeout(() => {
      const event = new CustomEvent("cutty-action", { detail: call });
      window.dispatchEvent(event);
    }, 400);

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
