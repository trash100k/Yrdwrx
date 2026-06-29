// @ts-nocheck
import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Zap, ListChecks, X, Loader2 } from "lucide-react";
import { ActionCard, CloseoutAction } from "./ActionCard";

interface ActionCardStackProps {
  summary?: string;
  actions: CloseoutAction[];
  /** Set of selected action ids. */
  selected: Record<string, boolean>;
  /** Set of confirmed (high-risk) action ids. */
  confirmed: Record<string, boolean>;
  onToggle: (id: string, next: boolean) => void;
  onConfirm: (id: string) => void;
  onChange: (id: string, patch: Partial<CloseoutAction>) => void;
  onDoAll: () => void;
  onReviewEach: () => void;
  onCancel: () => void;
  executing?: boolean;
}

/**
 * Stack of inline-editable closeout action cards plus the bottom command bar
 * ([Do All] / [Review Each] / [Cancel]).
 */
export function ActionCardStack({
  summary,
  actions,
  selected,
  confirmed,
  onToggle,
  onConfirm,
  onChange,
  onDoAll,
  onReviewEach,
  onCancel,
  executing = false,
}: ActionCardStackProps) {
  const selectedCount = actions.filter((a) => selected[a.id]).length;
  // Block Do All when a selected high-risk invoice is not yet confirmed.
  const blocked = actions.some(
    (a) => selected[a.id] && a.type === "invoice" && a.risk === "high" && !confirmed[a.id]
  );

  return (
    <div className="space-y-5">
      {summary && (
        <div className="rounded-2xl bg-forest-500/10 border border-forest-500/20 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-forest-400 mb-1">
            What I Heard
          </p>
          <p className="text-white text-lg font-medium leading-relaxed">{summary}</p>
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              selected={!!selected[action.id]}
              confirmed={!!confirmed[action.id]}
              onToggle={onToggle}
              onConfirm={onConfirm}
              onChange={onChange}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom command bar — sticky for thumb reach in the field */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky bottom-4 z-10 rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl p-3 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onDoAll}
            disabled={executing || selectedCount === 0 || blocked}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[56px] rounded-xl bg-forest-500 hover:bg-forest-400 text-black text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {executing ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
            {executing ? "Working" : `Do All${selectedCount ? ` (${selectedCount})` : ""}`}
          </button>
          <button
            onClick={onReviewEach}
            disabled={executing || selectedCount === 0 || blocked}
            className="inline-flex items-center justify-center gap-2 min-h-[56px] px-5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-40"
          >
            <ListChecks size={20} />
            <span className="hidden sm:inline">Review Each</span>
          </button>
          <button
            onClick={onCancel}
            disabled={executing}
            className="inline-flex items-center justify-center min-h-[56px] w-14 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Cancel"
          >
            <X size={22} />
          </button>
        </div>
        {blocked && (
          <p className="mt-2 text-center text-[11px] font-bold uppercase tracking-wide text-rose-400">
            Confirm the invoice to continue
          </p>
        )}
      </motion.div>
    </div>
  );
}

export default ActionCardStack;
