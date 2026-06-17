import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({ content, children, position = "top", delay = 300 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const getPositionClasses = () => {
    switch (position) {
      case "top":
        return "bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom";
      case "bottom":
        return "top-full left-1/2 -translate-x-1/2 mt-2 origin-top";
      case "left":
        return "right-full top-1/2 -translate-y-1/2 mr-2 origin-right";
      case "right":
        return "left-full top-1/2 -translate-y-1/2 ml-2 origin-left";
      default:
        return "bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom";
    }
  };

  return (
    <div 
      className="relative flex items-center justify-center group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={`absolute z-[100] whitespace-nowrap bg-black border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-xl pointer-events-none ${getPositionClasses()}`}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
