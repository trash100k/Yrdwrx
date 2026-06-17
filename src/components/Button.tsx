import React, { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "forest";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-bold transition-all rounded-xl active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-white text-black hover:bg-zinc-200 shadow-xl shadow-white/10",
      secondary: "bg-white/5 text-white border border-white/10 hover:bg-white/10",
      danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-xl shadow-rose-500/20 text-white",
      forest: "bg-forest-500 text-white hover:bg-forest-600 shadow-xl shadow-forest-500/20 text-white",
      ghost: "text-zinc-400 hover:text-white hover:bg-white/5",
    };

    const sizes = {
      sm: "h-9 px-4 text-xs",
      md: "h-11 px-6 text-sm",
      lg: "h-14 px-8 text-base",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : leftIcon ? (
          <span className="mr-2">{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
