// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Undo2, Check } from "lucide-react";

interface UndoChipProps {
  /** Seconds the undo window stays open (Gmail-style). */
  seconds?: number;
  /** Called when the user taps undo within the window. Should reverse the action. */
  onUndo: () => void | Promise<void>;
  /** Optional label override. */
  label?: string;
}

/**
 * Gmail-style "Undo" chip with a ~12s countdown ring. After it expires (or the
 * undo succeeds), it collapses to a quiet committed/undone state.
 */
export function UndoChip({ seconds = 12, onUndo, label = "Undo" }: UndoChipProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [state, setState] = useState<"open" | "undone" | "committed">("open");
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (state !== "open") return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      if (left <= 0) {
        setState("committed");
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [state, seconds]);

  const handleUndo = useCallback(async () => {
    if (state !== "open" || busy) return;
    setBusy(true);
    try {
      await onUndo();
      setState("undone");
    } catch (e) {
      // Leave window open so the user can retry; reset busy flag.
      console.error("Undo failed", e);
    } finally {
      setBusy(false);
    }
  }, [state, busy, onUndo]);

  if (state === "undone") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80 text-zinc-400 text-[11px] font-black uppercase tracking-widest">
        <Undo2 size={12} /> Reversed
      </span>
    );
  }

  if (state === "committed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-forest-500/10 text-forest-400 text-[11px] font-black uppercase tracking-widest">
        <Check size={12} /> Done
      </span>
    );
  }

  const pct = Math.max(0, Math.min(1, remaining / seconds));

  return (
    <button
      onClick={handleUndo}
      disabled={busy}
      className="group inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
    >
      {/* Countdown ring */}
      <span className="relative inline-flex items-center justify-center" style={{ width: 18, height: 18 }}>
        <svg viewBox="0 0 36 36" className="w-[18px] h-[18px] -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 15}
            strokeDashoffset={(1 - pct) * 2 * Math.PI * 15}
            className="text-forest-400 transition-[stroke-dashoffset] duration-100 ease-linear"
          />
        </svg>
        <Undo2 size={9} className="absolute" />
      </span>
      {label}
      <span className="tabular-nums text-zinc-400">{Math.ceil(remaining)}s</span>
    </button>
  );
}

export default UndoChip;
