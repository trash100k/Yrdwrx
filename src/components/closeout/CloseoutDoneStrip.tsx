// @ts-nocheck
import React from "react";
import { motion } from "motion/react";
import {
  CheckCircle2,
  FileText,
  CalendarPlus,
  Package,
  StickyNote,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { UndoChip } from "./UndoChip";

export interface ExecutedAction {
  id: string;
  type: "close_job" | "invoice" | "schedule" | "inventory" | "note";
  title: string;
  detail?: string;
  /** false = the execution failed (no undo offered). */
  ok: boolean;
  /** Reverses this action; surfaced via the UndoChip. Omit when not reversible. */
  undo?: () => void | Promise<void>;
}

const TYPE_ICON: Record<ExecutedAction["type"], { icon: any; tint: string }> = {
  close_job: { icon: CheckCircle2, tint: "text-forest-400" },
  invoice: { icon: FileText, tint: "text-rose-400" },
  schedule: { icon: CalendarPlus, tint: "text-amber-400" },
  inventory: { icon: Package, tint: "text-sky-400" },
  note: { icon: StickyNote, tint: "text-zinc-300" },
};

interface CloseoutDoneStripProps {
  executed: ExecutedAction[];
  /** Start another closeout. */
  onAgain: () => void;
}

/**
 * Done state: an activity feed of what just got executed, each row carrying a
 * Gmail-style UndoChip for a brief reversal window.
 */
export function CloseoutDoneStrip({ executed, onAgain }: CloseoutDoneStripProps) {
  const okCount = executed.filter((e) => e.ok).length;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-forest-500/10 border border-forest-500/20 p-6 text-center"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-forest-500/20 border border-forest-500/30 flex items-center justify-center mb-3">
          <CheckCircle2 size={28} className="text-forest-400" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Closeout Done</h2>
        <p className="text-forest-300/80 text-sm font-bold uppercase tracking-widest mt-1">
          {okCount} action{okCount === 1 ? "" : "s"} executed
        </p>
      </motion.div>

      <div className="space-y-3">
        {executed.map((a, i) => {
          const meta = TYPE_ICON[a.type] || TYPE_ICON.note;
          const Icon = a.ok ? meta.icon : AlertTriangle;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 rounded-2xl border p-4 ${
                a.ok ? "bg-zinc-900/60 border-white/10" : "bg-rose-500/10 border-rose-500/30"
              }`}
            >
              <div
                className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
                  a.ok ? "bg-white/5" : "bg-rose-500/20"
                }`}
              >
                <Icon size={20} className={a.ok ? meta.tint : "text-rose-400"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold leading-tight truncate">{a.title}</p>
                {a.detail && <p className="text-zinc-400 text-xs mt-0.5 truncate">{a.detail}</p>}
                {!a.ok && (
                  <p className="text-rose-400 text-[11px] font-bold uppercase tracking-widest mt-0.5">
                    Failed
                  </p>
                )}
              </div>
              {a.ok && a.undo && <UndoChip onUndo={a.undo} seconds={12} />}
            </motion.div>
          );
        })}
      </div>

      <button
        onClick={onAgain}
        className="w-full inline-flex items-center justify-center gap-2 min-h-[56px] rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-black uppercase tracking-widest transition-colors"
      >
        <RotateCcw size={20} /> New Closeout
      </button>
    </div>
  );
}

export default CloseoutDoneStrip;
