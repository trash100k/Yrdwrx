import React from "react";
import { LucideIcon } from "lucide-react";
import { motion } from "motion/react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-[24px] border border-white/5 bg-black/20 backdrop-blur-sm p-12 text-center flex flex-col items-center justify-center min-h-[300px]"
    >
       <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
          <Icon size={32} className="text-zinc-500" />
       </div>
       <h3 className="text-xl font-bold text-white mb-2 tracking-tight">{title}</h3>
       <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed mb-6">
         {description}
       </p>
       {action && (
         <button
           onClick={action.onClick}
           className="px-6 py-3 bg-white text-black text-sm font-bold rounded-xl hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10"
         >
           {action.label}
         </button>
       )}
    </motion.div>
  );
}
