// @ts-nocheck
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Navigation, X, Send } from "lucide-react";
import { fetchApi } from "../lib/api";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { customersRepo } from "../lib/repos";

// One-tap "On My Way": texts the customer an arrival window so they're home and ready.
// Reuses /api/sms/send (which self-persists to the conversation thread and simulates
// cleanly when Twilio isn't configured). Self-contained — drop <OnMyWayButton job={job} />
// anywhere a job is rendered.
export default function OnMyWayButton({ job, className = "" }: { job: any; className?: string }) {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [eta, setEta] = useState("30 minutes");
  const [phone, setPhone] = useState<string>(job?.phone || job?.data?.phone || "");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  const name = job?.client || job?.customerName || "there";
  const firstName = String(name).split(" ")[0] || "there";

  const openModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
    // Resolve a phone from the linked customer if the job doesn't carry one.
    if (!phone && job?.customerId) {
      setResolving(true);
      try {
        const c = await customersRepo.getById(job.customerId);
        setPhone(c?.phone || c?.data?.phone || "");
      } catch {
        /* leave blank -> send disabled */
      } finally {
        setResolving(false);
      }
    }
  };

  const message = `Hi ${firstName}, this is ${tenant?.name || "your crew"} — we're on our way and should arrive in about ${eta}. See you soon!`;

  const send = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) {
      showToast("No phone number on file for this customer.", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetchApi("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, message, customerId: job?.customerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        showToast(data?.error || "Couldn't send the text.", "error");
        return;
      }
      if (data.simulated) {
        showToast("Saved to the thread — SMS isn't configured yet.", "info");
      } else {
        showToast("On-my-way text sent.", "success");
      }
      setOpen(false);
    } catch (err) {
      showToast("Network error sending the text.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Text the customer an arrival window"
        className={`px-4 py-2 bg-black border border-white/10 hover:border-forest-400/40 hover:text-white text-white/60 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${className}`}
      >
        <Navigation size={12} /> On My Way
      </button>

      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-zinc-900 border-2 border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black italic uppercase tracking-tight text-white flex items-center gap-2">
                  <Navigation size={18} className="text-forest-400" /> On My Way
                </h3>
                <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white" aria-label="Close">
                  <X size={20} />
                </button>
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Arrival window</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {["15 minutes", "30 minutes", "1 hour", "later today"].map((w) => (
                  <button
                    key={w}
                    onClick={() => setEta(w)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                      eta === w ? "bg-forest-500 text-black" : "bg-white/5 text-white/60 hover:text-white border border-white/10"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Message preview</p>
              <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white/80 italic mb-4 leading-relaxed">
                {message}
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">
                To: {resolving ? "resolving…" : phone || "No phone on file"}
              </p>

              <button
                onClick={send}
                disabled={sending || resolving || !phone}
                className="w-full bg-forest-500 text-black py-3.5 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
              >
                {sending ? (
                  <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Sending…</>
                ) : (
                  <><Send size={14} /> Send Text</>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
