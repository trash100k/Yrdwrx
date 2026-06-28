// @ts-nocheck
import { safeStorage } from '../lib/storage';
// @ts-nocheck
import React, { useState } from "react";
import { useTenant } from "../contexts/TenantContext";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { ToggleRight, ToggleLeft, Activity, Users, Truck, Package, Palette, FileText, Map, Calendar, ReceiptText, Shield, Database, Trash2, AlertTriangle, Globe } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { deleteUser, signOut } from "firebase/auth";

import { ServicePricingCatalog } from "../components/ServicePricingCatalog";
import { StripeConnectSection } from "../components/StripeConnectSection";
import { IntegrationSettings } from "../components/IntegrationSettings";
import { WorkflowBuilderSection } from "../components/WorkflowBuilderSection";
import { TeamManagement } from "../components/TeamManagement";
import { Link } from "react-router-dom";

// Shareable public booking link (online booking / instant-quote intake). Operators put this
// on their website / Google profile; submissions land as NEW leads in the pipeline.
function BookingLinkSection({ tenantId }: { tenantId?: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = tenantId ? `${origin}/book/${tenantId}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };
  return (
    <section className="bg-zinc-950 border border-white/5 rounded-2xl p-5 sm:p-8 space-y-4">
      <div className="space-y-1">
        <span className="text-xs md:text-[10px] font-bold tracking-widest text-forest-400 uppercase">Lead Capture</span>
        <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">Online Booking Link</h3>
        <p className="text-sm text-zinc-400">Share this on your website, Google profile, or texts. Requests come in as new leads.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          readOnly
          value={link || "Sign in to a tenant to generate your link"}
          className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 font-mono truncate"
        />
        <button
          onClick={copy}
          disabled={!link}
          className="shrink-0 px-6 py-3 bg-forest-500 hover:bg-forest-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </section>
  );
}

export default function Settings() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  if (!tenant) return null;

  const features = tenant.settings?.features || {
    crewTracking: true,
    inventoryManagement: true,
    designStudio: true,
    contracts: true,
    routeOptimization: true,
    crm: true,
    scheduler: true,
    reports: true,
    invoices: true,
    compliance: true,
    semanticMemory: true,
    aiOmnilingual: true,
  };

  const subFeatures = tenant.settings?.subFeatures || {
    requireGateCheckPhoto: true,
    requireCompletionPhoto: true,
    enableGeofencing: true,
    exifVerification: true,
    aiExpenseOcr: true,
    aiProposals: true,
    automatedFollowUps: true,
    liveEarAlwaysOn: true,
    visionAnalysis: true,
    aiSafetyCheck: true,
    requireSignature: true,
    autoCacheEstimates: true,
    autoCacheOcr: true,
    feedbackLoopLearning: true,
    autoTranslateChat: true,
    voiceMemoDubbing: true,
    clientFacingUiSpecs: true,
  };

  const featureConfigs = [
    {
      id: "crm",
      label: "Client Book / CRM",
      icon: Users,
      description: "Manage client details, property specifics, and history.",
      subSettings: [
        { id: "aiProposals", label: "AI Automated Proposals", desc: "Generate professional proposals instantly." },
        { id: "automatedFollowUps", label: "Automated Follow-ups", desc: "Voice AI follows up with prospects." }
      ]
    },
    {
      id: "scheduler",
      label: "Job Scheduler",
      icon: Calendar,
      description: "Core calendar and drag-and-drop job tracking board.",
    },
    {
      id: "crewTracking",
      label: "Field & Crew",
      icon: Truck,
      description: "Manage multiple crews, layout daily routes, and chat in the field.",
      subSettings: [
        { id: "requireGateCheckPhoto", label: "Gate Check Photos", desc: "Require photos upon arrival at property." },
        { id: "requireCompletionPhoto", label: "Completion Photos", desc: "Require photos upon finishing a job." },
        { id: "enableGeofencing", label: "Browser GPS Check-in", desc: "Use point-in-time HTML5 location API for check-ins without background tracking." },
        { id: "exifVerification", label: "EXIF Photo Verification", desc: "Validate geofence locations passively by extracting metadata from uploaded photos." }
      ]
    },
    {
      id: "inventoryManagement",
      label: "Inventory Management",
      icon: Package,
      description: "Track chemicals, parts, and equipment levels locally.",
    },
    {
      id: "compliance",
      label: "EPA & Safety Compliance",
      icon: Shield,
      description: "Human-in-the-loop chemical application logs & safety workflows.",
      subSettings: [
        { id: "aiSafetyCheck", label: "AI Weather/Safety Checks", desc: "AI checks wind/temp before chemical application." },
        { id: "requireSignature", label: "Signed Application Logs", desc: "Require human signature on chemical logs." }
      ]
    },
    {
      id: "contracts",
      label: "Estimating & Contracts",
      icon: FileText,
      description: "Drafting engine for AI-assisted bids and proposals.",
    },
    {
      id: "invoices",
      label: "Invoicing & Billing",
      icon: ReceiptText,
      description: "Manage payments, track outstanding balances, and send invoices.",
      subSettings: [
        { id: "aiExpenseOcr", label: "AI Receipt Scanning", desc: "Upload photos of receipts to auto-categorize expenses." }
      ]
    },
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: Activity,
      description: "Business intelligence and metric dashboards.",
      subSettings: [
        { id: "liveEarAlwaysOn", label: "Live Ear (Always-On)", desc: "Enable ambient voice tracking for hands-free management." },
        { id: "visionAnalysis", label: "AI Vision Analysis", desc: "Enable computer vision to spot diseases / measure lots." }
      ]
    },
    {
      id: "routeOptimization",
      label: "Route Optimization",
      icon: Map,
      description: "Algorithmic density routing for jobs and properties.",
    },
    {
      id: "designStudio",
      label: "Design Studio",
      icon: Palette,
      description: "Interactive visual planner for property layouts.",
      subSettings: [
        { id: "requireBlueprintDeposit", label: "Blueprint Lock (Deposit)", desc: "Blur material lists for clients until a deposit is paid." },
        { id: "semanticStyleLearning", label: "Semantic Style Learning", desc: "Allow Gemini to learn your preferred plant selections and spacing rules over time." },
        { id: "enableHardscapeBidding", label: "Complex Hardscape Spec", desc: "Prompt AI to generate deep infrastructural math for excavation, base, and stone cuts." },
        { id: "enableWaterFeatureBidding", label: "Water Feature Logic", desc: "Require AI to spec ecosystem parameters like pump GPH, EPDM liners, and skimmer boxes." }
      ]
    },
    {
      id: "semanticMemory",
      label: "Semantic Knowledge Base",
      icon: Database,
      description: "Automatically cache AI responses and estimations to save on inference costs.",
      subSettings: [
        { id: "autoCacheEstimates", label: "Auto-Cache Material Specs", desc: "Save common property material lists to standard database instead of re-prompting AI." },
        { id: "autoCacheOcr", label: "Receipt & OCR Caching", desc: "Log repeated vendor templates to bypass OCR tokens on subsequent scans." },
        { id: "feedbackLoopLearning", label: "Feedback Loop Savings", desc: "Allow system to learn from manual crew overrides to prevent future AI mistakes." }
      ]
    },
    {
      id: "aiOmnilingual",
      label: "AI Omnilingual Core",
      icon: Globe,
      description: "Real-time AI-native translation engine for chat, ui, and voice memos.",
      subSettings: [
        { id: "autoTranslateChat", label: "Auto-Translate Team Chat", desc: "Detect and translate messages to the native language of the user." },
        { id: "voiceMemoDubbing", label: "Voice Memo Dubbing", desc: "Synthesize transcriptions to the listener's target language automatically." },
        { id: "clientFacingUiSpecs", label: "Client-Facing Translations", desc: "Translate proposals & portals instantly for foreign clients." }
      ]
    },
  ];

  const handleToggle = async (featureId: string, currentValue: boolean, isSubFeature = false) => {
    if (!tenant) return;
    if (tenant.id.startsWith("demo-")) {
      showToast("Cannot modify settings in Demo mode.");
      return;
    }
    
    setUpdating(true);
    try {
      const targetObj = isSubFeature ? subFeatures : features;
      const newObj = { ...targetObj, [featureId]: !currentValue };
      
      const payload = isSubFeature 
        ? { "settings.subFeatures": newObj }
        : { "settings.features": newObj };

      const tenantRef = doc(db, "tenants", tenant.id);
      await updateDoc(tenantRef, payload);
      showToast("Feature toggled successfully.");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to update feature.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteData = async () => {
    if (deleteConfirmation !== "DELETE") {
      showToast("Please type DELETE to confirm.", "error");
      return;
    }
    
    if (auth.currentUser?.uid?.startsWith("demo-")) {
      showToast("Cannot delete data in Demo mode.", "error");
      setShowDeleteModal(false);
      return;
    }
    
    setIsDeleting(true);
    try {
      if (auth.currentUser) {
        // Delete user doc
        await deleteDoc(doc(db, "users", auth.currentUser.uid));
        // Delete user auth
        await deleteUser(auth.currentUser);
      }
      showToast("All your data has been successfully deleted.", "success");
      setShowDeleteModal(false);
      await signOut(auth);
      window.location.href = "/";
    } catch (err: any) {
      console.error("Error deleting data:", err);
      if (err.code === "auth/requires-recent-login") {
         showToast("For security reasons, please log out and log back in before deleting your account.", "error");
      } else {
         showToast(err.message || "Failed to delete your data.", "error");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <header className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-normal md:tracking-tighter italic mb-2">
            Platform Settings
            </h1>
            <p className="text-white/60">
            Customize active feature segments to fit your company's operational footprint.
            </p>
        </div>
        <button onClick={() => {
            safeStorage.setItem("force_agreements_view", "true");
            window.location.reload();
        }} className="bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all">
           Review Agreements <FileText size={14} />
        </button>
      </header>

      <section className="space-y-6 flex-1 mt-10">
        <h2 className="text-sm font-black text-forest-400 uppercase tracking-widest flex items-center gap-2">
          <Activity size={18} /> Active Modules
        </h2>

        <div className="grid gap-4">
          {featureConfigs.map((f: any) => {
            const isEnabled = features[f.id as keyof typeof features] ?? true;
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-zinc-900 border-2 rounded-2xl overflow-hidden transition-all ${
                  isEnabled ? "border-forest-500/20" : "border-white/5 opacity-50 grayscale"
                }`}
              >
                <div className="p-6 sm:p-8 flex items-center justify-between bg-black/20">
                  <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-2xl shrink-0 ${isEnabled ? "bg-forest-500/10 text-forest-400" : "bg-white/5 text-white/40"}`}>
                      <f.icon size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{f.label}</h3>
                      <p className="text-sm text-white/50">{f.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggle(f.id, isEnabled)}
                    disabled={updating}
                    className={`text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words focus:outline-none transition-colors ${
                      isEnabled ? "text-forest-500" : "text-white/20"
                    }`}
                  >
                    {isEnabled ? <ToggleRight /> : <ToggleLeft />}
                  </button>
                </div>

                {/* Sub Features */}
                {isEnabled && f.subSettings && f.subSettings.length > 0 && (
                  <div className="px-6 sm:px-8 pb-6 space-y-2 border-t border-white/5 pt-6 bg-zinc-900/50">
                    <p className="text-xs md:text-[10px] uppercase font-black tracking-widest text-white/30 mb-4">Module Add-ons</p>
                    {f.subSettings.map((sub: any) => {
                      const isSubEnabled = subFeatures[sub.id as keyof typeof subFeatures] ?? true;
                      return (
                        <div key={sub.id} className="flex flex-col gap-4 p-4 bg-black/40 rounded-2xl border border-white/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-sm">{sub.label}</p>
                              <p className="text-xs text-white/50">{sub.desc}</p>
                            </div>
                            <button
                              onClick={() => handleToggle(sub.id, isSubEnabled, true)}
                              disabled={updating}
                              className={`text-3xl sm:text-4xl focus:outline-none transition-colors ${
                                isSubEnabled ? "text-forest-500" : "text-white/20"
                              }`}
                            >
                              {isSubEnabled ? <ToggleRight /> : <ToggleLeft />}
                            </button>
                          </div>
                          
                          {/* Dedicated input for Custom Rules if Semantic Style Learning is on */}
                          {sub.id === "semanticStyleLearning" && isSubEnabled && (
                            <div className="pt-4 border-t border-white/5 mt-2">
                              <label className="text-xs md:text-[10px] uppercase font-black tracking-widest text-forest-500 mb-2 block">
                                Custom Installation Heuristics (Contractor AI Guidelines)
                              </label>
                              <textarea 
                                defaultValue={tenant?.settings?.customInstallRules || ""}
                                onBlur={(e) => {
                                  if (!tenant) return;
                                  if (tenant.id.startsWith("demo-")) {
                                    showToast("Settings updates are disabled in Demo mode.");
                                    return;
                                  }
                                  const tenantRef = doc(db, "tenants", tenant.id);
                                  updateDoc(tenantRef, { "settings.customInstallRules": e.target.value });
                                }}
                                className="w-full bg-zinc-900 border-2 border-white/10 rounded-xl p-4 text-sm text-white/80 focus:border-forest-500/50 outline-none resize-y min-h-[100px]"
                                placeholder="Describe heuristic..."
                              />
                              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-2 text-right">
                                AI Designer reads this on every bid. Space is limited to 1,000 characters.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      <ServicePricingCatalog />

      <BookingLinkSection tenantId={tenant?.id} />

      <StripeConnectSection />
      
      <IntegrationSettings />

      <WorkflowBuilderSection />

      <TeamManagement />

      {/* Platform & Cooperation Agreements */}
      <section className="bg-zinc-900 border border-white/5 molten-edge rounded-3xl p-6 sm:p-8 space-y-6 mt-12">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-normal md:tracking-tighter flex items-center gap-3">
            <Shield className="text-forest-400" size={24} /> Individual Platform Agreements
          </h2>
          <p className="text-xs text-white/50 leading-relaxed mt-1">
            Gaelworx AI operations are built on modular integrity. Rather than bundled fine-print, read our cooperative terms, privacy commitments, data structures, and ethical AI gates separately. Each document features a friendly Copilot Notes translation adjacent to the binding technical text.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/terms"
            className="p-5 bg-black/40 hover:bg-black border border-white/5 hover:border-celtic-500/30 rounded-2xl transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white group-hover:text-celtic-400 transition-colors uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} className="text-celtic-500" /> Terms of Service
                </span>
                <span className="text-[10px] bg-celtic-500/10 text-celtic-400 px-2 py-0.5 rounded font-mono font-bold uppercase">Dual Reader</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed font-semibold">
                Governing general appropriate use, acceptable operations, liability boundaries, and server access definitions.
              </p>
            </div>
            <div className="text-[10px] text-forest-400 font-bold uppercase tracking-widest mt-4">Read Terms &rarr;</div>
          </Link>

          <Link
            to="/privacy"
            className="p-5 bg-black/40 hover:bg-black border border-white/5 hover:border-forest-500/30 rounded-2xl transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white group-hover:text-forest-400 transition-colors uppercase tracking-wider flex items-center gap-2">
                  <Shield size={16} className="text-forest-500" /> Privacy Policy
                </span>
                <span className="text-[10px] bg-forest-500/10 text-forest-400 px-2 py-0.5 rounded font-mono font-bold uppercase">Dual Reader</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed font-semibold">
                Deep dive detailing exactly what client details, crew coordinate sessions, and general analytics are maintained securely.
              </p>
            </div>
            <div className="text-[10px] text-forest-400 font-bold uppercase tracking-widest mt-4">Read Privacy Policy &rarr;</div>
          </Link>

          <Link
            to="/data-map"
            className="p-5 bg-black/40 hover:bg-black border border-white/5 hover:border-ember-500/30 rounded-2xl transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white group-hover:text-ember-400 transition-colors uppercase tracking-wider flex items-center gap-2">
                  <Database size={16} className="text-ember-500" /> Data Processing Map
                </span>
                <span className="text-[10px] bg-ember-500/10 text-ember-400 px-2 py-0.5 rounded font-mono font-bold uppercase">Dual Reader</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed font-semibold">
                Technical governance topology showing independent tenant storage isolation, external provider limits, and threat exclusion policies.
              </p>
            </div>
            <div className="text-[10px] text-forest-400 font-bold uppercase tracking-widest mt-4">Read Data Map &rarr;</div>
          </Link>

          <Link
            to="/ai-usage"
            className="p-5 bg-black/40 hover:bg-black border border-white/5 hover:border-amber-500/30 rounded-2xl transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors uppercase tracking-wider flex items-center gap-2">
                  <Brain size={16} className="text-amber-500" /> AI Usage & Ethics
                </span>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-mono font-bold uppercase">Dual Reader</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed font-semibold">
                Mandatory framework regarding human verification rules of generative estimates and isolated secure cognitive learning bounds.
              </p>
            </div>
            <div className="text-[10px] text-forest-400 font-bold uppercase tracking-widest mt-4">Read AI Usage & Ethics &rarr;</div>
          </Link>
        </div>
      </section>

      {/* Advanced Danger Zone Settings */}
      <section className="mt-12 pt-12 border-t border-red-500/20">
        <h2 className="text-xl font-black text-red-500 uppercase tracking-widest flex items-center gap-3 mb-6">
          <AlertTriangle size={24} /> Danger Zone
        </h2>
        
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
           <div className="flex-1 space-y-2">
             <h3 className="font-bold text-lg text-white">Delete All Personal Data & Organization</h3>
             <p className="text-xs text-white/50 leading-relaxed max-w-xl">
               Permanently remove your account, operational history, tenant profile, and all associated metric data from our servers. This action is irreversible and complies with GDPR requests for erasure and the CCPA right to be forgotten.
             </p>
           </div>
           
           <button
             onClick={() => setShowDeleteModal(true)}
             className="px-6 py-4 bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shrink-0 flex items-center gap-2"
           >
             <Trash2 size={16} /> Delete Data
           </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-zinc-950 border border-red-500/30 rounded-2xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 blur-[100px] pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mb-2">
                   <AlertTriangle size={32} />
                </div>
                
                <h3 className="text-2xl font-black uppercase tracking-normal md:tracking-tighter text-white">Are you absolutely sure?</h3>
                
                <p className="text-sm text-white/60 leading-relaxed">
                  This action will permanently delete your user profile, tenant data, configurations, and all historical records. There is no undo. 
                </p>

                <div className="w-full text-left bg-black/50 p-4 border border-red-500/20 rounded-2xl">
                   <label className="text-xs md:text-[10px] text-red-400 font-bold uppercase tracking-widest mb-2 block">
                     Type "DELETE" to confirm
                   </label>
                   <input
                     type="text"
                     value={deleteConfirmation}
                     onChange={(e) => setDeleteConfirmation(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-red-500/50"
                     placeholder="DELETE"
                   />
                </div>

                <div className="flex gap-4 w-full pt-4">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 py-4 bg-white/5 text-white/70 hover:text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteData}
                    disabled={deleteConfirmation !== "DELETE" || isDeleting}
                    className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isDeleting ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin block" /> : "Erase All"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
