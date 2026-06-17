import React, { InputHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, helpText, leftIcon, rightIcon, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className={`w-full flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label htmlFor={inputId} className="text-xs font-bold text-zinc-300 ml-1">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-zinc-500 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-black/40 border transition-all rounded-xl h-12 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? "pl-11" : "pl-4"} 
              ${rightIcon || error ? "pr-11" : "pr-4"}
              ${error ? "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20" : "border-white/10 focus:border-white/20 focus:ring-white/10 hover:border-white/20"}
            `}
            {...props}
          />
          {(rightIcon || error) && (
            <div className="absolute right-3.5 text-zinc-500 flex items-center">
              {error ? <AlertCircle className="text-rose-500" size={18} /> : rightIcon}
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

Input.displayName = "Input";
