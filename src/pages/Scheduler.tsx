// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Plus,
  Settings2,
  Trash2,
  Zap,
} from "lucide-react";
import { jobsRepo, invoicesRepo, customersRepo } from "../lib/repos";
import { runAutomations } from "../lib/automations";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { Job } from "../types";

// Surface Firestore-only job fields (client/time/invoiceId) that live in the `data`
// jsonb on Supabase. Spread `data` first so real columns win on key collisions.
const adaptJob = (r: any): Job => ({ ...(r?.data || {}), ...r });

// Map a camelCase Job to a Supabase `jobs` row. Fields without a column
// (client/time/invoiceId) are nested into `data`; tenant/timestamps are
// stamped server-side (RLS / column defaults) so we drop them here.
const toJobRow = (j: any) => ({
  title: j.title,
  status: j.status,
  date: j.date,
  address: j.address,
  notes: j.notes,
  progress: j.progress,
  checklist: j.checklist,
  revenue: j.revenue,
  customerId: j.customerId,
  assignedTo: j.assignedTo,
  data: { client: j.client, time: j.time, invoiceId: j.invoiceId, ...(j.data || {}) },
});

import { VoiceMemoJobModal } from "../components/VoiceMemoJobModal";
import { useRole } from "../hooks/useRole";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { INITIAL_SERVICE_CATALOG } from "../lib/constants";

// Parse an "HH:MM" string into minutes-since-midnight, or null if unparseable.
const timeToMinutes = (t?: string): number | null => {
  if (!t || typeof t !== "string") return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min)) return null;
  return h * 60 + min;
};

// Format minutes-since-midnight as a friendly "9:00 AM".
const minutesToLabel = (mins: number): string => {
  const h24 = Math.floor(mins / 60);
  const min = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
};

// Resolve the earliest-allowed service time (in minutes) for an HOA customer's `data`.
// Prefers an explicit quietHoursStart ("HH:MM"); otherwise scans hoaRules for a
// "...before 9 am..." style phrase and parses the hour.
const hoaEarliestStartMinutes = (data: any): number | null => {
  if (!data) return null;
  const explicit = timeToMinutes(data.quietHoursStart);
  if (explicit != null) return explicit;
  const rules: string[] = Array.isArray(data.hoaRules) ? data.hoaRules : [];
  for (const rule of rules) {
    if (typeof rule !== "string") continue;
    const m = rule.match(/before\s+(\d{1,2})\s*(am)?/i);
    if (m) {
      let hour = parseInt(m[1], 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) return hour * 60;
    }
  }
  return null;
};

export default function Scheduler() {
  const { tenant } = useTenant();
  const { hasPermission } = useRole();
  const { showToast } = useToast();
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  // Lightweight reschedule control: holds the job being re-dated + its draft date/time.
  const [reschedulingJob, setReschedulingJob] = useState<any>(null);
  const [rescheduleDraft, setRescheduleDraft] = useState<{ date: string; time: string }>({ date: "", time: "" });
  const [newJob, setNewJob] = useState<Partial<Job>>({
    title: "",
    status: "SCHEDULED",
  });
  const [autoInvoice, setAutoInvoice] = useState(true);

  const availableSlots = React.useMemo(() => {
    if (!newJob.date) return [];
    const workHours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
    const jobsOnDate = activeJobs.filter(j => j.date === newJob.date);
    return workHours.filter(time => !jobsOnDate.some(j => j.time === time));
  }, [newJob.date, activeJobs]);

  const categories = tenant?.settings?.serviceCatalog || INITIAL_SERVICE_CATALOG;
  
  const addModalRef = useFocusTrap<HTMLDivElement>(showAddModal);

  useEffect(() => {
    // RLS scopes jobs to the caller's tenant, so no tenantId filter is needed.
    const unsubscribe = jobsRepo.subscribe((rows) =>
      setActiveJobs((rows || []).map(adaptJob)),
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleVoiceAction = (e: CustomEvent) => {
      const { name, args } = e.detail;
      if (name === "schedule_job") {
        setNewJob((prev) => ({
          ...prev,
          title: args.serviceType || "New Job",
          client: args.clientName || "",
          dateTime: args.date ? new Date(args.date).toISOString() : new Date().toISOString()
        }));
        setShowAddModal(true);
      }
    };

    window.addEventListener("cutty-action", handleVoiceAction as EventListener);
    return () => window.removeEventListener("cutty-action", handleVoiceAction as EventListener);
  }, []);

  // HOA quiet-hours guardrail: warn (don't block) when a job is being scheduled for an
  // HOA customer before their earliest-allowed service window. Reuses customer data the
  // job already carries, or fetches via customersRepo.getById when only customerId is known.
  const checkHoaQuietHours = async (job: Partial<Job>) => {
    const startTime = job.time;
    if (!startTime) return; // no chosen start time -> nothing to compare
    const chosenMinutes = timeToMinutes(startTime);
    if (chosenMinutes == null) return;

    // Prefer customer data already on the job; otherwise fetch by customerId.
    let customer: any = null;
    if (job.customerId) {
      try {
        customer = await customersRepo.getById(job.customerId);
      } catch {
        customer = null;
      }
    }
    if (!customer) return; // free-text client with no linked customer record -> can't verify HOA status
    if (!customer.isHoa) return;

    const earliest = hoaEarliestStartMinutes(customer.data);
    const threshold = earliest != null ? earliest : 9 * 60; // default no-service-before 9:00 AM
    if (chosenMinutes < threshold) {
      const who =
        customer.companyName ||
        [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
        job.client ||
        "This client";
      showToast(
        `⚠ ${who} is an HOA — no service before ${minutesToLabel(threshold)}`,
        "warning",
      );
    }
  };

  const handleAddJob = async () => {
    if (!newJob.title) return;

    // Warn (non-blocking) about HOA quiet-hours before scheduling.
    await checkHoaQuietHours(newJob);

    let invoiceId = "";
    if (autoInvoice) {
       const invPrice = categories.flatMap(cat => cat.services).find(s => s.name === newJob.title)?.price || 150;
       // Supabase invoices: free-text client name lives in the data jsonb (no column); RLS stamps tenant.
       const invRow = await invoicesRepo.create({
          amount: invPrice,
          items: [{ description: newJob.title, quantity: 1, rate: invPrice }],
          status: "sent",
          data: { client: newJob.client || "Unknown Client" },
       });
       invoiceId = invRow?.id || "";
    }

    await jobsRepo.create(toJobRow({ ...newJob, invoiceId }));
    setShowAddModal(false);
    setNewJob({ title: "", status: "SCHEDULED" });
  };

  const handleStatusChange = async (
    jobId: string,
    newStatus: Job["status"],
  ) => {
    await jobsRepo.update(jobId, { status: newStatus });

    // When a job is marked COMPLETED, fire the automation engine (fire-and-forget;
    // must never throw into this code path).
    if (newStatus === "COMPLETED") {
      const job = activeJobs.find((j) => j.id === jobId);
      runAutomations("job_completed", {
        clientName: job?.client,
        customerId: job?.customerId,
        jobId,
        title: job?.title,
      }).catch(() => {});
    }
  };

  // Open the inline reschedule editor for a job, seeded with its current date/time.
  const openReschedule = (job: any) => {
    setReschedulingJob(job);
    setRescheduleDraft({ date: job.date || "", time: job.time || "" });
  };

  // Persist a new date/time. `time` lives in the job's `data` jsonb (no column), so we
  // merge it back into the existing data bag; `date` is a real column.
  const handleReschedule = async () => {
    if (!reschedulingJob || !rescheduleDraft.date) return;
    const job = reschedulingJob;

    // Reuse the HOA quiet-hours guardrail against the new time (warn, don't block).
    await checkHoaQuietHours({ ...job, date: rescheduleDraft.date, time: rescheduleDraft.time });

    try {
      await jobsRepo.update(job.id, {
        date: rescheduleDraft.date,
        data: { ...(job.data || {}), client: job.client, invoiceId: job.invoiceId, time: rescheduleDraft.time || undefined },
      });
      showToast("Job rescheduled", "success");
    } catch (err: any) {
      console.error("Failed to reschedule job", err);
      showToast(`Reschedule failed: ${err.message || "unknown error"}`, "error");
    } finally {
      setReschedulingJob(null);
      setRescheduleDraft({ date: "", time: "" });
    }
  };

  const statusColors = {
    PENDING: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    SCHEDULED: "text-celtic-400 bg-celtic-400/10 border-celtic-400/20",
    IN_PROGRESS: "text-ember-400 bg-ember-400/10 border-ember-400/20",
    COMPLETED: "text-forest-400 bg-forest-400/10 border-forest-400/20",
    CANCELED: "text-red-400 bg-red-400/10 border-red-400/20",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-40 relative z-10">
      {tenant?.settings?.features?.cockpit_buttons && (
        <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => setShowAddModal(true)} className="flex flex-col items-center justify-center gap-2 p-6 bg-celtic-500/10 border border-celtic-500/20 rounded-[20px] text-celtic-400 hover:bg-celtic-500/20 transition-all shadow-sm">
            <Plus size={24} className="hover:scale-110 transition-transform" />
            <span className="font-bold text-sm">Quick Deploy</span>
          </button>
          <div className="flex flex-col items-center justify-center gap-2 p-6 bg-zinc-900 border border-white/5 molten-edge rounded-[20px] text-zinc-400 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
             <Zap size={24} className="text-yellow-400 animate-pulse" />
             <span className="font-bold text-sm text-yellow-400/80">Easy Mode Active</span>
          </div>
        </div>
      )}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 lg:gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-celtic-500/10 rounded-full border border-celtic-500 text-xs font-black uppercase tracking-widest text-celtic-500">
            <Settings2 size={16} />
            Operations Command
          </div>
          <h1 className="text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Scheduler
          </h1>
          <p className="max-w-xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            Active Routing & Dispatch
          </p>
        </div>
        {hasPermission("dispatcher") && (
            <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-3 px-4 sm:px-8 py-3 sm:py-5 bg-white text-black font-semibold text-sm rounded-xl shadow-sm border border-transparent hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
            >
            <Plus size={24} />{" "}
            <span className="hidden sm:inline">Deploy Unit</span>
            </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 relative z-10">
        {/* Left Column: Board */}
        <div className="lg:col-span-2 space-y-6">
          {(["IN_PROGRESS", "SCHEDULED", "PENDING"] as const).map(
            (statusGroup) => {
              const jobsInGroup = activeJobs.filter(
                (j) => j.status === statusGroup,
              );
              if (jobsInGroup.length === 0) return null;
              return (
                <div key={statusGroup} className="space-y-4">
                  <h3 className="text-sm font-black text-white/40 uppercase tracking-widest mb-4">
                    {statusGroup.replace("_", " ")}
                  </h3>
                  {jobsInGroup.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="relative overflow-hidden p-6 bg-zinc-900/40 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-6 group cursor-pointer"
                    >
                      {typeof job.progress === 'number' && (
                        <>
                          <div 
                             className="absolute top-0 left-0 h-full bg-forest-500/5 transition-all duration-1000 ease-out z-0 pointer-events-none"
                             style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                          />
                          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/40 z-10">
                            <div 
                               className="h-full bg-forest-500 transition-all duration-1000 ease-out"
                               style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                            />
                          </div>
                        </>
                      )}
                      
                      <div className="relative z-10 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                          <h4 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight group-hover:text-amber-400 transition-colors">
                            {job.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-4 mt-3">
                            {job.client && (
                              <span className="text-sm font-bold text-white/50">
                                {job.client}
                              </span>
                            )}
                            {job.address && (
                              <span className="flex items-center gap-1 text-xs font-bold text-white/40 bg-black/40 px-3 py-1 rounded-full">
                                <MapPin size={12} /> {job.address}
                              </span>
                            )}
                            {job.date && (
                              <span className="flex items-center gap-1 text-xs font-bold text-white/40 bg-black/40 px-3 py-1 rounded-full">
                                <CalendarIcon size={12} /> {job.date}
                              </span>
                            )}
                            {typeof job.progress === 'number' && (
                               <span className="flex items-center gap-1 text-xs font-black text-forest-400 bg-forest-500/10 px-3 py-1 rounded-full border border-forest-500/20">
                                 {Math.round(job.progress)}% COMPLETED
                               </span>
                            )}
                          </div>
                          {(job.checklist?.length || job.notes) && (
                              <div className="flex items-center gap-4 mt-4">
                                  {job.checklist && job.checklist.length > 0 && (
                                      <div className="flex items-center gap-2 text-xs font-bold text-white/40 bg-zinc-800/80 px-3 py-1.5 rounded-xl">
                                          <div className="w-2 h-2 rounded-full bg-forest-400" />
                                          <span>Tasks: {job.checklist.filter(c => c.completed).length} / {job.checklist.length}</span>
                                      </div>
                                  )}
                                  {job.notes && (
                                      <div className="flex items-center gap-2 text-xs font-bold text-white/40 bg-zinc-800/80 px-3 py-1.5 rounded-xl">
                                          <div className="w-2 h-2 rounded-full bg-celtic-400" />
                                          <span>Notes Logged</span>
                                      </div>
                                  )}
                              </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReschedule(job);
                            }}
                            className="px-4 py-2 bg-black border border-white/10 hover:border-celtic-400/40 hover:text-white text-white/60 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5"
                            title="Edit job date / time"
                          >
                            <CalendarIcon size={12} /> Reschedule
                          </button>
                          <select
                            value={job.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleStatusChange(
                                job.id,
                                e.target.value as Job["status"],
                              )
                            }
                            className={`px-4 py-2 bg-black border ${statusColors[job.status]} rounded-xl text-xs font-black uppercase tracking-widest outline-none cursor-pointer appearance-none text-center`}
                          >
                            <option value="PENDING">Pending</option>
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELED">Canceled</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            },
          )}
        </div>

        {/* Right Column: Global Meta */}
        <div className="space-y-6 sm:space-y-8">
          <div className="p-6 sm:p-8 bg-zinc-900/80 border border-white/5 rounded-2xl sticky top-6">
            <h3 className="text-xl font-black text-white italic uppercase tracking-normal md:tracking-tighter mb-6">
              Metrics
            </h3>
            <div className="space-y-6">
              <div>
                <span className="text-xs md:text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 block">
                  Units Deployed
                </span>
                <span className="text-2xl sm:text-3xl sm:text-4xl font-black text-white italic">
                  {activeJobs.filter((j) => j.status === "IN_PROGRESS").length}
                </span>
              </div>
              <div>
                <span className="text-xs md:text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 block">
                  Queue Depth
                </span>
                <span className="text-2xl sm:text-3xl sm:text-4xl font-black text-white italic">
                  {
                    activeJobs.filter(
                      (j) => j.status === "SCHEDULED" || j.status === "PENDING",
                    ).length
                  }
                </span>
              </div>
              <div className="pt-6 border-t border-white/10">
                <span className="text-xs md:text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 block">
                  Completion rate
                </span>
                <span className="text-2xl sm:text-3xl sm:text-4xl font-black text-forest-400 italic">
                  {activeJobs.length
                    ? Math.round(
                        (activeJobs.filter((j) => j.status === "COMPLETED")
                          .length /
                          activeJobs.length) *
                          100,
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Job Modal */}
      {showAddModal && (
        <div ref={addModalRef} className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/5 molten-edge p-10 rounded-2xl w-full max-w-xl">
            <h2 className="text-xl sm:text-2xl sm:text-3xl font-black text-white italic uppercase mb-8">
              Deploy New Unit
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xs md:text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                  Operation Title
                </label>
                <input
                  type="text"
                  value={newJob.title || ""}
                  onChange={(e) =>
                    setNewJob({ ...newJob, title: e.target.value })
                  }
                  className="w-full bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-celtic-500 outline-none mb-3"
                  placeholder="Describe service..."
                  list="service-list"
                />
                <datalist id="service-list">
                  {categories.flatMap(cat => cat.services).map(service => (
                    <option key={service.name} value={service.name} />
                  ))}
                </datalist>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 pt-2">
                  {categories.map(category => (
                     <div key={category.name}>
                       <h4 className="text-xs md:text-[10px] font-black uppercase text-white/30 tracking-widest mb-2 border-b-2 border-white/5 pb-1">{category.name}</h4>
                       <div className="flex flex-wrap gap-2">
                         {category.services.map(service => (
                          <button
                            key={service.name}
                            onClick={() => setNewJob({ ...newJob, title: service.name })}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg border-2 transition-all flex items-center gap-1 ${
                              newJob.title === service.name
                                ? "bg-forest-500/20 border-forest-500/50 text-forest-400"
                                : "bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/20"
                            }`}
                          >
                            {service.name} <span className="opacity-50 ml-1">${service.price}</span>
                          </button>
                        ))}
                       </div>
                     </div>
                  ))}
                </div>
              </div>
                            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs md:text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={newJob.client || ""}
                    onChange={(e) =>
                      setNewJob({ ...newJob, client: e.target.value })
                    }
                    className="w-full bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-celtic-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                    Job Date & Time
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newJob.date || ""}
                      onChange={(e) =>
                        setNewJob({ ...newJob, date: e.target.value })
                      }
                      className="flex-1 min-w-0 bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white/60 focus:border-celtic-500 outline-none"
                    />
                    <select
                      value={newJob.time || ""}
                      onChange={(e) => setNewJob({ ...newJob, time: e.target.value })}
                      className="flex-1 min-w-0 bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white/60 focus:border-celtic-500 outline-none"
                      disabled={!newJob.date}
                    >
                      <option value="">Select Time</option>
                      {availableSlots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10 mt-4">
                 <input 
                    type="checkbox" 
                    id="autoInvoice" 
                    checked={autoInvoice} 
                    onChange={(e) => setAutoInvoice(e.target.checked)}
                    className="w-5 h-5 accent-forest-500"
                 />
                 <label htmlFor="autoInvoice" className="text-sm font-bold text-white">Auto-Generate Linked Invoice</label>
              </div>
              <div>
                <label className="block text-xs md:text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                  Location Data
                </label>
                <input
                  type="text"
                  value={newJob.address || ""}
                  onChange={(e) =>
                    setNewJob({ ...newJob, address: e.target.value })
                  }
                  className="w-full bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-celtic-500 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-10 p-4 border-t border-white/10">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-8 py-3 text-sm font-black text-white/40 hover:text-white uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddJob}
                className="px-8 py-3 bg-white text-black rounded-xl text-sm font-black uppercase tracking-widest hover:scale-105 transition-transform"
              >
                Deploy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulingJob && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/5 molten-edge p-10 rounded-2xl w-full max-w-md">
            <h2 className="text-xl sm:text-2xl font-black text-white italic uppercase mb-2">
              Reschedule Job
            </h2>
            <p className="text-sm font-bold text-white/40 mb-8 truncate">{reschedulingJob.title}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs md:text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                  New Date
                </label>
                <input
                  type="date"
                  value={rescheduleDraft.date}
                  onChange={(e) => setRescheduleDraft((d) => ({ ...d, date: e.target.value }))}
                  className="w-full min-w-0 bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white/80 focus:border-celtic-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs md:text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                  New Time
                </label>
                <input
                  type="time"
                  value={rescheduleDraft.time}
                  onChange={(e) => setRescheduleDraft((d) => ({ ...d, time: e.target.value }))}
                  className="w-full min-w-0 bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white/80 focus:border-celtic-500 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-10 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setReschedulingJob(null);
                  setRescheduleDraft({ date: "", time: "" });
                }}
                className="px-8 py-3 text-sm font-black text-white/40 hover:text-white uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={!rescheduleDraft.date}
                className="px-8 py-3 bg-white text-black rounded-xl text-sm font-black uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedJob && (
          <VoiceMemoJobModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}
