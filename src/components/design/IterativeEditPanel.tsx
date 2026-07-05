// @ts-nocheck
// IterativeEditPanel — the Design Studio "have a conversation with the photo" loop and
// the on-site-selling differentiator. The contractor describes a change in plain language
// (optionally marking a specific spot / attaching a product photo), applies it, and STACKS
// the next change on top of the result — with undo/redo and a before/after slider on the
// current frame. Each edit feeds the previous COMPOSITED result back as the base
// (`convHeadBase`), so the rest of the yard stays stable and drift is confined to the mask.
//
// Pure state lives in ../../lib/designEdit (typed + unit-tested); this component is just the
// UI + the network/canvas glue. Region compositing is passed in from the page so the exact
// same "keep everything outside the mask pixel-identical" guarantee is reused.

import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Undo2, Redo2, MapPin, X, Image as ImageIcon, Send, Layers } from "lucide-react";
import { fetchApi } from "../../lib/api";
import { compressImage } from "../../lib/imageUtils";
import { burnAiVizBadge } from "../../lib/aiVizBadge";
import { useToast } from "../../contexts/ToastContext";
import MarkupCanvas from "../MarkupCanvas";
import BeforeAfterSlider from "../BeforeAfterSlider";
import {
  convInit,
  convApply,
  convUndo,
  convRedo,
  convCanUndo,
  convCanRedo,
  convHeadImage,
  convHeadBase,
  convBefore,
  convAppliedTurns,
} from "../../lib/designEdit";

let _turnSeq = 0;
const nextTurnId = () => `edit_${Date.now()}_${_turnSeq++}`;

// Honest copy for hard credit/tier gates (402 plan feature, 429 usage cap) so the reveal
// isn't a generic "try again" after the user described a change.
function gateMessage(status, data) {
  const raw = typeof data?.error === "string" ? data.error.trim() : "";
  const serverMsg = raw && !/^too many/i.test(raw) ? raw : "";
  if (status === 402) return serverMsg || "AI editing is a Pro feature — upgrade to unlock it.";
  if (status === 429) return serverMsg || "You've used your AI edits for now — upgrade to keep going.";
  return null;
}

export default function IterativeEditPanel({
  initialImage,
  zone,
  aspectRatioLabel,
  composite,
  onCommit,
}) {
  const { showToast } = useToast();
  const [conv, setConv] = useState(() => convInit(initialImage || null));
  const [instruction, setInstruction] = useState("");
  const [refImage, setRefImage] = useState(null); // optional product/reference photo (data URL)
  const [pendingRegions, setPendingRegions] = useState([]); // regions captured from the markup pass
  const [marking, setMarking] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const refInputRef = useRef(null);

  // A brand-new starting photo (re-upload / loaded vision) resets the whole conversation.
  useEffect(() => {
    setConv(convInit(initialImage || null));
    setInstruction("");
    setRefImage(null);
    setPendingRegions([]);
    setMarking(false);
    setComparing(false);
  }, [initialImage]);

  const headImage = convHeadImage(conv);
  const beforeImage = convBefore(conv);
  const appliedTurns = convAppliedTurns(conv);
  const hasEdits = appliedTurns.length > 0;

  // MarkupCanvas finalize: capture the semantic regions (normalized 0..1) for the NEXT
  // apply, then drop back to the edit view.
  const handleMarkFinalize = (payload) => {
    const regs = Array.isArray(payload?.regions) ? payload.regions : [];
    setPendingRegions(regs);
    setMarking(false);
    if (regs.length) {
      showToast(`${regs.length} spot${regs.length > 1 ? "s" : ""} marked — describe the change and apply.`, "success");
    } else {
      showToast("No spots marked — describe a whole-photo change instead.", "info");
    }
  };

  const pickRefImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await compressImage(file, 1000, 1000, 0.85);
      setRefImage(b64);
      showToast("Reference photo attached to the next edit.", "success");
    } catch {
      showToast("Couldn't read that reference photo — try a JPG or PNG.", "error");
    }
    if (refInputRef.current) refInputRef.current.value = "";
  };

  const applyEdit = async () => {
    if (busy) return;
    const text = instruction.trim();
    if (!text && pendingRegions.length === 0) {
      showToast("Describe a change (or mark a spot) first.", "info");
      return;
    }
    const base = convHeadBase(conv) || initialImage;
    if (!base) return;

    setBusy(true);
    try {
      const res = await fetchApi("/api/design/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base,
          instruction: text,
          regions: pendingRegions,
          referenceImages: refImage ? [refImage] : [],
          aspectRatio: aspectRatioLabel || undefined,
          zone: zone || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.error) {
        const gate = gateMessage(res.status, data);
        if (gate) {
          showToast(gate, res.status === 402 ? "info" : "warning");
          return;
        }
        showToast(data?.error || "Couldn't apply that edit. Try rephrasing.", "error");
        return;
      }

      // Mock mode (no Gemini key): the server echoes the base photo. Be honest and don't
      // stack a no-op turn — nothing actually changed.
      if (data.mock) {
        showToast("AI editing needs a Gemini key — preview unchanged.", "info");
        return;
      }
      if (!data.imageUrl) {
        showToast("No image came back from that edit.", "error");
        return;
      }

      // Region edits: composite the model output back over the base through a feathered
      // mask so everything OUTSIDE the marked spots stays pixel-identical. Whole-photo
      // edits use the model output directly.
      let comp = data.imageUrl;
      if (pendingRegions.length && typeof composite === "function") {
        comp = await composite(base, data.imageUrl, pendingRegions).catch(() => data.imageUrl);
      }
      const badged = await burnAiVizBadge(comp).catch(() => comp);

      setConv((c) =>
        convApply(c, {
          id: nextTurnId(),
          instruction: text || (pendingRegions.length ? "Placed marked spots" : "Edit"),
          image: badged,
          composite: comp,
          regions: pendingRegions,
          ts: Date.now(),
        }),
      );
      // Reset the per-edit inputs; the conversation continues from the new HEAD.
      setInstruction("");
      setPendingRegions([]);
      setRefImage(null);
      setComparing(true);
      showToast(data.cached ? "Edit applied (from cache)." : "Edit applied — stack another or compare.", "success");
    } catch (e) {
      console.error("iterative edit error", e);
      showToast("Network error applying the edit.", "error");
    } finally {
      setBusy(false);
    }
  };

  const doUndo = () => setConv((c) => convUndo(c));
  const doRedo = () => setConv((c) => convRedo(c));

  const commitToProposal = () => {
    const head = appliedTurns[appliedTurns.length - 1];
    if (!head) return;
    onCommit?.({ image: head.image, composite: head.composite || head.image });
    showToast("Sent this render to the proposal panel.", "success");
  };

  if (!initialImage) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3 opacity-50">
        <ImageIcon size={36} className="text-white/20" />
        <p className="text-[11px] uppercase tracking-widest font-black text-white/50 max-w-xs">
          Upload a yard photo to start an iterative edit conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Stage: marking canvas, compare slider, or the current HEAD frame. */}
      <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-black/40 border border-white/5">
        {marking ? (
          <div className="absolute inset-0 p-1">
            <MarkupCanvas backgroundImage={convHeadBase(conv) || initialImage} onSave={handleMarkFinalize} />
          </div>
        ) : comparing && hasEdits ? (
          <BeforeAfterSlider beforeImage={beforeImage} afterImage={headImage} />
        ) : (
          <img
            src={headImage}
            alt="Current design"
            className="absolute inset-0 w-full h-full object-contain"
            {...(headImage && !headImage.startsWith("data:") ? { crossOrigin: "anonymous" } : {})}
          />
        )}

        {busy && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-14 h-14 border-4 border-forest-500/20 border-t-forest-500 rounded-full animate-spin" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-forest-400">Applying your edit…</p>
          </div>
        )}
      </div>

      {/* View toggles + undo/redo */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setMarking((m) => !m); setComparing(false); }}
          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${marking ? "bg-forest-500 text-black" : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"}`}
        >
          <MapPin size={12} /> {marking ? "Marking…" : "Mark a spot"}
        </button>
        {hasEdits && (
          <button
            type="button"
            onClick={() => { setComparing((s) => !s); setMarking(false); }}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${comparing ? "bg-forest-500 text-black" : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"}`}
          >
            <Layers size={12} /> {comparing ? "Comparing" : "Before / After"}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={doUndo}
            disabled={!convCanUndo(conv)}
            title="Undo the last edit"
            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 size={12} /> Undo
          </button>
          <button
            type="button"
            onClick={doRedo}
            disabled={!convCanRedo(conv)}
            title="Redo"
            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Redo2 size={12} /> Redo
          </button>
        </div>
      </div>

      {/* Instruction + reference photo + apply */}
      <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-forest-400 flex items-center gap-2">
          <Sparkles size={12} /> Describe the next change
        </p>
        {pendingRegions.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-forest-300">
            <MapPin size={12} /> {pendingRegions.length} spot{pendingRegions.length > 1 ? "s" : ""} marked for this edit
            <button type="button" onClick={() => setPendingRegions([])} className="text-white/30 hover:text-red-400" aria-label="Clear marked spots">
              <X size={12} />
            </button>
          </div>
        )}
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") applyEdit(); }}
          rows={2}
          placeholder="e.g. Add a flagstone path from the porch to the gate — keep everything else the same"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white/90 placeholder:text-zinc-600 focus:border-forest-500/40 focus:outline-none resize-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input ref={refInputRef} type="file" accept="image/*" onChange={pickRefImage} className="hidden" />
          <button
            type="button"
            onClick={() => refInputRef.current?.click()}
            title="Attach a product/reference photo (e.g. the exact paver or plant)"
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${refImage ? "bg-forest-500/20 text-forest-300 border border-forest-500/30" : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"}`}
          >
            <ImageIcon size={12} /> {refImage ? "Reference attached" : "Add reference photo"}
          </button>
          {refImage && (
            <button type="button" onClick={() => setRefImage(null)} className="text-white/30 hover:text-red-400" aria-label="Remove reference photo">
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={applyEdit}
            disabled={busy}
            className="ml-auto px-5 py-2.5 bg-forest-500 text-black rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-forest-400 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 shadow-[0_0_20px_rgba(5,168,69,0.25)]"
          >
            {busy ? (
              <><div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Applying…</>
            ) : (
              <><Sparkles size={14} /> Apply Edit</>
            )}
          </button>
        </div>
      </div>

      {/* Edit conversation timeline */}
      {hasEdits && (
        <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-forest-400 flex items-center gap-2">
              <Layers size={12} /> Edit history ({appliedTurns.length})
            </p>
            {onCommit && (
              <button
                type="button"
                onClick={commitToProposal}
                title="Use the current render in the proposal (Save / PDF / Send)"
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"
              >
                <Send size={11} /> Use in proposal
              </button>
            )}
          </div>
          <ol className="space-y-1.5">
            {appliedTurns.map((t, i) => (
              <li key={t.id} className="flex items-center gap-2 text-[11px] text-white/70">
                <span className="w-5 h-5 shrink-0 rounded-full bg-forest-500/15 text-forest-300 text-[9px] font-black flex items-center justify-center">{i + 1}</span>
                <span className="truncate font-semibold">{t.instruction}</span>
                {t.regions?.length ? (
                  <span className="ml-auto shrink-0 text-[8px] font-black uppercase tracking-widest text-forest-400/70">{t.regions.length} spot{t.regions.length > 1 ? "s" : ""}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
