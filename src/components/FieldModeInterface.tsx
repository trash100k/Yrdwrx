// @ts-nocheck

import React, { useEffect, useState } from "react";
import {
  MapPin,
  Lock,
  CheckCircle2,
  Camera,
  AlertTriangle,
  Info,
  Maximize2,
  Calendar,
  Settings,
  X,
  MessageSquare,
  Map as MapIcon,
  ClipboardList,
} from "lucide-react";
import { useFieldMode } from "../contexts/FieldModeContext";
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import JobMap from "./JobMap";

import { useLocalStorage } from "../hooks/useLocalStorage";

export default function FieldModeInterface() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const { toggleFieldMode, missionPackage } = useFieldMode();

  const [activeJob, setActiveJob] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"comms" | "map" | "documentation">(
    "documentation",
  );
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentReport, setIncidentReport] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  
  const [arrivalPhoto, setArrivalPhoto] = useState<string | null>(null);
  const [departurePhoto, setDeparturePhoto] = useState<string | null>(null);

  const [showSnapshotPrompt, setShowSnapshotPrompt] = useState(false);
  const [isAnalyzingSnapshot, setIsAnalyzingSnapshot] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<any>(null);

  const [isHighContrast, setIsHighContrast] = useLocalStorage(
    "fieldmode_isHighContrast",
    true,
  );

  const handleInitiateCompletion = () => {
    if (!activeJob) return;
    if (!arrivalPhoto) {
      showToast("Please provide an arrival photo first in Documentation.", "error");
      setActiveTab("documentation");
      return;
    }
    setShowSnapshotPrompt(true);
  };

  const handleProcessSnapshot = async (photoData: string) => {
    setDeparturePhoto(photoData);
    setIsAnalyzingSnapshot(true);
    setSnapshotResult(null);
    try {
      const res = await fetchApi("/api/job/snapshot-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: photoData })
      });
      const data = await res.json();
      setSnapshotResult(data);
    } catch (e) {
      console.error(e);
      showToast("Error analyzing snapshot", "error");
      // Fallback
      setSnapshotResult({ varianceFound: false, notes: "Analysis failed, proceed anyway." });
    } finally {
      setIsAnalyzingSnapshot(false);
    }
  };

  const handleFinishJob = async () => {
    if (!activeJob || !arrivalPhoto || !departurePhoto) return;
    setIsFinishing(true);
    try {
      await updateDoc(doc(db, "jobs", activeJob.id), {
        status: "completed",
        completedAt: new Date().toISOString(),
        arrivalPhotoUrl: arrivalPhoto,
        departurePhotoUrl: departurePhoto,
        snapshotNotes: snapshotResult?.notes || "",
        varianceFound: snapshotResult?.varianceFound || false,
      });
      showToast("Job marked as completed.");
      setShowSnapshotPrompt(false);
      toggleFieldMode();
    } catch (error) {
      console.error(error);
      showToast("Error completing job", "error");
    } finally {
      setIsFinishing(false);
    }
  };

  const handleReportIncident = () => {
    if (!incidentReport.trim()) return;
    console.debug("Incident Reported:", incidentReport);
    setIncidentReport("");
    setShowIncidentModal(false);
    showToast("Incident reported to dispatch.");
  };

  useEffect(() => {
    const tenantId = tenant?.id || "genesis-1";
    const q = query(
      collection(db, "jobs"),
      where("tenantId", "==", tenantId),
      where("status", "in", ["scheduled", "in-progress"]),
      orderBy("date", "asc"),
      limit(1),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setActiveJob({ id: snapshot.docs[0].id, ...data });
        } else {
          setActiveJob(null);
        }
        setIsLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "jobs");
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tenant]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center space-y-4 z-[200]">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-600">Loading schedule...</p>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col font-sans transition-colors ${isHighContrast ? "bg-yellow-400 text-black" : "bg-black text-white"}`}
    >
      {/* Top Header */}
      <header
        className={`h-20 flex items-center justify-between px-6 border-b-4 shrink-0 ${isHighContrast ? "bg-yellow-400 border-black" : "bg-black border-white/20"}`}
      >
        <div className="flex flex-col">
          <span className="font-black text-2xl sm:text-3xl tracking-normal md:tracking-tighter uppercase italic leading-none">
            Field Ops
          </span>
          <span
            className={`text-xs md:text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-emerald-400"}`}
          >
            Standard Protocol Active
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsHighContrast(!isHighContrast)}
            className={`flex items-center justify-center p-3 sm:px-6 rounded-2xl font-black uppercase tracking-widest text-xs md:text-[10px] transition-transform hover:scale-105 active:scale-95 border-2 ${isHighContrast ? "bg-black text-white border-black" : "bg-white text-black border-white"}`}
          >
            {isHighContrast ? (
              <MapPin size={16} className="sm:hidden" />
            ) : (
              <Maximize2 size={16} className="sm:hidden" />
            )}
            <span className="hidden sm:inline">
              {isHighContrast ? "Tactical Mode" : "Sunlight Mode"}
            </span>
          </button>

          <button
            onClick={toggleFieldMode}
            className={`px-6 py-3 font-black uppercase tracking-widest text-xs md:text-[10px] rounded-2xl transition-transform hover:scale-105 active:scale-95 border-2 ${isHighContrast ? "bg-white text-black border-black" : "bg-zinc-800 text-white border-white/20"}`}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Job Details */}
        <div
          className={`w-full lg:w-1/3 lg:min-w-[480px] flex flex-col shrink-0 border-r-4 ${isHighContrast ? "border-black bg-yellow-400" : "border-white/20 bg-black"}`}
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {activeJob ? (
              <>
                <div className="space-y-4">
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 text-xs md:text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "border-black text-black bg-white" : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"}`}
                  >
                    <CheckCircle2 size={12} /> Target Acquired
                  </div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black tracking-normal md:tracking-tighter leading-none uppercase italic">
                    {activeJob.title}
                  </h1>
                  <div
                    className={`flex items-start gap-4 p-4 rounded-3xl border-2 ${isHighContrast ? "bg-white border-black" : "bg-white/5 border-white/20"}`}
                  >
                    <MapPin
                      size={24}
                      className={
                        isHighContrast ? "text-black" : "text-emerald-400"
                      }
                    />
                    <p className="text-xl font-bold uppercase tracking-tight">
                      {activeJob.address}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div
                    className={`p-6 rounded-3xl border-4 ${isHighContrast ? "bg-white border-black shadow-[8px_8px_0_0_#000]" : "bg-zinc-900 border-white/20"}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3
                        className={`font-black uppercase tracking-widest text-xs ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                      >
                        Gate Access
                      </h3>
                      <Lock
                        size={20}
                        className={
                          isHighContrast ? "text-black" : "text-white/40"
                        }
                      />
                    </div>
                    <p
                      className={`text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words font-black tracking-normal md:tracking-tighter ${isHighContrast ? "text-black" : "text-white"}`}
                    >
                      {activeJob.gateCode || "NONE"}
                    </p>
                  </div>

                  {activeJob.isHOA && (
                    <div
                      className={`p-6 rounded-3xl border-4 ${isHighContrast ? "bg-black text-yellow-400 border-black" : "bg-amber-500/20 text-amber-500 border-amber-500/50"}`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle size={24} />
                        <h3 className="font-black uppercase tracking-widest">
                          Active HOA
                        </h3>
                      </div>
                      <p className="font-bold text-lg leading-tight uppercase">
                        Strict noise and parking rules apply. Stay within
                        boundary lines.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3
                    className={`font-black uppercase tracking-widest text-xs ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                  >
                    Tactical Instructions
                  </h3>
                  <div
                    className={`p-6 rounded-3xl border-2 ${isHighContrast ? "bg-white border-black" : "bg-white/5 border-white/20"}`}
                  >
                    <p className="text-lg leading-relaxed font-bold uppercase">
                      {activeJob.accessNotes ||
                        "Standard service. Execute standard protocol. Contact dispatch if issues arise."}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 pt-12">
                <div
                  className={`w-32 h-32 rounded-full flex items-center justify-center border-4 ${isHighContrast ? "bg-white border-black text-black" : "bg-white/5 border-white/10 text-white/20"}`}
                >
                  <CheckCircle2 size={64} />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl sm:text-4xl font-black italic uppercase tracking-tight">
                    Queue Clear
                  </h2>
                  <p
                    className={`font-bold mt-2 uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                  >
                    Stand by for new assignments
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions Footer */}
          <div
            className={`p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t-4 shrink-0 ${isHighContrast ? "bg-yellow-400 border-black" : "bg-black border-white/20"}`}
          >
            <button
              onClick={() => setShowIncidentModal(true)}
              className={`flex flex-col items-center justify-center p-5 sm:p-8 min-h-[120px] gap-2 rounded-3xl border-4 transition-transform hover:scale-105 active:scale-95 ${isHighContrast ? "bg-white border-black text-black shadow-[6px_6px_0_0_#000]" : "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20"}`}
            >
              <AlertTriangle size={32} />
              <span className="text-xs md:text-sm font-black uppercase tracking-widest block mt-2">
                Issue
              </span>
            </button>
            <button
              className={`flex flex-col items-center justify-center p-5 sm:p-8 min-h-[120px] gap-2 rounded-3xl border-4 transition-transform hover:scale-105 active:scale-95 ${isHighContrast ? "bg-white border-black text-black shadow-[6px_6px_0_0_#000]" : "bg-white/5 border-white/20 text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <Camera size={32} />
              <span className="text-xs md:text-sm font-black uppercase tracking-widest block mt-2">
                Photo
              </span>
            </button>
            <button
              onClick={handleInitiateCompletion}
              disabled={isFinishing || !activeJob}
              className={`flex flex-col items-center justify-center p-5 sm:p-8 min-h-[120px] gap-2 rounded-3xl border-4 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale ${isHighContrast ? "bg-black border-black text-white shadow-[6px_6px_0_0_#000]" : "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"}`}
            >
              {isFinishing ? (
                <div
                  className={`w-8 h-8 border-4 rounded-full animate-spin ${isHighContrast ? "border-white/20 border-t-white" : "border-emerald-300 border-t-white"}`}
                />
              ) : (
                <CheckCircle2 size={32} />
              )}
              <span className="text-xs md:text-sm font-black uppercase tracking-widest block mt-2">
                Complete Job
              </span>
            </button>
          </div>
        </div>

        {/* Right Side: Map & Tabs */}
        <div
          className={`flex-1 flex flex-col ${isHighContrast ? "bg-yellow-400" : "bg-black"}`}
        >
          <div
            className={`h-20 flex px-4 shrink-0 overflow-x-auto border-b-4 ${isHighContrast ? "border-black bg-white" : "border-white/20 bg-zinc-950"}`}
          >
            <button
              onClick={() => setActiveTab("comms")}
              className={`flex items-center justify-center gap-3 flex-1 h-full font-black text-sm uppercase tracking-widest transition-colors border-b-4 ${activeTab === "comms" ? (isHighContrast ? "border-black text-black" : "border-emerald-500 text-white") : "border-transparent text-gray-500"}`}
            >
              <ClipboardList size={20} />
              <span className="hidden sm:inline">Comms</span>
            </button>
            <button
              onClick={() => setActiveTab("map")}
              className={`flex items-center justify-center gap-3 flex-1 h-full font-black text-sm uppercase tracking-widest transition-colors border-b-4 ${activeTab === "map" ? (isHighContrast ? "border-black text-black" : "border-emerald-500 text-white") : "border-transparent text-gray-500"}`}
            >
              <MapIcon size={20} />
              <span className="hidden sm:inline">Map</span>
            </button>
            <button
              onClick={() => setActiveTab("documentation")}
              className={`flex items-center justify-center gap-3 flex-1 h-full font-black text-sm uppercase tracking-widest transition-colors border-b-4 ${activeTab === "documentation" ? (isHighContrast ? "border-black text-black" : "border-emerald-500 text-white") : "border-transparent text-gray-500"}`}
            >
              <Camera size={20} />
              <span className="hidden sm:inline">Verification</span>
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden">
            {activeTab === "map" ? (
              <div
                className={`absolute inset-0 p-6 ${isHighContrast ? "bg-yellow-400" : "bg-black"}`}
              >
                <div
                  className={`w-full h-full rounded-2xl overflow-hidden border-4 ${isHighContrast ? "border-black" : "border-white/10"}`}
                >
                  <JobMap
                    jobs={activeJob ? [activeJob] : []}
                    onJobSelect={() => {}}
                  />
                </div>
              </div>
            ) : activeTab === "documentation" ? (
              <div className="p-5 sm:p-8 max-w-4xl mx-auto space-y-8 h-full overflow-y-auto custom-scrollbar">
                <header className="flex items-end justify-between border-b-4 border-black/10 pb-4">
                  <div>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black italic uppercase tracking-normal md:tracking-tighter leading-none mb-2">
                      Documentation
                    </h2>
                    <p
                      className={`text-xs md:text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                    >
                      Photo Check-In & Verification Protocol
                    </p>
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mb-8">
                  {/* Arrival Photo */}
                  {tenant?.settings?.subFeatures?.requireGateCheckPhoto !== false && (
                  <div
                    className={`p-6 rounded-2xl border-4 flex flex-col ${isHighContrast ? "bg-white border-black shadow-[8px_8px_0_0_#000]" : "bg-black border-white/20"}`}
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-lg uppercase tracking-widest">
                        Arrival Check-In
                      </h3>
                      <Camera
                        className={
                          isHighContrast ? "text-black" : "text-white"
                        }
                        size={20}
                      />
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center">
                      {arrivalPhoto ? (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500">
                          <img src={arrivalPhoto} alt="Arrival Verification" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setArrivalPhoto(null)} 
                            className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-rose-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className={`w-full aspect-video rounded-2xl border-4 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-solid transition-all ${isHighContrast ? "border-black bg-black/5 hover:bg-black/10" : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"}`}>
                          <Camera size={32} className="mb-2 opacity-50" />
                          <span className="font-black uppercase tracking-widest text-xs opacity-50 text-center px-4">
                            Upload Photo On-Site
                          </span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = URL.createObjectURL(file);
                              const img = new Image();
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
                                setArrivalPhoto(canvas.toDataURL("image/jpeg", 0.75));
                                URL.revokeObjectURL(url);
                              };
                              img.src = url;
                            }} 
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Departure Photo */}
                  {tenant?.settings?.subFeatures?.requireCompletionPhoto !== false && (
                  <div
                    className={`p-6 rounded-2xl border-4 flex flex-col ${isHighContrast ? "bg-white border-black shadow-[8px_8px_0_0_#000]" : "bg-zinc-900 border-white/20"}`}
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-lg uppercase tracking-widest">
                        Completion Verification
                      </h3>
                      <CheckCircle2
                        className={
                          isHighContrast ? "text-black" : "text-emerald-400"
                        }
                        size={20}
                      />
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center">
                      {departurePhoto ? (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500">
                          <img src={departurePhoto} alt="Departure Verification" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setDeparturePhoto(null)} 
                            className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-rose-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className={`w-full aspect-video rounded-2xl border-4 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-solid transition-all ${isHighContrast ? "border-black bg-black/5 hover:bg-black/10" : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"} ${!arrivalPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                          <Camera size={32} className="mb-2 opacity-50" />
                          <span className="font-black uppercase tracking-widest text-xs opacity-50 text-center px-4">
                            {arrivalPhoto ? "Upload Completion Space" : "Requires Arrival Photo First"}
                          </span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            disabled={!arrivalPhoto}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = URL.createObjectURL(file);
                              const img = new Image();
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
                                setDeparturePhoto(canvas.toDataURL("image/jpeg", 0.75));
                                URL.revokeObjectURL(url);
                              };
                              img.src = url;
                            }} 
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  )}
                </div>

                <div
                  className={`p-5 sm:p-8 rounded-2xl border-4 ${isHighContrast ? "bg-black text-white border-black" : "bg-white/5 border-white/10"}`}
                >
                  <h3 className="font-black text-xl sm:text-2xl uppercase tracking-normal md:tracking-tighter mb-4">
                    Photo Requirements
                  </h3>
                  <ul className="list-disc pl-5 space-y-2 font-bold uppercase tracking-widest text-xs">
                    <li>Arrival photo must include primary property signage or gate.</li>
                    <li>Completion photo must clearly show cleared surfaces.</li>
                    <li>Ensure adequate lighting for documentation purposes.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-8 max-w-3xl mx-auto space-y-8 h-full flex flex-col">
                <h2 className="text-2xl sm:text-3xl sm:text-4xl font-black italic uppercase tracking-normal md:tracking-tighter mb-4">
                  Comms Log
                </h2>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                  <div
                    className={`p-6 rounded-3xl border-4 ${isHighContrast ? "bg-white border-black" : "bg-white/5 border-white/10"}`}
                  >
                    <p className="font-bold text-lg uppercase">
                      System: Unit dispatched to waypoint.
                    </p>
                  </div>
                </div>
                <div
                  className={`rounded-3xl border-4 p-4 flex items-center gap-4 ${isHighContrast ? "bg-white border-black shadow-[8px_8px_0_0_#000]" : "bg-zinc-900 border-white/20"}`}
                >
                  <div className="flex-1">
                    <h3 className="font-black uppercase text-lg">
                      Leave Audio Note
                    </h3>
                    <p
                      className={`text-xs md:text-[10px] font-bold uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                    >
                      Syncs to dispatch console
                    </p>
                  </div>
                  <button
                    className={`flex items-center justify-center w-16 h-16 rounded-2xl border-4 transition-transform hover:scale-105 active:scale-95 ${isHighContrast ? "bg-emerald-400 border-black text-black" : "bg-emerald-600 border-emerald-400 text-white"}`}
                  >
                    <MessageSquare size={28} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Incident Modal */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300] p-6 backdrop-blur-sm">
          <div
            className={`rounded-2xl border-8 w-full max-w-xl overflow-hidden shadow-2xl ${isHighContrast ? "bg-white border-black text-black" : "bg-zinc-900 border-rose-500 text-white"}`}
          >
            <div
              className={`p-5 sm:p-8 border-b-4 flex justify-between items-center ${isHighContrast ? "bg-yellow-400 border-black" : "bg-rose-500/10 border-rose-500/30"}`}
            >
              <h3 className="text-2xl sm:text-3xl font-black tracking-normal md:tracking-tighter italic uppercase">
                Report Issue
              </h3>
              <button
                onClick={() => setShowIncidentModal(false)}
                className={`p-2 rounded-xl border-4 hover:scale-105 transition-transform ${isHighContrast ? "border-black text-black" : "border-rose-500/50 text-rose-500"}`}
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-5 sm:p-8 space-y-6">
              <label
                className={`block text-xs font-black uppercase tracking-widest ${isHighContrast ? "text-black" : "text-white/60"}`}
              >
                Condition Details
              </label>
              <textarea
                value={incidentReport}
                onChange={(e) => setIncidentReport(e.target.value)}
                placeholder="DESCRIBE SITUATION..."
                className={`w-full h-48 p-6 rounded-3xl border-4 outline-none resize-none font-black text-xl uppercase ${isHighContrast ? "bg-black/5 border-black placeholder:text-black/20 focus:bg-yellow-400/20" : "bg-black border-white/20 placeholder:text-white/20 focus:border-rose-500/50 focus:bg-rose-500/5"}`}
              />
            </div>
            <div
              className={`p-5 sm:p-8 border-t-4 flex justify-end gap-4 ${isHighContrast ? "border-black bg-yellow-400/10" : "border-white/10 bg-black/50"}`}
            >
              <button
                onClick={() => setShowIncidentModal(false)}
                className={`px-8 py-4 text-xs md:text-[10px] font-black uppercase tracking-widest rounded-2xl border-4 ${isHighContrast ? "border-black text-black hover:bg-black/5" : "border-white/20 text-white/60 hover:text-white hover:bg-white/5"}`}
              >
                Cancel
              </button>
              <button
                onClick={handleReportIncident}
                disabled={!incidentReport.trim()}
                className={`px-8 py-4 text-xs md:text-[10px] font-black uppercase tracking-widest rounded-2xl border-4 disabled:opacity-50 disabled:grayscale transition-transform hover:scale-105 active:scale-95 ${isHighContrast ? "bg-black border-black text-white" : "bg-rose-600 border-rose-500 text-white hover:bg-rose-500"}`}
              >
                Transmit Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {showSnapshotPrompt && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md">
          <div className={`w-full max-w-2xl rounded-[40px] border-4 overflow-hidden flex flex-col shadow-2xl ${isHighContrast ? "bg-white border-black" : "bg-zinc-900 border-white/20"}`}>
            <div className={`shrink-0 p-6 sm:p-8 border-b-4 flex items-center justify-between ${isHighContrast ? "border-black bg-yellow-400" : "border-white/10 bg-zinc-950"}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isHighContrast ? "bg-black text-white" : "bg-emerald-500/20 text-emerald-400"}`}>
                  <Camera size={24} />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight">Project Snapshot</h3>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-emerald-400"}`}>AI Quality & Variance Check</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto">
                {!snapshotResult && !isAnalyzingSnapshot ? (
                    <div className="space-y-4">
                        <p className={`text-sm font-bold leading-relaxed ${isHighContrast ? "text-black" : "text-white/80"}`}>
                            Please capture a final wide-angle shot of the completed job. The AI will cross-reference this photo against the standard quality plans to verify clean edges, material placement, and overall completion.
                        </p>
                        <label className={`w-full aspect-video rounded-3xl border-4 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-solid transition-all ${isHighContrast ? "border-black bg-black/5 hover:bg-black/10" : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"}`}>
                            <Camera size={48} className="mb-4 opacity-50" />
                            <span className="font-black uppercase tracking-widest text-sm opacity-50 text-center px-4">Tap to Capture Area</span>
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const url = URL.createObjectURL(file);
                                    const img = new Image();
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
                                      handleProcessSnapshot(canvas.toDataURL("image/jpeg", 0.75));
                                      URL.revokeObjectURL(url);
                                    };
                                    img.src = url;
                                }}
                            />
                        </label>
                    </div>
                ) : isAnalyzingSnapshot ? (
                    <div className="flex flex-col items-center justify-center space-y-6 py-12">
                        <div className={`w-24 h-24 border-8 rounded-full animate-spin ${isHighContrast ? "border-black/10 border-t-black" : "border-emerald-500/20 border-t-emerald-500"}`} />
                        <div className="text-center">
                            <h4 className={`text-xl font-black uppercase tracking-tight mb-2 ${isHighContrast ? "text-black" : "text-white"}`}>Analyzing Snapshot</h4>
                            <p className={`text-xs font-bold uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-emerald-400"}`}>Cross-referencing with standard quality plans...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <img src={departurePhoto!} alt="Snapshot" className="w-full aspect-video object-cover rounded-2xl border-4 border-black/10" />
                        
                        <div className={`p-6 rounded-2xl border-4 ${snapshotResult.varianceFound ? (isHighContrast ? "border-black bg-amber-400" : "border-amber-500/50 bg-amber-500/10") : (isHighContrast ? "border-black bg-emerald-400" : "border-emerald-500/50 bg-emerald-500/10")}`}>
                            <div className="flex items-center gap-3 mb-4">
                                {snapshotResult.varianceFound ? <AlertTriangle size={24} className={isHighContrast ? "text-black" : "text-amber-500"} /> : <CheckCircle2 size={24} className={isHighContrast ? "text-black" : "text-emerald-500"} />}
                                <h4 className={`text-lg font-black uppercase tracking-tight ${isHighContrast ? "text-black" : (snapshotResult.varianceFound ? "text-amber-500" : "text-emerald-500")}`}>
                                    {snapshotResult.varianceFound ? "Variance Detected" : "Quality Standard Met"}
                                </h4>
                            </div>
                            <p className={`text-sm font-bold leading-relaxed ${isHighContrast ? "text-black/80" : "text-white/80"}`}>
                                {snapshotResult.notes}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className={`p-5 sm:p-8 border-t-4 flex justify-end gap-4 shrink-0 ${isHighContrast ? "border-black bg-yellow-400/10" : "border-white/10 bg-zinc-950"}`}>
              <button
                onClick={() => setShowSnapshotPrompt(false)}
                className={`px-8 py-4 text-xs md:text-[10px] font-black uppercase tracking-widest rounded-2xl border-4 transition-colors ${isHighContrast ? "border-black text-black hover:bg-black/5" : "border-white/20 text-white/60 hover:text-white hover:bg-white/5"}`}
              >
                Cancel
              </button>
              {snapshotResult && (
                  <button
                    onClick={handleFinishJob}
                    disabled={isFinishing}
                    className={`px-8 py-4 text-xs md:text-[10px] font-black uppercase tracking-widest rounded-2xl border-4 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 ${isHighContrast ? "bg-black border-black text-white" : "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"}`}
                  >
                    {isFinishing && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                    Confirm Completion
                  </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
