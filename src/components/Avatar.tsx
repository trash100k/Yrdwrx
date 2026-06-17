import React from "react";
import { User } from "lucide-react";

interface AvatarProps {
  src?: string;
  initials?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ src, initials, size = "md", className = "" }: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  return (
    <div className={`relative inline-flex items-center justify-center overflow-hidden rounded-full bg-white/10 border border-white/20 ${sizes[size]} ${className}`}>
      {src ? (
        <img src={src} alt="Avatar" className="w-full h-full object-cover" />
      ) : initials ? (
        <span className="font-bold text-white tracking-widest">{initials}</span>
      ) : (
        <User className="text-zinc-400 w-1/2 h-1/2" />
      )}
    </div>
  );
}
