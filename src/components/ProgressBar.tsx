import React from "react";
import { motion } from "motion/react";

interface ProgressBarProps {
  progress: number;
  label?: string;
  ariaLabel?: string;
  showValue?: boolean;
  color?: string;
  height?: string;
  className?: string;
}

export function ProgressBar({ 
  progress, 
  label, 
  ariaLabel,
  showValue = true, 
  color = "bg-forest-500", 
  height = "h-2",
  className = ""
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  return (
    <div
      className={`w-full ${className}`}
      role="progressbar"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || label || "Progress"}
    >
      {(label || showValue) && (
        <div className="flex justify-between items-end mb-2">
          {label && <span className="text-xs font-bold text-zinc-300">{label}</span>}
          {showValue && <span className="text-[10px] font-mono text-zinc-500">{clampedProgress.toFixed(0)}%</span>}
        </div>
      )}
      <div className={`w-full bg-white/5 rounded-full overflow-hidden ${height}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}
