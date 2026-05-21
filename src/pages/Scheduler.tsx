import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  doc,
  addDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useTenant } from "../contexts/TenantContext";
import { Job } from "../types";

export default function Scheduler() {
  const { tenant } = useTenant();
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newJob, setNewJob] = useState<Partial<Job>>({
    title: "",
    status: "SCHEDULED",
  });

  useEffect(() => {
    const tenantId = tenant?.id || "genesis-1";
    const q = query(collection(db, "jobs"), where("tenantId", "==", tenantId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveJobs(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Job),
      );
    });

    return () => unsubscribe();
  }, [tenant]);

  const handleAddJob = async () => {
    if (!newJob.title) return;
    await addDoc(collection(db, "jobs"), {
      ...newJob,
      tenantId: tenant?.id || "genesis-1",
    });
    setShowAddModal(false);
    setNewJob({ title: "", status: "SCHEDULED" });
  };

  const handleStatusChange = async (
    jobId: string,
    newStatus: Job["status"],
  ) => {
    await updateDoc(doc(db, "jobs", jobId), { status: newStatus });
  };

  const statusColors = {
    PENDING: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    SCHEDULED: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    IN_PROGRESS: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    COMPLETED: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    CANCELED: "text-red-400 bg-red-400/10 border-red-400/20",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-40 relative z-10">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500 text-xs font-black uppercase tracking-widest text-blue-500">
            <Settings2 size={16} />
            Operations Command
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Scheduler
          </h1>
          <p className="max-w-xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            Active Routing & Dispatch
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-3 px-8 py-5 bg-white text-black border-4 border-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[4px_4px_0_0_#FFF] hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
        >
          <Plus size={24} />{" "}
          <span className="hidden sm:inline">Deploy Unit</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
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
                      className="p-6 bg-zinc-900/40 border-4 border-white/10 rounded-[32px] hover:bg-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-6 group"
                    >
                      <div>
                        <h4 className="text-2xl font-black text-white italic uppercase tracking-tight">
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
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <select
                          value={job.status}
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
                  ))}
                </div>
              );
            },
          )}
        </div>

        {/* Right Column: Global Meta */}
        <div className="space-y-8">
          <div className="p-8 bg-zinc-900/80 border-4 border-white/10 rounded-[40px] sticky top-6">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-6">
              Metrics
            </h3>
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 block">
                  Units Deployed
                </span>
                <span className="text-4xl font-black text-white italic">
                  {activeJobs.filter((j) => j.status === "IN_PROGRESS").length}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 block">
                  Queue Depth
                </span>
                <span className="text-4xl font-black text-white italic">
                  {
                    activeJobs.filter(
                      (j) => j.status === "SCHEDULED" || j.status === "PENDING",
                    ).length
                  }
                </span>
              </div>
              <div className="pt-6 border-t border-white/10">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 block">
                  Completion rate
                </span>
                <span className="text-4xl font-black text-emerald-400 italic">
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
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border-4 border-white/10 p-10 rounded-[32px] w-full max-w-xl">
            <h2 className="text-3xl font-black text-white italic uppercase mb-8">
              Deploy New Unit
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                  Operation Title
                </label>
                <input
                  type="text"
                  value={newJob.title || ""}
                  onChange={(e) =>
                    setNewJob({ ...newJob, title: e.target.value })
                  }
                  className="w-full bg-black/50 border-4 border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                  placeholder="e.g. Lawn Aeration & Overseeding"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={newJob.client || ""}
                    onChange={(e) =>
                      setNewJob({ ...newJob, client: e.target.value })
                    }
                    className="w-full bg-black/50 border-4 border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                    Job Date
                  </label>
                  <input
                    type="date"
                    value={newJob.date || ""}
                    onChange={(e) =>
                      setNewJob({ ...newJob, date: e.target.value })
                    }
                    className="w-full bg-black/50 border-4 border-white/10 rounded-xl px-4 py-3 text-white/60 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                  Location Data
                </label>
                <input
                  type="text"
                  value={newJob.address || ""}
                  onChange={(e) =>
                    setNewJob({ ...newJob, address: e.target.value })
                  }
                  className="w-full bg-black/50 border-4 border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
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
    </div>
  );
}
