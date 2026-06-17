import React, { useState } from "react";
import { Customer } from "../types";
import { CheckSquare, Calendar, Clock, AlertCircle, Search } from "lucide-react";

export const CRMTasks = ({ customers }: { customers: Customer[] }) => {
  const [tasks, setTasks] = useState([
    { id: 1, title: "Follow up on invoice #104", priority: "high", due: "Today", status: "pending", customer: "Jane Doe" },
    { id: 2, title: "Schedule property walk-through", priority: "medium", due: "Tomorrow", status: "pending", customer: "Smith Corp" },
    { id: 3, title: "Send new contract via DocuSign", priority: "high", due: "Today", status: "completed", customer: "Acme Inc" },
    { id: 4, title: "Quarterly check-in call", priority: "low", due: "Next Week", status: "pending", customer: "John Smith" },
  ]);

  const [activeView, setActiveView] = useState<"list" | "calendar">("list");
  
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const completedTasks = tasks.filter(t => t.status === "completed");

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-y-auto custom-scrollbar flex-col bg-zinc-950">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-2">
         <div>
           <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-2">Tasks & Action Items</h2>
           <p className="text-xs text-white/50">{pendingTasks.length} pending tasks assigned to you.</p>
         </div>
         
         <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input type="text" placeholder="Search tasks..." className="w-full bg-black border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-white/40 outline-none focus:border-forest-500/50 transition-colors" />
            </div>
            <div className="bg-black border border-white/10 rounded-xl p-1 flex">
              <button 
                onClick={() => setActiveView("list")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeView === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
              >
                 List
              </button>
              <button 
                onClick={() => setActiveView("calendar")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeView === "calendar" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
              >
                 Calendar
              </button>
            </div>
            <button className="bg-white text-black font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl hover:bg-white/90 transition-colors shadow-lg active:scale-95">
              + New Task
            </button>
         </div>
      </div>

      {activeView === "list" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 flex-1">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/40 border-b border-white/5 pb-4">Up Next</h3>
            
            {pendingTasks.map(task => (
              <div key={task.id} className="bg-zinc-900 border border-white/5 p-5 rounded-2xl flex items-center gap-4 group hover:border-white/20 transition-colors cursor-pointer">
                 <button 
                   onClick={() => setTasks(tasks.map(t => t.id === task.id ? {...t, status: "completed"} : t))}
                   className="w-6 h-6 rounded-md border-2 border-white/20 flex items-center justify-center shrink-0 hover:border-forest-500 hover:bg-forest-500/20 group-hover:bg-white/5 transition-all text-transparent hover:text-forest-500"
                 >
                   <CheckSquare size={14} />
                 </button>
                 <div className="flex-1 w-0">
                   <h4 className="font-bold text-white text-sm truncate">{task.title}</h4>
                   <p className="text-xs text-white/60 truncate mt-1">For: {task.customer}</p>
                 </div>
                 <div className="flex items-center gap-3 shrink-0">
                    {task.priority === "high" && <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">High</span>}
                    {task.priority === "medium" && <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">Med</span>}
                    {task.priority === "low" && <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">Low</span>}
                    <div className="flex items-center gap-1 text-xs text-white/40 bg-black py-1 px-3 rounded-lg border border-white/5">
                      <Clock size={12} /> {task.due}
                    </div>
                 </div>
              </div>
            ))}

            <h3 className="text-sm font-black uppercase tracking-widest text-white/40 border-b border-white/5 pb-4 pt-8 mt-4">Completed</h3>
            {completedTasks.map(task => (
              <div key={task.id} className="bg-zinc-900/50 border border-white/5 p-5 rounded-2xl flex items-center gap-4 opacity-60">
                 <div className="w-6 h-6 rounded-md bg-forest-500/20 text-forest-500 flex items-center justify-center shrink-0">
                   <CheckSquare size={14} />
                 </div>
                 <div className="flex-1 w-0">
                   <h4 className="font-bold text-white text-sm truncate line-through decoration-white/30">{task.title}</h4>
                   <p className="text-xs text-white/60 truncate mt-1">For: {task.customer}</p>
                 </div>
                 <div className="flex items-center gap-1 text-xs text-forest-400 bg-forest-500/10 py-1 px-3 rounded-lg border border-forest-500/20">
                   Done
                 </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
             <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 sticky top-0">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Today's Schedule</h3>
                    <p className="text-[10px] text-white/50">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="space-y-4 relative border-l border-white/10 ml-5 pl-6 pb-4">
                   <div className="absolute w-3 h-3 bg-white/20 rounded-full left-[-6px] top-1 border-2 border-zinc-900"></div>
                   <div className="text-xs text-white/40 font-bold mb-1">09:00 AM</div>
                   <div className="bg-black border border-white/5 p-4 rounded-xl shadow-md">
                     <p className="text-sm text-white font-bold mb-1">Morning Sync</p>
                     <p className="text-[10px] text-white/50">Internal Team</p>
                   </div>
                </div>
                
                <div className="space-y-4 relative border-l border-white/10 ml-5 pl-6 pb-4">
                   <div className="absolute w-3 h-3 bg-forest-500 rounded-full left-[-6px] top-1 border-2 border-zinc-900 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                   <div className="text-xs text-forest-400 font-bold mb-1">11:30 AM (Current)</div>
                   <div className="bg-forest-500/10 border border-forest-500/30 p-4 rounded-xl shadow-md">
                     <p className="text-sm text-forest-400 font-bold mb-1">Call with Jane Doe</p>
                     <p className="text-[10px] text-forest-400/60">Review Invoice #104</p>
                   </div>
                </div>

                <div className="space-y-4 relative border-l-0 border-white/10 ml-5 pl-6">
                   <div className="absolute w-3 h-3 bg-white/20 rounded-full left-[-6px] top-1 border-2 border-zinc-900"></div>
                   <div className="text-xs text-white/40 font-bold mb-1">02:00 PM</div>
                   <div className="bg-black border border-white/5 p-4 rounded-xl shadow-md">
                     <p className="text-sm text-white font-bold mb-1">Property Check</p>
                     <p className="text-[10px] text-white/50">Smith Corp HQ</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-zinc-900 rounded-3xl border border-white/5 mt-4 p-8 flex flex-col items-center justify-center text-center">
           <Calendar size={64} className="text-white/10 mb-6" />
           <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Calendar Integration</h3>
           <p className="text-sm text-white/50 max-w-md">
             Full calendar view requires Google Workspace integration. Connect your Google account in Settings to view and manage appointments directly on your calendar.
           </p>
           <button className="mt-8 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-lg transition-colors border border-white/10">
             Connect Google Calendar
           </button>
        </div>
      )}
    </div>
  );
};
