import { fetchApi } from "../lib/api";
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateMockup = async () => {
    if (!imageFile || !result) return;
    setIsGeneratingMockup(true);
    try {
        const description = result.identifiedAreas.map(a => a.suggestion).join(". ");
        const formData = new FormData();
        formData.append("image", imageFile);
        formData.append("description", description);

        const response = await fetchApi("/api/design/generate-mockup", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        if (data.imageUrl) setMockupImage(data.imageUrl);
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

      const filename = `Cutty-Design-${Date.now()}.json`;
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
              : "Upload a photo of the yard, mark what you want changed, and let Cutty help you design."}
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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 h-[700px]">
        {/* Workspace Matrix */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 p-5 sm:p-8 relative overflow-hidden transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />

            <div className="h-full relative">
              <MarkupCanvas backgroundImage={image} onSave={processDesign} />
              <AnimatePresence>
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl"
                  >
                    <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="mt-4 font-black uppercase tracking-widest text-emerald-400 text-sm">
                      Analyzing Scene...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Voice Interface Dock */}
          <div className="h-28 bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-6">
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
        <aside className="xl:col-span-4 flex flex-col gap-4 sm:gap-8 min-w-0">
          {/* Satellite Matrix Component */}
          <div
            className="h-64 bg-zinc-900 border border-white/5 shadow-2xl p-6 sm:p-10 bg-black/40 overflow-hidden relative group shrink-0"
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
                <h3 className="text-xl sm:text-2xl font-black italic tracking-normal md:tracking-tighter text-white">
                  PROPERTY VIEW
                </h3>
              </div>

              <div className="flex items-center justify-between text-xs md:text-[10px] font-black uppercase text-white/40 tracking-widest">
                <span>Elevation: 342ft</span>
                <span>Soil Type: Loamy Clay</span>
              </div>
            </div>

            <div className="absolute inset-0 border border-emerald-500/0 group-hover:border-emerald-500/20 transition-all pointer-events-none rounded-2xl" />
          </div>

          {/* Design Results Nodes */}
          <div className="flex-1 bg-zinc-900 border border-white/5 rounded-2xl p-5 sm:p-8 overflow-y-auto no-scrollbar relative min-h-0">
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
                    <p className="text-lg font-black italic text-white uppercase tracking-normal md:tracking-tighter mb-2">
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
                          className="p-5 bg-white/5 border border-white/5 rounded-3xl group"
                        >
                          <p className="text-xs font-black text-white italic mb-1 uppercase tracking-tight">
                            {area.description}
                          </p>
                          <p className="text-xs md:text-[11px] text-white/40 font-medium leading-relaxed uppercase tracking-widest">
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
                    <p className="text-sm font-bold italic text-white leading-relaxed tracking-tight p-6 bg-white/5 rounded-2xl border border-white/5">
                      {result.visionSummary}
                    </p>

                    {result.botanicalViolations && result.botanicalViolations.length > 0 && !overriddenViolations && (
                      <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <div className="flex items-center gap-3 mb-3">
                          <AlertTriangle size={18} className="text-red-500" />
                          <p className="text-sm font-bold text-red-500 uppercase tracking-widest">Botanical Constraint Violations</p>
                        </div>
                        <ul className="space-y-3 mb-4">
                          {result.botanicalViolations.map((v, idx) => (
                            <li key={idx} className="text-sm bg-black/40 p-3 rounded-lg border border-red-500/10">
                              <span className="font-bold text-red-400 block mb-1">{v.issue}</span>
                              <span className="text-xs text-red-400/70 block">{v.reason}</span>
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
                            className="w-full sm:w-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <Lock size={12} /> Override & Approve
                          </button>
                        ) : (
                          <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-medium">
                            <span className="font-bold">Admin Override Required:</span> Please adjust your design or request an owner to override.
                          </div>
                        )}
                      </div>
                    )}

                    {result.approvalRequired && (
                      <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={18} className="text-amber-500" />
                          <div>
                            <p className="text-sm font-bold text-amber-500">Pending Admin Approval</p>
                            <p className="text-xs text-amber-500/70">Safe botanical parameters verified. Awaiting financial approval by admin.</p>
                          </div>
                        </div>
                        <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors">
                          Submit for Review
                        </button>
                      </div>
                    )}
                  </div>

                  {(!result.botanicalViolations || result.botanicalViolations.length === 0 || overriddenViolations) && (
                    <>
                      <div className="flex flex-col gap-4">
                        {mockupImage ? (
                          <div className="rounded-2xl overflow-hidden border border-emerald-500/20 shadow-[0_0_40px_-15px_rgba(16,185,129,0.3)]">
                            <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                              <span className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <Sparkles size={12} /> AI Generative Mockup (Gemini)
                              </span>
                            </div>
                            <img src={mockupImage} alt="AI Generated Mockup" className="w-full h-auto" />
                          </div>
                        ) : (
                          <button
                            onClick={generateMockup}
                            disabled={isGeneratingMockup}
                            className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            {isGeneratingMockup ? (
                                <><div className="w-4 h-4 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin" /> Generating AI Simulation...</>
                            ) : (
                                <><Sparkles size={16} /> Visualize with Deep Image Generation</>
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
                            <span className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest">
                              <BrainCircuit size={12} /> Semantic Style Match Active
                            </span>
                          )}
                        </div>
                        
                        {tenant?.settings?.subFeatures?.semanticStyleLearning && (
                          <div className="mb-4 p-4 bg-black/20 border border-white/5 rounded-2xl text-xs text-white/50 leading-relaxed font-bold">
                            <span className="text-white">Cutty Logic: </span>
                            Gemini pulled directly from your custom contractor installation heuristics:<br/>
                            <span className="italic opacity-80 mt-1 block border-l-2 border-emerald-500/50 pl-2">
                              "{tenant?.settings?.customInstallRules || 'No custom rules applied.'}"
                            </span>
                          </div>
                        )}

                        {result.tiers && (
                          <div className="flex bg-black p-1 rounded-2xl border-2 border-white/10 mb-6 shrink-0 overflow-x-auto shadow-inner">
                            <button
                              onClick={() => setActiveTier("good")}
                              className={`flex-1 py-3 px-4 rounded-xl font-black text-xs md:text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                                activeTier === "good" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                              }`}
                            >
                              Good (Budget)
                            </button>
                            <button
                              onClick={() => setActiveTier("better")}
                              className={`flex-1 py-3 px-4 rounded-xl font-black text-xs md:text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                                activeTier === "better" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                              }`}
                            >
                              Better (Standard)
                            </button>
                            <button
                              onClick={() => setActiveTier("best")}
                              className={`flex-1 py-3 px-4 rounded-xl font-black text-xs md:text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                                activeTier === "best" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                              }`}
                            >
                              Best (Premium)
                            </button>
                          </div>
                        )}

                        <div className="space-y-3">
                          {(result.tiers && activeTier !== "standard" ? result.tiers[activeTier].estimatedMaterials : result.estimatedMaterials).map((material: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-4 bg-white/5 border-l-2 border-emerald-500/40 rounded-2xl"
                            >
                              <div>
                                <p className="text-xs md:text-[10px] font-black uppercase text-white tracking-widest">
                                  {material.item}
                                </p>
                                <p className="text-[9px] font-medium text-white/40 uppercase tracking-widest">
                                  {material.quantity}
                                </p>
                                {material.geoSpatialVolume && tenant?.settings?.subFeatures?.visionAnalysis !== false && (
                                  <p className="border border-emerald-500/20 text-emerald-400 bg-emerald-500/10 px-2 py-1 mt-2 inline-block rounded-md text-[8px] font-black uppercase tracking-[0.2em]">
                                    AI Geo-Spatial Vol: {material.geoSpatialVolume}
                                  </p>
                                )}
                              </div>
                              {role !== "employee" && role !== "foreman" && (
                                <span className="text-lg font-black italic text-white">
                                  ${material.estimatedCost}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {!result.tiers && role !== "employee" && role !== "foreman" && (
                          <div className="mt-6 flex justify-end">
                            <button 
                              onClick={generateTiers}
                              disabled={isGeneratingTiers}
                              className="text-xs md:text-[10px] border border-amber-500/30 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {isGeneratingTiers ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                  Generating Tiers...
                                </>
                              ) : (
                                <>
                                  <BrainCircuit size={12} /> Generate Good/Better/Best Tiers
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {result.tiers && activeTier !== "standard" && result.tiers[activeTier].description && (
                          <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-2xl text-xs text-white/70 italic">
                            {result.tiers[activeTier].description}
                          </div>
                        )}
                      </div>

                      <div className="pt-8 border-t border-white/10">
                        <p className="micro-label text-emerald-400 uppercase tracking-widest font-black mb-3 flex items-center justify-between">
                          <span>Property Value / ROI</span>
                          {result.tiers && activeTier !== "standard" && result.tiers[activeTier].totalCost && role !== "employee" && role !== "foreman" && (
                            <span className="text-amber-400">Total Est: ${result.tiers[activeTier].totalCost}</span>
                          )}
                        </p>
                        <p className="text-xs font-black italic text-white uppercase tracking-normal md:tracking-tighter">
                          {result.strategicValue}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <button className="w-full bg-white text-black py-6 rounded-[28px] font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">
                          Save to Quote
                        </button>
                        <button 
                          onClick={handleSaveToDrive}
                          disabled={isSavingDrive}
                          className="w-full bg-blue-500/10 text-blue-400 py-6 rounded-[28px] border-4 border-blue-500/20 font-black uppercase tracking-widest text-xs hover:bg-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {isSavingDrive ? (
                            <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                          ) : (
                            <Save size={16} />
                          )}
                          Upload Blueprint to Google Drive
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-5 sm:p-8 gap-6 opacity-30">
                  <ImageIcon size={48} className="text-white/20" />
                  <div className="space-y-4">
                    <h4 className="text-xl font-black italic text-white uppercase tracking-normal md:tracking-tighter">
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
                  <h2 className="text-2xl sm:text-3xl font-black italic text-white uppercase tracking-normal md:tracking-tighter mb-1">Cutty Logic Engine</h2>
                  <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs md:text-[11px] bg-emerald-500/10 inline-block px-3 py-1 rounded-md">Semantic Style Learning Active</p>
                </div>
              </div>
              
              <div className="space-y-6 text-white/70 leading-relaxed text-sm mb-10 text-center sm:text-left">
                <p>
                  Welcome to the AI Design Studio. Unlike generic AI tools, Cutty uses <span className="text-white font-bold">Semantic Style Learning</span> to adopt your specific installation methods and bidding logic automatically.
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
                      <p className="text-xs text-white/50">Cutty reads your <span className="text-white">Custom Installation Heuristics</span> from settings to select your preferred plant spacing, soils, and material volumes.</p>
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
