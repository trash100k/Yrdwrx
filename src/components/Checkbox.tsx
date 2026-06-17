import React from "react";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", label, description, checked, onChange, disabled, id, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;

    return (
      <div className={`flex items-start gap-3 ${className}`}>
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            type="checkbox"
            id={checkboxId}
            ref={ref}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${checked ? 'bg-forest-500 border-forest-500 text-white' : 'border-white/20 bg-black/40'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer peer-hover:border-white/40'}`}>
            <AnimatePresence>
              {checked && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <Check size={14} strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label htmlFor={checkboxId} className={`text-sm font-bold ${disabled ? 'text-zinc-500 cursor-not-allowed' : 'text-zinc-200 cursor-pointer transition-colors hover:text-white'}`}>
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
