// @ts-nocheck
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, ShieldAlert, FileText, Magnet, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

const MACROS = [
  {
    id: "dispatch",
    label: "Emergency Dispatch Protocol",
    description: "Re-route closest available crew to high-priority incident.",
    icon: ShieldAlert,
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  {
    id: "invoice",
    label: "Auto-Invoice Queue",
    description: "Batch process 14 completed jobs & dispatch invoices.",
    icon: FileText,
    color: "text-forest-500",
    bg: "bg-forest-500/10",
    border: "border-forest-500/20",
  },
  {
    id: "revenue",
    label: "Sweep Unbilled Revenue",
    description: "Scan system for missed billable hours ($4,250 found).",
    icon: Magnet,
    color: "text-celtic-500",
    bg: "bg-celtic-500/10",
    border: "border-celtic-500/20",
  },
];

export default function QuickActionMacros() {
  const [activeMacro, setActiveMacro] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { showToast } = useToast();
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
       if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, []);

  const executeMacro = (macroId: string) => {
    setActiveMacro(macroId);
    setProgress(0);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            setActiveMacro(null);
            showToast("Macro execution completed successfully.", "success");
          }, 800);
          return 100;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 200);
  };

  return (
    <div className="bg-zinc-950 border border-white/5 molten-edge shadow-md p-6 sm:p-8 rounded-[24px] relative overflow-hidden group">
      <header className="mb-6 relative z-10 flex items-center gap-4">
        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-300">
          <Zap size={20} />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-0.5">
            Quick Actions
          </h2>
          <p className="text-sm font-medium text-zinc-500">
            High-velocity compound system operations
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {MACROS.map((macro) => {
          const isActive = activeMacro === macro.id;
          const isProcessingOther = activeMacro && activeMacro !== macro.id;
          const Icon = macro.icon;

          return (
            <button
              key={macro.id}
              onClick={() => executeMacro(macro.id)}
              disabled={activeMacro !== null}
              className={`p-5 border flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-300 rounded-[20px] ${
                isProcessingOther
                  ? "opacity-40 grayscale cursor-not-allowed border-white/5 bg-white/5"
                  : isActive
                  ? `border-white/20 ${macro.bg}`
                  : `${macro.border} hover:border-white/10 hover:bg-white/5`
              }`}
            >
              <div className="mb-3 relative z-10 flex justify-center w-full">
                <div className={`p-2 rounded-lg ${macro.bg}`}>
                  {isActive && progress >= 100 ? (
                    <CheckCircle2 size={24} className="text-white" />
                  ) : isActive ? (
                    <Loader2 size={24} className={`animate-spin ${macro.color}`} />
                  ) : (
                    <Icon size={24} className={macro.color} />
                  )}
                </div>
              </div>
              
              <h3 className="text-sm font-bold text-white mb-0.5 relative z-10 leading-snug">
                {macro.label}
              </h3>

              {/* Progress Bar Background */}
              {isActive && (
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  className="absolute bottom-0 left-0 h-1 bg-white/20"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
