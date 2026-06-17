import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";

interface AccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  className?: string;
}

export function Accordion({ items, allowMultiple = false, className = "" }: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) next.clear();
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <div key={item.id} className="border border-white/10 bg-black/20 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(item.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
            >
              <span className="font-semibold text-white">{item.title}</span>
              <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={18} className="text-zinc-400" />
              </motion.div>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="p-4 border-t border-white/10 text-zinc-300">
                    {item.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
