import React, { useState } from "react";
import { Customer } from "../types";
import { Link2, Send, ExternalLink, ShieldCheck } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useToast } from "../contexts/ToastContext";

export const CustomerPortalCard = ({ customer }: { customer: Customer }) => {
  const { showToast } = useToast();
  const [isSending, setIsSending] = useState(false);
  
  const portalUrl = `${window.location.origin}/portal/${customer.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    showToast("Client Portal Link copied", "success");
  };

  const handleSendInvite = async () => {
    setIsSending(true);
    try {
      if(customer.id) {
         await updateDoc(doc(db, "customers", customer.id), { 
            magicLinkSentAt: new Date().toISOString(),
            magicLinkSentCount: (customer.magicLinkSentCount || 0) + 1
         });
         showToast("Portal invite sent to client's email", "success");
      }
    } catch(err) {
       console.error(err);
       showToast("Failed to send invite", "error");
    } finally {
       setIsSending(false);
    }
  };

  return (
    <div className="bg-white/5 rounded-2xl p-10 border border-white/5 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors" />
      
      <div className="flex items-center gap-3 mb-8 relative z-10">
        <ShieldCheck size={20} className="text-blue-400" />
        <h4 className="text-xs md:text-[10px] text-blue-400 font-black uppercase tracking-widest">
          Client Portal
        </h4>
      </div>

      <p className="text-sm font-medium text-white/60 mb-6 relative z-10 leading-relaxed">
        Give your client direct access to view their estimates, pay invoices, and review upcoming jobs securely via magic link.
      </p>
      
      {customer.magicLinkSentAt && (
         <div className="mb-6 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
           <p className="text-xs font-bold text-blue-400 uppercase tracking-widest text-center">Last sent: {new Date(customer.magicLinkSentAt).toLocaleDateString()}</p>
         </div>
      )}

      <div className="flex flex-col gap-3 relative z-10">
        <button 
          onClick={handleSendInvite}
          disabled={!customer.email || isSending}
          className="w-full bg-blue-500 text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={14} /> 
          {customer.email ? (isSending ? "Sending..." : "Email Portal Invite") : "No Email on File"}
        </button>
        
        <div className="flex gap-3">
          <button 
            onClick={handleCopyLink}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2"
          >
            <Link2 size={14} /> Copy Link
          </button>
          
          <a 
            href={portalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2 text-center"
          >
            <ExternalLink size={14} /> View As
          </a>
        </div>
      </div>
    </div>
  );
};
