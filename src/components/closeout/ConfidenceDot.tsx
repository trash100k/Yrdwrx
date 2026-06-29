// @ts-nocheck
import React from "react";

export type RiskLevel = "low" | "medium" | "high";

const RISK_STYLES: Record<RiskLevel, { dot: string; ring: string; label: string; text: string }> = {
  low: {
    dot: "bg-forest-500",
    ring: "shadow-[0_0_12px_rgba(5,168,69,0.6)]",
    label: "AUTO",
    text: "text-forest-400",
  },
  medium: {
    dot: "bg-amber-400",
    ring: "shadow-[0_0_12px_rgba(251,191,36,0.6)]",
    label: "REVIEW",
    text: "text-amber-400",
  },
  high: {
    dot: "bg-rose-500",
    ring: "shadow-[0_0_12px_rgba(244,63,94,0.6)]",
    label: "CONFIRM",
    text: "text-rose-400",
  },
};

interface ConfidenceDotProps {
  risk?: RiskLevel | string;
  showLabel?: boolean;
  size?: number;
  className?: string;
}

/**
 * Risk-tier indicator for closeout action cards.
 * low = forest (auto / pre-checked), medium = amber (one-tap), high = rose (explicit confirm).
 */
export function ConfidenceDot({ risk = "low", showLabel = true, size = 12, className = "" }: ConfidenceDotProps) {
  const style = RISK_STYLES[(risk as RiskLevel)] || RISK_STYLES.low;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`inline-block rounded-full ${style.dot} ${style.ring}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
      {showLabel && (
        <span className={`text-[10px] font-black uppercase tracking-widest ${style.text}`}>
          {style.label}
        </span>
      )}
    </div>
  );
}

export default ConfidenceDot;
