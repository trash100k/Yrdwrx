// @ts-nocheck

import React, { useState, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useCuttyGuide } from "../contexts/CuttyGuideContext";
import { ChevronRight, X, Sparkles, Target } from "lucide-react";
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
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const { width, height } = tooltipRef.current.getBoundingClientRect();
      setTooltipSize({ width, height });
    }
  }, [currentTourStep, activeFocus?.id]);
  
  if (!isTourActive || !activeFocus) return null;
  const { rect } = activeFocus;
  const isLastStep = currentTourStep === tourSteps.length - 1;
  const isMobile = window.innerWidth < 768;

  /* Calculate position with dynamic size and placement awareness */ 
  const getPlacement = () => {
      // If mobile or no target element, just center/dock to bottom
      if (isMobile || !rect) {
        return { 
          style: {
            bottom: isMobile ? '16px' : '50%',
            left: isMobile ? '16px' : '50%',
            right: isMobile ? '16px' : undefined,
            transform: isMobile ? 'none' : 'translate(-50%, -50%)',
            width: isMobile ? 'calc(100vw - 32px)' : '320px'
          },
          arrowClass: "hidden", 
          arrowPos: "" 
        };
      }

      const padding = 24;
      const { width: tw, height: th } = tooltipSize;
      /* Default: Bottom */ let left = rect.left + rect.width / 2 - tw / 2;
      let top = rect.bottom + padding;
      let arrowClass = "border-b-forest-500/80 -top-3";
      let arrowPos = "left-1/2 -translate-x-1/2";
      
      /* If not enough space at bottom, try top */ 
      if (top + th > window.innerHeight - 20) {
        top = rect.top - th - padding;
        arrowClass = "border-t-forest-500/80 -bottom-3";
      }
      
      /* Keep within horizontal bounds */ 
      left = Math.max(20, Math.min(window.innerWidth - tw - 20, left));
      
      return { 
        style: { left, top }, 
        arrowClass, 
        arrowPos 
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
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          ...placement.style
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`absolute pointer-events-auto ${!isMobile && rect ? 'sm:w-[320px]' : ''}`}
        style={!isMobile && !rect ? placement.style : {}}
      >
        {" "}
        <div className=" bg-black/90 backdrop-blur-3xl border-forest-500/30 p-6 sm:p-8 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)]">
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
        {rect && !isMobile && (
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
