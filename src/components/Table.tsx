import React from "react";

export function Table({ className = "", ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-3xl border border-white/10 bg-zinc-950 shadow-xl custom-scrollbar">
      <table className={`w-full text-sm text-left ${className}`} {...props} />
    </div>
  );
}

export function TableHeader({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`text-[10px] uppercase bg-black/60 backdrop-blur-md text-zinc-400 font-bold tracking-widest border-b border-white/10 ${className}`} {...props} />;
}

export function TableBody({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-white/5 ${className}`} {...props} />;
}

export function TableRow({ className = "", ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`hover:bg-white/[0.02] transition-colors ${className}`} {...props} />;
}

export function TableHead({ className = "", ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-6 py-5 ${className}`} {...props} />;
}

export function TableCell({ className = "", ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-6 py-4 text-zinc-300 ${className}`} {...props} />;
}
