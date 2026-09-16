import React from "react";

interface SkeletonProps {
  className?: string;
  circle?: boolean;
  ariaLabel?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export function Skeleton({
  className = "",
  circle = false,
  ariaLabel = "Loading...",
  "aria-hidden": ariaHidden,
}: SkeletonProps) {
  if (ariaHidden === true || ariaHidden === "true") {
    return (
      <div
        aria-hidden="true"
        className={`animate-pulse bg-white/10 ${circle ? "rounded-full" : "rounded-lg"} ${className}`}
      />
    );
  }

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`animate-pulse bg-white/10 ${circle ? "rounded-full" : "rounded-lg"} ${className}`}
    />
  );
}
