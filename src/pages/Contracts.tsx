import { useToast } from '../contexts/ToastContext';
// @ts-nocheck
import React, { useState } from "react";
import { FileText, Plus, Search, CalendarClock, CreditCard, ChevronRight, CheckCircle2, AlertCircle, X, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function Contracts() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('active');
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto min-h-[100dvh]">
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">New Contract</h2>
                  <p className="text-zinc-400 text-sm">Create a recurring service agreement</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Client Name</label>
                  <input type="text" className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" placeholder="e.g. Sunset Ridge HOA" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Service Plan</label>
                  <input type="text" className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" placeholder="e.g. Premium Mowing & Trim" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Billing Cycle</label>
                    <select className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500">
                      <option>Monthly</option>
                      <option>Bi-Weekly</option>
                      <option>Weekly</option>
                      <option>Annually</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">MRR ($)</label>
                    <input type="number" className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" placeholder="0.00" />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-colors"
                  >
                    <Save size={18} /> Create
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <FileText size={32} className="text-blue-400" />
          <h1 className="text-2xl sm:text-3xl sm:text-4xl font-black text-white italic uppercase tracking-tight">Recurring Contracts</h1>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-white text-black px-6 py-3 rounded-full font-bold uppercase text-sm tracking-widest hover:scale-105 transition-transform flex items-center gap-2"
        >
          <Plus size={18} /> New Contract
        </button>
      </div>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('active')}
          className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
        >
          Active
        </button>
        <button 
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
        >
          Pending Renewal
        </button>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden relative max-w-[100vw]">
        <div className="overflow-x-auto overflow-y-hidden w-full custom-scrollbar">
          <table className="block sm:table w-full whitespace-nowrap text-left min-w-[700px]">
            <thead className="bg-zinc-950 text-zinc-500 uppercase text-xs font-black tracking-widest border-b border-white/5">
              <tr>
                <th className="sticky left-0 bg-zinc-950 z-20 p-4 pl-6 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">Client / HOA</th>
                <th className="p-4">Service Plan</th>
                <th className="p-4">Billing Cycle</th>
                <th className="p-4">Value (MRR)</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-black/20">
              {[
                { id: 1, name: "Sunset Ridge HOA", plan: "Premium Mowing & Trim", cycle: "Net-30 / Monthly", mrr: "$2,400", status: "Active", risk: false },
                { id: 2, name: "Cedar Creek Estates", plan: "Basic Turf Care", cycle: "Auto-pay / Monthly", mrr: "$1,850", status: "Active", risk: false },
                { id: 3, name: "Dr. Michael Chen", plan: "Platinum Care + Fertilizer", cycle: "Auto-pay / Bi-Weekly", mrr: "$450", status: "Active", risk: false },
                { id: 4, name: "Vanguard Corporate Center", plan: "Commercial Full-Service", cycle: "Net-60 / Monthly", mrr: "$5,200", status: "Pending Renewal", risk: true },
              ].map((contract) => (
                <tr key={contract.id} className="hover:bg-zinc-900 transition-colors cursor-pointer group">
                  <td className="sticky left-0 bg-[#121214] group-hover:bg-[#18181b] z-10 p-4 pl-6 font-bold text-white flex items-center gap-3 border-r border-white/5 shadow-[4px_0_12px_rgba(0,0,0,0.2)]">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-blue-400">
                    <FileText size={18} />
                  </div>
                  {contract.name}
                </td>
                <td className="p-4 text-zinc-300 font-medium">{contract.plan}</td>
                <td className="p-4 text-zinc-400 text-sm flex items-center gap-2">
                  <CreditCard size={14} /> {contract.cycle}
                </td>
                <td className="p-4 text-emerald-400 font-bold">{contract.mrr}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-md text-xs md:text-[10px] font-black uppercase tracking-widest ${contract.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                    {contract.status}
                  </span>
                  {contract.risk && <span className="ml-2 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs md:text-[10px] font-black uppercase tracking-widest">At Risk</span>}
                </td>
                <td className="p-4 pr-6 text-right">
                  <button onClick={() => showToast(`Opening contract...`, "info")} className="text-zinc-500 group-hover:text-white transition-colors">
                    <ChevronRight size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
