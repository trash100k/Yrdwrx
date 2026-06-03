import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fetchApi } from "../lib/api";
import { playVoice } from "../lib/playVoice";

interface SpeechRecognitionType {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionType;
}

export function HandsFreeDictator({ onProcessAction }: { onProcessAction?: (actionData: any) => void }) {
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  // Used to debounce processing of continuous speech
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition: SpeechRecognitionConstructor; webkitSpeechRecognition: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition: SpeechRecognitionConstructor; webkitSpeechRecognition: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: any) => {
        let currentInterim = "";
        let finalTrans = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }
        
        if (finalTrans) {
            setTranscript((prev) => {
                const newTrans = prev + " " + finalTrans;
                triggerInactivityProcessing(newTrans);
                return newTrans;
            });
        }
        setInterimTranscript(currentInterim);
      };

      recognitionRef.current.onerror = (e) => {
        console.error("Speech recognition error:", e);
        if (isActive) {
           // try to restart if it's a minor error like no-speech
           try { recognitionRef.current?.start(); } catch (err) {}
        }
      };

      recognitionRef.current.onend = () => {
        if (isActive && recognitionRef.current) {
          try {
             recognitionRef.current.start();
          } catch (e) {
             console.error("Could not restart", e);
          }
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isActive]);

  const toggleHandsFree = () => {
    if (!recognitionRef.current) {
        alert("Speech recognition not supported in this browser.");
        return;
    }
    if (isActive) {
        setIsActive(false);
        recognitionRef.current.stop();
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    } else {
        setTranscript("");
        setInterimTranscript("");
        setIsActive(true);
        setLastAction(null);
        try {
            recognitionRef.current.start();
        } catch (e) {
            console.error(e);
        }
    }
  };

  const triggerInactivityProcessing = (currentText: string) => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (!currentText.trim()) return;
      
      inactivityTimerRef.current = setTimeout(() => {
          processText(currentText);
      }, 4000); // 4 seconds of silence triggers processing
  };

  const processText = async (text: string) => {
      setIsProcessing(true);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      
      try {
          const res = await fetchApi("/api/agent/hands-free-dictation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcript: text })
          });
          const data = await res.json();
          if (data && data.intent !== "UNKNOWN_OR_UNPARSEABLE") {
             let msg = `Processed: ${data.intent.replace(/_/g, " ")}. `;
             if (data.summary) msg += data.summary;
             setLastAction(msg);
             playVoice("Okay, " + msg);
             if (onProcessAction) onProcessAction(data);
             // Clear transcript after successful processing
             setTranscript("");
             setInterimTranscript("");
          } else {
             setLastAction("Could not understand the command.");
          }
      } catch (err) {
          console.error(err);
          setLastAction("Error parsing dictation.");
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 ${isActive ? 'w-80' : 'w-auto'}`}>
        <AnimatePresence>
            {isActive && (
                <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="w-full bg-zinc-900 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-2xl flex flex-col gap-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <Mic className="animate-pulse" size={18} />
                            <span className="font-bold uppercase tracking-widest text-xs">Hands-Free Dictation</span>
                        </div>
                        {isProcessing && <Loader2 className="animate-spin text-emerald-500" size={16} />}
                    </div>
                    
                    <div className="bg-black/50 border border-white/5 rounded-xl p-4 min-h-24 max-h-48 overflow-y-auto">
                        <p className="text-sm text-zinc-300 leading-relaxed font-mono">
                            {transcript}
                            <span className="text-zinc-500 italic">{interimTranscript}</span>
                            {!transcript && !interimTranscript && <span className="text-zinc-600">Listening continuously... Speak your updates.</span>}
                        </p>
                    </div>

                    {lastAction && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl font-bold flex items-center gap-2">
                             <CheckCircle2 size={14} className="shrink-0" />
                             <span className="leading-relaxed">{lastAction}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-2">
                        <span>Auto-processes on pause</span>
                        <button 
                            onClick={() => processText(transcript)} 
                            disabled={isProcessing || !transcript.trim()}
                            className="text-emerald-500 disabled:opacity-50 hover:text-emerald-400 transition-colors"
                        >
                            Force Submit
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <button
            onClick={toggleHandsFree}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all ${
                isActive 
                    ? "bg-red-500 text-white hover:bg-red-600 hover:scale-105" 
                    : "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105"
            }`}
        >
            {isActive ? <MicOff size={28} /> : <Mic size={28} />}
        </button>
    </div>
  );
}
