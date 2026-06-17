import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  position?: "left" | "right";
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export function Drawer({ isOpen, onClose, title, children, position = "right", size = "md" }: DrawerProps) {
  const positionClasses = {
    left: "left-0 top-0 bottom-0 border-r border-white/10",
    right: "right-0 top-0 bottom-0 border-l border-white/10"
  };

  const sizeClasses = {
    sm: "w-full max-w-sm",
    md: "w-full max-w-md",
    lg: "w-full max-w-lg",
    xl: "w-full max-w-xl",
    full: "w-full"
  };

  const initialX = position === "right" ? "100%" : "-100%";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: initialX }}
            animate={{ x: 0 }}
            exit={{ x: initialX }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`absolute ${positionClasses[position]} ${sizeClasses[size]} bg-zinc-950 shadow-2xl flex flex-col`}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
              <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
              <button 
                onClick={onClose} 
                className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 relative">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
