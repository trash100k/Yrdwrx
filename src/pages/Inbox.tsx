// @ts-nocheck
// Unified Conversation Inbox — every SMS + portal message with a customer, in one
// chronological thread. This is the daily-use surface (the "messenger") that field-service
// SaaS competitors lead with: one place to see, read, and reply to all customer conversation.
//
// Data model:
//   customer_messages rows: { id, customerId, sender, text, createdAt, tenantId }
//   We group messages by customerId, build one conversation row per customer-with-messages,
//   and render the active customer's full thread as chat bubbles.
//
// Sending:
//   - Send SMS   -> POST /api/sms/send { to, message, customerId }. The SERVER persists the
//                   outbound into the thread, so on success we just reload (subscribe also pushes).
//   - Send Email -> we FIRST persist to the thread ourselves (customerMessagesRepo.create) so it
//                   shows immediately, THEN POST /api/email/send. We toast honestly on
//                   {sent} vs {simulated} (email may not be configured) vs error.
//
// Live updates come from customerMessagesRepo.subscribe (re-group on every push).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, Mail, Phone, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { customerMessagesRepo, customersRepo } from "../lib/repos";
import { fetchApi } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useTenant } from "../contexts/TenantContext";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Flatten a repo row's freeform jsonb (data) under its top-level columns.
const flatten = (r: any) => ({ ...(r?.data || {}), ...r });

// Resolve a display name across the field-name variants customers may carry.
const customerName = (c: any) => {
  if (!c) return "Unknown";
  const f = flatten(c);
  return (
    [f.firstName, f.lastName].filter(Boolean).join(" ").trim() ||
    f.companyName ||
    f.name ||
    f.email ||
    "Unknown"
  );
};

const customerPhone = (c: any) => {
  const f = flatten(c || {});
  return f.phone || f.phoneNumber || f.mobile || null;
};

const customerEmail = (c: any) => {
  const f = flatten(c || {});
  return f.email || null;
};

// Best-effort date parse -> epoch ms, or 0 (sorts oldest).
const ms = (v: any) => {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

// Inbound (customer-side) senders align LEFT; everything else aligns RIGHT.
const INBOUND = new Set(["client", "customer", "inbound", "lead", "portal"]);
const isInbound = (sender: any) => INBOUND.has(String(sender || "").toLowerCase().trim());

// Friendly label for a sender tag.
const senderLabel = (sender: any) => {
  const s = String(sender || "").toLowerCase().trim();
  if (isInbound(s)) return "Customer";
  if (s === "system") return "System";
  if (s === "agent") return "Cutty";
  if (s === "staff") return "Staff";
  return "You";
};

// Relative time like "2m", "3h", "5d", or a date for older.
const relTime = (epoch: number) => {
  if (!epoch) return "";
  const diff = Date.now() - epoch;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(epoch).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const fmtTime = (epoch: number) =>
  epoch
    ? new Date(epoch).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

const truncate = (s: string, n = 64) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

// Per-customer last-read map, persisted to localStorage (no DB schema change).
// Shape: { [customerId]: <epoch ms of when the thread was last read> }.
const READ_MAP_KEY = "yardworx_inbox_read";

const loadReadMap = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(READ_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export default function Inbox() {
  const { tenant } = useTenant();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState<null | "sms" | "email">(null);
  const [showPicker, setShowPicker] = useState(false);

  // Read/unread tracking — per-customer last-read epoch, persisted to localStorage.
  const [readMap, setReadMap] = useState<Record<string, number>>(() => loadReadMap());

  // Update state + persist (try/catch so a full/blocked localStorage never breaks the UI).
  const persistReadMap = (next: Record<string, number>) => {
    setReadMap(next);
    try {
      localStorage.setItem(READ_MAP_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / privacy-mode failures */
    }
  };

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  // --- load + live subscription --------------------------------------------
  const ingest = (rows: any[]) => setMessages((rows || []).map(flatten));

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let alive = true;
    (async () => {
      setLoading(true);
      const [msgRows, custRows] = await Promise.all([
        customerMessagesRepo.list().catch(() => []),
        customersRepo.list().catch(() => []),
      ]);
      if (!alive) return;
      ingest(msgRows);
      setCustomers((custRows || []).map(flatten));
      setLoading(false);
      // Live updates: re-group on every push (full list, ascending by created_at).
      unsub = customerMessagesRepo.subscribe((rows) => alive && ingest(rows));
    })();
    return () => {
      alive = false;
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  // Manual reload after a send (subscribe usually covers it, but be deterministic).
  const reloadMessages = async () => {
    const rows = await customerMessagesRepo.list().catch(() => []);
    ingest(rows);
  };

  // --- customer lookup ------------------------------------------------------
  const customerById = useMemo(() => {
    const map: Record<string, any> = {};
    for (const c of customers) if (c?.id) map[c.id] = c;
    return map;
  }, [customers]);

  // --- group messages into conversations (one row per customer-with-messages) --
  const conversations = useMemo(() => {
    const byCustomer: Record<string, any[]> = {};
    for (const m of messages) {
      const cid = m.customerId;
      if (!cid) continue;
      (byCustomer[cid] = byCustomer[cid] || []).push(m);
    }
    const rows = Object.entries(byCustomer).map(([cid, msgs]) => {
      const sorted = [...msgs].sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
      const last = sorted[sorted.length - 1];
      const cust = customerById[cid];
      // A conversation is UNREAD if it has an INBOUND message newer than the last-read mark.
      const lastRead = readMap[cid] ?? 0;
      const unreadCount = sorted.filter(
        (m) => isInbound(m.sender) && ms(m.createdAt) > lastRead,
      ).length;
      return {
        customerId: cid,
        customer: cust || null,
        name: customerName(cust),
        messages: sorted,
        lastText: last?.text || "",
        lastInbound: isInbound(last?.sender),
        lastMs: ms(last?.createdAt),
        count: sorted.length,
        unreadCount,
        unread: unreadCount > 0,
      };
    });
    return rows.sort((a, b) => b.lastMs - a.lastMs);
  }, [messages, customerById, readMap]);

  // Total number of conversations with at least one unread inbound message.
  const totalUnread = useMemo(
    () => conversations.filter((c) => c.unread).length,
    [conversations],
  );

  // Search filters the conversation list by customer name.
  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.name.toLowerCase().includes(q));
  }, [conversations, search]);

  // Customers WITHOUT any thread yet — selectable to start a new conversation.
  const customersWithThread = useMemo(
    () => new Set(conversations.map((c) => c.customerId)),
    [conversations],
  );
  const startableCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => c?.id && !customersWithThread.has(c.id))
      .filter((c) => !q || customerName(c).toLowerCase().includes(q))
      .sort((a, b) => customerName(a).localeCompare(customerName(b)));
  }, [customers, customersWithThread, search]);

  // --- active thread --------------------------------------------------------
  const activeCustomer = activeId ? customerById[activeId] || null : null;
  const activeThread = useMemo(() => {
    if (!activeId) return [];
    const conv = conversations.find((c) => c.customerId === activeId);
    return conv ? conv.messages : [];
  }, [conversations, activeId]);

  const activePhone = customerPhone(activeCustomer);
  const activeEmail = customerEmail(activeCustomer);

  // Auto-scroll the thread to the newest message when it changes.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeThread.length, activeId]);

  // Pick the most-recent conversation by default once loaded (desktop convenience).
  // The auto-opened thread is marked read too, so it doesn't show a stale unread badge.
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      const firstId = conversations[0].customerId;
      setActiveId(firstId);
      persistReadMap({ ...readMap, [firstId]: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  // --- send actions ---------------------------------------------------------
  const sendSms = async () => {
    const text = draft.trim();
    if (!text || !activeId || !activePhone || sending) return;
    setSending("sms");
    try {
      const res = await fetchApi("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: activePhone, message: text, customerId: activeId }),
      });
      if (!res.ok) {
        const e = await res.text().catch(() => "");
        throw new Error(e || `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      // The server persists the outbound itself, so just clear + reload the thread.
      setDraft("");
      await reloadMessages();
      showToast(data?.simulated ? "Text saved (SMS not configured yet)." : "Text sent", "success");
    } catch (err: any) {
      console.error("[sms/send]", err);
      showToast("Text failed to send.", "error");
    } finally {
      setSending(null);
    }
  };

  const sendEmail = async () => {
    const text = draft.trim();
    if (!text || !activeId || !activeEmail || sending) return;
    setSending("email");
    try {
      // Persist to the thread first so it shows immediately (email route does NOT persist).
      await customerMessagesRepo.create({ customerId: activeId, sender: "business", text });
      setDraft("");
      await reloadMessages();

      const res = await fetchApi("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: activeEmail,
          subject: `Message from ${tenant?.name || "YardWorx"}`,
          text,
        }),
      });
      if (!res.ok) {
        const e = await res.text().catch(() => "");
        throw new Error(e || `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      if (data?.sent) {
        showToast("Email sent", "success");
      } else if (data?.simulated) {
        showToast("Email isn't configured yet — saved to the thread.", "warning");
      } else {
        showToast("Email queued — saved to the thread.", "info");
      }
    } catch (err: any) {
      console.error("[email/send]", err);
      // The message is already in the thread; tell the truth about delivery.
      showToast("Saved to the thread, but email failed to send.", "error");
      await reloadMessages();
    } finally {
      setSending(null);
    }
  };

  // Mark a customer's thread as read up to "now" (covers any inbound up to this moment).
  const markRead = (cid: string) => {
    if (!cid) return;
    persistReadMap({ ...readMap, [cid]: Date.now() });
  };

  const selectCustomer = (cid: string) => {
    setActiveId(cid);
    setShowPicker(false);
    markRead(cid);
  };

  // Re-flag the active thread as unread: set last-read to just BEFORE its most-recent
  // inbound message so that message (and any newer inbound) counts as unread again.
  const markUnread = (cid: string) => {
    if (!cid) return;
    const conv = conversations.find((c) => c.customerId === cid);
    const lastInboundMs = conv
      ? conv.messages.reduce(
          (acc: number, m: any) => (isInbound(m.sender) ? Math.max(acc, ms(m.createdAt)) : acc),
          0,
        )
      : 0;
    persistReadMap({ ...readMap, [cid]: lastInboundMs > 0 ? lastInboundMs - 1 : 0 });
    showToast("Marked as unread.", "info");
  };

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------
  const totalMessages = messages.length;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 pb-8 border-b-4 border-white/10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-forest-500/10 rounded-full border border-forest-500 text-xs font-black uppercase tracking-widest text-forest-400">
            <MessageSquare size={16} />
            Inbox
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Conversation Inbox
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Every Text &amp; Portal Message · One Thread
          </p>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      ) : totalMessages === 0 && startableCustomers.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Texts and client-portal messages will land here as one chronological thread per customer. Once a customer reaches out — or you send the first message — the conversation appears here."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
          {/* ---- Left: conversation list ---- */}
          <section className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[78vh]">
            <div className="p-4 border-b border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <p className="micro-label font-black text-white/30 uppercase tracking-[0.3em] text-[10px]">
                  Conversations
                </p>
                <span className="flex items-center gap-2">
                  {totalUnread > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-forest-500 text-black text-[9px] font-black uppercase tracking-widest leading-none">
                      {totalUnread} new
                    </span>
                  )}
                  <span className="text-[10px] font-black uppercase tracking-widest text-forest-400">
                    {conversations.length}
                  </span>
                </span>
              </div>
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customers…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black border border-white/10 text-sm text-white placeholder:text-white/25 font-bold focus:outline-none focus:border-forest-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Conversation rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {filteredConversations.length === 0 && (
                <p className="px-4 py-6 text-[11px] font-black uppercase tracking-widest text-white/25 text-center">
                  No matching conversations
                </p>
              )}
              {filteredConversations.map((conv) => {
                const active = conv.customerId === activeId;
                const unread = conv.unread;
                return (
                  <div key={conv.customerId} className="group relative">
                    <button
                      onClick={() => selectCustomer(conv.customerId)}
                      className={`w-full text-left px-4 py-3.5 transition-colors flex items-start gap-3 ${
                        active ? "bg-forest-500/10" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black uppercase border ${
                            active
                              ? "bg-forest-500/20 border-forest-500/40 text-forest-300"
                              : "bg-white/5 border-white/10 text-white/50"
                          }`}
                        >
                          {(conv.name || "?").slice(0, 2)}
                        </div>
                        {unread && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-forest-500 ring-2 ring-zinc-900" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-sm font-black italic uppercase truncate ${
                              active
                                ? "text-forest-300"
                                : unread
                                ? "text-white"
                                : "text-white/70"
                            }`}
                          >
                            {conv.name}
                          </p>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {unread && (
                              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-forest-500 text-black text-[9px] font-black leading-none">
                                {conv.unreadCount}
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-black uppercase tracking-widest ${
                                unread ? "text-forest-400" : "text-white/30"
                              }`}
                            >
                              {relTime(conv.lastMs)}
                            </span>
                          </span>
                        </div>
                        <p
                          className={`text-xs font-bold truncate mt-0.5 ${
                            unread ? "text-white/70" : "text-white/40"
                          }`}
                        >
                          {conv.lastInbound ? "" : "You: "}
                          {truncate(conv.lastText, 42)}
                        </p>
                      </div>
                    </button>
                    {/* Hover affordance: re-flag a read conversation as unread */}
                    {!unread && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markUnread(conv.customerId);
                        }}
                        className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-lg bg-black/70 border border-white/10 text-[8px] font-black uppercase tracking-widest text-white/50 hover:text-forest-400 hover:border-forest-500/40"
                        title="Mark unread"
                      >
                        Mark unread
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New-conversation picker (customers without a thread yet) */}
            {startableCustomers.length > 0 && (
              <div className="border-t border-white/10">
                <button
                  onClick={() => setShowPicker((s) => !s)}
                  className="w-full px-4 py-3 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-forest-400 hover:bg-forest-500/5 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Send size={12} />
                    New conversation
                  </span>
                  <span className="text-white/30">{startableCustomers.length}</span>
                </button>
                <AnimatePresence>
                  {showPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                        {startableCustomers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c.id)}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/[0.03] transition-colors flex items-center gap-2"
                          >
                            <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                            <span className="text-xs font-black italic uppercase text-white/70 truncate">
                              {customerName(c)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* ---- Right: thread ---- */}
          <section className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[78vh] min-h-[60vh]">
            {!activeId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                  <MessageSquare size={30} className="text-zinc-500" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-white/40">
                  Select a conversation
                </p>
                <p className="text-xs text-white/25 font-bold mt-2 max-w-xs">
                  Choose a customer on the left to read and reply to their thread.
                </p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="p-5 border-b border-white/10 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-forest-500/15 border border-forest-500/30 text-forest-300 flex items-center justify-center text-sm font-black uppercase shrink-0">
                    {(customerName(activeCustomer) || "?").slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tight leading-none truncate">
                      {customerName(activeCustomer)}
                    </h3>
                    <div className="flex items-center gap-4 mt-1.5">
                      {activePhone && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/40">
                          <Phone size={11} className="text-forest-400" />
                          {activePhone}
                        </span>
                      )}
                      {activeEmail && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/40 truncate">
                          <Mail size={11} className="text-forest-400" />
                          {activeEmail}
                        </span>
                      )}
                      {!activePhone && !activeEmail && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/25">
                          No contact info on file
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Re-flag this thread as unread (e.g. to follow up later). */}
                  <button
                    type="button"
                    onClick={() => markUnread(activeId)}
                    className="shrink-0 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 text-white/50 border border-white/10 hover:text-forest-400 hover:border-forest-500/40 transition-colors"
                    title="Mark this conversation as unread"
                  >
                    Mark unread
                  </button>
                </div>

                {/* Bubbles */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {activeThread.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <p className="text-xs font-black uppercase tracking-widest text-white/30">
                        No messages yet
                      </p>
                      <p className="text-xs text-white/25 font-bold mt-2 max-w-xs">
                        Send the first message below to start this conversation.
                      </p>
                    </div>
                  ) : (
                    activeThread.map((m, i) => {
                      const inbound = isInbound(m.sender);
                      return (
                        <motion.div
                          key={m.id || i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.015, 0.25) }}
                          className={`flex flex-col ${inbound ? "items-start" : "items-end"}`}
                        >
                          <div
                            className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                              inbound
                                ? "bg-zinc-800 border border-white/10 text-zinc-100 rounded-tl-sm"
                                : "bg-forest-500/15 border border-forest-500/30 text-forest-50 rounded-tr-sm"
                            }`}
                          >
                            {m.text}
                          </div>
                          <span className="mt-1.5 text-[9px] font-black uppercase tracking-widest text-white/25">
                            {senderLabel(m.sender)} · {fmtTime(ms(m.createdAt))}
                          </span>
                        </motion.div>
                      );
                    })
                  )}
                  <div ref={threadEndRef} />
                </div>

                {/* Composer */}
                <div className="p-4 border-t border-white/10 space-y-3 bg-black/30">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Message ${customerName(activeCustomer)}…`}
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-sm text-white placeholder:text-white/25 font-medium resize-none focus:outline-none focus:border-forest-500/50 transition-colors"
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Send SMS */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={sendSms}
                        disabled={!draft.trim() || !activePhone || !!sending}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-forest-500/10 text-forest-400 border border-forest-500/30 hover:bg-forest-500/20 transition-colors disabled:opacity-40 disabled:hover:bg-forest-500/10"
                      >
                        <Phone size={14} />
                        {sending === "sms" ? "Sending…" : "Send SMS"}
                      </button>
                      {!activePhone && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/25 px-1">
                          No phone on file
                        </span>
                      )}
                    </div>

                    {/* Send Email */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={sendEmail}
                        disabled={!draft.trim() || !activeEmail || !!sending}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-white/5"
                      >
                        <Mail size={14} />
                        {sending === "email" ? "Sending…" : "Send Email"}
                      </button>
                      {!activeEmail && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/25 px-1">
                          No email on file
                        </span>
                      )}
                    </div>

                    <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-white/20">
                      Outbound saves to the thread
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
