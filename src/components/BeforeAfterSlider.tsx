import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Camera } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  imageAspectRatio?: number | null;
}

export default function BeforeAfterSlider({ beforeImage, afterImage, imageAspectRatio }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePositionChange = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let position = (x / rect.width) * 100;
    if (position < 0) position = 0;
    if (position > 100) position = 100;
    setSliderPosition(position);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    if (e.touches[0]) {
      handlePositionChange(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handlePositionChange(e.clientX);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="flex-1 w-full h-full flex items-center justify-center min-h-0 p-4 relative">
      <div 
        ref={containerRef}
        className="relative rounded-2xl border border-white/10 bg-black/40 overflow-hidden shadow-2xl cursor-ew-resize group flex items-center justify-center"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
      >
        {/* Sizer */}
        <img 
          src={beforeImage}
          className="invisible pointer-events-none"
          style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
          alt="sizer"
          crossOrigin="anonymous"
        />

        {/* Before Canvas - Ambient base */}
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          <img
            src={beforeImage}
            alt="Before Yard"
            className="w-full h-full object-fill pointer-events-none"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        </div>

        {/* After Canvas - Controlled split using clipPath */}
        <div className="absolute inset-0 w-full h-full pointer-events-none"
             style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
        >
          <img
            src={afterImage}
            alt="After Yard Design"
            className="w-full h-full object-fill pointer-events-none"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        </div>

        {/* Slide vertical bar line controller */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white hover:bg-emerald-400 transition-colors pointer-events-none"
          style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black border-2 border-white text-white flex items-center justify-center shadow-2xl font-black">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8L22 12L18 16" />
              <path d="M6 8L2 12L6 16" />
            </svg>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 text-[10px] text-white font-black uppercase tracking-widest pointer-events-none flex items-center gap-1.5 z-10">
          <Camera size={12} className="text-zinc-400" />
          Before (Original)
        </div>
        <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-emerald-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg pointer-events-none flex items-center gap-1.5 z-10">
          <Sparkles size={12} className="text-black" />
          After (Gemini Vision)
        </div>

        {/* Interactive slider hint overlay */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 rounded-full text-[9px] text-emerald-400 font-black uppercase tracking-[0.2em] pointer-events-none group-hover:opacity-0 transition-opacity z-10">
          Drag to Swipe Comparison
        </div>
      </div>
    </div>
  );
}
