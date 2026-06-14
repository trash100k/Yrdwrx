import { fetchApi } from "../lib/api";
// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Mic, Loader2, Play, Square, FileText, CheckSquare, X, Wand2 } from "lucide-react";
import { Job } from "../types";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Props {
  job: Job;
  onClose: () => void;
}

export function VoiceMemoJobModal({ job, onClose }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [notes, setNotes] = useState(job.notes || "");
  const [checklist, setChecklist] = useState(job.checklist || []);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window && window.webkitSpeechRecognition) {
      const SpeechRecognition = window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript((prev) => prev ? prev + " " + currentTranscript : currentTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
      
      recognitionRef.current.onend = () => {
         if (isRecording) {
            recognitionRef.current.start();
         }
      }
    }
    
    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    }
  }, [isRecording]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
        alert("Speech recognition is not supported in this browser. Please use Chrome.");
        return;
    }
    if (isRecording) {
      setIsRecording(false);
      recognitionRef.current.stop();
    } else {
      setTranscript("");
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const processTranscript = async () => {
    if (!transcript) return;
    setIsProcessing(true);
    try {
      const response = await fetchApi("/api/scheduler/voice-memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, job }),
      });
      const data = await response.json();
      if (data) {
        if (data.notes) setNotes(data.notes);
        if (data.checklist) {
            // merge checklists
            setChecklist(prev => {
                const combined = [...prev, ...data.checklist];
                // basic dedupe by exact text (not perfect but OK)
                const seen = new Set();
                return combined.filter(item => {
                    const duplicate = seen.has(item.text);
                    seen.add(item.text);
                    return !duplicate;
                });
            });
        }
      }
      setTranscript("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveJobData = async () => {
    try {
      await updateDoc(doc(db, "jobs", job.id), {
        notes,
        checklist,
      });
      onClose();
    } catch (e) {
      console.error("Error saving job", e);
    }
  };

  const toggleChecklistItem = (id: string) => {
      setChecklist(checklist.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };
  
  const removeChecklistItem = (id: string) => {
      setChecklist(checklist.filter(item => item.id !== id));
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-white/5 p-10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors">
            <X size={32} />
        </button>
        <h2 className="text-3xl sm:text-4xl font-black text-white italic uppercase tracking-normal md:tracking-tighter mb-2">
          {job.title}
        </h2>
        <div className="text-white/50 font-bold uppercase tracking-widest text-sm mb-10 flex gap-4">
            {job.client && <span>{job.client}</span>}
            {job.address && <span>• {job.address}</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left Column: Voice Memo Input */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-emerald-400 mb-4">
               <Mic size={24} />
               <h3 className="font-black uppercase tracking-widest">Voice Memo Field Log</h3>
            </div>
            
            <div className="bg-zinc-900 border-2 border-white/5 rounded-3xl p-6 min-h-[200px] flex flex-col relative overflow-hidden">
                {isRecording && (
                    <div className="absolute inset-0 border-4 border-red-500/50 rounded-3xl animate-pulse pointer-events-none" />
                )}
                <div className="flex-1 text-white/80 font-medium leading-relaxed pb-12">
                   {transcript || (
                       <span className="text-white/20 italic">Tap microphone to dictate field notes, material requirements, or issue reports...</span>
                   )}
                </div>
                
                <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                    <button 
                        onClick={toggleRecording}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-bounce' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                        {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={24} />}
                    </button>
                    
                    {transcript && !isRecording && (
                        <button 
                            onClick={processTranscript}
                            disabled={isProcessing}
                            className="bg-emerald-500 text-black px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-emerald-400 transition-colors disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                            Process Memo
                        </button>
                    )}
                </div>
            </div>
            
            <div className="p-6 bg-blue-500/10 border-2 border-blue-500/20 rounded-3xl">
                <p className="text-blue-400/80 text-xs font-bold uppercase tracking-widest leading-relaxed">
                    <span className="text-blue-400 font-black">AI Trigger:</span> "We used 3 bags of mulch. Gate code is 1234. I need to replace a sprinkler head next time."
                </p>
            </div>
          </div>

          {/* Right Column: AI Processed Data */}
          <div className="space-y-8 bg-zinc-900/50 rounded-3xl p-8 border border-white/5">
            <div>
              <div className="flex items-center gap-3 text-blue-400 mb-4">
                 <FileText size={20} />
                 <h3 className="font-black uppercase tracking-widest text-sm">Job Notes</h3>
              </div>
              <textarea
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
                 className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-white/20 focus:border-emerald-500 outline-none min-h-[120px]"
                 placeholder="Processed notes will appear here..."
              />
            </div>

            <div>
              <div className="flex items-center gap-3 text-amber-400 mb-4">
                 <CheckSquare size={20} />
                 <h3 className="font-black uppercase tracking-widest text-sm">Action Checklist</h3>
              </div>
              <div className="space-y-3">
                  {checklist.length === 0 ? (
                      <p className="text-white/20 text-sm italic">No checklist items.</p>
                  ) : checklist.map((item) => (
                      <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border ${item.completed ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-black/40 border-white/5'}`}>
                          <div className="flex items-center gap-4">
                              <button 
                                onClick={() => toggleChecklistItem(item.id)}
                                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${item.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/30 text-transparent'}`}
                              >
                                  ✓
                              </button>
                              <span className={`text-sm font-medium ${item.completed ? 'text-white/40 line-through' : 'text-white'}`}>{item.text}</span>
                          </div>
                          <button onClick={() => removeChecklistItem(item.id)} className="text-white/20 hover:text-red-400 transition-colors">
                              <X size={16} />
                          </button>
                      </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-12 pt-8 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-8 py-4 text-sm font-black text-white/40 hover:text-white uppercase tracking-widest transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveJobData}
            className="px-8 py-4 bg-white text-black rounded-2xl text-sm font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform"
          >
            Save Job
          </button>
        </div>
      </div>
    </div>
  );
}
