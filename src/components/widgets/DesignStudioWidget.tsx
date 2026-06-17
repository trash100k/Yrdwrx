import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Palette, Camera, ChevronRight, Image as ImageIcon, Map } from "lucide-react";

export default function DesignStudioWidget({
  flexOrder,
  isReel = false,
}: {
  flexOrder?: number;
  isReel?: boolean;
}) {
  return (
    <div
      style={{ order: flexOrder }}
      className={`relative ${
        isReel
          ? "w-80 sm:w-96 shrink-0 h-[400px]"
          : "bg-zinc-950 border border-white/5 molten-edge rounded-2xl p-5 sm:p-8 col-span-1 shadow-2xl space-y-6 flex flex-col justify-between group h-full"
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-xs md:text-[10px] bg-ember-500/20 text-ember-400 font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
            <Sparkles size={12} /> AI Workspace
          </span>
          <h4 className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
            Design Studio
          </h4>
        </div>
        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-ember-400">
          <Palette size={20} />
        </div>
      </div>

      <div className="flex-1 min-h-[100px] flex flex-col items-center justify-center space-y-4 py-4">
         <div className="flex -space-x-3">
           <div className="w-12 h-12 bg-zinc-900 border-2 border-zinc-950 rounded-xl flex items-center justify-center shadow-lg relative z-20 hover:-translate-y-1 transition-transform">
             <Camera size={20} className="text-forest-400" />
           </div>
           <div className="w-12 h-12 bg-zinc-900 border-2 border-zinc-950 rounded-xl flex items-center justify-center shadow-lg relative z-10 hover:-translate-y-1 transition-transform">
             <Map size={20} className="text-celtic-400" />
           </div>
           <div className="w-12 h-12 bg-zinc-900 border-2 border-zinc-950 rounded-xl flex items-center justify-center shadow-lg relative z-0 hover:-translate-y-1 transition-transform">
             <ImageIcon size={20} className="text-amber-400" />
           </div>
         </div>
         <p className="text-xs text-zinc-400 font-medium text-center">
            Upload photos, generate visual estimates, and extract item quantities.
         </p>
      </div>

      <Link
        to="design-studio"
        className="w-full mt-4 flex items-center justify-center gap-2 bg-ember-500 hover:bg-ember-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md group/btn outline-none focus:ring-2 focus:ring-ember-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
      >
        <span>Open Studio Editor</span>
        <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}
