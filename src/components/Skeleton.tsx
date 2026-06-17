import React from "react";

interface SkeletonProps {
  className?: string;
  circle?: boolean;
}

export function Skeleton({ className = "", circle = false }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white/10 ${circle ? "rounded-full" : "rounded-lg"} ${className}`} />
  );
}
