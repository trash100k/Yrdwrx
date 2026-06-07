import React, { useState, useRef } from "react";
import { Mic, Loader2, Sparkles, Globe, ScanFace, FileImage } from "lucide-react";
import { motion } from "motion/react";
import { fetchApi } from "../lib/api";

export function MagicSetupNode({ onExtract }: { onExtract: (data: any) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [url, setUrl] = useState("");
  const [isUrlMode, setIsUrlMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMagicSetup = async () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsRecording(true);
    
    recognition.onresult = async (event: any) => {
      setIsRecording(false);
      setIsProcessing(true);
      const transcript = event.results[0][0].transcript;
      try {
        const res = await fetchApi("/api/agent/onboarding-magic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript })
        });
        const data = await res.json();
        onExtract(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsProcessing(false);
      }
    };

    recognition.onerror = () => {
       setIsRecording(false);
       setIsProcessing(false);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const handleUrlSetup = async () => {
    if (!url) return;
    setIsProcessing(true);
    try {
        const res = await fetchApi("/api/agent/onboarding-scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        onExtract(data);
    } catch (e) {
        console.error(e);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
         const base64Data = reader.result as string;
         try {
             const res = await fetchApi("/api/agent/onboarding-vision", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ image: base64Data })
             });
             const data = await res.json();
             onExtract(data);
         } catch (err) {
             console.error(err);
         } finally {
             setIsProcessing(false);
         }
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="p-8 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-3xl mb-10 flex flex-col items-center text-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full scale-150 group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />
        <h3 className="text-xl font-black italic uppercase tracking-tighter text-emerald-400 mb-2 relative z-10 flex items-center justify-center gap-2">
            <Sparkles size={20} /> Zero-Touch Setup
        </h3>
        <p className="text-sm text-emerald-400/80 mb-6 font-medium relative z-10 max-w-sm">
            Skip the forms. Dictate your info, scan a website, or upload a business card to let Cutty architect your system automatically.
        </p>

        {!isUrlMode ? (
            <div className="flex flex-col items-center justify-center z-10 relative w-full">
                <button
                    onClick={handleMagicSetup}
                    disabled={isRecording || isProcessing}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                        isRecording ? "bg-red-500 text-white animate-pulse shadow-[0_0_30px_#ef4444]" : 
                        isProcessing ? "bg-white text-black" : "bg-emerald-500 text-black hover:scale-105 hover:bg-white hover:text-emerald-500"
                    }`}
                >
                    {isProcessing ? <Loader2 size={32} className="animate-spin" /> : <Mic size={32} />}
                </button>
                {isRecording && <p className="text-xs text-red-400 font-bold uppercase tracking-widest mt-4 animate-pulse">Listening...</p>}
                
                <div className="flex items-center gap-6 mt-8">
                    <button 
                        onClick={() => setIsUrlMode(true)}
                        className="text-emerald-400/60 font-bold text-xs uppercase tracking-widest hover:text-emerald-400 transition-colors flex items-center gap-2"
                    >
                        <Globe size={14} /> Website Setup
                    </button>
                    <div className="w-px h-4 bg-emerald-500/20"></div>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-emerald-400/60 font-bold text-xs uppercase tracking-widest hover:text-emerald-400 transition-colors flex items-center gap-2"
                    >
                        <FileImage size={14} /> Scan Photo / Card
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileUpload} 
                    />
                </div>
            </div>
        ) : (
            <div className="w-full max-w-xs z-10 relative flex flex-col gap-4">
                <input 
                    type="url"
                    placeholder="https://your-website.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-black/50 border border-emerald-500/30 rounded-2xl px-4 py-4 focus:outline-none focus:border-emerald-500 text-white text-center font-medium"
                />
                <button
                    disabled={isProcessing || !url}
                    onClick={handleUrlSetup}
                    className="w-full bg-emerald-500 text-black font-bold uppercase tracking-widest py-4 rounded-2xl hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : "Extract Engine"}
                </button>
                <button 
                    onClick={() => setIsUrlMode(false)}
                    className="mt-2 text-white/40 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-colors"
                >
                    Cancel
                </button>
            </div>
        )}

        {isProcessing && <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mt-4 animate-pulse relative z-10">Architecting Your System...</p>}
    </div>
  );
}
