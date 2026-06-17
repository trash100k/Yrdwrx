import React from "react";
import { Bell, CheckCircle, Clock, AlertTriangle, MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const NotificationsCenter = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const notifications = [
    { id: 1, type: "success", title: "Invoice #2830 Paid", desc: "Oak Street Property maintenance paid $450.00", time: "10 min ago", icon: CheckCircle, color: "text-forest-400", bg: "bg-forest-500/10", border: "border-forest-500/20" },
    { id: 2, type: "alert", title: "Low Inventory", desc: "Premium Mulch (Brown) is below minimum stock levels (2 remaining).", time: "1 hr ago", icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    { id: 3, type: "message", title: "New Client Request", desc: "Sarah Jenkins requested a quote for Tree Trimming.", time: "2 hrs ago", icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { id: 4, type: "update", title: "Job Completed", desc: "Crew Beta finished Weekly Mow at 1823 Maple Dr.", time: "3 hrs ago", icon: Clock, color: "text-zinc-300", bg: "bg-white/5", border: "border-white/10" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[190]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-20 right-4 sm:right-24 w-[380px] bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-[200]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/50">
              <h3 className="font-bold text-white tracking-tight flex items-center gap-2">
                <Bell size={16} className="text-forest-400" /> Notifications
              </h3>
              <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors bg-white/5 border border-white/5 rounded-full">
                <X size={14} />
              </button>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.map((n) => (
                 <div key={n.id} className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group flex gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${n.bg} ${n.border}`}>
                      <n.icon size={18} className={n.color} />
                    </div>
                    <div>
                       <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-white group-hover:text-forest-300 transition-colors">{n.title}</p>
                          <span className="text-[10px] font-bold text-zinc-500">{n.time}</span>
                       </div>
                       <p className="text-xs text-zinc-400 leading-relaxed">{n.desc}</p>
                    </div>
                 </div>
              ))}
            </div>
            
            <div className="p-3 border-t border-white/5 bg-black text-center">
               <button className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
                  Mark all as read
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
