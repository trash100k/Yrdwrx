import React from "react";
import { motion } from "motion/react";
import { Leaf } from "lucide-react";

interface LoaderProps {
  size?: number;
  text?: string;
  fullScreen?: boolean;
}

export function Loader({ size = 32, text = "Loading...", fullScreen = false }: LoaderProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
       <div className={`relative flex items-center justify-center`} style={{ width: size, height: size }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-2 border-forest-500/20 border-t-forest-500 rounded-full"
          />
          <Leaf className="text-forest-500 absolute" size={size * 0.4} />
       </div>
       {text && <p className="text-[10px] font-black uppercase tracking-[0.2em] text-forest-500/60 animate-pulse">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950 backdrop-blur-sm">
         {content}
      </div>
    );
  }

  return content;
}
