import React from "react";

interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function Slider({ min = 0, max = 100, step = 1, value, onChange, disabled, className = "", label }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <div className="flex justify-between items-center px-1">
          <label className="text-sm font-bold text-zinc-300">{label}</label>
          <span className="text-xs font-mono font-bold text-zinc-500">{value}</span>
        </div>
      )}
      <div className="relative flex items-center h-6 w-full">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="absolute w-full h-full opacity-0 cursor-pointer peer z-20 disabled:cursor-not-allowed"
        />
        {/* Track */}
        <div className="absolute w-full h-1.5 rounded-full bg-white/10 z-0 overflow-hidden pointer-events-none">
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
