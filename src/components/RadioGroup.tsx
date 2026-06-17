import React from "react";
import { motion } from "motion/react";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  className?: string;
  disabled?: boolean;
}

export function RadioGroup({ options, value, onChange, name, className = "", disabled }: RadioGroupProps) {
  const groupName = name || React.useId();

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const optionId = `${groupName}-${option.value}`;

        return (
          <label 
            key={option.value} 
            htmlFor={optionId}
            className={`flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}`}
          >
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="radio"
                id={optionId}
                name={groupName}
                value={option.value}
                checked={isSelected}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="sr-only peer"
              />
              <div className={`w-5 h-5 rounded-full border transition-all flex items-center justify-center ${isSelected ? 'border-forest-500' : 'border-white/20 bg-black/40'} ${disabled ? '' : 'group-hover:border-white/40'}`}>
                <motion.div
                  initial={false}
                  animate={{ scale: isSelected ? 1 : 0, opacity: isSelected ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-2.5 h-2.5 rounded-full bg-forest-500"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-bold transition-colors ${isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                {option.label}
              </span>
              {option.description && (
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{option.description}</p>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
