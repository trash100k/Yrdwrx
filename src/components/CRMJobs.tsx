import React, { useState } from "react";
import { Customer } from "../types";
import { Briefcase, Calendar, CheckSquare, Clock, MapPin, Plus, FileText, Search } from "lucide-react";

export const CRMJobs = ({ customer }: { customer: Customer }) => {
  const [jobs, setJobs] = useState([
    { id: 1, title: "Lawn Maintenance", status: "completed", date: "2026-05-15", technician: "Mike R.", amount: 150, type: "recurring" },
    { id: 2, title: "Tree Trimming", status: "completed", date: "2026-04-10", technician: "Sarah W.", amount: 450, type: "one-off" },
    { id: 3, title: "Seasonal Cleanup", status: "scheduled", date: "2026-06-25", technician: "Mike R.", amount: 300, type: "one-off" },
    { id: 4, title: "Irrigation Repair", status: "pending", date: "TBD", technician: "Unassigned", amount: null, type: "repair" }
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-white/5 molten-edge p-8 shadow-2xl relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
           <div>
             <h4 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
               <Briefcase size={16} className="text-forest-400" /> Job & Service History
             </h4>
             <p className="text-[10px] text-white/40 font-bold uppercase mt-1 tracking-widest">For {customer.firstName} {customer.lastName}</p>
           </div>
           
           <button className="bg-white text-black text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-white/90 transition-colors shadow-lg shadow-white/10">
             <Plus size={14} /> New Job
           </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
           <div className="bg-black/40 border border-white/5 rounded-xl p-4">
             <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Total Jobs</p>
             <h3 className="text-2xl font-bold text-white">{jobs.length}</h3>
           </div>
           <div className="bg-black/40 border border-white/5 rounded-xl p-4">
             <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Completed</p>
             <h3 className="text-2xl font-bold text-white">{jobs.filter(j => j.status === 'completed').length}</h3>
           </div>
           <div className="bg-black/40 border border-white/5 rounded-xl p-4">
             <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Scheduled</p>
             <h3 className="text-2xl font-bold text-forest-400">{jobs.filter(j => j.status === 'scheduled').length}</h3>
           </div>
           <div className="bg-black/40 border border-white/5 rounded-xl p-4">
             <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Value (YTD)</p>
             <h3 className="text-2xl font-bold text-blue-400">$600</h3>
           </div>
        </div>
        
        <div className="space-y-4 relative z-10">
           {jobs.map(job => (
             <div key={job.id} className="flex flex-col md:flex-row gap-4 bg-white/5 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors group">
               <div className="flex-1">
                 <div className="flex flex-wrap items-center gap-3 mb-2">
                   <h5 className="text-sm font-bold text-white">{job.title}</h5>
                   {job.status === "completed" && <span className="text-[10px] bg-forest-500/10 text-forest-400 border border-forest-500/20 px-2 py-0.5 rounded font-black uppercase tracking-widest">Completed</span>}
                   {job.status === "scheduled" && <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-black uppercase tracking-widest">Scheduled</span>}
                   {job.status === "pending" && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded font-black uppercase tracking-widest">Pending Action</span>}
                   
                   {job.type === "recurring" && <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-black uppercase tracking-widest ml-auto">Recurring</span>}
                 </div>
                 
                 <div className="flex items-center gap-4 text-[10px] font-bold text-white/40 uppercase tracking-widest mt-4">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {job.date}</span>
                    <span className="flex items-center gap-1"><CheckSquare size={12} /> Tech: {job.technician}</span>
                 </div>
               </div>
               
               <div className="md:w-32 flex flex-col md:items-end justify-between border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-4">
                  <div className="text-sm font-bold text-white mb-2">{job.amount ? `$${job.amount}` : "--"}</div>
                  <button className="text-xs font-bold text-forest-400 hover:text-forest-300 transition-colors flex items-center gap-1">
                    View Details <Clock size={12} />
                  </button>
               </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
