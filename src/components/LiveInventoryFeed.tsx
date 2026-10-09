// @ts-nocheck

import React, { useState, useEffect, useRef } from "react";
import { inventoryRepo } from "../lib/repos";
import {
  Package,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export function LiveInventoryFeed() {
  const [items, setItems] = useState<
    { id: string; name: string; stock: number; location?: string }[]
  >([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // RLS scopes inventory to the caller's tenant; subscribe pushes a fresh full list on any change.
    const unsub = inventoryRepo.subscribe((rows) => {
      const docs = (rows || []).map((r: any) => ({ ...(r.data || {}), ...r }));
      setItems(docs);
    });
    return unsub;
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const amount = direction === "left" ? -280 : 280;
      scrollContainerRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  return (
    <div
      role="region"
      aria-label="Live Inventory Feed"
      className="w-full bg-black/40 backdrop-blur-xl border-y border-white/5 h-32 relative group overflow-hidden"
    >
      <div className="absolute top-0 left-0 bottom-0 w-32 bg-linear-to-r from-black to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 right-0 bottom-0 w-32 bg-linear-to-l from-black to-transparent z-10 pointer-events-none" />

      {/* Navigation Buttons */}
      {items.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll inventory left"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-forest-500 focus:outline-none"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll inventory right"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-forest-500 focus:outline-none"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      <div
        ref={scrollContainerRef}
        className="flex px-6 sm:px-12 h-full items-center gap-6 overflow-x-auto custom-scrollbar-hide scroll-smooth"
      >
        {items.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-white/50 text-xs font-medium">
            <Package size={16} className="text-white/30" />
            <span>No inventory items tracked yet. Add items in inventory management.</span>
          </div>
        ) : (
          items.map((item) => {
            const qty = Number(item.quantity ?? item.stock ?? 0);
            const min = Number(item.minQuantity ?? item.minThreshold ?? 0);
            const unit = item.unit || "units";
            const low = min > 0 && qty < min;
            return (
              <div
                key={item.id}
                className={`flex-none w-64 h-24 p-4 rounded-2xl border transition-all ${
                  low ? "bg-rose-500/10 border-rose-500/30" : "bg-white/5 border-white/5"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package size={14} className={low ? "text-rose-400" : "text-white/40"} />
                    <span className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/40 truncate w-32">
                      {item.name}
                    </span>
                  </div>
                  {low && (
                    <div className="flex items-center gap-1 animate-pulse">
                      <AlertTriangle size={12} className="text-rose-400" />
                      <span className="text-[8px] font-black text-rose-400 uppercase tracking-normal md:tracking-tighter">
                        Low Stock
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <span
                      className={`text-xl sm:text-2xl font-black italic tracking-normal md:tracking-tighter ${
                        low ? "text-rose-400" : "text-white"
                      }`}
                    >
                      {qty}
                    </span>
                    <span className="text-xs md:text-[10px] font-bold text-white/20 ml-2 uppercase">
                      {unit}
                    </span>
                  </div>
                  {min > 0 && (
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">
                        Target
                      </span>
                      <span className="text-xs md:text-[10px] font-bold text-white/40">
                        {min} {unit}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
