import React, { useEffect } from "react";
import { Keyboard, X, Command } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const KeyboardShortcutsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Toggle shortcuts with '?'
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && e.target instanceof HTMLElement && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        if(isOpen) onClose();
        // The trigger from Layout will handle opening if we don't open it here
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, onClose]);

  const shortcuts = [
    { key: "Cmd + K", label: "Command palette" },
    { key: "Cmd + B", label: "Ask YardPilot (AI)" },
    { key: "?", label: "Show keyboard shortcuts" },
    { key: "G then D", label: "Go to Dashboard" },
    { key: "G then C", label: "Go to CRM" },
    { key: "G then S", label: "Go to Scheduler" },
    { key: "G then I", label: "Go to Invoices" },
    { key: "G then R", label: "Go to Route Optimizer" },
    { key: "Esc", label: "Close active modal / menu" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl relative z-10 overflow-hidden"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Keyboard size={16} className="text-zinc-400" />
                 </div>
                 Keyboard Shortcuts
              </h2>
              <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-full">
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-2">
                {shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-black/50">
                     <span className="text-sm font-medium text-zinc-400">{s.label}</span>
                     <kbd className="bg-white/10 border border-white/20 text-white font-mono text-xs px-2.5 py-1.5 rounded-lg shadow-sm">
                        {s.key}
                     </kbd>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-black/50 border-t border-white/5 p-4 text-center">
              <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                 Navigate faster without your mouse
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
