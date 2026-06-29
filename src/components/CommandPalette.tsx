import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Map, Users, Calendar, Truck, Terminal, Sparkles, X, Activity, Send, ReceiptText, BarChart3, Settings as SettingsIcon, Shield, Palette, Package, FileText, User, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useRole } from "../hooks/useRole";
import { customersRepo, jobsRepo, invoicesRepo } from "../lib/repos";

// Repos return camelCase columns; some display fields live in the freeform `data`
// jsonb. Flatten jsonb first so real columns win on key collisions (matches the
// adapt* pattern used across the pages).
const flatten = (r: any) => ({ ...(r?.data || {}), ...r });

const customerName = (c: any) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
  c.companyName ||
  c.name ||
  "Unnamed Client";

export const CommandPalette = ({ isOpen, onClose, onOutreach }: { isOpen: boolean; onClose: () => void; onOutreach?: () => void }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { role } = useRole();
  const rolePrefix = role === "employee" || role === "foreman" ? "/employee" : "/admin";

  // Entity caches — loaded once when the palette opens so typing never refetches.
  const [customers, setCustomers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // A command either navigates (path + optional state) or runs an action.
  const run = (a: any) => {
    if (a?.action) a.action();
    else if (a?.path) navigate(a.path, a.state ? { state: a.state } : undefined);
    onClose();
  };

  // Lightly debounce the typed term so filtering doesn't run on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 120);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Load entity lists once per palette-open. Reset cache on close so re-opening
  // picks up fresh data.
  useEffect(() => {
    if (!isOpen) {
      setLoaded(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [c, j, i] = await Promise.all([
          customersRepo.list().catch(() => []),
          jobsRepo.list().catch(() => []),
          invoicesRepo.list().catch(() => []),
        ]);
        if (!active) return;
        setCustomers((c || []).map(flatten));
        setJobs((j || []).map(flatten));
        setInvoices((i || []).map(flatten));
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [isOpen]);

  const sectionActions = useMemo(() => [
    { id: "Dashboard", icon: Activity, path: `${rolePrefix}` },
    { id: "CRM", icon: Users, path: `${rolePrefix}/crm` },
    { id: "Scheduler", icon: Calendar, path: `${rolePrefix}/scheduler` },
    { id: "Crew Suite", icon: Truck, path: `${rolePrefix}/crew-suite` },
    { id: "Invoices", icon: ReceiptText, path: `${rolePrefix}/invoices` },
    { id: "Inventory", icon: Package, path: `${rolePrefix}/inventory` },
    { id: "Contracts", icon: FileText, path: `${rolePrefix}/contracts` },
    { id: "Design Studio", icon: Palette, path: `${rolePrefix}/design-studio` },
    { id: "Compliance", icon: Shield, path: `${rolePrefix}/compliance` },
    { id: "Reports", icon: BarChart3, path: `${rolePrefix}/reports` },
    { id: "Settings", icon: SettingsIcon, path: `${rolePrefix}/settings` },
    { id: "YardPilot (AI)", icon: Sparkles, path: `${rolePrefix}/agent` },
    ...(onOutreach ? [{ id: "Agentic Outreach", icon: Send, action: () => onOutreach() }] : []),
  ], [rolePrefix, onOutreach]);

  // Build grouped result list. Each group has a label and an array of items; the
  // flat ordering (Sections -> Clients -> Jobs -> Invoices) drives arrow nav.
  const groups = useMemo(() => {
    const q = debouncedTerm.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");

    const sections = sectionActions
      .filter((a) => !q || a.id.toLowerCase().includes(q))
      .map((a) => ({ ...a, kind: "section", label: a.id }));

    // Only run entity search once there's a query (avoids dumping the whole book).
    let clients: any[] = [];
    let jobItems: any[] = [];
    let invoiceItems: any[] = [];

    if (q) {
      clients = customers
        .filter((c) => {
          const name = customerName(c).toLowerCase();
          const company = (c.companyName || "").toLowerCase();
          const phone = (c.phone || "").replace(/\D/g, "");
          return (
            name.includes(q) ||
            company.includes(q) ||
            (digits.length >= 3 && phone.includes(digits))
          );
        })
        .slice(0, 6)
        .map((c) => ({
          kind: "client",
          icon: User,
          label: customerName(c),
          sub: c.companyName || c.phone || c.email || "",
          path: `${rolePrefix}/crm`,
          state: { client: customerName(c), customer: c },
        }));

      jobItems = jobs
        .filter((j) => {
          const title = (j.title || "").toLowerCase();
          const client = (j.client || "").toLowerCase();
          return title.includes(q) || client.includes(q);
        })
        .slice(0, 6)
        .map((j) => ({
          kind: "job",
          icon: Briefcase,
          label: j.title || "Untitled Job",
          sub: [j.client, j.status].filter(Boolean).join(" · "),
          path: `${rolePrefix}/scheduler`,
        }));

      invoiceItems = invoices
        .filter((inv) => {
          const client = (inv.client || inv.customer || "").toString().toLowerCase();
          const id = (inv.id || "").toString().toLowerCase();
          return client.includes(q) || id.includes(q);
        })
        .slice(0, 6)
        .map((inv) => ({
          kind: "invoice",
          icon: ReceiptText,
          label: inv.client || inv.customer || `Invoice ${String(inv.id).slice(0, 8)}`,
          sub: [
            inv.amount != null ? `$${Number(inv.amount).toLocaleString()}` : null,
            (inv.status || "").toString().toUpperCase(),
          ].filter(Boolean).join(" · "),
          path: `${rolePrefix}/invoices`,
        }));
    }

    return [
      { key: "Sections", label: "Sections", items: sections },
      { key: "Clients", label: "Clients", items: clients },
      { key: "Jobs", label: "Jobs", items: jobItems },
      { key: "Invoices", label: "Invoices", items: invoiceItems },
    ].filter((g) => g.items.length > 0);
  }, [debouncedTerm, sectionActions, customers, jobs, invoices, rolePrefix]);

  // Flat, ordered list of selectable items for keyboard navigation.
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedTerm]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if(isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }

      if (!isOpen || flatItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % flatItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      } else if (e.key === "Enter") {
        if (flatItems[selectedIndex]) {
          run(flatItems[selectedIndex]);
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, onClose, flatItems, selectedIndex, navigate]);

  // Running counter so we can map a group-local index back to the flat index used
  // for arrow-key selection.
  let flatCursor = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10"
          >
            <div className="flex items-center px-6 py-5 border-b border-white/5">
              <Search size={22} className="text-forest-400 mr-4" />
              <input
                autoFocus
                type="text"
                placeholder="Search clients, jobs, invoices, or jump to a section (Cmd + K)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-none text-xl text-white focus:outline-none placeholder:text-zinc-600 font-medium"
              />
              <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-full ml-4">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 max-h-[50vh] overflow-y-auto custom-scrollbar" role="listbox" id="command-palette-results">
              {flatItems.length > 0 ? (
                <div className="space-y-4">
                  {groups.map((group) => (
                    <div key={group.key} className="space-y-1">
                      <p className="px-4 py-2 text-[10px] uppercase font-black tracking-widest text-zinc-500">{group.label}</p>
                      {group.items.map((item: any) => {
                        flatCursor += 1;
                        const i = flatCursor;
                        const isSelected = i === selectedIndex;
                        const Icon = item.icon;
                        return (
                          <button
                            key={`${group.key}-${i}`}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => run(item)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                              isSelected ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"
                            }`}
                          >
                            <div className={`flex items-center gap-4 min-w-0 transition-colors ${isSelected ? "text-white" : "text-zinc-300"} group-hover:text-white`}>
                              <div className={`w-10 h-10 shrink-0 rounded-lg bg-black/50 border flex items-center justify-center transition-colors ${
                                isSelected ? "border-forest-500/50 bg-forest-500/20" : "border-white/5 group-hover:border-forest-500/30 group-hover:bg-forest-500/10"
                              }`}>
                                <Icon size={18} className={`${isSelected ? "text-forest-400" : "group-hover:text-forest-400"} transition-colors`} />
                              </div>
                              <div className="flex flex-col items-start min-w-0">
                                <span className="font-bold text-lg tracking-tight truncate max-w-[22rem]">{item.label}</span>
                                {item.sub && (
                                  <span className="text-xs font-medium text-zinc-500 truncate max-w-[22rem]">{item.sub}</span>
                                )}
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded bg-black border transition-colors shrink-0 ml-3 ${
                              isSelected ? "text-forest-400 border-forest-500/30" : "text-zinc-600 border-zinc-800"
                            }`}>{item.kind === "section" ? "Jump to" : "Open"}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-zinc-500 font-bold">
                  {searchTerm
                    ? (loaded ? `No results found for "${searchTerm}"` : "Searching…")
                    : "Type to search clients, jobs, and invoices"}
                </div>
              )}
            </div>

            <div className="bg-black/50 border-t border-white/5 px-6 py-3 flex items-center justify-between">
               <div className="flex gap-4 items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                     <kbd className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">↑</kbd>
                     <kbd className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">↓</kbd> to navigate
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                     <kbd className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">↵</kbd> to select
                  </span>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
