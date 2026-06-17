import React from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AlertProps {
  title?: string;
  children: React.ReactNode;
  variant?: "info" | "success" | "warning" | "error";
  onClose?: () => void;
  className?: string;
}

export function Alert({ title, children, variant = "info", onClose, className = "" }: AlertProps) {
  const styles = {
    info: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      icon: <Info className="text-blue-400" size={20} />,
      titleColor: "text-blue-400",
    },
    success: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      icon: <CheckCircle2 className="text-emerald-400" size={20} />,
      titleColor: "text-emerald-400",
    },
    warning: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      icon: <AlertTriangle className="text-amber-400" size={20} />,
      titleColor: "text-amber-400",
    },
    error: {
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      icon: <AlertCircle className="text-rose-400" size={20} />,
      titleColor: "text-rose-400",
    },
  };

  const currentStyle = styles[variant];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`flex p-4 rounded-2xl border ${currentStyle.bg} ${currentStyle.border} ${className}`}
        role="alert"
      >
        <div className="flex-shrink-0 mt-0.5">{currentStyle.icon}</div>
        <div className="ml-3 flex-1">
          {title && <h3 className={`text-sm font-bold tracking-tight mb-1 ${currentStyle.titleColor}`}>{title}</h3>}
          <div className="text-sm text-zinc-300 leading-relaxed">{children}</div>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
