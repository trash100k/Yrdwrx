
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
  const [activeTab, setActiveTab] = useState<"comms" | "map" | "hardware">(
    "hardware",
  );
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentReport, setIncidentReport] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);

  const [isHighContrast, setIsHighContrast] = useLocalStorage(
    "fieldmode_isHighContrast",
    true,
  );

  const handleFinishJob = async () => {
    if (!activeJob) return;
    setIsFinishing(true);
    try {
      await updateDoc(doc(db, "jobs", activeJob.id), {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      showToast("Job marked as completed.");
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
          <span className="font-black text-3xl tracking-tighter uppercase italic leading-none">
            Field Ops
          </span>
          <span
            className={`text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-emerald-400"}`}
          >
            Standard Protocol Active
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsHighContrast(!isHighContrast)}
            className={`flex items-center justify-center p-3 sm:px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-transform hover:scale-105 active:scale-95 border-2 ${isHighContrast ? "bg-black text-white border-black" : "bg-white text-black border-white"}`}
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
            className={`px-6 py-3 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-transform hover:scale-105 active:scale-95 border-2 ${isHighContrast ? "bg-white text-black border-black" : "bg-zinc-800 text-white border-white/20"}`}
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
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "border-black text-black bg-white" : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"}`}
                  >
                    <CheckCircle2 size={12} /> Target Acquired
                  </div>
                  <h1 className="text-5xl font-black tracking-tighter leading-none uppercase italic">
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
                      className={`text-6xl font-black tracking-tighter ${isHighContrast ? "text-black" : "text-white"}`}
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
                  <h2 className="text-4xl font-black italic uppercase tracking-tight">
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
            className={`p-6 grid grid-cols-3 gap-4 border-t-4 shrink-0 ${isHighContrast ? "bg-yellow-400 border-black" : "bg-black border-white/20"}`}
          >
            <button
              onClick={() => setShowIncidentModal(true)}
              className={`flex flex-col items-center justify-center py-6 gap-2 rounded-2xl border-4 transition-transform hover:scale-105 active:scale-95 ${isHighContrast ? "bg-white border-black text-black shadow-[4px_4px_0_0_#000]" : "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20"}`}
            >
              <AlertTriangle size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest block">
                Issue
              </span>
            </button>
            <button
              className={`flex flex-col items-center justify-center py-6 gap-2 rounded-2xl border-4 transition-transform hover:scale-105 active:scale-95 ${isHighContrast ? "bg-white border-black text-black shadow-[4px_4px_0_0_#000]" : "bg-white/5 border-white/20 text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <Camera size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest block">
                Photo
              </span>
            </button>
            <button
              onClick={handleFinishJob}
              disabled={isFinishing || !activeJob}
              className={`flex flex-col items-center justify-center py-6 gap-2 rounded-2xl border-4 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale ${isHighContrast ? "bg-black border-black text-white" : "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"}`}
            >
              {isFinishing ? (
                <div
                  className={`w-6 h-6 border-4 rounded-full animate-spin ${isHighContrast ? "border-white/20 border-t-white" : "border-white/20 border-t-white"}`}
                />
              ) : (
                <CheckCircle2 size={24} />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest block">
                Done
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
              onClick={() => setActiveTab("hardware")}
              className={`flex items-center justify-center gap-3 flex-1 h-full font-black text-sm uppercase tracking-widest transition-colors border-b-4 ${activeTab === "hardware" ? (isHighContrast ? "border-black text-black" : "border-emerald-500 text-white") : "border-transparent text-gray-500"}`}
            >
              <Settings size={20} />
              <span className="hidden sm:inline">Diagnostics</span>
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden">
            {activeTab === "map" ? (
              <div
                className={`absolute inset-0 p-6 ${isHighContrast ? "bg-yellow-400" : "bg-black"}`}
              >
                <div
                  className={`w-full h-full rounded-[40px] overflow-hidden border-4 ${isHighContrast ? "border-black" : "border-white/10"}`}
                >
                  <JobMap
                    jobs={activeJob ? [activeJob] : []}
                    onJobSelect={() => {}}
                  />
                </div>
              </div>
            ) : activeTab === "hardware" ? (
              <div className="p-8 max-w-4xl mx-auto space-y-8 h-full overflow-y-auto custom-scrollbar">
                <header className="flex items-end justify-between border-b-4 border-black/10 pb-4">
                  <div>
                    <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-2">
                      Diagnostics
                    </h2>
                    <p
                      className={`text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                    >
                      Pre-Op Hardware Telemetry & OSHA/ASAE Protocols
                    </p>
                  </div>
                  <div
                    className={`px-4 py-2 border-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "border-black text-black" : "border-emerald-500 text-emerald-400"}`}
                  >
                    All Systems Go
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Visual Meter 1: Battery Core */}
                  <div
                    className={`p-6 rounded-[32px] border-4 ${isHighContrast ? "bg-white border-black shadow-[8px_8px_0_0_#000]" : "bg-black border-white/20"}`}
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-lg uppercase tracking-widest">
                        Battery Arrays
                      </h3>
                      <Settings
                        className={
                          isHighContrast ? "text-black/40" : "text-white/40"
                        }
                        size={20}
                      />
                    </div>
                    <div className="space-y-6">
                      {[
                        {
                          name: "Zero-Turn Main",
                          level: 98,
                          color: "bg-emerald-500",
                        },
                        {
                          name: "Trimmer Aux",
                          level: 64,
                          color: "bg-yellow-500",
                        },
                        {
                          name: "Blower Pack",
                          level: 82,
                          color: "bg-emerald-500",
                        },
                      ].map((bat) => (
                        <div key={bat.name} className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span>{bat.name}</span>
                            <span>{bat.level}%</span>
                          </div>
                          <div
                            className={`h-4 w-full rounded-full border-2 overflow-hidden ${isHighContrast ? "border-black bg-black/5" : "border-white/10 bg-white/5"}`}
                          >
                            <div
                              className={`h-full ${bat.color} ${isHighContrast ? "border-r-2 border-black" : ""}`}
                              style={{ width: `${bat.level}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visual Meter 2: Mechanicals */}
                  <div
                    className={`p-6 rounded-[32px] border-4 ${isHighContrast ? "bg-white border-black shadow-[8px_8px_0_0_#000]" : "bg-zinc-900 border-white/20"}`}
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-lg uppercase tracking-widest">
                        Mechanical PSI
                      </h3>
                      <Info
                        className={
                          isHighContrast ? "text-black/40" : "text-white/40"
                        }
                        size={20}
                      />
                    </div>

                    <div className="flex items-end gap-4 h-32 mb-4">
                      {[
                        { label: "HYD-L", val: 80, limit: true },
                        { label: "HYD-R", val: 85, limit: true },
                        { label: "COOL", val: 60, limit: true },
                        { label: "OIL", val: 95, limit: false },
                      ].map((bar, i) => (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center justify-end h-full gap-2 relative"
                        >
                          {bar.limit && (
                            <div className="absolute top-[20%] left-0 w-full border-t-2 border-dashed border-rose-500/50 z-10" />
                          )}
                          <div
                            className={`w-full rounded-t-lg transition-all ${isHighContrast ? "bg-black" : "bg-white"} ${bar.val > 90 ? (isHighContrast ? "!bg-rose-500" : "!bg-rose-500") : ""}`}
                            style={{ height: `${bar.val}%` }}
                          />
                          <span className="text-[9px] font-black uppercase tracking-widest">
                            {bar.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p
                      className={`text-[10px] text-center font-bold uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                    >
                      Hydraulic pressures optimal
                      <br />
                      under 2800 PSI threshold.
                    </p>
                  </div>
                </div>

                {/* Pre-Op Compliance Checks - highly visual instead of text list */}
                <div
                  className={`p-8 rounded-[32px] border-4 ${isHighContrast ? "bg-black text-white border-black" : "bg-white/5 border-white/10"}`}
                >
                  <h3 className="font-black text-2xl uppercase tracking-tighter mb-6 flex items-center justify-between">
                    <span>Safety Interlocks</span>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] ${isHighContrast ? "bg-white text-black" : "bg-white/10 text-white"}`}
                    >
                      ASAE S474.1
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "PTO Switch", status: "PASS" },
                      { label: "Seat Sensor", status: "PASS" },
                      { label: "Brake Link", status: "PASS" },
                      { label: "ROPS Lock", status: "PASS" },
                    ].map((check) => (
                      <div
                        key={check.label}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 text-center gap-2 ${isHighContrast ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/10"}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                          <CheckCircle2 size={16} strokeWidth={3} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest leading-tight">
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 max-w-3xl mx-auto space-y-8 h-full flex flex-col">
                <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4">
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
                      className={`text-[10px] font-bold uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-white/40"}`}
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
            className={`rounded-[40px] border-8 w-full max-w-xl overflow-hidden shadow-2xl ${isHighContrast ? "bg-white border-black text-black" : "bg-zinc-900 border-rose-500 text-white"}`}
          >
            <div
              className={`p-8 border-b-4 flex justify-between items-center ${isHighContrast ? "bg-yellow-400 border-black" : "bg-rose-500/10 border-rose-500/30"}`}
            >
              <h3 className="text-3xl font-black tracking-tighter italic uppercase">
                Report Issue
              </h3>
              <button
                onClick={() => setShowIncidentModal(false)}
                className={`p-2 rounded-xl border-4 hover:scale-105 transition-transform ${isHighContrast ? "border-black text-black" : "border-rose-500/50 text-rose-500"}`}
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
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
              className={`p-8 border-t-4 flex justify-end gap-4 ${isHighContrast ? "border-black bg-yellow-400/10" : "border-white/10 bg-black/50"}`}
            >
              <button
                onClick={() => setShowIncidentModal(false)}
                className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl border-4 ${isHighContrast ? "border-black text-black hover:bg-black/5" : "border-white/20 text-white/60 hover:text-white hover:bg-white/5"}`}
              >
                Cancel
              </button>
              <button
                onClick={handleReportIncident}
                disabled={!incidentReport.trim()}
                className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl border-4 disabled:opacity-50 disabled:grayscale transition-transform hover:scale-105 active:scale-95 ${isHighContrast ? "bg-black border-black text-white" : "bg-rose-600 border-rose-500 text-white hover:bg-rose-500"}`}
              >
                Transmit Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
