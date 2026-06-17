import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "forest";
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const variants = {
    default: "bg-white/10 text-zinc-300 border-white/20",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    forest: "bg-forest-500/10 text-forest-400 border-forest-500/20",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
