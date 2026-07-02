import React from "react";
import { Plus, Users, Calendar, ReceiptText, FileText, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useRole } from "../hooks/useRole";

export const QuickCreateMenu = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const { role } = useRole();
  const rolePrefix = role === "employee" || role === "foreman" ? "/employee" : "/admin";

  // Each create deep-links straight into the target page's prefilled modal via ?create=<kind>
  // (the page opens it on mount and strips the param) — so "Create Invoice" lands the owner in
  // the invoice form, not on a page where they still have to find the button.
  const actions = [
    { id: "new_client", label: "New Client", icon: Users, path: `${rolePrefix}/crm?create=client`, bg: "bg-blue-500/10", border: "border-blue-500/20", color: "text-blue-400" },
    { id: "new_job", label: "Schedule Job", icon: Calendar, path: `${rolePrefix}/scheduler?create=job`, bg: "bg-forest-500/10", border: "border-forest-500/20", color: "text-forest-400" },
    { id: "new_invoice", label: "Create Invoice", icon: ReceiptText, path: `${rolePrefix}/invoices?create=invoice`, bg: "bg-amber-500/10", border: "border-amber-500/20", color: "text-amber-400" },
    { id: "new_quote", label: "Draft Quote", icon: FileText, path: `${rolePrefix}/crm`, bg: "bg-purple-500/10", border: "border-purple-500/20", color: "text-purple-400" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[190]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-20 right-32 sm:right-48 w-64 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[200]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/50">
              <h3 className="font-bold text-white text-sm tracking-tight flex items-center gap-2">
                 Quick Create
              </h3>
              <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors bg-white/5 border border-white/5 rounded-full">
                <X size={14} />
              </button>
            </div>
            
            <div className="p-2 space-y-1">
              {actions.map((action) => (
                 <button
                   key={action.id}
                   onClick={() => {
                     navigate(action.path);
                     onClose();
                   }}
                   className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left"
                 >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${action.bg} ${action.border}`}>
                      <action.icon size={14} className={action.color} />
                    </div>
                    <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                       {action.label}
                    </span>
                 </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
