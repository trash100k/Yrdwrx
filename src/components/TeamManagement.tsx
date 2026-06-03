import React, { useState } from "react";
import { Users, Mail, Shield, UserPlus, Check, X } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

export function TeamManagement() {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [isSending, setIsSending] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSending(true);
    // Simulate sending invite
    setTimeout(() => {
      showToast(`Invitation sent to ${email} as ${role}!`);
      setEmail("");
      setIsSending(false);
    }, 1200);
  };

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden mt-12">
      <div className="p-6 sm:p-8 bg-black/20 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <Users size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Team Management</h3>
            <p className="text-sm text-zinc-400">Invite and manage employee and foreman access.</p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="team@example.com"
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-white/20"
              required
            />
          </div>
          <div className="w-full sm:w-48 space-y-2">
            <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Access Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="employee">Employee</option>
              <option value="foreman">Foreman</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSending || !email}
            className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSending ? <Users size={18} className="animate-pulse" /> : <UserPlus size={18} />}
            Send Invite
          </button>
        </form>

        <div className="mt-8">
          <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Role Privileges</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-black/30 border border-white/5 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-white font-bold">
                <Shield size={16} className="text-zinc-400" /> Employee
              </div>
              <ul className="text-sm text-zinc-400 space-y-2">
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> Access to routing & schedules</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> Basic Copilot workflows</li>
                <li className="flex items-center gap-2"><X size={14} className="text-red-500" /> Cannot see Crew Suite or Inventory</li>
                <li className="flex items-center gap-2"><X size={14} className="text-red-500" /> Cannot see Financials/CRM</li>
              </ul>
            </div>
            <div className="bg-black/30 border border-white/5 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-white font-bold">
                <Shield size={16} className="text-indigo-400" /> Foreman
              </div>
              <ul className="text-sm text-zinc-400 space-y-2">
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> All Employee features</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> Full access to Crew Suite</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> Full access to Inventory</li>
                <li className="flex items-center gap-2"><X size={14} className="text-red-500" /> Cannot see Financials/CRM</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
