import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Map, Users, Calendar, Truck, Terminal, Sparkles, X, Activity, Send, ReceiptText, BarChart3, Settings as SettingsIcon, Shield, Palette, Package, FileText, User, Briefcase, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useRole } from "../hooks/useRole";
import { supabase } from "../lib/supabase";
import { toCamelKey } from "../lib/repos/base";

// Raw supabase rows are snake_case (we bypass the repos to use ilike filters), so
// camelize top-level keys, then flatten the freeform `data` jsonb FIRST so real
// columns win on key collisions (matches the adapt* pattern used across the pages).
const flatten = (r: any) => {
  const row: any = {};
  for (const k of Object.keys(r || {})) row[toCamelKey(k)] = r[k];
  return { ...(row.data || {}), ...row };
};

// PostgREST `or()` strings parse commas/parens/quotes as syntax, and LIKE treats
// %/_ as wildcards — blank the former, escape the latter so user input is literal.
const sanitizeTerm = (s: string) =>
  s
    .replace(/[,()"'\\]/g, " ")
    .replace(/[%_]/g, "\\$&")
    .replace(/\s+/g, " ")
    .trim();

const EMPTY_RESULTS = { clients: [], jobs: [], invoices: [] };

// Tenant-scoped (via RLS) server-side search: 8 rows per entity, newest first.
async function searchEntities(rawTerm: string) {
  const term = sanitizeTerm(rawTerm);
  if (!term) return EMPTY_RESULTS;
  const pat = `%${term}%`;

  const [c, j, i] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("is_archived", false)
      .or(
        `first_name.ilike.${pat},last_name.ilike.${pat},company_name.ilike.${pat},phone.ilike.${pat},email.ilike.${pat}`,
      )
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("jobs")
      .select("*")
      .ilike("title", pat)
      .order("date", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("invoices")
      .select("*")
      .eq("is_archived", false)
      .or(`data->>client.ilike.${pat},data->>number.ilike.${pat}`)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return {
    clients: (c.data ?? []).map(flatten),
    jobs: (j.data ?? []).map(flatten),
    invoices: (i.data ?? []).map(flatten),
  };
}

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

  // Server-side entity results for the current debounced term.
  const [results, setResults] = useState<{ clients: any[]; jobs: any[]; invoices: any[] }>(EMPTY_RESULTS);
  const [searching, setSearching] = useState(false);
  // Latest-wins: each search bumps the seq; stale responses are dropped.
  const seqRef = useRef(0);

  // A command either navigates (path + optional state) or runs an action.
  const run = (a: any) => {
    if (a?.action) a.action();
    else if (a?.path) navigate(a.path, a.state ? { state: a.state } : undefined);
    onClose();
  };

  // Debounce the typed term so the server search doesn't fire on every keystroke.
  // Static section/action filtering stays instant on `searchTerm` (see `groups`).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Server-side search per debounced term. Latest-wins via seqRef: any response
  // arriving after a newer request started is ignored.
  useEffect(() => {
    const seq = ++seqRef.current;
    const q = debouncedTerm.trim();

    if (!isOpen || !q) {
      setResults(EMPTY_RESULTS);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchEntities(q)
      .then((fresh) => {
        if (seq !== seqRef.current) return; // stale response
        setResults(fresh);
        setSearching(false);
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setResults(EMPTY_RESULTS);
        setSearching(false);
      });
  }, [debouncedTerm, isOpen]);

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
  // Sections filter INSTANTLY on the raw term; entity rows come from the debounced
  // server-side search in `results`.
  const groups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const sections = sectionActions
      .filter((a) => !q || a.id.toLowerCase().includes(q))
      .map((a) => ({ ...a, kind: "section", label: a.id }));

    // Hide entity rows the instant the input is emptied (don't wait out the
    // debounce window with stale results on screen).
    const rows = q ? results : EMPTY_RESULTS;

    const clients: any[] = rows.clients.map((c) => ({
      kind: "client",
      icon: User,
      label: customerName(c),
      sub: c.companyName || c.phone || c.email || "",
      path: `${rolePrefix}/crm`,
      state: { client: customerName(c), customer: c },
    }));

    const jobItems: any[] = rows.jobs.map((j) => ({
      kind: "job",
      icon: Briefcase,
      label: j.title || "Untitled Job",
      sub: [j.client, j.status].filter(Boolean).join(" · "),
      path: `${rolePrefix}/scheduler`,
    }));

    const invoiceItems: any[] = rows.invoices.map((inv) => ({
      kind: "invoice",
      icon: ReceiptText,
      label:
        inv.client ||
        inv.customer ||
        (inv.number ? `Invoice #${inv.number}` : `Invoice ${String(inv.id).slice(0, 8)}`),
      sub: [
        inv.amount != null ? `$${Number(inv.amount).toLocaleString()}` : null,
        (inv.status || "").toString().toUpperCase(),
      ].filter(Boolean).join(" · "),
      path: `${rolePrefix}/invoices`,
    }));

    return [
      { key: "Sections", label: "Sections", items: sections },
      { key: "Clients", label: "Clients", items: clients },
      { key: "Jobs", label: "Jobs", items: jobItems },
      { key: "Invoices", label: "Invoices", items: invoiceItems },
    ].filter((g) => g.items.length > 0);
  }, [searchTerm, sectionActions, results, rolePrefix]);

  // Flat, ordered list of selectable items for keyboard navigation.
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Reset selection when the term changes (instant section filtering) AND when
  // server results land (the flat list re-shuffles under the cursor).
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm, results]);

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
              {searching ? (
                <Loader2 size={22} className="text-forest-400 mr-4 animate-spin" />
              ) : (
                <Search size={22} className="text-forest-400 mr-4" />
              )}
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
                <div className="p-10 text-center">
                  {searchTerm ? (
                    searching || searchTerm !== debouncedTerm ? (
                      <span className="text-zinc-500 font-bold flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-forest-400" /> Searching…
                      </span>
                    ) : (
                      <>
                        <p className="text-zinc-400 font-bold">No matches for "{searchTerm}"</p>
                        <p className="mt-2 text-[10px] uppercase font-black tracking-widest text-zinc-600">
                          Clients · Jobs · Invoices · Sections
                        </p>
                      </>
                    )
                  ) : (
                    <span className="text-zinc-500 font-bold">Type to search clients, jobs, and invoices</span>
                  )}
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
