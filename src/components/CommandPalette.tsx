import React, { useState, useEffect, useMemo } from "react";
import { Search, Map, Users, Calendar, Truck, Terminal, Sparkles, X, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useRole } from "../hooks/useRole";

export const CommandPalette = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { role } = useRole();
  const rolePrefix = role === "employee" || role === "foreman" ? "/employee" : "/admin";

  const actions = useMemo(() => [
    { id: "Dashboard", icon: Activity, path: `${rolePrefix}` },
    { id: "CRM", icon: Users, path: `${rolePrefix}/crm` },
    { id: "Scheduler", icon: Calendar, path: `${rolePrefix}/scheduler` },
    { id: "Crew Suite", icon: Truck, path: `${rolePrefix}/crew-suite` },
    { id: "YardPilot (AI)", icon: Sparkles, path: `${rolePrefix}/agent` },
  ], [rolePrefix]);

  const filteredActions = useMemo(() =>
    actions.filter((a) => a.id.toLowerCase().includes(searchTerm.toLowerCase())),
  [actions, searchTerm]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if(isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }

      if (isOpen && filteredActions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredActions.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          const action = filteredActions[selectedIndex];
          if (action) {
            navigate(action.path);
            onClose();
          }
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, onClose, filteredActions, selectedIndex, navigate]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10"
          >
            <div className="flex items-center px-6 py-5 border-b border-white/5">
              <Search size={22} className="text-forest-400 mr-4" />
              <input
                autoFocus
                type="text"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls="command-palette-listbox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                placeholder="Search commands, clients, or navigate (Cmd + K)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-none text-xl text-white focus:outline-none placeholder:text-zinc-600 font-medium"
              />
              <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-full ml-4">
                <X size={16} />
              </button>
            </div>

            <div
              className="p-4 max-h-[50vh] overflow-y-auto custom-scrollbar"
              role="listbox"
              aria-label="Commands"
              id="command-palette-listbox"
            >
              {filteredActions.length > 0 ? (
                <div className="space-y-1">
                  <p className="px-4 py-2 text-[10px] uppercase font-black tracking-widest text-zinc-500">Navigation</p>
                  {filteredActions.map((action, i) => (
                    <button
                      key={action.id}
                      role="option"
                      aria-selected={selectedIndex === i}
                      onClick={() => {
                        navigate(action.path);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors group ${
                        selectedIndex === i ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <div className={`flex items-center gap-4 transition-colors ${
                        selectedIndex === i ? "text-white" : "text-zinc-300 group-hover:text-white"
                      }`}>
                        <div className={`w-10 h-10 rounded-lg bg-black/50 border flex items-center justify-center transition-colors ${
                          selectedIndex === i
                            ? "border-forest-500/50 bg-forest-500/20"
                            : "border-white/5 group-hover:border-forest-500/30 group-hover:bg-forest-500/10"
                        }`}>
                           <action.icon size={18} className={selectedIndex === i ? "text-forest-400" : "group-hover:text-forest-400 transition-colors"} />
                        </div>
                        <span className="font-bold text-lg tracking-tight">{action.id}</span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-600 border border-zinc-800 px-2 py-1 rounded bg-black">Jump to</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-zinc-500 font-bold">
                  No results found for "{searchTerm}"
                </div>
              )}
            </div>
            
            <div className="bg-black/50 border-t border-white/5 px-6 py-3 flex items-center justify-between">
               <div className="flex gap-4 items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                     <kbd className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">↑</kbd>
                     <kbd className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">↓</kbd> to navigate
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                     <kbd className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">↵</kbd> to select
                  </span>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
