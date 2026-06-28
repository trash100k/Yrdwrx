// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import {
  FileText, Plus, CalendarClock, CreditCard, ChevronRight, X, Save,
  DollarSign, ShieldCheck, AlertTriangle, Loader2, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { contractsRepo, customersRepo } from "../lib/repos";
import { useToast } from "../contexts/ToastContext";
import { ConfirmDialog } from "../components/ConfirmDialog";

// --- Status model -----------------------------------------------------------
const STATUS = {
  active: { label: "Active", cls: "bg-forest-500/10 text-forest-400 border-forest-500/30" },
  pending_renewal: { label: "Pending Renewal", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  at_risk: { label: "At Risk", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
};
const STATUS_ORDER = ["active", "pending_renewal", "at_risk", "cancelled"];

const fmtMoney = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const DAY = 86400000;
function renewingSoon(c) {
  const end = c?.data?.end_date;
  if (!end) return false;
  const t = new Date(end).getTime();
  if (isNaN(t)) return false;
  const days = (t - Date.now()) / DAY;
  return days >= 0 && days <= 30;
}

const EMPTY_FORM = {
  name: "", customer_id: "", status: "active", mrr: "",
  cycle: "Monthly", start_date: "", end_date: "", services: "",
};

export default function Contracts() {
  const { showToast } = useToast();
  const [contracts, setContracts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // row being edited, or null for create
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // --- Realtime list --------------------------------------------------------
  useEffect(() => {
    const unsub = contractsRepo.subscribe((rows) => {
      setContracts(rows || []);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Customers for the picker (best-effort; non-fatal if it fails).
  useEffect(() => {
    let active = true;
    customersRepo.list().then((rows) => active && setCustomers(rows || [])).catch(() => {});
    return () => { active = false; };
  }, []);

  const customerName = (id) => {
    const c = customers.find((x) => x.id === id);
    if (!c) return null;
    return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Customer";
  };

  // --- Live metrics ---------------------------------------------------------
  const metrics = useMemo(() => {
    const live = contracts.filter((c) => c.status !== "cancelled");
    const totalMrr = live.reduce((s, c) => s + Number(c.mrr || 0), 0);
    const activeCount = contracts.filter((c) => c.status === "active").length;
    const atRiskCount = contracts.filter(
      (c) => c.status === "at_risk" || c.status === "pending_renewal" || renewingSoon(c)
    ).length;
    return { totalMrr, activeCount, atRiskCount };
  }, [contracts]);

  // --- Filtering + sort -----------------------------------------------------
  const visible = useMemo(() => {
    let rows = contracts;
    if (activeTab === "active") rows = rows.filter((c) => c.status === "active");
    else if (activeTab === "pending")
      rows = rows.filter((c) => c.status === "pending_renewal" || c.status === "at_risk");
    return [...rows].sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.status);
      const sb = STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      return Number(b.mrr || 0) - Number(a.mrr || 0); // highest value first
    });
  }, [contracts, activeTab]);

  // --- Modal handlers -------------------------------------------------------
  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      name: c.name || "",
      customer_id: c.customer_id || "",
      status: c.status || "active",
      mrr: c.mrr != null ? String(c.mrr) : "",
      cycle: c.data?.cycle || "Monthly",
      start_date: c.data?.start_date || "",
      end_date: c.data?.end_date || "",
      services: c.data?.services || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast("Contract name is required", "error");
      return;
    }
    setSaving(true);
    const row = {
      name: form.name.trim(),
      status: form.status,
      mrr: Number(form.mrr) || 0,
      customer_id: form.customer_id || null,
      data: {
        cycle: form.cycle,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        services: form.services.trim(),
      },
    };
    try {
      if (editing) {
        await contractsRepo.update(editing.id, row);
        showToast("Contract updated", "success");
      } else {
        await contractsRepo.create(row);
        showToast("Contract created", "success");
      }
      setShowModal(false);
    } catch (e) {
      showToast(e?.message || "Failed to save contract", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await contractsRepo.remove(deleteTarget.id);
      showToast("Contract deleted", "success");
    } catch (e) {
      showToast(e?.message || "Failed to delete contract", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  // --- Render ---------------------------------------------------------------
  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto min-h-[100dvh]">
      {/* Add / Edit modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !saving && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button
                onClick={() => !saving && setShowModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-forest-500/10 rounded-xl flex items-center justify-center text-forest-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{editing ? "Edit Contract" : "New Contract"}</h2>
                  <p className="text-zinc-400 text-sm">
                    {editing ? "Update this recurring agreement" : "Create a recurring service agreement"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Contract / Client Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500"
                    placeholder="e.g. Sunset Ridge HOA"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Customer (optional)</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500"
                  >
                    <option value="">— No linked customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500"
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>{STATUS[s].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">MRR ($)</label>
                    <input
                      type="number"
                      value={form.mrr}
                      onChange={(e) => setForm((f) => ({ ...f, mrr: e.target.value }))}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Billing Cycle</label>
                  <select
                    value={form.cycle}
                    onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value }))}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500"
                  >
                    <option>Monthly</option>
                    <option>Bi-Weekly</option>
                    <option>Weekly</option>
                    <option>Annually</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Start Date</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">End / Renewal Date</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Services / Notes</label>
                  <textarea
                    value={form.services}
                    onChange={(e) => setForm((f) => ({ ...f, services: e.target.value }))}
                    rows={3}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 resize-none"
                    placeholder="e.g. Premium Mowing & Trim, seasonal fertilizer, leaf cleanup"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  {editing && (
                    <button
                      onClick={() => { setShowModal(false); setDeleteTarget(editing); }}
                      className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl font-bold uppercase tracking-widest text-sm transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {editing ? "Save" : "Create"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete contract?"
        description={`This permanently removes "${deleteTarget?.name || "this contract"}" and its MRR from your tracking. This can't be undone.`}
        confirmText="Delete"
        danger
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <FileText size={32} className="text-forest-400" />
          <h1 className="text-2xl sm:text-3xl sm:text-4xl font-black text-white italic uppercase tracking-tight">Recurring Contracts</h1>
        </div>
        <button
          onClick={openCreate}
          className="bg-white text-black px-6 py-3 rounded-full font-bold uppercase text-sm tracking-widest hover:scale-105 transition-transform flex items-center gap-2"
        >
          <Plus size={18} /> New Contract
        </button>
      </div>

      {/* Live metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Monthly Recurring Revenue", value: fmtMoney(metrics.totalMrr), icon: DollarSign, color: "text-forest-400", border: "border-forest-500/20" },
          { label: "Active Contracts", value: metrics.activeCount, icon: ShieldCheck, color: "text-white", border: "border-white/10" },
          { label: "At Risk / Renewing", value: metrics.atRiskCount, icon: AlertTriangle, color: metrics.atRiskCount > 0 ? "text-amber-400" : "text-zinc-400", border: metrics.atRiskCount > 0 ? "border-amber-500/20" : "border-white/10" },
        ].map((m) => (
          <div key={m.label} className={`bg-zinc-900 border ${m.border} rounded-3xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{m.label}</span>
              <m.icon size={16} className={m.color} />
            </div>
            <div className={`text-3xl font-black tracking-tight ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 flex-wrap">
        {[
          { id: "active", label: "Active" },
          { id: "pending", label: "Renewal / At Risk" },
          { id: "all", label: "All" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest transition-all ${activeTab === t.id ? "bg-forest-500/20 text-forest-400 border border-forest-500/50" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-white/5 molten-edge rounded-3xl overflow-hidden relative max-w-[100vw]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Loader2 size={28} className="animate-spin mb-3 text-forest-400" />
            <p className="text-sm font-bold uppercase tracking-widest">Loading contracts…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 mb-4">
              <FileText size={24} />
            </div>
            <p className="text-white font-bold mb-1">No contracts {activeTab !== "all" ? "in this view" : "yet"}</p>
            <p className="text-zinc-500 text-sm mb-6 max-w-sm">
              Track recurring service agreements and their MRR. Create your first contract to get started.
            </p>
            <button
              onClick={openCreate}
              className="bg-white text-black px-6 py-3 rounded-full font-bold uppercase text-sm tracking-widest hover:scale-105 transition-transform flex items-center gap-2"
            >
              <Plus size={18} /> New Contract
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-hidden w-full custom-scrollbar">
            <table className="block sm:table w-full whitespace-nowrap text-left min-w-[760px]">
              <thead className="bg-zinc-950 text-zinc-500 uppercase text-xs font-black tracking-widest border-b border-white/5 molten-edge">
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
                {visible.map((c) => {
                  const st = STATUS[c.status] || STATUS.active;
                  const linked = customerName(c.customer_id);
                  const soon = renewingSoon(c);
                  const plan = c.data?.services || "—";
                  const cycle = c.data?.cycle || "Monthly";
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openEdit(c)}
                      className="hover:bg-zinc-900 transition-colors cursor-pointer group"
                    >
                      <td className="sticky left-0 bg-[#121214] group-hover:bg-[#18181b] z-10 p-4 pl-6 font-bold text-white border-r border-white/5 shadow-[4px_0_12px_rgba(0,0,0,0.2)]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-forest-400 shrink-0">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate">{c.name}</div>
                            {linked && <div className="text-[11px] font-medium text-zinc-500 truncate">{linked}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-zinc-300 font-medium max-w-[260px] truncate">{plan}</td>
                      <td className="p-4 text-zinc-400 text-sm">
                        <span className="flex items-center gap-2"><CreditCard size={14} /> {cycle}</span>
                      </td>
                      <td className="p-4 text-forest-400 font-bold">{fmtMoney(c.mrr)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded-md text-xs md:text-[10px] font-black uppercase tracking-widest border ${st.cls}`}>
                            {st.label}
                          </span>
                          {soon && c.status === "active" && (
                            <span className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs md:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1">
                              <CalendarClock size={11} /> Renewing Soon
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <button className="text-zinc-500 group-hover:text-white transition-colors">
                          <ChevronRight size={20} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
