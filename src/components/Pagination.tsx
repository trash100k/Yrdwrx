import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, className = "" }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      
      <span className="text-sm font-medium text-zinc-500 px-2 min-w-[4rem] text-center">
        <span className="text-white">{currentPage}</span> / {totalPages}
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
