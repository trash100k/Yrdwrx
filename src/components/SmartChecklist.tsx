
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Fuel,
  MapPin,
  X,
  Loader2,
  ChevronRight,
  AlertCircle,
  Plus,
  Package,
  Camera,
} from "lucide-react";
import {
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
  query,
  onSnapshot,
} from "firebase/firestore";
import { db, logSystemEvent } from "../lib/firebase";
import { ingestKnowledge } from "../services/brainService";
import { syncService } from "../services/syncService";
import { useTenant } from "../contexts/TenantContext";

interface ChecklistItem {
  text: string;
  completed: boolean;
  aiSource: boolean;
  isProximityTask?: boolean;
}

interface SmartChecklistProps {
  job: Record<string, any>;
  onClose: () => void;
  userCoords: { lat: number; lng: number } | null;
}

export default function SmartChecklist({
  job,
  onClose,
  userCoords,
}: SmartChecklistProps) {
  const { tenant } = useTenant();
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    job.checklist || [],
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [fuelValue, setFuelValue] = useState(job.fuelStart ?? 100);
  const [step, setStep] = useState<
    "gate" | "fuel" | "checklist" | "materials" | "evidence"
  >(job.gateCode || job.isHOA ? "gate" : job.fuelStart ? "checklist" : "fuel");
  const [gateConfirmed, setGateConfirmed] = useState(false);
  const [inventory, setInventory] = useState<
    { id: string; name: string; stock: number }[]
  >([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [materialQty, setMaterialQty] = useState("1");
  const [photoEvidence, setPhotoEvidence] = useState<string | null>(
    job.evidenceUrl || null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const isHOA = job.client?.toLowerCase().includes("hoa") || job.isHOA;
  const hoaRules = job.hoaRules || [
    "No mowing before 9:00 AM",
    "Crew must wear identifying vests at all times",
    "Mandatory gates-shut verification",
  ];

  useEffect(() => {
    if (checklist.length === 0 && !isGenerating) {
      generateChecklist();
    }

    // Fetch inventory for logging
    const q = query(collection(db, "inventory"));
    const unsubInv = onSnapshot(q, (snapshot) => {
      setInventory(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any),
      );
    });
    return () => unsubInv();
  }, [job.id]);

  const logMaterial = async () => {
    if (!selectedMaterial) return;
    try {
      const qty = parseFloat(materialQty);
      if (isNaN(qty)) return;

      if (navigator.onLine) {
        await addDoc(collection(db, "materialLogs"), {
          itemId: selectedMaterial.id,
          itemName: selectedMaterial.name,
          jobId: job.id,
          clientName: job.client,
          tenantId: tenant?.id || "genesis-1",
          quantity: qty,
          unit: selectedMaterial.unit,
          timestamp: serverTimestamp(),
          type: "out",
        });

        // Update inventory count
        await updateDoc(doc(db, "inventory", selectedMaterial.id), {
          quantity: selectedMaterial.quantity - qty,
          tenantId: tenant?.id || "genesis-1",
        });
      } else {
        await syncService.queueAction(
          "CREATE",
          "materialLogs",
          {
            itemId: selectedMaterial.id,
            itemName: selectedMaterial.name,
            jobId: job.id,
            clientName: job.client,
            quantity: qty,
            unit: selectedMaterial.unit,
            timestamp: new Date().toISOString(),
            type: "out",
          },
          tenant?.id || "genesis-1",
        );
        await syncService.queueAction(
          "UPDATE",
          "inventory",
          {
            quantity: selectedMaterial.quantity - qty,
          },
          tenant?.id || "genesis-1",
          selectedMaterial.id,
        );
      }

      await ingestKnowledge(
        `Material Log: ${qty} ${selectedMaterial.unit} of ${selectedMaterial.name} used for ${job.client}.`,
        {
          type: "inventory",
          action: "usage_logged",
          jobId: job.id,
        },
      );

      await logSystemEvent("MATERIAL_LOGGED", {
        jobId: job.id,
        materialId: selectedMaterial.id,
        qty,
      });

      setSelectedMaterial(null);
      setMaterialQty("1");
    } catch (err) {
      console.error(err);
    }
  };

  const generateChecklist = async () => {
    setIsGenerating(true);
    try {
      // 1. Base checklist from existing templates
      let items: ChecklistItem[] = job.checklist || [
        { text: "Verify site boundaries", completed: false, aiSource: true },
        {
          text: "Inspect turf for disease clusters",
          completed: false,
          aiSource: true,
        },
        { text: "Clear hardscape debris", completed: false, aiSource: true },
      ];

      // 2. Proximity/History Injections (The core of the requested feature)
      const proximityInjections: string[] = [];

      // Site history simulation logic
      if (
        job.client?.toLowerCase().includes("schmidt") ||
        job.client?.toLowerCase().includes("hill")
      ) {
        proximityInjections.push("Verify back gate latch (Tricky mechanism)");
      }

      if (
        job.title?.toLowerCase().includes("pruning") ||
        job.client?.toLowerCase().includes("estates")
      ) {
        proximityInjections.push(
          "Locate master irrigation node for safety check",
        );
      }

      if (job.isHOA || job.client?.toLowerCase().includes("oak")) {
        proximityInjections.push("Photo proof of pool area security closure");
      }

      // 3. Merge and deduplicate
      if (proximityInjections.length > 0) {
        const injectedItems = proximityInjections.map((text) => ({
          text,
          completed: false,
          aiSource: true,
          isProximityTask: true, // New flag for highlighting
        }));
        items = [...injectedItems, ...items];
      }

      setChecklist(items);

      // Update Firestore with initial checklist
      await updateDoc(doc(db, "jobs", job.id), {
        checklist: items,
      });

      await logSystemEvent("PROXIMITY_CHECKLIST_GENERATED", {
        jobId: job.id,
        injections: proximityInjections.length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleItem = async (index: number) => {
    const newList = [...checklist];
    newList[index].completed = !newList[index].completed;
    setChecklist(newList);

    if (navigator.onLine) {
      await updateDoc(doc(db, "jobs", job.id), {
        checklist: newList,
        tenantId: tenant?.id || "genesis-1",
      });
    } else {
      await syncService.queueAction(
        "UPDATE",
        "jobs",
        { checklist: newList },
        tenant?.id || "genesis-1",
        job.id,
      );
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    // Simulate high-tier upload & processing
    setTimeout(async () => {
      const fakeUrl = URL.createObjectURL(file);
      setPhotoEvidence(fakeUrl);
      await updateDoc(doc(db, "jobs", job.id), { evidenceUrl: fakeUrl });
      setIsUploading(false);
      setStep("checklist");
    }, 1500);
  };

  const saveFuel = async () => {
    const isEnding = job.status === "in-progress" || job.status === "completed";
    const field = isEnding ? "fuelEnd" : "fuelStart";
    const newStatus = isEnding ? job.status : "on-site";

    if (navigator.onLine) {
      await updateDoc(doc(db, "jobs", job.id), {
        [field]: fuelValue,
        status: newStatus,
        tenantId: tenant?.id || "genesis-1",
      });
    } else {
      await syncService.queueAction(
        "UPDATE",
        "jobs",
        {
          [field]: fuelValue,
          status: newStatus,
        },
        tenant?.id || "genesis-1",
        job.id,
      );
    }

    if (fuelValue <= 25) {
      await ingestKnowledge(
        `SYSTEM ALERT: Equipment fuel level recorded at ${fuelValue}% for job "${job.title}" at ${job.client}. Refueling recommended before next assignment.`,
        {
          type: "equipment",
          subType: "maintenance_alert",
          urgency: "high",
        },
      );
    }

    setStep("checklist");
  };

  const isAllDone =
    checklist.length > 0 &&
    checklist.every((i) => i.completed) &&
    photoEvidence !== null;
  const isEnding = job.status === "in-progress" || job.status === "completed";

  const completeJob = async () => {
    if (!isAllDone || isFinalizing) return;
    setIsFinalizing(true);
    try {
      if (window.navigator.vibrate) {
        window.navigator.vibrate([10, 30, 10]);
      }

      if (navigator.onLine) {
        await updateDoc(doc(db, "jobs", job.id), {
          status: "completed",
          progress: 100,
          tenantId: tenant?.id || "genesis-1",
          updatedAt: serverTimestamp(),
        });
      } else {
        await syncService.queueAction(
          "UPDATE",
          "jobs",
          {
            status: "completed",
            progress: 100,
            updatedAt: new Date().toISOString(),
          },
          tenant?.id || "genesis-1",
          job.id,
        );
      }

      await logSystemEvent("JOB_COMPLETED", {
        jobId: job.id,
        tenantId: tenant?.id,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-6 right-6 w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden z-[60]"
    >
      {/* Header */}
      <div
        className={`${isHOA ? "bg-purple-950" : "bg-slate-900"} p-6 text-white text-center relative overflow-hidden transition-colors`}
      >
        {isHOA && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-white to-purple-500 animate-pulse z-20" />
        )}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent" />
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-white/40 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="flex items-center justify-center gap-2 mb-2 relative">
          <Sparkles
            size={16}
            className={isHOA ? "text-purple-400" : "text-emerald-400"}
          />
          <h3
            className={`text-[10px] font-black uppercase tracking-[0.2em] ${isHOA ? "text-purple-400" : "text-emerald-400"}`}
          >
            {isHOA
              ? "COMMUNITY PROTOCOL ACTIVE"
              : isEnding
                ? "Post-Job Audit"
                : "Arrival at Location"}
          </h3>
        </div>
        <h2 className="text-xl font-bold tracking-tight relative mb-1">
          {job.client}
        </h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest relative">
          {job.title}
        </p>
      </div>

      {isHOA && step === "checklist" && (
        <div className="bg-purple-50 p-4 border-b border-purple-100">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-purple-600" />
            <span className="text-[10px] font-black uppercase text-purple-600 tracking-widest">
              Site Service Standards
            </span>
          </div>
          <div className="space-y-2">
            {hoaRules.map((rule: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1 h-1 bg-purple-400 rounded-full" />
                <span className="text-[10px] font-bold text-purple-900/70">
                  {rule}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-8">
        {step === "gate" ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-200">
                <AlertCircle size={32} className="text-purple-600" />
              </div>
              <h4 className="text-lg font-black text-slate-900 mb-1">
                Gate Access Protocol
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                Verify secure entry requirements before proceeding.
              </p>
            </div>

            <div className="space-y-4">
              {job.gateCode && (
                <div className="bg-slate-900 text-white p-6 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 blur-2xl" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 block mb-2">
                    Secure Entry Code
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-4xl font-black italic tracking-widest">
                      {job.gateCode}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(job.gateCode);
                      }}
                      className="text-[9px] font-black uppercase bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-all"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {job.accessNotes && (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-[32px]">
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 block mb-2">
                    Access Instructions
                  </span>
                  <p className="text-xs font-bold text-amber-900/70 leading-relaxed italic">
                    "{job.accessNotes}"
                  </p>
                </div>
              )}

              <div
                onClick={() => setGateConfirmed(!gateConfirmed)}
                className={`flex items-center gap-4 p-6 rounded-[32px] border cursor-pointer transition-all ${gateConfirmed ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-transparent hover:border-slate-200"}`}
              >
                {gateConfirmed ? (
                  <CheckCircle2 size={24} className="text-emerald-600" />
                ) : (
                  <Circle size={24} className="text-slate-300" />
                )}
                <div>
                  <span className="text-sm font-black text-slate-900 block">
                    Status Confirmed
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    Entry secured and protocol followed
                  </span>
                </div>
              </div>
            </div>

            <button
              disabled={!gateConfirmed}
              onClick={() => setStep(job.fuelStart ? "checklist" : "fuel")}
              className={`w-full rounded-2xl py-5 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-xl ${gateConfirmed ? "bg-slate-900 text-white shadow-slate-200" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}
            >
              Authorization Complete
              <ChevronRight size={16} />
            </button>
          </div>
        ) : step === "fuel" ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Fuel
                  size={32}
                  className={isEnding ? "text-emerald-600" : "text-slate-900"}
                />
              </div>
              <h4 className="text-lg font-black text-slate-900 mb-1">
                {isEnding ? "Final Fuel Reading" : "Fuel Gauge Check"}
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                {isEnding
                  ? "Record levels after finishing the property."
                  : "Record existing fuel levels before starting operations."}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Current Level
                </span>
                <span className="text-3xl font-black text-slate-900">
                  {fuelValue}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={fuelValue}
                onChange={(e) => setFuelValue(parseInt(e.target.value))}
                className={`w-full h-3 rounded-lg appearance-none cursor-pointer accent-slate-900 transition-colors ${fuelValue <= 25 ? "bg-red-100" : "bg-slate-100"}`}
              />
              {fuelValue <= 25 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-600 text-white p-3 rounded-xl flex items-center gap-3 shadow-lg shadow-red-900/20"
                >
                  <AlertCircle size={16} className="animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    Low Fuel Alert: Refill Immediately
                  </p>
                </motion.div>
              )}
              <div className="flex justify-between text-[10px] font-black text-slate-300">
                <span>EMPTY</span>
                <span>FULL</span>
              </div>
            </div>

            <button
              onClick={saveFuel}
              className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
            >
              Confirm & Unlock Checklist
              <ChevronRight size={16} />
            </button>
          </div>
        ) : step === "evidence" ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <h4 className="text-lg font-black text-slate-900 mb-1">
                Site Evidence
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                Stated photo verification for client compliance records.
              </p>
            </div>

            <div className="relative aspect-video bg-slate-100 rounded-[32px] overflow-hidden border-2 border-dashed border-slate-200 flex flex-col items-center justify-center group hover:border-emerald-500 transition-all">
              {photoEvidence ? (
                <img
                  src={photoEvidence}
                  alt="Evidence"
                  className="w-full h-full object-cover"
                />
              ) : isUploading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2
                    size={32}
                    className="animate-spin text-emerald-600"
                  />
                  <p className="text-[10px] font-black uppercase text-emerald-600 animate-pulse">
                    Syncing to Cloud...
                  </p>
                </div>
              ) : (
                <>
                  <Camera
                    size={40}
                    className="text-slate-300 mb-2 group-hover:scale-110 group-hover:text-emerald-500 transition-all"
                  />
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Tap to Capture Stage
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col items-center opacity-50">
                <span className="text-[8px] font-black uppercase text-slate-400">
                  Lat
                </span>
                <span className="text-[10px] font-bold text-slate-900">
                  {userCoords?.lat.toFixed(4) || "--"}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col items-center opacity-50">
                <span className="text-[8px] font-black uppercase text-slate-400">
                  Lng
                </span>
                <span className="text-[10px] font-bold text-slate-900">
                  {userCoords?.lng.toFixed(4) || "--"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setStep("checklist")}
              className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
            >
              Back to Checklist
            </button>
          </div>
        ) : step === "materials" ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <h4 className="text-lg font-black text-slate-900 mb-1">
                Material Allocation
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                Record specific consumables utilized during service.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2">
                {inventory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedMaterial(item)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedMaterial?.id === item.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-50 border-transparent hover:border-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Package
                        size={14}
                        className={
                          selectedMaterial?.id === item.id
                            ? "text-emerald-400"
                            : "text-slate-400"
                        }
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {item.name}
                      </span>
                    </span>
                    <span className="text-[10px] font-bold opacity-60">
                      {item.quantity} {item.unit} available
                    </span>
                  </button>
                ))}
              </div>

              {selectedMaterial && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4"
                >
                  <div className="flex-1">
                    <label className="text-[9px] font-black uppercase text-emerald-800 tracking-widest block mb-1">
                      Usage Amount ({selectedMaterial.unit})
                    </label>
                    <input
                      type="number"
                      aria-label="Material quantity"
                      value={materialQty}
                      onChange={(e) => setMaterialQty(e.target.value)}
                      className="w-full bg-white border-transparent rounded-lg p-2 font-black text-lg focus:ring-0"
                    />
                  </div>
                  <button
                    onClick={logMaterial}
                    className="bg-emerald-600 text-white p-4 rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-200"
                    aria-label="Confirm material usage"
                  >
                    <CheckCircle2 size={24} />
                  </button>
                </motion.div>
              )}
            </div>

            <button
              onClick={() => setStep("checklist")}
              className="w-full bg-slate-100 text-slate-500 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest"
            >
              Back to Checklist
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Property Checklist
              </h4>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep("evidence")}
                  className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  <Camera size={14} />
                  <span className="text-[10px] font-black uppercase">
                    Service Photo
                  </span>
                </button>
                <button
                  onClick={() => setStep("materials")}
                  className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  <Plus size={14} />
                  <span className="text-[10px] font-black uppercase">
                    Materials
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {checklist.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleItem(idx)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                    item.completed
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-slate-50 border-transparent text-slate-600 hover:border-slate-200"
                  }`}
                >
                  {item.completed ? (
                    <CheckCircle2
                      size={20}
                      className="text-emerald-600 shrink-0"
                    />
                  ) : (
                    <Circle size={20} className="text-slate-300 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 block">
                    <span className="flex items-center gap-2 block">
                      <span
                        className={`text-xs font-bold leading-tight block ${item.completed ? "line-through opacity-50" : ""}`}
                      >
                        {item.text}
                      </span>
                      {item.isProximityTask && !item.completed && (
                        <span className="bg-amber-100 text-amber-700 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 animate-pulse">
                          <AlertCircle size={8} />
                          Site Insight
                        </span>
                      )}
                    </span>
                    {item.aiSource && (
                      <span className="text-[8px] font-black uppercase text-emerald-500 tracking-tighter block mt-1">
                        AI Verified
                      </span>
                    )}
                  </span>
                </button>
              ))}
              {checklist.length === 0 && !isGenerating && (
                <div className="text-center py-8 text-slate-300">
                  <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-[10px] font-bold">No items found</p>
                </div>
              )}
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={() => setStep("fuel")}
                className="flex-1 bg-slate-50 text-slate-500 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest border border-slate-100"
              >
                Adust Fuel
              </button>
              <button
                disabled={!isAllDone || isFinalizing}
                onClick={completeJob}
                className={`flex-[2] rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 ${
                  isAllDone
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
                }`}
              >
                {isFinalizing && <Loader2 size={12} className="animate-spin" />}
                {isFinalizing
                  ? "Encrypting Matrix..."
                  : photoEvidence
                    ? "Finalize Job Matrix"
                    : "Photo Proof Required"}
              </button>
            </div>

            {isAllDone && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-6 bg-emerald-50 rounded-3xl border border-emerald-200 flex flex-col gap-4 shadow-xl shadow-emerald-500/5"
              >
                <div className="flex items-center gap-3">
                  <Sparkles size={18} className="text-emerald-600" />
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                    Neural Reconciliation Recs
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900/40">
                    <span className="uppercase tracking-tight">
                      Review Scout Launch
                    </span>
                    <span className="text-emerald-600 bg-white px-2 py-0.5 rounded-lg border border-emerald-100 shadow-sm">
                      AUTOMATIC
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900/40">
                    <span className="uppercase tracking-tight">
                      Upsell: Holly Swap
                    </span>
                    <button className="text-white bg-emerald-600 px-3 py-1 rounded-lg shadow-lg hover:bg-emerald-500 transition-all font-black text-[9px] uppercase tracking-widest">
                      Queue Directive
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <MapPin size={10} className="text-emerald-500" />
          Verified at property
        </div>
        <div className="flex items-center gap-2">
          <Fuel
            size={10}
            className={step === "fuel" ? "text-slate-900" : "text-emerald-500"}
          />
          Fuel: {fuelValue}%
        </div>
      </div>
    </motion.div>
  );
}
