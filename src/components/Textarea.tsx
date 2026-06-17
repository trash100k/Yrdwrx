import React, { TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", label, error, helpText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;

    return (
      <div className={`w-full flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label htmlFor={textareaId} className="text-xs font-bold text-zinc-300 ml-1">
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            id={textareaId}
            ref={ref}
            className={`w-full bg-black/40 border transition-all rounded-xl p-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20" : "border-white/10 focus:border-white/20 focus:ring-white/10 hover:border-white/20"}
              min-h-[100px] resize-y
            `}
            {...props}
          />
          {error && (
            <div className="absolute right-3.5 top-3.5 text-zinc-500 pointer-events-none">
              <AlertCircle className="text-rose-500" size={18} />
            </div>
          )}
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-xs text-rose-500 ml-1 font-medium"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        {helpText && !error && (
          <p className="text-xs text-zinc-500 ml-1">{helpText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
