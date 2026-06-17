import React, { useState } from "react";
import { motion } from "motion/react";
import { Calendar, Clock, Truck, Plus, CheckCircle } from "lucide-react";

export function ResourceTimeline() {
  const [draggedEquipment, setDraggedEquipment] = useState<string | null>(null);
  
  // Hardcoded for demo purposes
  const [jobs, setJobs] = useState([
    { id: "job1", title: "Residential Cleanup", time: "08:00 AM", equipment: ["Mower", "Blower"] },
    { id: "job2", title: "Commercial Landscaping", time: "11:00 AM", equipment: [] },
    { id: "job3", title: "Tree Trimming", time: "02:00 PM", equipment: ["Chainsaw"] },
  ]);

  const equipmentList = ["Mower", "Blower", "Trimmer", "Chainsaw", "Excavator", "Skid Steer"];

  const handleDragStart = (e: React.DragEvent, item: string) => {
    e.dataTransfer.setData("equipment", item);
    setDraggedEquipment(item);
  };

  const handleDrop = (e: React.DragEvent, jobId: string) => {
    e.preventDefault();
    const equipment = e.dataTransfer.getData("equipment");
    setDraggedEquipment(null);

    if (equipment) {
      setJobs(jobs.map(job => {
        if (job.id === jobId && !job.equipment.includes(equipment)) {
          return { ...job, equipment: [...job.equipment, equipment] };
        }
        return job;
      }));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeEquipment = (jobId: string, itemToRemove: string) => {
    setJobs(jobs.map(job => {
      if (job.id === jobId) {
        return { ...job, equipment: job.equipment.filter(i => i !== itemToRemove) };
      }
      return job;
    }));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-8">
      {/* Draggable equipment list */}
      <div className="w-full lg:w-64 shrink-0">
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 shadow-2xl">
          <h3 className="text-xs font-black text-forest-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Truck size={14} /> Available Resources
          </h3>
          <div className="space-y-2">
            {equipmentList.map(item => (
              <div
                key={item}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragEnd={() => setDraggedEquipment(null)}
                className={`p-3 bg-black/40 border ${draggedEquipment === item ? 'border-forest-500/50 opacity-50' : 'border-white/5'} rounded-xl cursor-grab active:cursor-grabbing hover:bg-black/60 transition-colors flex items-center gap-2`}
              >
                <div className="w-2 h-2 rounded-full bg-forest-400" />
                <span className="text-sm font-bold text-white">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline view */}
      <div className="flex-1 bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-2xl overflow-x-auto">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-8 flex items-center gap-2">
          <Calendar size={14} /> Daily Service Orders
        </h3>
        
        <div className="relative border-l-2 border-white/5 ml-4 pl-8 space-y-12">
          {jobs.map((job) => (
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
                    <h4 className="text-lg font-black text-white">{job.title}</h4>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1 mt-1">
                      <Clock size={12} /> {job.time}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/5 min-h-[60px]">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Assigned Resources</p>
                  
                  {job.equipment.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {job.equipment.map(item => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
