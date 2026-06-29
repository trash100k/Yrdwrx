// @ts-nocheck
import { compressImage } from "../lib/imageUtils";
import { fetchApi } from "../lib/api";

import React, { useEffect, useState, useRef } from "react";
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
  Map as MapIcon,
  ClipboardList,
  Mic,
  Square,
  Play,
} from "lucide-react";
import { useFieldMode } from "../contexts/FieldModeContext";
import { jobsRepo, inspectionFormsRepo, customersRepo } from "../lib/repos";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import JobMap from "./JobMap";

import { useLocalStorage } from "../hooks/useLocalStorage";
import { useAuditLog } from "../hooks/useAuditLog";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

export default function FieldModeInterface() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const { toggleFieldMode, missionPackage } = useFieldMode();
  const { logAction } = useAuditLog();

  const [activeJob, setActiveJob] = useState<Record<string, unknown> | null>(
    null,
  );
  const [openJobs, setOpenJobs] = useState<Record<string, unknown>[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Voice note dictation for the Comms tab.
  const {
    transcript: noteTranscript,
    isListening: isRecordingNote,
    startListening: startNoteDictation,
    stopListening: stopNoteDictation,
    setTranscript: setNoteTranscript,
  } = useSpeechRecognition();
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<"comms" | "map" | "documentation" | "checklist">(
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

  const [inspectionForms, setInspectionForms] = useState<any[]>([]);
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!tenant) return;
    const unsub = inspectionFormsRepo.subscribe((rows) => setInspectionForms(rows || []));
    return () => unsub();
  }, [tenant]);

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
    
    // Check if mandatory forms are filled
    const activeForms = inspectionForms.filter((f: any) => !f.jobType || activeJob?.title?.toLowerCase().includes(f.jobType.toLowerCase()));
    for (const form of activeForms) {
      for (const field of form.fields || []) {
        if (field.required && !formResponses[`${form.id}_${field.id}`]) {
           showToast(`Please complete mandatory task: ${field.label}`, "error");
           setActiveTab("checklist");
           return;
        }
      }
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
      await jobsRepo.update(activeJob.id, {
        status: "COMPLETED",
        data: {
          ...(activeJob.data || {}),
          completedAt: new Date().toISOString(),
          arrivalPhotoUrl: arrivalPhoto,
          departurePhotoUrl: departurePhoto,
          snapshotNotes: snapshotResult?.notes || "",
          varianceFound: snapshotResult?.varianceFound || false,
          inspectionResponses: formResponses,
        },
      });
      logAction("Field Mode", "Job Completed", `Completed Job ID: ${activeJob.id} (${activeJob.title || "Unknown Job"})`);
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

  const handleReportIncident = async () => {
    const text = incidentReport.trim();
    if (!text) return;
    if (!activeJob) {
      showToast("No active job to attach this incident to.", "error");
      return;
    }
    const incident = { text, ts: new Date().toISOString() };
    try {
      const existing = (activeJob.data as any) || {};
      await jobsRepo.update(activeJob.id, {
        data: {
          ...existing,
          incidents: [...(existing.incidents || []), incident],
        },
      });
      logAction("Field Mode", "Incident Reported", `Job ID: ${activeJob.id} — ${text}`);
      showToast("Incident reported to dispatch.");
    } catch (e) {
      console.error(e);
      showToast("Error reporting incident", "error");
    } finally {
      setIncidentReport("");
      setShowIncidentModal(false);
    }
  };

  // Manually pick the active job from the open queue (picker).
  const selectJob = (id: string) => {
    const job = openJobs.find((j) => j.id === id) || null;
    activeJobIdRef.current = id;
    setActiveJobId(id);
    setActiveJob(job);
  };

  // Start the active job: move SCHEDULED -> IN_PROGRESS.
  const handleStartJob = async () => {
    if (!activeJob || isStarting) return;
    setIsStarting(true);
    try {
      await jobsRepo.update(activeJob.id, {
        status: "IN_PROGRESS",
        data: {
          ...((activeJob.data as any) || {}),
          startedAt: new Date().toISOString(),
        },
      });
      setActiveJob((prev) => (prev ? { ...prev, status: "IN_PROGRESS" } : prev));
      logAction("Field Mode", "Job Started", `Job ID: ${activeJob.id} (${activeJob.title || "Unknown Job"})`);
      showToast("Job started.");
    } catch (e) {
      console.error(e);
      showToast("Error starting job", "error");
    } finally {
      setIsStarting(false);
    }
  };

  // Toggle dictation for a field voice note; persist transcript to the job on stop.
  const toggleVoiceNote = () => {
    if (isRecordingNote) {
      stopNoteDictation();
      void saveVoiceNote();
    } else {
      startNoteDictation();
    }
  };

  const saveVoiceNote = async () => {
    const text = (noteTranscript || "").trim();
    if (!text) return;
    if (!activeJob) {
      showToast("No active job to attach this note to.", "error");
      return;
    }
    setIsSavingNote(true);
    const note = { text, ts: new Date().toISOString(), author: "Field" };
    try {
      const existing = (activeJob.data as any) || {};
      await jobsRepo.update(activeJob.id, {
        data: {
          ...existing,
          fieldNotes: [...(existing.fieldNotes || []), note],
        },
      });
      // Optimistically reflect in the active job so the log re-renders immediately.
      setActiveJob((prev) =>
        prev
          ? {
              ...prev,
              data: {
                ...((prev.data as any) || {}),
                fieldNotes: [...(((prev.data as any) || {}).fieldNotes || []), note],
              },
              fieldNotes: [...((prev.fieldNotes as any[]) || []), note],
            }
          : prev,
      );
      logAction("Field Mode", "Field Note", `Job ID: ${activeJob.id} — ${text}`);
      showToast("Field note saved.");
    } catch (e) {
      console.error(e);
      showToast("Error saving note", "error");
    } finally {
      setNoteTranscript("");
      setIsSavingNote(false);
    }
  };

  useEffect(() => {
    // jobs has no columns for photos/notes/gate code — those live in the job's `data` jsonb.
    // Flatten the job's own `data` jsonb (so job.gateCode / job.hoaRules from the job work),
    // then map the snake_case `customer_id` column to camelCase `customerId` for the
    // customer backfill below (the raw row spread can carry the snake_case key only).
    const adaptJob = (r) => {
      const j = { ...(r?.data || {}), ...r };
      if (j.customerId == null && r?.customer_id != null) j.customerId = r.customer_id;
      return j;
    };
    // RLS scopes to tenant — no tenantId filter needed.
    const unsub = jobsRepo.subscribe((rows) => {
      const open = (rows || []).map(adaptJob)
        .filter(j => j.status === "SCHEDULED" || j.status === "IN_PROGRESS")
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
      setOpenJobs(open);
      // Respect a manually-picked job; otherwise default to the first open job.
      const picked = activeJobIdRef.current;
      const job = (picked && open.find((j) => j.id === picked)) || open[0] || null;
      activeJobIdRef.current = job?.id || null;
      setActiveJobId(job?.id || null);
      setActiveJob(job);
      setIsLoading(false);
      // Surface the client's gate code + HOA rules from the linked customer.
      // (The agent's set_gate_code writes the code to the customer's data.gateCode; HOA
      // rules live in data.hoaRules and is_hoa is a real column camelized to isHoa.)
      if (job?.customerId) {
        customersRepo.getById(job.customerId).then((row) => {
          if (!row) return;
          // Flatten: data jsonb fields + camelCase top-level columns.
          const c = { ...(row.data || {}), ...row };
          setActiveJob((prev) => (prev && prev.id === job.id) ? {
            ...prev,
            gateCode: prev.gateCode || c.gateCode || null,
            hoaRules: (Array.isArray(prev.hoaRules) && prev.hoaRules.length) ? prev.hoaRules : (c.hoaRules || null),
            isHOA: prev.isHOA || c.isHoa || false,
          } : prev);
        }).catch(() => {});
      }
    });
    return () => unsub();
  }, [tenant]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center space-y-4 z-[200]">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-forest-600 rounded-full animate-spin" />
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
            className={`text-xs md:text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-forest-400"}`}
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
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 text-xs md:text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "border-black text-black bg-white" : "border-forest-500/30 text-forest-400 bg-forest-500/10"}`}
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
                        isHighContrast ? "text-black" : "text-forest-400"
                      }
                    />
                    <p className="text-xl font-bold uppercase tracking-tight">
                      {activeJob.address}
                    </p>
                  </div>

                  {/* Job picker — when more than one open job is in the queue. */}
                  {openJobs.length > 1 && (
                    <div className="space-y-2">
                      <label
                        className={`block font-black uppercase tracking-widest text-xs ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                      >
                        Active Assignment ({openJobs.length} in queue)
                      </label>
                      <select
                        value={activeJobId || ""}
                        onChange={(e) => selectJob(e.target.value)}
                        className={`w-full p-4 rounded-2xl border-4 outline-none font-black text-base uppercase tracking-tight ${isHighContrast ? "bg-white border-black text-black" : "bg-zinc-900 border-white/20 text-white focus:border-forest-500/50"}`}
                      >
                        {openJobs.map((j: any) => (
                          <option key={j.id} value={j.id}>
                            {(j.title || "Untitled Job")}{" — "}{j.status === "IN_PROGRESS" ? "In Progress" : "Scheduled"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Start Job — only when the active job hasn't begun. */}
                  {activeJob.status === "SCHEDULED" && (
                    <button
                      onClick={handleStartJob}
                      disabled={isStarting}
                      className={`w-full flex items-center justify-center gap-3 p-5 rounded-3xl border-4 font-black uppercase tracking-widest text-base transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale ${isHighContrast ? "bg-black border-black text-white shadow-[6px_6px_0_0_#000]" : "bg-forest-600 border-forest-500 text-white shadow-[0_0_20px_rgba(5,168,69,0.4)]"}`}
                    >
                      {isStarting ? (
                        <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Play size={24} />
                      )}
                      Start Job
                    </button>
                  )}
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
                      {Array.isArray(activeJob.hoaRules) && activeJob.hoaRules.length > 0 ? (
                        <ul className="space-y-2">
                          {activeJob.hoaRules.map((rule, i) => (
                            <li
                              key={i}
                              className="font-bold text-lg leading-tight uppercase flex items-start gap-2"
                            >
                              <span className="mt-1.5 shrink-0">&bull;</span>
                              <span>{rule}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-bold text-lg leading-tight uppercase">
                          HOA property. Observe community rules.
                        </p>
                      )}
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
              onClick={() => setActiveTab("documentation")}
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
              className={`flex flex-col items-center justify-center p-5 sm:p-8 min-h-[120px] gap-2 rounded-3xl border-4 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale ${isHighContrast ? "bg-black border-black text-white shadow-[6px_6px_0_0_#000]" : "bg-forest-600 border-forest-500 text-white shadow-[0_0_20px_rgba(5,168,69,0.4)]"}`}
            >
              {isFinishing ? (
                <div
                  className={`w-8 h-8 border-4 rounded-full animate-spin ${isHighContrast ? "border-white/20 border-t-white" : "border-forest-300 border-t-white"}`}
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
              className={`flex items-center justify-center gap-3 flex-1 h-full font-black text-sm uppercase tracking-widest transition-colors border-b-4 ${activeTab === "comms" ? (isHighContrast ? "border-black text-black" : "border-forest-500 text-white") : "border-transparent text-gray-500"}`}
            >
              <ClipboardList size={20} />
              <span className="hidden sm:inline">Comms</span>
            </button>
            <button
              onClick={() => setActiveTab("map")}
              className={`flex items-center justify-center gap-3 flex-1 h-full font-black text-sm uppercase tracking-widest transition-colors border-b-4 ${activeTab === "map" ? (isHighContrast ? "border-black text-black" : "border-forest-500 text-white") : "border-transparent text-gray-500"}`}
            >
              <MapIcon size={20} />
              <span className="hidden sm:inline">Map</span>
            </button>
            <button
              onClick={() => setActiveTab("documentation")}
              className={`flex items-center justify-center gap-3 flex-1 h-full font-black text-sm uppercase tracking-widest transition-colors border-b-4 ${activeTab === "documentation" ? (isHighContrast ? "border-black text-black" : "border-forest-500 text-white") : "border-transparent text-gray-500"}`}
            >
              <Camera size={20} />
              <span className="hidden sm:inline">Verification</span>
            </button>
            <button
              onClick={() => setActiveTab("checklist")}
              className={`flex items-center justify-center gap-3 flex-1 h-full font-black text-sm uppercase tracking-widest transition-colors border-b-4 ${activeTab === "checklist" ? (isHighContrast ? "border-black text-black" : "border-forest-500 text-white") : "border-transparent text-gray-500"}`}
            >
              <ClipboardList size={20} />
              <span className="hidden sm:inline">Tasks</span>
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
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-forest-500">
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
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const base64 = await compressImage(file, 1200, 1200, 0.8);
                                  setArrivalPhoto(base64);
                                } catch(err) {
                                  console.error("Compression error:", err);
                                }
                              }
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
                          isHighContrast ? "text-black" : "text-forest-400"
                        }
                        size={20}
                      />
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center">
                      {departurePhoto ? (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-forest-500">
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
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const base64 = await compressImage(file, 1200, 1200, 0.8);
                                  setDeparturePhoto(base64);
                                } catch(err) {
                                  console.error("Compression error:", err);
                                }
                              }
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
            ) : activeTab === "checklist" ? (
              <div className="p-5 sm:p-8 max-w-4xl mx-auto space-y-8 h-full overflow-y-auto custom-scrollbar">
                <header className="flex items-end justify-between border-b-4 border-black/10 pb-4">
                  <div>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black italic uppercase tracking-normal md:tracking-tighter leading-none mb-2">
                      Inspection Tasks
                    </h2>
                    <p
                      className={`text-xs md:text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                    >
                      Mandatory Forms for {activeJob?.title || "Active Job"}
                    </p>
                  </div>
                </header>

                <div className="space-y-6">
                   {inspectionForms.filter((f: any) => !f.jobType || activeJob?.title?.toLowerCase().includes(f.jobType.toLowerCase())).map((form: any) => (
                     <div key={form.id} className={`p-6 rounded-2xl border-4 ${isHighContrast ? "bg-white border-black shadow-[8px_8px_0_0_#000]" : "bg-black border-white/20"}`}>
                       <h3 className="font-black text-xl uppercase mb-4 text-forest-500 border-b-2 border-forest-500/20 pb-2">{form.jobType} Form</h3>
                       <div className="space-y-4">
                         {form.fields?.map((field: any) => (
                           <div key={field.id} className="flex flex-col space-y-2">
                             <label className={`text-sm font-bold uppercase tracking-wider ${isHighContrast ? "text-black" : "text-white"}`}>
                               {field.label} {field.required && <span className="text-rose-500">*</span>}
                             </label>
                             {field.type === "checkbox" ? (
                               <label className="flex items-center gap-3 cursor-pointer">
                                 <input
                                   type="checkbox"
                                   checked={!!formResponses[`${form.id}_${field.id}`]}
                                   onChange={(e) => setFormResponses({ ...formResponses, [`${form.id}_${field.id}`]: e.target.checked })}
                                   className={`w-8 h-8 rounded-lg border-4 ${isHighContrast ? "border-black accent-black" : "border-white/20 accent-forest-500"}`}
                                 />
                                 <span className="font-bold text-sm uppercase">Complete</span>
                               </label>
                             ) : field.type === "image" ? (
                               formResponses[`${form.id}_${field.id}`] ? (
                                 <div className="relative w-full max-w-sm aspect-video rounded-xl overflow-hidden border-4 border-forest-500">
                                   <img src={formResponses[`${form.id}_${field.id}`]} alt={field.label} className="w-full h-full object-cover" />
                                   <button
                                     onClick={() => setFormResponses({ ...formResponses, [`${form.id}_${field.id}`]: undefined })}
                                     className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-rose-500 transition-colors"
                                   >
                                     <X size={16} />
                                   </button>
                                 </div>
                               ) : (
                                 <label className={`w-full max-w-sm aspect-video rounded-xl border-4 border-dashed flex flex-col items-center justify-center cursor-pointer ${isHighContrast ? "border-black bg-black/5" : "border-white/20 bg-white/5"}`}>
                                   <Camera size={24} className="mb-2 opacity-50" />
                                   <span className="font-bold uppercase text-[10px] opacity-70 px-2 text-center">Capture specific photo</span>
                                   <input
                                     type="file"
                                     accept="image/*"
                                     capture="environment"
                                     className="hidden"
                                     onChange={async (e) => {
                                       const file = e.target.files?.[0];
                                       if (file) {
                                         try {
                                           const base64 = await compressImage(file, 1200, 1200, 0.8);
                                           setFormResponses((prev) => ({ ...prev, [`${form.id}_${field.id}`]: base64 }));
                                         } catch (err) {
                                           console.error("Compression error:", err);
                                         }
                                       }
                                     }}
                                   />
                                 </label>
                               )
                             ) : (
                               <input
                                 type={field.type === "number" ? "number" : "text"}
                                 value={formResponses[`${form.id}_${field.id}`] || ""}
                                 onChange={(e) => setFormResponses({ ...formResponses, [`${form.id}_${field.id}`]: e.target.value })}
                                 className={`w-full p-4 rounded-xl border-4 outline-none font-bold text-lg uppercase ${isHighContrast ? "bg-black/5 border-black placeholder:text-black/20 focus:bg-yellow-400/20" : "bg-black border-white/20 placeholder:text-white/20 focus:border-forest-500/50 focus:bg-forest-500/5"}`}
                                 placeholder="ENTER VALUE..."
                               />
                             )}
                           </div>
                         ))}
                       </div>
                     </div>
                   ))}
                   {inspectionForms.filter((f: any) => !f.jobType || activeJob?.title?.toLowerCase().includes(f.jobType.toLowerCase())).length === 0 && (
                     <div className={`p-8 text-center rounded-2xl border-4 border-dashed ${isHighContrast ? "border-black bg-black/5" : "border-white/20 bg-white/5"}`}>
                       <h3 className="font-black uppercase tracking-widest text-lg opacity-50">No Active Forms</h3>
                       <p className="font-bold uppercase text-xs opacity-40 mt-2">No mandatory checklist assigned for this job type.</p>
                     </div>
                   )}
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-8 max-w-3xl mx-auto space-y-8 h-full flex flex-col">
                <h2 className="text-2xl sm:text-3xl sm:text-4xl font-black italic uppercase tracking-normal md:tracking-tighter mb-4">
                  Comms Log
                </h2>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                  {(() => {
                    const notes = ((activeJob?.data as any)?.fieldNotes || (activeJob?.fieldNotes as any[])) || [];
                    if (!notes.length) {
                      return (
                        <div
                          className={`p-8 text-center rounded-3xl border-4 border-dashed ${isHighContrast ? "border-black bg-black/5" : "border-white/20 bg-white/5"}`}
                        >
                          <h3 className="font-black uppercase tracking-widest text-lg opacity-50">
                            No Field Notes Yet
                          </h3>
                          <p className="font-bold uppercase text-xs opacity-40 mt-2">
                            Tap the mic below to dictate a note for this job.
                          </p>
                        </div>
                      );
                    }
                    return notes.map((n: any, i: number) => (
                      <div
                        key={n.ts || i}
                        className={`p-6 rounded-3xl border-4 ${isHighContrast ? "bg-white border-black" : "bg-white/5 border-white/10"}`}
                      >
                        <p className="font-bold text-lg uppercase">{n.text}</p>
                        {n.ts && (
                          <p
                            className={`text-[10px] font-black uppercase tracking-widest mt-2 ${isHighContrast ? "text-black/50" : "text-white/30"}`}
                          >
                            {n.author || "Field"} · {new Date(n.ts).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ));
                  })()}
                  {isRecordingNote && (
                    <div
                      className={`p-6 rounded-3xl border-4 border-dashed animate-pulse ${isHighContrast ? "bg-white border-black" : "bg-forest-500/10 border-forest-500/40"}`}
                    >
                      <p className="font-bold text-lg uppercase">
                        {noteTranscript || "Listening..."}
                      </p>
                    </div>
                  )}
                </div>
                <div
                  className={`rounded-3xl border-4 p-4 flex items-center gap-4 ${isHighContrast ? "bg-white border-black shadow-[8px_8px_0_0_#000]" : "bg-zinc-900 border-white/20"}`}
                >
                  <div className="flex-1">
                    <h3 className="font-black uppercase text-lg">
                      {isRecordingNote ? "Listening — Tap to Save" : "Leave Audio Note"}
                    </h3>
                    <p
                      className={`text-xs md:text-[10px] font-bold uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-white/40"}`}
                    >
                      Syncs to dispatch console
                    </p>
                  </div>
                  <button
                    onClick={toggleVoiceNote}
                    disabled={isSavingNote || !activeJob}
                    className={`flex items-center justify-center w-16 h-16 rounded-2xl border-4 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 ${isRecordingNote ? "bg-rose-500 border-rose-400 text-white animate-pulse" : isHighContrast ? "bg-forest-400 border-black text-black" : "bg-forest-600 border-forest-400 text-white"}`}
                  >
                    {isSavingNote ? (
                      <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isRecordingNote ? (
                      <Square size={28} fill="currentColor" />
                    ) : (
                      <Mic size={28} />
                    )}
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
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isHighContrast ? "bg-black text-white" : "bg-forest-500/20 text-forest-400"}`}>
                  <Camera size={24} />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight">Project Snapshot</h3>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-forest-400"}`}>AI Quality & Variance Check</p>
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
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        const base64 = await compressImage(file, 1200, 1200, 0.8);
                                        handleProcessSnapshot(base64);
                                      } catch(err) {
                                        console.error("Compression error:", err);
                                      }
                                    }
                                }}
                            />
                        </label>
                    </div>
                ) : isAnalyzingSnapshot ? (
                    <div className="flex flex-col items-center justify-center space-y-6 py-12">
                        <div className={`w-24 h-24 border-8 rounded-full animate-spin ${isHighContrast ? "border-black/10 border-t-black" : "border-forest-500/20 border-t-forest-500"}`} />
                        <div className="text-center">
                            <h4 className={`text-xl font-black uppercase tracking-tight mb-2 ${isHighContrast ? "text-black" : "text-white"}`}>Analyzing Snapshot</h4>
                            <p className={`text-xs font-bold uppercase tracking-widest ${isHighContrast ? "text-black/60" : "text-forest-400"}`}>Cross-referencing with standard quality plans...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <img src={departurePhoto!} alt="Snapshot" className="w-full aspect-video object-cover rounded-2xl border-4 border-black/10" />
                        
                        <div className={`p-6 rounded-2xl border-4 ${snapshotResult.varianceFound ? (isHighContrast ? "border-black bg-amber-400" : "border-amber-500/50 bg-amber-500/10") : (isHighContrast ? "border-black bg-forest-400" : "border-forest-500/50 bg-forest-500/10")}`}>
                            <div className="flex items-center gap-3 mb-4">
                                {snapshotResult.varianceFound ? <AlertTriangle size={24} className={isHighContrast ? "text-black" : "text-amber-500"} /> : <CheckCircle2 size={24} className={isHighContrast ? "text-black" : "text-forest-500"} />}
                                <h4 className={`text-lg font-black uppercase tracking-tight ${isHighContrast ? "text-black" : (snapshotResult.varianceFound ? "text-amber-500" : "text-forest-500")}`}>
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
                    className={`px-8 py-4 text-xs md:text-[10px] font-black uppercase tracking-widest rounded-2xl border-4 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 ${isHighContrast ? "bg-black border-black text-white" : "bg-forest-600 border-forest-500 text-white shadow-[0_0_20px_rgba(5,168,69,0.4)]"}`}
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
