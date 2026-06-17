import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false
}: ConfirmDialogProps) {
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
            className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10"
          >
            <div className="p-6">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border ${danger ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-forest-500/10 border-forest-500/20 text-forest-500'}`}>
                  <AlertTriangle size={24} />
               </div>
               <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
               <p className="text-zinc-400 text-sm leading-relaxed mb-8">{description}</p>
               
               <div className="flex gap-3 mt-4">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={() => {
                      onConfirm();
                      onClose();
                    }}
                    className={`flex-1 px-4 py-3 text-white rounded-xl text-sm font-bold shadow-xl transition-all hover:scale-105 active:scale-95 ${danger ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-forest-500 hover:bg-forest-600 shadow-forest-500/20'}`}
                  >
                    {confirmText}
                  </button>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
