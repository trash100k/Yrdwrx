// @ts-nocheck
import React, { useState } from "react";
import { useTenant } from "../contexts/TenantContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { Leaf, Handshake, CheckCircle2 } from "lucide-react";
import { safeStorage } from "../lib/storage";

export default function DisclaimerModal() {
  const { tenant } = useTenant();
  const [accepted, setAccepted] = useState(() => {
    try {
      return safeStorage.getItem("cutty_ai_disclaimer_accepted") === "true";
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  // If we don't have a tenant, or they already accepted (both local state and remote), hide barrier
  if (accepted || tenant?.legal?.aiDisclaimerAccepted) {
      return null;
  }

  const handleAccept = async () => {
    setLoading(true);
    try {
      safeStorage.setItem("cutty_ai_disclaimer_accepted", "true");
      if (tenant && !tenant.id.startsWith("demo-")) {
          const ref = doc(db, "tenants", tenant.id);
          await updateDoc(ref, {
            "legal.aiDisclaimerAccepted": true,
            "legal.acceptedAt": new Date().toISOString()
          });
      }
      setAccepted(true);
    } catch (e) {
      console.error(e);
      // Fallback for demo mode
      setAccepted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          className="max-w-xl w-full bg-zinc-950 border border-forest-500/20 shadow-2xl shadow-forest-500/5 rounded-2xl p-8 md:p-10 relative overflow-hidden"
        >
          {/* Subtle Background Glow */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-forest-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="flex items-center gap-4 text-forest-500 mb-8 relative z-10">
            <div className="p-4 bg-forest-500/10 rounded-2xl hidden sm:block">
               <Leaf size={32} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">AI Usage Agreement</h2>
              <p className="text-xs uppercase tracking-widest text-forest-500/60 font-bold mt-1">Empowering Good People</p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-white/80 relative z-10">
            <p>
              Welcome to the YardWorx Green platform. Before we get to work, let's set a few quick expectations about how our AI assistant operates to keep things smooth and safe:
            </p>

            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                <h3 className="font-bold text-white mb-1 flex items-center gap-2"><Handshake size={16} className="text-forest-400"/> 1. You're the Boss</h3>
                <p className="text-white/60">Our AI suggestions for routes, CRM follow-ups, and schedules are just that—suggestions. Always double-check AI-drafted messages and material estimates before finalizing.</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                <h3 className="font-bold text-white mb-1 flex items-center gap-2"><Leaf size={16} className="text-forest-400"/> 2. Field Safety First</h3>
                <p className="text-white/60">For the Compliance tool, the AI weather check is a helpful guide. However, your skilled on-site crew members always have the final say on whether it's safe to apply chemicals securely.</p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 mt-8 relative z-10 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
                className="peer appearance-none w-5 h-5 rounded-[4px] border-2 border-forest-500/50 checked:bg-forest-500 checked:border-forest-500 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-forest-500/50"
              />
              <CheckCircle2 size={12} className="absolute text-black opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth={4} />
            </div>
            <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors select-none leading-tight">
              I have read the guidelines and understand that I am ultimately responsible for my results and application safety.
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={loading || !verified}
            className="w-full mt-6 py-5 bg-forest-500 text-black font-black uppercase tracking-widest rounded-2xl hover:bg-forest-400 transition-all flex items-center justify-center gap-2 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : <><CheckCircle2 /> Got it, let's get to work</>}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
