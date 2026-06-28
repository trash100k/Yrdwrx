// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle, Clock, AlertTriangle, MessageSquare, X, Receipt, Package } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { invoicesRepo, inventoryRepo, leadsRepo, jobsRepo } from "../lib/repos";

// Severity → visual treatment (matches the forest/zinc/amber aesthetic).
const SEVERITY_STYLES = {
  critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", weight: 3 },
  warning: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", weight: 2 },
  info: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", weight: 1 },
};

const ICONS = { invoice: Receipt, inventory: Package, lead: MessageSquare, job: Clock };

function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const future = diff < 0;
  const m = Math.round(Math.abs(diff) / 60000);
  const fmt = (n, unit) => (future ? `in ${n} ${unit}${n === 1 ? "" : "s"}` : `${n} ${unit}${n === 1 ? "" : "s"} ago`);
  if (m < 1) return future ? "soon" : "just now";
  if (m < 60) return fmt(m, "min");
  const h = Math.round(m / 60);
  if (h < 24) return fmt(h, "hr");
  const d = Math.round(h / 24);
  return fmt(d, "day");
}

// Compose a flat notification list from the live Supabase repos. Each repo call is
// independently guarded so one failure (not signed in / table missing) can't blank
// out the others.
async function buildNotifications() {
  const out = [];
  const now = Date.now();

  // --- Overdue / due invoices ---
  try {
    const invoices = await invoicesRepo.list();
    for (const inv of invoices ?? []) {
      const status = String(inv.status ?? "").toUpperCase();
      if (status !== "OVERDUE" && status !== "PENDING") continue;
      const due = inv.due_date ? new Date(inv.due_date).getTime() : null;
      if (due == null || due >= now) continue;
      const amount = Number(inv.amount ?? 0);
      const overdue = status === "OVERDUE";
      out.push({
        id: `invoice:${inv.id}`,
        type: "invoice",
        title: overdue ? "Invoice Overdue" : "Invoice Past Due",
        body: `Invoice for $${amount.toFixed(2)} was due ${timeAgo(inv.due_date)}.`,
        severity: overdue ? "critical" : "warning",
        createdAt: inv.due_date,
        link: "/admin/invoices",
      });
    }
  } catch {}

  // --- Low inventory ---
  try {
    const items = await inventoryRepo.list();
    for (const item of items ?? []) {
      const qty = item.quantity;
      const min = item.min_threshold;
      if (qty == null || min == null) continue;
      if (Number(qty) > Number(min)) continue;
      out.push({
        id: `inventory:${item.id}`,
        type: "inventory",
        title: "Low Inventory",
        body: `${item.name ?? "Item"} is at or below its minimum (${Number(qty)} left, min ${Number(min)}).`,
        severity: Number(qty) <= 0 ? "critical" : "warning",
        createdAt: item.updated_at ?? item.created_at,
        link: "/admin/inventory",
      });
    }
  } catch {}

  // --- Pending leads (new leads awaiting action) ---
  try {
    const leads = await leadsRepo.list();
    for (const lead of leads ?? []) {
      const score = lead.score != null ? ` · score ${Number(lead.score)}` : "";
      out.push({
        id: `lead:${lead.id}`,
        type: "lead",
        title: "New Lead",
        body: `${lead.name ?? "A new lead"}${lead.address ? ` — ${lead.address}` : ""}${score}`,
        severity: "info",
        createdAt: lead.created_at,
        link: "/admin/crm",
      });
    }
  } catch {}

  // --- Upcoming jobs (next ~48h) ---
  try {
    const horizon = now + 48 * 60 * 60 * 1000;
    const jobs = await jobsRepo.list();
    for (const job of jobs ?? []) {
      const when = job.date ? new Date(job.date).getTime() : null;
      if (when == null || when < now || when > horizon) continue;
      out.push({
        id: `job:${job.id}`,
        type: "job",
        title: "Upcoming Job",
        body: `${job.title ?? "Job"}${job.address ? ` at ${job.address}` : ""} — ${timeAgo(job.date)}.`,
        severity: "info",
        createdAt: job.date,
        link: "/admin/scheduler",
      });
    }
  } catch {}

  // Most severe first, then newest. createdAt may be in the past (invoices) or
  // future (jobs); we sort by absolute recency of the underlying timestamp.
  out.sort((a, b) => {
    const sw = (SEVERITY_STYLES[b.severity]?.weight ?? 0) - (SEVERITY_STYLES[a.severity]?.weight ?? 0);
    if (sw !== 0) return sw;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  return out;
}

export const NotificationsCenter = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [loading, setLoading] = useState(false);

  // Load once each time the panel opens (keeps it simple; data is fresh on open).
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setLoading(true);
    buildNotifications()
      .then((n) => alive && setItems(n))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [isOpen]);

  const visible = useMemo(() => items.filter((n) => !dismissed.has(n.id)), [items, dismissed]);

  const dismiss = (id) => setDismissed((prev) => new Set(prev).add(id));
  const clearAll = () => setDismissed(new Set(items.map((n) => n.id)));

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
            className="absolute top-20 right-4 sm:right-24 w-[380px] bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-[200]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/50">
              <h3 className="font-bold text-white tracking-tight flex items-center gap-2">
                <Bell size={16} className="text-forest-400" /> Notifications
                {visible.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-forest-500/15 border border-forest-500/20 text-[10px] font-black text-forest-300">
                    {visible.length}
                  </span>
                )}
              </h3>
              <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors bg-white/5 border border-white/5 rounded-full">
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {loading && (
                <div className="px-6 py-12 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-600">
                  Loading…
                </div>
              )}

              {!loading && visible.length === 0 && (
                <div className="px-6 py-12 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-forest-500/20 bg-forest-500/10">
                    <CheckCircle size={22} className="text-forest-400" />
                  </div>
                  <p className="text-sm font-bold text-white">You're all caught up</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">No overdue invoices, low stock, new leads, or upcoming jobs right now.</p>
                </div>
              )}

              {!loading &&
                visible.map((n) => {
                  const style = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info;
                  const Icon = ICONS[n.type] ?? AlertTriangle;
                  return (
                    <div key={n.id} className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors group flex gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${style.bg} ${style.border}`}>
                        <Icon size={18} className={style.color} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <p className="text-sm font-bold text-white group-hover:text-forest-300 transition-colors truncate">{n.title}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold text-zinc-500 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                dismiss(n.id);
                              }}
                              className="p-0.5 text-zinc-600 hover:text-white opacity-0 group-hover:opacity-100 transition-all bg-white/5 border border-white/5 rounded-full"
                              aria-label="Dismiss"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{n.body}</p>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-3 border-t border-white/5 bg-black text-center">
              <button
                onClick={clearAll}
                disabled={visible.length === 0}
                className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors disabled:opacity-40 disabled:hover:text-zinc-500"
              >
                Dismiss all
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
