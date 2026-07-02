// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Eraser, PenLine, Type, ShieldCheck } from "lucide-react";

// Reusable e-signature capture modal — the "sign it in the driveway" close.
// Captures a signer name (always) plus EITHER a drawn signature (pointer/touch on a
// light pad) OR a typed cursive fallback. Calls onSign({ name, dataUrl }) where
// dataUrl is the canvas PNG data-URI, or "" when the signer only typed their name.
//
// Props:
//   open        — controls visibility (AnimatePresence handles enter/exit)
//   title?      — heading (default "Sign & Accept")
//   amountLabel?— optional amount string shown in the header (e.g. "$1,240.00")
//   tierLabel?  — optional plan/tier string shown as a pill
//   onCancel()  — dismiss without signing
//   onSign({ name, dataUrl }) — confirm; dataUrl is PNG data-URI or "" (typed only)
export default function SignaturePad({
  open,
  title = "Sign & Accept",
  amountLabel,
  tierLabel,
  onCancel,
  onSign,
}: {
  open: boolean;
  title?: string;
  amountLabel?: string;
  tierLabel?: string;
  onCancel: () => void;
  onSign: (payload: { name: string; dataUrl: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  // Reset all state each time the pad opens fresh.
  useEffect(() => {
    if (open) {
      setName("");
      setMode("draw");
      setHasDrawn(false);
      setSaving(false);
      drawingRef.current = false;
      lastRef.current = null;
    }
  }, [open]);

  // Size the canvas to its CSS box scaled for devicePixelRatio, then paint the light
  // signing surface. Re-runs when the pad opens or the user switches back to draw mode.
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 320;
    const h = rect.height || 180;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Light signing surface — reads clean + legal on the dark UI.
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b0f0d"; // near-black ink
  }, []);

  useEffect(() => {
    if (open && mode === "draw") {
      // Entering draw mode paints a fresh (empty) surface, so the ink flag resets too —
      // otherwise a draw -> type -> draw round-trip could export a blank canvas as "signed".
      setHasDrawn(false);
      // rAF so the canvas has been laid out before we measure it.
      const id = requestAnimationFrame(setupCanvas);
      return () => cancelAnimationFrame(id);
    }
  }, [open, mode, setupCanvas]);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    drawingRef.current = true;
    lastRef.current = pointFromEvent(e);
    // Dot for a tap so a single touch still leaves a mark.
    const ctx = canvas.getContext("2d");
    if (ctx && lastRef.current) {
      ctx.beginPath();
      ctx.arc(lastRef.current.x, lastRef.current.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = "#0b0f0d";
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const last = lastRef.current;
    if (!canvas || !ctx || !last) return;
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (!hasDrawn) setHasDrawn(true);
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  const clearCanvas = () => {
    setHasDrawn(false);
    setupCanvas();
  };

  const confirm = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    let dataUrl = "";
    if (mode === "draw" && hasDrawn && canvasRef.current) {
      try {
        dataUrl = canvasRef.current.toDataURL("image/png");
      } catch {
        dataUrl = "";
      }
    }
    setSaving(true);
    try {
      await onSign({ name: trimmed, dataUrl });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => !saving && onCancel()}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-white/10 shadow-2xl w-full max-w-lg rounded-t-2xl sm:rounded-2xl relative overflow-hidden max-h-[95dvh] overflow-y-auto"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-forest-500 to-celtic-500" />
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-start justify-between mb-6 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 shrink-0 bg-forest-500/10 rounded-xl flex items-center justify-center text-forest-400">
                    <PenLine size={22} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white leading-tight truncate">{title}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {amountLabel && (
                        <span className="text-sm font-black text-forest-400">{amountLabel}</span>
                      )}
                      {tierLabel && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-celtic-400 bg-celtic-500/10 border border-celtic-500/20 px-2 py-0.5 rounded-lg">
                          {tierLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => !saving && onCancel()}
                  aria-label="Close"
                  className="text-zinc-500 hover:text-white transition-colors shrink-0"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Signer name — always required, even for a drawn mark. */}
              <label
                htmlFor="signature-signer-name"
                className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2"
              >
                Full Name
              </label>
              <input
                id="signature-signer-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Type your full name"
                autoComplete="name"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-forest-500 mb-5"
              />

              {/* Mode toggle: draw vs type */}
              <div className="flex bg-black p-1 rounded-xl border border-white/10 mb-3">
                {[
                  { key: "draw", label: "Draw", icon: PenLine },
                  { key: "type", label: "Type instead", icon: Type },
                ].map((m) => {
                  const Icon = m.icon;
                  const active = mode === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMode(m.key as "draw" | "type")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                        active ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Icon size={14} aria-hidden="true" /> {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Signature surface */}
              {mode === "draw" ? (
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endStroke}
                    onPointerLeave={endStroke}
                    onPointerCancel={endStroke}
                    className="w-full h-44 rounded-xl bg-slate-50 cursor-crosshair"
                    style={{ touchAction: "none" }}
                  />
                  {!hasDrawn && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 text-sm font-medium italic">
                      Sign here
                    </span>
                  )}
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between pointer-events-none">
                    <span className="border-t border-slate-300 flex-1 mr-3" />
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="pointer-events-auto flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-[11px] font-black uppercase tracking-widest transition-colors"
                    >
                      <Eraser size={13} aria-hidden="true" /> Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-44 rounded-xl bg-slate-50 flex items-center justify-center px-6 overflow-hidden">
                  <span
                    className="text-slate-900 text-4xl sm:text-5xl leading-none truncate max-w-full"
                    style={{ fontFamily: "'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive" }}
                  >
                    {name.trim() || "Your signature"}
                  </span>
                </div>
              )}

              {/* Legal line */}
              <p className="text-[11px] text-zinc-500 leading-relaxed mt-4 flex items-start gap-2">
                <ShieldCheck size={14} className="text-forest-400 shrink-0 mt-0.5" aria-hidden="true" />
                By signing, I accept this estimate as presented and authorize the work.
              </p>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => !saving && onCancel()}
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!name.trim() || saving}
                  className="flex-[1.6] flex items-center justify-center gap-2 px-4 py-3 bg-forest-500 hover:bg-forest-400 text-black rounded-xl font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PenLine size={15} aria-hidden="true" /> {saving ? "Signing..." : "Sign & Accept"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
