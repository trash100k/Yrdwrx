// @ts-nocheck

import React, { createContext, useContext, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";

interface ToastContextType {
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string, type?: "success" | "error" | "info" | "warning") => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50 max-w-lg bg-emerald-950 border border-emerald-500/30 text-emerald-100 px-6 py-4 rounded-3xl shadow-[0_0_40px_rgba(16,185,129,0.3)] text-sm font-bold flex items-center gap-4"
          >
            <Sparkles className="text-emerald-400 shrink-0" size={18} />
            <span>{notification}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-auto text-emerald-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
