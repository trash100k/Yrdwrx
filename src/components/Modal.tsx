import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
}

export function Modal({ isOpen, onClose, title, children, maxWidth = "md" }: ModalProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={`w-full ${maxWidthClasses[maxWidth]} bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[90vh]`}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
              <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
              <button 
                onClick={onClose} 
                className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-full"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
