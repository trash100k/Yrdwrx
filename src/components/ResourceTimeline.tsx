// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Calendar, Clock, Truck, Plus, CheckCircle } from "lucide-react";
import { jobsRepo, crewsRepo } from "../lib/repos";

// READ adapter: flatten the jsonb `data` bag first, then let real columns win, so
// data-only fields (equipment/time/client) surface alongside top-level columns.
const adaptJob = (r: any) => ({ ...(r?.data || {}), ...r });
const adaptCrew = (r: any) => ({ ...(r?.data || {}), ...r });

export function ResourceTimeline() {
  const [draggedEquipment, setDraggedEquipment] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [crews, setCrews] = useState<any[]>([]);

  // Real jobs (the timeline rows) and crews (the assignable resources) from Supabase.
  useEffect(() => {
    const unsubJobs = jobsRepo.subscribe((rows) => {
      const list = (rows || []).map(adaptJob).filter((j: any) => {
        const s = (j.status || "").toUpperCase();
        return s !== "COMPLETED" && s !== "CANCELED";
      });
      setJobs(list);
    });
    const unsubCrews = crewsRepo.subscribe((rows) => setCrews((rows || []).map(adaptCrew)));
    return () => {
      unsubJobs();
      unsubCrews();
    };
  }, []);

  // Resources a crew/equipment chip can be dropped onto a job. We expose real crews
  // plus a small static set of equipment types (no equipment table exists yet).
  const equipmentList = ["Mower", "Blower", "Trimmer", "Chainsaw", "Excavator", "Skid Steer"];
  const resourceList = [
    ...crews.map((c: any) => ({ key: `crew:${c.id}`, label: c.name || "Crew", kind: "crew" })),
    ...equipmentList.map((e) => ({ key: `equip:${e}`, label: e, kind: "equip" })),
  ];

  const handleDragStart = (e: React.DragEvent, label: string) => {
    e.dataTransfer.setData("equipment", label);
    setDraggedEquipment(label);
  };

  // Persist a dropped resource onto a job's `data.equipment` list via jobsRepo.update.
  const handleDrop = async (e: React.DragEvent, jobId: string) => {
    e.preventDefault();
    const item = e.dataTransfer.getData("equipment");
    setDraggedEquipment(null);
    if (!item) return;

    const job = jobs.find((j: any) => j.id === jobId);
    if (!job) return;
    const current: string[] = Array.isArray(job.equipment) ? job.equipment : [];
    if (current.includes(item)) return;
    const next = [...current, item];

    // Optimistic local update; subscription will reconcile after the write.
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, equipment: next } : j)));
    try {
      await jobsRepo.update(jobId, { data: { ...(job.data || {}), equipment: next } });
    } catch (err) {
      console.error("Failed to assign resource to job", err);
      // Roll back the optimistic change on failure.
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, equipment: current } : j)));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeEquipment = async (jobId: string, itemToRemove: string) => {
    const job = jobs.find((j: any) => j.id === jobId);
    if (!job) return;
    const current: string[] = Array.isArray(job.equipment) ? job.equipment : [];
    const next = current.filter((i) => i !== itemToRemove);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, equipment: next } : j)));
    try {
      await jobsRepo.update(jobId, { data: { ...(job.data || {}), equipment: next } });
    } catch (err) {
      console.error("Failed to remove resource from job", err);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, equipment: current } : j)));
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-8">
      {/* Draggable resource list (real crews + equipment types) */}
      <div className="w-full lg:w-64 shrink-0">
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 shadow-2xl">
          <h3 className="text-xs font-black text-forest-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Truck size={14} /> Available Resources
          </h3>
          <div className="space-y-2">
            {resourceList.map((item) => (
              <div
                key={item.key}
                draggable
                onDragStart={(e) => handleDragStart(e, item.label)}
                onDragEnd={() => setDraggedEquipment(null)}
                className={`p-3 bg-black/40 border ${draggedEquipment === item.label ? 'border-forest-500/50 opacity-50' : 'border-white/5'} rounded-xl cursor-grab active:cursor-grabbing hover:bg-black/60 transition-colors flex items-center gap-2`}
              >
                <div className={`w-2 h-2 rounded-full ${item.kind === "crew" ? "bg-celtic-400" : "bg-forest-400"}`} />
                <span className="text-sm font-bold text-white">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline view (real jobs) */}
      <div className="flex-1 bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-2xl overflow-x-auto">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-8 flex items-center gap-2">
          <Calendar size={14} /> Daily Service Orders
        </h3>

        {jobs.length === 0 ? (
          <div className="p-8 border border-white/5 border-dashed rounded-2xl bg-white/[0.02] text-center">
            <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">No active jobs scheduled</span>
          </div>
        ) : (
          <div className="relative border-l-2 border-white/5 ml-4 pl-8 space-y-12">
            {jobs.map((job) => {
              const assigned: string[] = Array.isArray(job.equipment) ? job.equipment : [];
              return (
                <div
                  key={job.id}
                  className="relative"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, job.id)}
                >
                  {/* Timeline dot */}
                  <div className="absolute -left-[41px] top-4 w-5 h-5 rounded-full bg-black border-4 border-forest-500 z-10" />

                  <div className="bg-black/40 border border-white/5 hover:border-forest-500/30 transition-colors rounded-2xl p-5 mb-2">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-black text-white">{job.title || "Untitled Job"}</h4>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1 mt-1">
                          <Clock size={12} /> {job.time || job.date || "Unscheduled"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5 min-h-[60px]">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Assigned Resources</p>

                      {assigned.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {assigned.map((item) => (
                            <div key={item} className="px-3 py-1.5 bg-forest-500/10 border border-forest-500/20 text-forest-400 text-xs font-bold rounded-lg flex items-center gap-2">
                              {item}
                              <button onClick={() => removeEquipment(job.id, item)} className="text-forest-400 hover:text-white transition-colors">
                                <Plus size={12} className="rotate-45" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center p-3 border border-white/5 border-dashed rounded-xl bg-white/[0.02]">
                          <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Drop Resources Here</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
