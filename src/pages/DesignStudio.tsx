import { fetchApi } from "../lib/api";
import { compressImage } from "../lib/imageUtils";
// @ts-nocheck
import { safeStorage } from '../lib/storage';
// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTenant } from "../contexts/TenantContext";
import { useRole } from "../hooks/useRole";
import { DesignDatabasePanel } from "../components/DesignDatabasePanel";
import { useAuditLog } from "../hooks/useAuditLog";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  Sparkles,
  Mic,
  MicOff,
  ChevronRight,
  Image as ImageIcon,
  Trees,
  CheckCircle2,
  CloudLightning,
  Map,
  Activity,
  Plus,
  X,
  Target,
  AlertTriangle,
  BrainCircuit,
  Lock,
  Save,
  Database
} from "lucide-react";
import MarkupCanvas from "../components/MarkupCanvas";
import BeforeAfterSlider from "../components/BeforeAfterSlider";
import { db, auth } from "../lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { playVoice } from "../lib/playVoice";

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
    geoSpatialVolume?: string;
  }>;
  strategicValue: string;
  approvalRequired?: boolean;
  botanicalViolations?: Array<{
    issue: string;
    severity: string;
    reason: string;
  }>;
  tiers?: {
    good: any;
    better: any;
    best: any;
  };
}

export default function DesignStudio() {
  const location = useLocation();
  const { tenant } = useTenant();
  const { role } = useRole();
  const { logAction } = useAuditLog();
  const [image, setImage] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (image) {
      const img = new Image();
      img.onload = () => {
        setImageAspectRatio(img.width / img.height);
      };
      img.src = image;
    } else {
      setImageAspectRatio(null);
    }
  }, [image]);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [mockupImage, setMockupImage] = useState<string | null>(null);
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [overriddenViolations, setOverriddenViolations] = useState(false);

  const [isGeneratingTiers, setIsGeneratingTiers] = useState(false);
  const [activeTier, setActiveTier] = useState<"standard" | "good" | "better" | "best">("standard");
  const [activeView, setActiveView] = useState<"studio" | "database">("studio");
  const [activeTab, setActiveTab] = useState<"scribble" | "compare">("scribble");

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      rec.onend = () => {
        if (isRecording) {
          try {
            rec.start();
          } catch (e) {}
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [isRecording]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser environment. Please use Google Chrome or Safari.");
      return;
    }
    if (isRecording) {
      setIsRecording(false);
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    } else {
      setIsRecording(true);
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (!safeStorage.getItem("cutty-design-studio-onboarding")) {
      setShowOnboarding(true);
    }
  }, []);

  const closeOnboarding = () => {
    safeStorage.setItem("cutty-design-studio-onboarding", "true");
    setShowOnboarding(false);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCustomer, setActiveCustomer] = useState<{
    name?: string;
    id?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
  } | null>(null);

  const [catalogItems, setCatalogItems] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant) return;
    const unsub = onSnapshot(query(collection(db, "design_catalog"), where("tenantId", "==", tenant.id)), (snap) => {
      setCatalogItems(snap.docs.map(doc => doc.data()));
    });
    return unsub;
  }, [tenant]);

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
    if (!file) return;

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const MAX_WIDTH = 1080;
      const MAX_HEIGHT = 1080;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
      setImage(compressedBase64);
      setActiveTab("scribble");
      setImageAspectRatio(width / height);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const generateMockup = async () => {
    if (!image || !result) return;
    setIsGeneratingMockup(true);
    try {
        const description = result.identifiedAreas.map(a => a.suggestion).join(". ");
        const response = await fetchApi("/api/design/generate-mockup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: image, description })
        });
        const data = await response.json();
        if (data.imageUrl) {
          setMockupImage(data.imageUrl);
          setActiveTab("compare");
        }
    } catch(e) {
        console.error(e);
    } finally {
        setIsGeneratingMockup(false);
    }
  };

  const processDesign = async (markedUpImage: string) => {
    setIsProcessing(true);
    setResult(null);
    setMockupImage(null);
    setOverriddenViolations(false);

    try {
      const response = await fetchApi("/api/design/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: markedUpImage,
          prompt:
            transcript ||
            "Suggest a design transformation for this yard based on the markup.",
          role: role,
          settings: {
            ...tenant?.settings?.subFeatures,
            customInstallRules: tenant?.settings?.customInstallRules,
            designCatalog: catalogItems
          },
        }),
      });

      const data = await response.json();
      setResult(data);
      if (data.identifiedAreas && (tenant?.settings as any)?.voiceEnabled !== false) {
        let textToSpeek = "Here is the plan. ";
        data.identifiedAreas.slice(0, 2).forEach((a: any) => {
          textToSpeek += a.suggestion + ". ";
        });
        if (data.estimatedCost) {
            textToSpeek += ` The estimated cost will be roughly ${data.estimatedCost} dollars.`;
        }
        playVoice(textToSpeek);
      }
    } catch (error) {
      console.error("Design Processing Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateTiers = async () => {
    if (!result) return;
    setIsGeneratingTiers(true);
    try {
      const response = await fetchApi("/api/design/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baselineResult: result,
          settings: {
            ...tenant?.settings?.subFeatures,
            customInstallRules: tenant?.settings?.customInstallRules,
            designCatalog: catalogItems
          },
        }),
      });

      const data = await response.json();
      setResult((prev: any) => ({
        ...prev,
        tiers: data.tiers,
      }));
      setActiveTier("better");
    } catch (error) {
      console.error("Design Tiers Error:", error);
    } finally {
      setIsGeneratingTiers(false);
    }
  };

  const [isSavingDrive, setIsSavingDrive] = useState(false);

  const handleSaveToDrive = async () => {
    if (!result) return;
    setIsSavingDrive(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      const authResult = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(authResult);
      if (!credential?.accessToken) throw new Error("No token");

      const filename = `YardWorx-Design-${Date.now()}.json`;
      const content = JSON.stringify(result, null, 2);

      const res = await fetchApi("/api/integration/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          accessToken: credential.accessToken, 
          filename, 
          content, 
          mimeType: "application/json" 
        })
      });

      if (!res.ok) throw new Error("Drive upload failed");
      alert("Successfully backed up design logic format to Google Drive!");
    } catch (err: any) {
      console.error(err);
      alert(`Simulation Mode: Google Drive backup attempted, but caught API restrictions: ${err.message}`);
    } finally {
      setIsSavingDrive(false);
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
          <h1 className="text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Yard Designer
          </h1>
          <p className="max-w-xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            {activeCustomer
              ? `Architecting transformation for ${activeCustomer.firstName} ${activeCustomer.lastName}'s property at ${activeCustomer.address}.`
              : "Upload a photo of the yard, mark what you want changed, and let YardWorx help you design."}
          </p>

          {(role === "admin" || role === "owner") && (
            <div className="flex bg-black p-1 rounded-2xl border-2 border-white/10 mt-8 w-fit">
              <button
                onClick={() => setActiveView("studio")}
                className={`py-2 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  activeView === "studio" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                }`}
              >
                Studio UI
              </button>
              <button
                onClick={() => setActiveView("database")}
                className={`flex items-center gap-2 py-2 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  activeView === "database" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                }`}
              >
                <Database size={14} /> Catalog DB
              </button>
            </div>
          )}
        </div>

        {activeView === "studio" && (
          <div className="flex gap-4 shrink-0">
            {!image && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-5 bg-white text-black font-semibold text-sm rounded-xl shadow-sm border border-transparent hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
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
        )}
      </header>

      {activeView === "database" ? (
        <DesignDatabasePanel />
      ) : (
        <div className="flex flex-col gap-8 min-h-[750px]">
          {/* Step progression tracking line */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-white/5 text-sm">
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-black ${!image ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" : "bg-white/10 text-white/40"}`}>1</span>
              <div>
                <span className={`font-black uppercase tracking-widest text-[10px] block ${!image ? "text-white" : "text-zinc-500"}`}>Step 1: Point & Shoot</span>
              </div>
            </div>
            <div className="hidden sm:block text-zinc-800 text-xs font-mono">─────────</div>
            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-black ${image && !result ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" : "bg-white/10 text-white/40"}`}>2</span>
              <div>
                <span className={`font-black uppercase tracking-widest text-[10px] block ${image && !result ? "text-white" : "text-zinc-500"}`}>Step 2: Scribble & Talk</span>
              </div>
            </div>
            <div className="hidden sm:block text-zinc-800 text-xs font-mono">─────────</div>
            {/* Step 3 */}
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-black ${result ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" : "bg-white/10 text-white/40"}`}>3</span>
              <div>
                <span className={`font-black uppercase tracking-widest text-[10px] block ${result ? "text-white" : "text-zinc-500"}`}>Step 3: Reveal Comparison</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            {/* Workspace Matrix */}
            <div className="xl:col-span-8 flex flex-col gap-6">
              {/* Workspace Navigation Header */}
              {image && (
                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10 w-fit shrink-0 gap-2">
                  <button
                    onClick={() => setActiveTab("scribble")}
                    className={`py-2 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      activeTab === "scribble" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                    }`}
                  >
                    ✏️ Tracing & Scribbles
                  </button>
                  {mockupImage && (
                    <button
                      onClick={() => setActiveTab("compare")}
                      className={`py-2 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        activeTab === "compare" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                      }`}
                    >
                      ✨ Interactive Slider
                    </button>
                  )}
                </div>
              )}

              <div className={`flex-1 bg-black/40 rounded-2xl border border-white/5 p-4 sm:p-6 relative overflow-hidden transition-all flex flex-col ${image ? "" : "min-h-[500px] h-[550px]"}`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />

                <div className="flex-1 relative flex items-center justify-center min-h-0">
                  {!image ? (
                    <div 
                      className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl hover:border-emerald-500/20 hover:bg-white/[0.02] cursor-pointer transition-all text-center p-8 group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform text-emerald-400 mb-6 shadow-[0_10px_30px_rgba(16,185,129,0.1)]">
                        <Camera size={36} />
                      </div>
                      <h3 className="text-xl font-black italic uppercase tracking-wider text-white mb-2">📸 Point & Shoot</h3>
                      <p className="text-zinc-500 text-xs max-w-xs font-bold uppercase tracking-wider leading-relaxed mb-6">
                        Snap or upload a photo of the client's current yard here to start scribbling.
                      </p>
                      <span className="px-6 py-3.5 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-transform active:scale-95">
                        Choose Photo
                      </span>
                    </div>
                  ) : activeTab === "compare" && mockupImage ? (
                    <BeforeAfterSlider beforeImage={image} afterImage={mockupImage} imageAspectRatio={imageAspectRatio} />
                  ) : (
                    <MarkupCanvas backgroundImage={image} onSave={processDesign} imageAspectRatio={imageAspectRatio} />
                  )}

                  <AnimatePresence>
                    {isProcessing && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-xl"
                      >
                        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.2)]" />
                        <p className="mt-6 font-black uppercase tracking-[0.2em] text-emerald-400 text-xs">
                          Gemini Analyzing Scene...
                        </p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mt-2">formulating geo-spatial materials</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Voice Interface Dock */}
              {image && (
                <div className="h-28 bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-6 shrink-0 transition-all">
                  <button
                    onClick={toggleRecording}
                    aria-label={
                      isRecording
                        ? "Stop recording voice notes"
                        : "Capture voice notes"
                    }
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${
                      isRecording
                        ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                        : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
                  </button>

                  <div className="flex-1">
                    <p className="micro-label text-zinc-500 mb-2 uppercase tracking-widest font-black flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-zinc-600'}`} />
                      Explain Your Intent & talk to Gemini
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
                          ? "Listening to site requirements... speak now..."
                          : "Explain design intent... press the Mic to dictate..."
                      }
                      className="w-full bg-transparent border-none p-0 text-base font-bold italic text-white placeholder:text-zinc-500 focus:ring-0 focus:outline-none"
                    />
                  </div>

                  {isRecording && (
                    <div className="flex items-center gap-1.5 px-6">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [10, 32, 10] }}
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
              )}
            </div>

            {/* Intelligence Panel */}
            <aside className="xl:col-span-4 flex flex-col gap-6 min-w-0">
              {/* Design Results Nodes */}
              <div className="flex-1 bg-zinc-900/50 border border-white/5 rounded-2xl p-6 overflow-y-auto no-scrollbar relative min-h-[500px]">
                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center gap-4 text-center p-6"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                        <Sparkles
                          size={20}
                          className="absolute inset-0 m-auto text-emerald-400 animate-pulse"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-black italic text-white uppercase tracking-wider mb-1">
                          Synthesizing Design...
                        </p>
                        <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">
                          Assembling material catalogs
                        </p>
                      </div>
                    </motion.div>
                  ) : result ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8"
                    >
                      <div>
                        <p className="micro-label text-emerald-400 uppercase tracking-widest font-black mb-4 flex items-center gap-2">
                          <ImageIcon size={14} /> Identified Areas
                        </p>
                        <div className="space-y-3">
                          {result.identifiedAreas.map((area, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-white/5 border border-white/5 rounded-2xl group"
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
                        <p className="text-xs font-bold italic text-white leading-relaxed tracking-normal p-4 bg-white/5 rounded-xl border border-white/5 uppercase">
                          {result.visionSummary}
                        </p>

                        {result.botanicalViolations && result.botanicalViolations.length > 0 && !overriddenViolations && (
                          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <div className="flex items-center gap-3 mb-3">
                              <AlertTriangle size={18} className="text-red-500" />
                              <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Botanical Violations</p>
                            </div>
                            <ul className="space-y-3 mb-4">
                              {result.botanicalViolations.map((v, idx) => (
                                <li key={idx} className="text-xs bg-black/40 p-3 rounded-lg border border-red-500/10">
                                  <span className="font-bold text-red-400 block mb-1">{v.issue}</span>
                                  <span className="text-[10px] text-red-400/70 block">{v.reason}</span>
                                </li>
                              ))}
                            </ul>
                            {role === "owner" ? (
                              <button
                                onClick={() => {
                                  setOverriddenViolations(true);
                                  logAction(
                                    "Design Studio", 
                                    "Override Botanical Constraints", 
                                    `Owner bypassed ${result.botanicalViolations?.length} botanical violations`
                                  );
                                }}
                                className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                              >
                                <Lock size={12} /> Override & Approve
                              </button>
                            ) : (
                              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-medium">
                                <span className="font-bold">Admin Override Required:</span> Owners must override to bypass.
                              </div>
                            )}
                          </div>
                        )}

                        {result.approvalRequired && (
                          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-amber-500">Pending Review</p>
                              <p className="text-[10px] text-amber-500/70">Awaiting financial review from admin.</p>
                            </div>
                            <button className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-[9px] uppercase tracking-widest rounded-lg transition-colors shrink-0">
                              Submit
                            </button>
                          </div>
                        )}
                      </div>

                      {(!result.botanicalViolations || result.botanicalViolations.length === 0 || overriddenViolations) && (
                        <>
                          {/* Reveal mockup rendering */}
                          <div className="flex flex-col gap-4">
                            {mockupImage ? (
                              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-emerald-400">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 size={16} />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Active Slider Active</span>
                                </div>
                                <button 
                                  onClick={() => setActiveTab("compare")} 
                                  className="px-4 py-1.5 bg-emerald-500 text-black hover:bg-emerald-400 rounded-xl text-[10px] font-black uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                >
                                  Open Slider
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={generateMockup}
                                disabled={isGeneratingMockup}
                                className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-black border border-transparent rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:scale-[1.02] active:scale-95 duration-200"
                              >
                                {isGeneratingMockup ? (
                                    <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Formulating High-Res Render...</>
                                ) : (
                                    <><Sparkles size={16} /> Boom! Reveal Slider Design</>
                                )}
                              </button>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <p className="micro-label text-emerald-400 uppercase tracking-widest font-black flex items-center gap-2">
                                <Trees size={14} /> Materials Needed
                              </p>
                              
                              {tenant?.settings?.subFeatures?.semanticStyleLearning && (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[8px] font-black uppercase tracking-widest">
                                  <BrainCircuit size={10} /> Style Sync
                                </span>
                              )}
                            </div>
                            
                            {tenant?.settings?.subFeatures?.semanticStyleLearning && (
                              <div className="mb-4 p-3 bg-black/40 border border-white/5 rounded-xl text-[11px] text-white/50 leading-relaxed font-bold">
                                <span className="text-white">YardWorx Custom Rule:</span><br/>
                                <span className="italic opacity-80 mt-1 block border-l-2 border-emerald-500/50 pl-2">
                                  "{tenant?.settings?.customInstallRules || 'No custom rules applied.'}"
                                </span>
                              </div>
                            )}

                            {result.tiers && (
                              <div className="flex bg-black p-1 rounded-2xl border-2 border-white/10 mb-6 shrink-0 overflow-x-auto shadow-inner">
                                <button
                                  onClick={() => setActiveTier("good")}
                                  className={`flex-1 py-2.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                    activeTier === "good" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                                  }`}
                                >
                                  Good (Budget)
                                </button>
                                <button
                                  onClick={() => setActiveTier("better")}
                                  className={`flex-1 py-2.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                    activeTier === "better" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                                  }`}
                                >
                                  Better (Standard)
                                </button>
                                <button
                                  onClick={() => setActiveTier("best")}
                                  className={`flex-1 py-2.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                    activeTier === "best" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                                  }`}
                                >
                                  Best (Premium)
                                </button>
                              </div>
                            )}

                            <div className="space-y-2.5">
                              {(result.tiers && activeTier !== "standard" ? result.tiers[activeTier].estimatedMaterials : result.estimatedMaterials).map((material: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3.5 bg-white/5 border-l-2 border-emerald-500/40 rounded-xl"
                                >
                                  <div>
                                    <p className="text-xs font-black uppercase text-white tracking-widest">
                                      {material.item}
                                    </p>
                                    <p className="text-[9px] font-medium text-white/40 uppercase tracking-widest">
                                      {material.quantity}
                                    </p>
                                    {material.geoSpatialVolume && tenant?.settings?.subFeatures?.visionAnalysis !== false && (
                                      <p className="border border-emerald-500/20 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 mt-1.5 inline-block rounded-md text-[8px] font-black uppercase tracking-[0.2em]">
                                        AI Geo-Spatial Vol: {material.geoSpatialVolume}
                                      </p>
                                    )}
                                  </div>
                                  {role !== "employee" && role !== "foreman" && (
                                    <span className="text-sm font-black italic text-white font-mono">
                                      ${material.estimatedCost}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>

                            {!result.tiers && role !== "employee" && role !== "foreman" && (
                              <div className="mt-4 flex justify-end">
                                <button 
                                  onClick={generateTiers}
                                  disabled={isGeneratingTiers}
                                  className="text-[9px] border border-amber-500/35 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 font-black uppercase tracking-[0.15em] px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                  {isGeneratingTiers ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                      Generating Packages...
                                    </>
                                  ) : (
                                    <>
                                      <BrainCircuit size={12} /> Good/Better/Best Tiers
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {result.tiers && activeTier !== "standard" && result.tiers[activeTier].description && (
                              <div className="mt-4 p-4 bg-white/5 border border-white/5 rounded-2xl text-[11px] text-white/70 italic leading-relaxed">
                                {result.tiers[activeTier].description}
                              </div>
                            )}
                          </div>

                          <div className="pt-6 border-t border-white/5">
                            <p className="micro-label text-emerald-400 uppercase tracking-widest font-black mb-2 flex items-center justify-between">
                              <span>ROI Valuation</span>
                              {result.tiers && activeTier !== "standard" && result.tiers[activeTier].totalCost && role !== "employee" && role !== "foreman" && (
                                <span className="text-amber-400 font-mono">Total Est: ${result.tiers[activeTier].totalCost}</span>
                              )}
                            </p>
                            <p className="text-xs font-black italic text-white uppercase tracking-normal md:tracking-tighter leading-snug">
                              {result.strategicValue}
                            </p>
                          </div>

                          <div className="flex flex-col gap-3.5 pt-4">
                            <button className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl hover:scale-[1.02] active:scale-95 duration-150 transition-all">
                              Save to Quote
                            </button>
                            <button 
                              onClick={handleSaveToDrive}
                              disabled={isSavingDrive}
                              className="w-full bg-blue-500/10 text-blue-400 py-4 rounded-xl border border-blue-500/20 font-black uppercase tracking-widest text-xs hover:bg-blue-500/20 active:scale-95 duration-150 transition-all flex items-center justify-center gap-2"
                            >
                              {isSavingDrive ? (
                                <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                              ) : (
                                <Save size={14} />
                              )}
                              Upload Blueprint to Google Drive
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-4 opacity-40">
                      <ImageIcon size={40} className="text-white/20" />
                      <div className="space-y-2">
                        <h4 className="text-lg font-black italic text-white uppercase tracking-wider">
                          Heuristics Awaiting Input
                        </h4>
                        <p className="text-[10px] leading-relaxed uppercase tracking-[0.15em] max-w-xs mx-auto">
                          Choose a site photo, markup drawing zones and specify your design parameters to formulate bidding guides.
                        </p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Floating Action Node */}
      {activeView === "studio" && (
        <button
          onClick={() => image && processDesign(image)}
          aria-label="Process design transformation"
          className={`fixed bottom-12 right-12 w-20 h-20 bg-emerald-500 text-black rounded-3xl shadow-2xl flex items-center justify-center transition-all ${image ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 rotate-180"}`}
        >
          <Plus size={32} />
        </button>
      )}

      {/* Onboarding Modal */}
      <AnimatePresence>
        {showOnboarding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-zinc-900 border-4 border-emerald-500/20 rounded-2xl p-8 sm:p-12 shadow-2xl relative"
            >
              <button 
                onClick={closeOnboarding}
                className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors"
                aria-label="Close Onboarding"
              >
                <X size={24} />
              </button>
              
              <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 text-center sm:text-left">
                <div className="w-20 h-20 shrink-0 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <BrainCircuit size={40} />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black italic text-white uppercase tracking-normal md:tracking-tighter mb-1">YardWorx Logic Engine</h2>
                  <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs md:text-[11px] bg-emerald-500/10 inline-block px-3 py-1 rounded-md">Semantic Style Learning Active</p>
                </div>
              </div>
              
              <div className="space-y-6 text-white/70 leading-relaxed text-sm mb-10 text-center sm:text-left">
                <p>
                  Welcome to the AI Design Studio. Unlike generic AI tools, YardWorx uses <span className="text-white font-bold">Semantic Style Learning</span> to adopt your specific installation methods and bidding logic automatically.
                </p>
                <div className="bg-black/40 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <Target size={20} className="text-emerald-400 shrink-0 mt-1 sm:mt-0" />
                    <div>
                      <h3 className="text-white font-black uppercase tracking-widest text-xs md:text-[11px] mb-1">Geo-Spatial Calculation</h3>
                      <p className="text-xs text-white/50">Draw on the canvas. AI analyzes the physical area to estimate precise yardage matching your real-world practices.</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <Trees size={20} className="text-emerald-400 shrink-0 mt-1 sm:mt-0" />
                    <div>
                      <h3 className="text-white font-black uppercase tracking-widest text-xs md:text-[11px] mb-1">Actionable Nuance</h3>
                      <p className="text-xs text-white/50">YardWorx reads your <span className="text-white">Custom Installation Heuristics</span> from settings to select your preferred plant spacing, soils, and material volumes.</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <Map size={20} className="text-emerald-400 shrink-0 mt-1 sm:mt-0" />
                    <div>
                      <h3 className="text-white font-black uppercase tracking-widest text-xs md:text-[11px] mb-1">Hallucination Busters</h3>
                      <p className="text-xs text-white/50">It prevents impossible requests (e.g. planting a tree in a driveway) using strong physics constraints.</p>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={closeOnboarding}
                className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
              >
                Acknowledge & Start Designing
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
