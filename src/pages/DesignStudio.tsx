
import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  Sparkles,
  Mic,
  MicOff,
  ChevronRight,
  Image as ImageIcon,
  Trees,
  CloudLightning,
  Map,
  Activity,
  Plus,
  X,
  Target,
} from "lucide-react";
import MarkupCanvas from "../components/MarkupCanvas";

interface DesignResult {
  identifiedAreas: Array<{
    id: string;
    description: string;
    suggestion: string;
  }>;
  visionSummary: string;
  estimatedMaterials: Array<{
    item: string;
    quantity: string;
    estimatedCost: number;
  }>;
  strategicValue: string;
}

export default function DesignStudio() {
  const location = useLocation();
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCustomer, setActiveCustomer] = useState<{
    name: string;
    id: string;
  } | null>(null);

  useEffect(() => {
    if (location.state?.customer) {
      setActiveCustomer(location.state.customer);
      setTranscript(
        `Suggest a design for ${location.state.customer.firstName}'s yard...`,
      );
    }
  }, [location.state]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processDesign = async (markedUpImage: string) => {
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch("/api/design/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: markedUpImage,
          prompt:
            transcript ||
            "Suggest a design transformation for this yard based on the markup.",
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Design Processing Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500 text-xs font-black uppercase tracking-widest text-emerald-500">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
            Design Studio Ready
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Yard Designer
          </h1>
          <p className="max-w-xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            {activeCustomer
              ? `Architecting transformation for ${activeCustomer.firstName} ${activeCustomer.lastName}'s property at ${activeCustomer.address}.`
              : "Upload a photo of the yard, mark what you want changed, and let Cutty help you design."}
          </p>
        </div>

        <div className="flex gap-4 shrink-0">
          {!image && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-5 bg-white text-black border-4 border-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[4px_4px_0_0_#FFF] hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
            >
              <Camera size={24} />
              Upload Photo
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 h-[700px]">
        {/* Workspace Matrix */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="flex-1 bg-black/40 rounded-[32px] border-4 border-white/10 p-8 relative overflow-hidden transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />

            <div className="h-full">
              <MarkupCanvas backgroundImage={image} onSave={processDesign} />
            </div>
          </div>

          {/* Voice Interface Dock */}
          <div className="h-28 bg-zinc-900 border-4 border-white/10 rounded-[32px] p-4 flex items-center gap-6">
            <button
              onClick={() => setIsRecording(!isRecording)}
              aria-label={
                isRecording
                  ? "Stop recording voice notes"
                  : "Capture voice notes"
              }
              className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${
                isRecording
                  ? "bg-red-500 text-white animate-pulse shadow-2xl"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
            </button>

            <div className="flex-1">
              <p className="micro-label text-zinc-500 mb-2 uppercase tracking-widest font-black">
                Voice Notes
              </p>
              <label htmlFor="voice-notes-input" className="sr-only">
                Voice notes transcript
              </label>
              <input
                id="voice-notes-input"
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={
                  isRecording
                    ? "Listening to site requirements..."
                    : "Explain design intent node..."
                }
                className="w-full bg-transparent border-none p-0 text-lg font-bold italic text-white placeholder:text-zinc-500 focus:ring-0"
              />
            </div>

            {isRecording && (
              <div className="flex items-center gap-1.5 px-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [10, 30, 10] }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                    className="w-1 bg-red-500 rounded-full"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Intelligence Panel */}
        <aside className="xl:col-span-4 flex flex-col gap-8 min-w-0">
          {/* Satellite Matrix Component */}
          <div
            className="h-64 bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 bg-black/40 overflow-hidden relative group shrink-0"
            role="img"
            aria-label="Property satellite view analysis"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1500382017468-9049fee74a62?auto=format&fit=crop&q=80&w=800')] opacity-20 grayscale group-hover:grayscale-0 transition-all duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Target size={14} className="text-emerald-400" />
                  <span className="micro-label font-black text-emerald-400 uppercase tracking-widest leading-none">
                    Analyzing yard info...
                  </span>
                </div>
                <h3 className="text-2xl font-black italic tracking-tighter text-white">
                  PROPERTY VIEW
                </h3>
              </div>

              <div className="flex items-center justify-between text-[10px] font-black uppercase text-white/40 tracking-widest">
                <span>Elevation: 342ft</span>
                <span>Soil Type: Loamy Clay</span>
              </div>
            </div>

            <div className="absolute inset-0 border border-emerald-500/0 group-hover:border-emerald-500/20 transition-all pointer-events-none rounded-[40px]" />
          </div>

          {/* Design Results Nodes */}
          <div className="flex-1 bg-zinc-900 border-4 border-white/10 rounded-[40px] p-8 overflow-y-auto no-scrollbar relative min-h-0">
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center gap-6 text-center"
                >
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <Sparkles
                      size={24}
                      className="absolute inset-0 m-auto text-emerald-400 animate-pulse"
                    />
                  </div>
                  <div>
                    <p className="text-lg font-black italic text-white uppercase tracking-tighter mb-2">
                      Creating Design...
                    </p>
                    <p className="micro-label opacity-40">
                      Cutty is working on your request...
                    </p>
                  </div>
                </motion.div>
              ) : result ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-10"
                >
                  <div>
                    <p className="micro-label text-emerald-400 uppercase tracking-widest font-black mb-4 flex items-center gap-2">
                      <ImageIcon size={14} /> Identified Areas
                    </p>
                    <div className="space-y-4">
                      {result.identifiedAreas.map((area, idx) => (
                        <div
                          key={idx}
                          className="p-5 bg-white/5 border-4 border-white/10 rounded-3xl group"
                        >
                          <p className="text-xs font-black text-white italic mb-1 uppercase tracking-tight">
                            {area.description}
                          </p>
                          <p className="text-[11px] text-white/40 font-medium leading-relaxed uppercase tracking-widest">
                            {area.suggestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="micro-label text-emerald-400 uppercase tracking-widest font-black mb-4 flex items-center gap-2">
                      <CloudLightning size={14} /> Design Vision
                    </p>
                    <p className="text-sm font-bold italic text-white leading-relaxed tracking-tight p-6 bg-white/5 rounded-[32px] border-4 border-white/10">
                      {result.visionSummary}
                    </p>
                  </div>

                  <div>
                    <p className="micro-label text-emerald-400 uppercase tracking-widest font-black mb-4 flex items-center gap-2">
                      <Trees size={14} /> Materials Needed
                    </p>
                    <div className="space-y-3">
                      {result.estimatedMaterials.map((material, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 bg-white/5 border-l-2 border-emerald-500/40 rounded-2xl"
                        >
                          <div>
                            <p className="text-[10px] font-black uppercase text-white tracking-widest">
                              {material.item}
                            </p>
                            <p className="text-[9px] font-medium text-white/40 uppercase tracking-widest">
                              {material.quantity}
                            </p>
                          </div>
                          <span className="text-lg font-black italic text-white">
                            ${material.estimatedCost}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/10">
                    <p className="micro-label text-emerald-400 uppercase tracking-widest font-black mb-3">
                      Property Value
                    </p>
                    <p className="text-xs font-black italic text-white uppercase tracking-tighter">
                      {result.strategicValue}
                    </p>
                  </div>

                  <button className="w-full bg-white text-black py-6 rounded-[28px] font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">
                    Save to Quote
                  </button>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-6 opacity-30">
                  <ImageIcon size={48} className="text-white/20" />
                  <div className="space-y-4">
                    <h4 className="text-xl font-black italic text-white uppercase tracking-tighter">
                      Ready to design
                    </h4>
                    <p className="micro-label leading-relaxed uppercase tracking-[0.2em]">
                      Upload a photo of the property and explain what you want
                      to do to start designing.
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      {/* Floating Action Node */}
      <button
        onClick={() => image && processDesign(image)}
        aria-label="Process design transformation"
        className={`fixed bottom-12 right-12 w-20 h-20 bg-emerald-500 text-black rounded-3xl shadow-2xl flex items-center justify-center transition-all ${image ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 rotate-180"}`}
      >
        <Plus size={32} />
      </button>
    </div>
  );
}
