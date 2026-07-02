// @ts-nocheck

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useCuttyGuide } from "../contexts/CuttyGuideContext";
import { ChevronRight, X, Sparkles } from "lucide-react";
export default function WalkthroughOverlay() {
  const {
    activeFocus,
    isTourActive,
    currentTourStep,
    tourSteps,
    nextTourStep,
    endTour,
  } = useCuttyGuide();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 280 });
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
  }));
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const { width, height } = tooltipRef.current.getBoundingClientRect();
      setTooltipSize({ width, height });
    }
  }, [currentTourStep, activeFocus?.id, activeFocus?.description]);
  useEffect(() => {
    const onResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  if (!isTourActive || !activeFocus) return null;
  const { rect } = activeFocus;
  const isLastStep = currentTourStep === tourSteps.length - 1;
  const vw = viewport.width;
  const vh = viewport.height;
  /* Very small screens always get the centered fallback card */
  const isCompact = vw < 640;
  const margin = 16;
  /* A missing, zero-size, or fully off-screen target can't be spotlighted —
     fall back to the centered card instead of anchoring at 0,0 */
  const rectUsable =
    !!rect &&
    rect.width + rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < vh &&
    rect.right > 0 &&
    rect.left < vw;

  const tw = Math.min(tooltipSize.width || 320, vw - margin * 2);
  const th = tooltipSize.height || 280;
  const cardWidth = Math.min(320, vw - margin * 2);

  /* Calculate position with dynamic size, viewport clamping, and fallbacks */
  const getPlacement = () => {
    const centered = {
      style: {
        left: Math.max(margin, (vw - tw) / 2),
        top: Math.max(margin, (vh - th) / 2),
        width: isCompact ? vw - margin * 2 : cardWidth,
      },
      arrowClass: "hidden",
      arrowPos: "",
    };
    if (isCompact || !rectUsable) return centered;

    const padding = 24;
    /* Default: Bottom */
    let left = rect.left + rect.width / 2 - tw / 2;
    let top = rect.bottom + padding;
    let arrowClass = "border-b-forest-500/80 -top-3";
    const arrowPos = "left-1/2 -translate-x-1/2";

    /* If not enough space at bottom, try top */
    if (top + th > vh - margin) {
      top = rect.top - th - padding;
      arrowClass = "border-t-forest-500/80 -bottom-3";
    }
    /* Neither above nor below fits — use the centered card */
    if (top < margin) return centered;

    /* Clamp fully inside the viewport (no off-screen tooltips) */
    left = Math.max(margin, Math.min(vw - tw - margin, left));
    top = Math.max(margin, Math.min(vh - th - margin, top));

    return {
      style: { left, top, width: cardWidth },
      arrowClass,
      arrowPos,
    };
  };
  const placement = getPlacement();

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {" "}
      {/* Dim backdrop */}{" "}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 pointer-events-auto"
        onClick={endTour}
      />{" "}
      {/* The Highlight Tooltip */}{" "}
      <motion.div
        key={activeFocus.id || currentTourStep}
        ref={tooltipRef}
        initial={{
          opacity: 0,
          y: 20,
          scale: 0.95,
          left: placement.style.left,
          top: placement.style.top,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          left: placement.style.left,
          top: placement.style.top,
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute pointer-events-auto"
        style={{ width: placement.style.width }}
      >
        {" "}
        <div
          className=" bg-black/90 backdrop-blur-3xl border-forest-500/30 p-6 sm:p-8 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-y-auto"
          style={{ maxHeight: vh - margin * 2 }}
        >
          {" "}
          <header className="flex items-center justify-between mb-4 sm:mb-6">
            {" "}
            <div className="flex items-center gap-2 px-2 py-1 bg-forest-500/10 rounded-full">
              {" "}
              <Sparkles size={10} className="text-forest-400" />{" "}
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-forest-400">
                Step {currentTourStep + 1} / {tourSteps.length}
              </span>{" "}
            </div>{" "}
            <button
              onClick={endTour}
              className="text-white/20 hover:text-white transition-colors p-2 -mr-2"
              aria-label="End tour"
            >
              {" "}
              <X size={16} />{" "}
            </button>{" "}
          </header>{" "}
          <h3 className="text-lg sm:text-xl font-black italic text-white uppercase tracking-tight mb-2 leading-none">
            {" "}
            {activeFocus.label}{" "}
          </h3>{" "}
          <p className="text-xs sm:text-sm text-white/60 leading-relaxed italic mb-8">
            {" "}
            {activeFocus.description}{" "}
          </p>{" "}
          <button
            onClick={nextTourStep}
            className="w-full py-4 bg-white text-black rounded-xl sm:rounded-2xl font-black text-xs md:text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl"
          >
            {" "}
            {isLastStep ? "Finish Walkthrough" : "Next Step"}{" "}
            {!isLastStep && <ChevronRight size={14} />}{" "}
          </button>{" "}
        </div>{" "}
        {/* Pointer Arrow */}{" "}
        <div
          className={`absolute w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[12px] border-b-transparent ${placement.arrowClass} ${placement.arrowPos}`}
        />{" "}
      </motion.div>{" "}
      {/* Target Marker (Animated ping) */}{" "}
      <AnimatePresence>
        {rectUsable && !isCompact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              left: rect.left + rect.width / 2,
              top: rect.top + rect.height / 2,
            }}
            exit={{ opacity: 0 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          >
            {" "}
            <div className="w-full h-full bg-forest-400 rounded-full animate-ping opacity-75" />{" "}
            <div className="absolute inset-0 w-full h-full bg-forest-400 rounded-full shadow-[0_0_15px_#10b981]" />{" "}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
