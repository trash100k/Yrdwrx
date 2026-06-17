import React from "react";
import { motion } from "motion/react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled = false, className = "" }: ToggleProps) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? "bg-forest-500" : "bg-white/10 border border-white/10"}`}></div>
        <motion.div
          className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full"
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>
      {label && <span className="text-sm font-medium text-zinc-300">{label}</span>}
    </label>
  );
}
