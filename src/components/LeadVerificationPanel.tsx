import React from "react";
import { Check, X, ShieldAlert, Target } from "lucide-react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Customer } from "../types";
import { useToast } from "../contexts/ToastContext";
import { useAuditLog } from "../hooks/useAuditLog";

interface LeadVerificationPanelProps {
  leads: Customer[];
}

export function LeadVerificationPanel({ leads }: LeadVerificationPanelProps) {
  const { showToast } = useToast();
  const { logAction } = useAuditLog();

  if (!leads || leads.length === 0) return null;

  const handleApprove = async (lead: Customer) => {
    try {
      await updateDoc(doc(db, "customers", lead.id!), {
        status: "ACTIVE", // or leave it without status if not required
        priority: true, // we could default priority or let them configure
      });
      showToast(`${lead.firstName} ${lead.lastName} has been approved and added to CRM.`, "success");
      logAction("CRM", "Lead Approved", `Approved lead: ${lead.firstName} ${lead.lastName}`);
    } catch (err: any) {
      showToast("Failed to approve lead", "error");
    }
  };

  const handleDeny = async (leadId: string, leadName: string) => {
    try {
      await deleteDoc(doc(db, "customers", leadId));
      showToast("Lead has been denied and removed.", "success");
      logAction("CRM", "Lead Denied", `Denied and removed lead: ${leadName}`);
    } catch (err: any) {
      showToast("Failed to deny lead", "error");
    }
  };

  return (
    <div className="mb-6 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl relative overflow-hidden">
      <div className="absolute right-0 top-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl rounded-full pointer-events-none transform translate-x-1/2 -translate-y-1/4"></div>
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
          <ShieldAlert size={20} className="text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white italic tracking-tight flex items-center gap-2">
            Pending Lead Approvals <span className="text-xs bg-red-500 text-black px-2 py-0.5 rounded-full not-italic">{leads.length}</span>
          </h3>
          <p className="text-xs text-red-400 font-medium">Verify incoming leads submitted by field personnel.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.map(lead => (
          <div key={lead.id} className="bg-black/40 border border-red-500/20 p-4 rounded-xl flex flex-col justify-between group hover:border-red-500/40 transition-colors">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-bold text-white uppercase text-sm tracking-widest">{lead.firstName} {lead.lastName}</h4>
                <Target size={14} className="text-red-400/50" />
              </div>
              <div className="space-y-1 mb-4 text-xs text-white/50">
                <p><span className="text-white/30 font-bold uppercase tracking-widest text-[9px]">Address:</span> {lead.address}</p>
                <p><span className="text-white/30 font-bold uppercase tracking-widest text-[9px]">Phone:</span> {lead.phone}</p>
                <p><span className="text-white/30 font-bold uppercase tracking-widest text-[9px]">Email:</span> {lead.email}</p>
                {lead.notes && (
                  <p className="mt-2 text-white/70 italic border-l-2 border-red-500/30 pl-2">
                    "{lead.notes}"
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-4 border-t border-red-500/10">
              <button 
                onClick={() => handleApprove(lead)}
                className="flex-1 bg-forest-500/10 hover:bg-forest-500 text-forest-400 hover:text-black border border-forest-500/30 font-black uppercase tracking-widest text-[10px] py-2 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Check size={12} /> Approve
              </button>
              <button 
                onClick={() => handleDeny(lead.id!, `${lead.firstName} ${lead.lastName}`)}
                className="flex-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 font-black uppercase tracking-widest text-[10px] py-2 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <X size={12} /> Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
