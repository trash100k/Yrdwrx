import React, { useState } from "react";
import { X, Send, Target, Loader2 } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useTenant } from "../contexts/TenantContext";

export function LeadSubmissionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    notes: ""
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const tenantId = tenant?.id || "genesis-1";

    try {
      await addDoc(collection(db, "customers"), {
        ...formData,
        tenantId,
        status: "PENDING_VERIFICATION",
        tags: ["Employee Lead"],
        createdAt: serverTimestamp(),
      });
      showToast("Lead submitted successfully for verification and estimation.", "success");
      onClose();
    } catch (err: any) {
      showToast(err.message || "Failed to submit lead", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10 text-white">
          <X size={20} />
        </button>

        <div className="p-8 pb-6 border-b border-white/5 molten-edge bg-forest-500/5 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 text-forest-500/10 pointer-events-none">
            <Target size={150} />
          </div>
          <div className="w-12 h-12 bg-forest-500/10 rounded-2xl flex items-center justify-center text-forest-400 mb-6 border border-forest-500/20">
            <Target size={24} />
          </div>
          <h2 className="text-2xl font-black text-white italic tracking-tight">Submit New Lead</h2>
          <p className="text-sm text-zinc-400 mt-2 max-w-[90%]">
            Enter the details of a potential lead. This will be sent to the admin dashboard for verification and initial estimation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">First Name</label>
              <input 
                required
                type="text" 
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-forest-500 transition-colors"
                placeholder="John" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Last Name</label>
              <input 
                type="text" 
                value={formData.lastName}
                onChange={e => setFormData({...formData, lastName: e.target.value})}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-forest-500 transition-colors"
                placeholder="Doe" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Contact Details</label>
            <div className="flex bg-black/50 border border-white/10 rounded-xl overflow-hidden focus-within:border-forest-500 transition-colors">
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-1/2 bg-transparent border-r border-white/10 px-4 py-3 text-sm text-white focus:outline-none"
                placeholder="Phone" 
              />
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-1/2 bg-transparent px-4 py-3 text-sm text-white focus:outline-none"
                placeholder="Email" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Property Address</label>
            <input 
              required
              type="text" 
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-forest-500 transition-colors"
              placeholder="123 Main St, City, ST" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Service Notes</label>
            <textarea 
              rows={3} 
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-forest-500 transition-colors resize-none"
              placeholder="Client is looking for a front yard redesign and weekly mowing..."
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || !formData.firstName || !formData.address}
              className="flex items-center gap-2 bg-forest-500 hover:bg-forest-400 text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(5, 168, 69,0.3)] transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Submit Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
