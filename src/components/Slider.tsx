import React, { useId } from "react";

interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  id?: string;
  ariaLabel?: string;
  "aria-label"?: string;
}

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  disabled,
  className = "",
  label,
  id,
  ariaLabel,
  "aria-label": ariaLabelProp,
}: SliderProps) {
  const generatedId = useId();
  const inputId = id || (label ? `slider-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}` : generatedId);
  const computedAriaLabel = ariaLabelProp || ariaLabel || label || "Slider";
  const percentage = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <div className="flex justify-between items-center px-1">
          <label htmlFor={inputId} className="text-sm font-bold text-zinc-300 cursor-pointer">
            {label}
          </label>
          <span className="text-xs font-mono font-bold text-zinc-500">{value}</span>
        </div>
      )}
      <div className="relative flex items-center h-6 w-full">
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          aria-label={computedAriaLabel}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          className="absolute w-full h-full opacity-0 cursor-pointer peer z-20 disabled:cursor-not-allowed focus:outline-none"
        />
        {/* Track */}
        <div className="absolute w-full h-1.5 rounded-full bg-white/10 z-0 overflow-hidden pointer-events-none peer-focus-visible:ring-2 peer-focus-visible:ring-forest-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black">
           {/* Fill */}
           <div 
             className="h-full bg-forest-500 pointer-events-none transition-all duration-75" 
             style={{ width: `${percentage}%` }}
           />
        </div>
        {/* Thumb */}
        <div 
          className={`absolute h-4 w-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] pointer-events-none z-10 transition-transform peer-focus:scale-110 peer-hover:scale-110 peer-active:scale-95 ${disabled ? 'opacity-50' : ''}`}
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
    </div>
  );
}
