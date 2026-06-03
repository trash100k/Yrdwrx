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
    wsRef.current?.close();
    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
  };

  const startLiveEar = async () => {
    setIsConnecting(true);
    try {
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      // Try grabbing video but don't fail if they don't have a camera
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "environment" } });
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
            const base64Jpeg = canvas.toDataURL("image/jpeg", 0.5).split(",")[1];
            ws.send(JSON.stringify({ image: base64Jpeg }));
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
        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.audio) {
          playAudioChunk(data.audio);
        }

        if (data.transcription) {
          setTranscription(data.transcription);
        }

        if (data.action) {
          handleDetectedAction(data.action);
        }
      };

      ws.onerror = (err) => {
        console.error("WS Error:", err);
        stopLiveEar();
      };

      ws.onclose = () => {
        clearInterval(videoInterval);
        stopLiveEar();
      };
    } catch (err: any) {
      console.error("Mic Access Error:", err);
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
      !toolCall.functionCalls ||
      toolCall.functionCalls.length === 0
    )
      return;
    const call = toolCall.functionCalls[0];
    setLastAction(call);

    // Cutty Guidance Logic
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

  return (
    <div className="flex items-center gap-4 bg-zinc-900 border border-white/5 p-2 rounded-3xl shadow-xl">
      <div className="pl-4 pr-3 hidden sm:block">
        <p className="text-[12px] font-bold uppercase text-zinc-300 tracking-wider leading-none mb-1.5">
          Voice Assistant
        </p>
        <p className="text-[15px] font-bold text-white leading-none">
          {isActive ? "Listening..." : "Ready to help"}
        </p>
      </div>
      <button
        onClick={isActive ? stopLiveEar : startLiveEar}
        disabled={isConnecting}
        id="voice-assistant-trigger"
        className={`w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center transition-all duration-300 relative overflow-hidden ${
          isActive
            ? "bg-emerald-500 text-black shadow-[0_0_20px_#10b981]"
            : "bg-white/5 text-emerald-400 hover:bg-white/10 border border-emerald-500/20"
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

      {isActive && transcription && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-[200px] break-words pr-4"
        >
          <p className="text-xs md:text-[10px] font-black uppercase text-emerald-400 tracking-widest leading-none mb-1">
            Incoming Audio
          </p>
          <p className="text-xs md:text-[11px] font-black italic text-white/60 truncate leading-none lowercase tracking-normal md:tracking-tighter">
            {transcription}
          </p>
        </motion.div>
      )}

      {/* Action Popover - Minimal */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-full mt-4 right-0 bg-black/90 border border-emerald-500/30 p-4 rounded-[24px] shadow-2xl min-w-[240px] backdrop-blur-3xl z-50 pointer-events-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-black">
                <Target size={16} />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase text-emerald-400 tracking-[0.2em]">
                  Performing Action
                </p>
                <p className="text-xs font-black italic text-white lowercase">
                  {lastAction.name.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
