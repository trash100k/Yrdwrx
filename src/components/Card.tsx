import React from "react";

export function Card({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-xl ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 border-b border-white/5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`font-bold text-white tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-sm text-zinc-400 mt-1 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 pt-0 flex items-center ${className}`} {...props}>
      {children}
    </div>
  );
}
