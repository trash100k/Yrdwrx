// @ts-nocheck
import React, { useEffect, useState, useRef } from "react";
import { MapPin, Calendar, CreditCard, Leaf, CheckCircle2, Lock, Send, AlertCircle, Clock, Image as ImageIcon, Download, ThumbsUp } from "lucide-react";
import { safeStorage } from "../lib/storage";
import ClientDashboard from "../components/ClientDashboard";

// SECURE PORTAL: the visitor has no app session. Their only credential is the signed
// capability token (set by MagicLinkAuth). Every read/write goes through server endpoints
// that verify that token and scope the query to this client — no direct DB access, and the
// token (not a URL id) is the authority.
export default function ClientPortal() {
  const token = (() => {
    try {
      return safeStorage.getItem("customerAuthToken");
    } catch {
      return null;
    }
  })();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  // Locally-approved design ids (so the button flips to "Approved ✓" immediately
  // without waiting for a re-fetch). Server source of truth stays proposal.approved.
  const [approvedDesignIds, setApprovedDesignIds] = useState<string[]>([]);
  const [approvingDesignId, setApprovingDesignId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const portalFetch = (path: string, init: RequestInit = {}) =>
    fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", "x-portal-token": token || "", ...(init.headers || {}) },
    });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await portalFetch("/api/portal/data");
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setError(json.error || "Couldn't load your portal.");
          setData(null);
        } else {
          setData(json);
          setMessages(json.messages || []);
        }
      } catch (e) {
        if (active) setError("Network error loading your portal.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    return () => clearTimeout(t);
  }, [messages, activeTab]);

  const client = data?.customer;
  // The portal API returns firstName/lastName/companyName (never `name`); compose a
  // friendly display name from whatever is present.
  const clientDisplayName =
    [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() ||
    client?.companyName ||
    "";
  const jobs = data?.jobs || [];
  const invoices = data?.invoices || [];
  const designs = data?.designs || [];

  const isPaid = (inv: any) => String(inv?.status || "").toLowerCase() === "paid";
  const outstanding = invoices.filter((i: any) => !isPaid(i)).reduce((a: number, i: any) => a + (Number(i.amount) || 0), 0);
  const money = (n: number) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handlePayment = async (invoice: any) => {
    if (!invoice?.id) return;
    setPaymentLoading(true);
    setPayingInvoiceId(invoice.id);
    setPaymentError(null);
    try {
      const res = await portalFetch("/api/portal/checkout", {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoice.id, successUrl: window.location.href, cancelUrl: window.location.href }),
      });
      const json = await res.json().catch(() => ({}));
      // When Stripe isn't configured the server returns a simulated/mock response
      // (e.g. { error: "Stripe key missing. Payment simulated.", simulatedUrl: "...?success=mock" }).
      // Don't fake a successful payment — tell the client payments aren't live yet.
      const isMockCheckout =
        json.simulated === true ||
        json.mock === true ||
        (typeof json.simulatedUrl === "string" && !json.checkoutUrl && !json.url) ||
        (typeof json.error === "string" && /stripe|simulat/i.test(json.error));
      if (isMockCheckout) {
        setPaymentError("Online payments aren't enabled yet. Please contact your service provider to settle this invoice.");
        return;
      }
      const url = json.checkoutUrl || json.url;
      if (url) window.location.href = url;
      else setPaymentError(json.error || "Unable to start checkout. Please try again.");
    } catch (e: any) {
      setPaymentError(e?.message || "Payment failed. Please try again.");
    } finally {
      setPaymentLoading(false);
      setPayingInvoiceId(null);
    }
  };

  // Re-fetch portal data (used after an approval so the approval message the server
  // posts to the thread shows up in the Messages tab).
  const refreshPortalData = async () => {
    try {
      const res = await portalFetch("/api/portal/data");
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(json);
        setMessages(json.messages || []);
      }
    } catch {
      /* keep current data; non-fatal */
    }
  };

  const handleApproveProposal = async (design: any) => {
    if (!design?.id || approvingDesignId) return;
    setApprovingDesignId(design.id);
    setApproveError(null);
    try {
      const res = await portalFetch("/api/portal/proposal/approve", {
        method: "POST",
        body: JSON.stringify({ designId: design.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        setApproveError(json.error || "Couldn't approve this proposal. Please try again.");
        return;
      }
      // Mark approved locally and re-fetch so the approval message appears in the thread.
      setApprovedDesignIds((prev) => (prev.includes(design.id) ? prev : [...prev, design.id]));
      await refreshPortalData();
    } catch (e: any) {
      setApproveError(e?.message || "Network error approving proposal.");
    } finally {
      setApprovingDesignId(null);
    }
  };

  const handleDownloadInvoicePdf = async (invoice: any) => {
    if (!invoice?.id || downloadingInvoiceId) return;
    setDownloadingInvoiceId(invoice.id);
    setDownloadError(null);
    try {
      // PDF binary (not JSON) — same x-portal-token header the rest of the portal uses.
      const res = await portalFetch("/api/portal/invoice-pdf", {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      if (!res.ok) {
        setDownloadError("Couldn't generate the invoice PDF. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setDownloadError(e?.message || "Network error downloading invoice.");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text) return;
    // Optimistic append, then persist.
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, sender: "client", text }]);
    setMessageText("");
    try {
      await portalFetch("/api/portal/message", { method: "POST", body: JSON.stringify({ text }) });
    } catch (e) {
      /* keep the optimistic message; it will reconcile on next load */
    }
  };

  // --- Gate / state screens -------------------------------------------------
  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 font-sans text-white p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-zinc-900 border border-white/5 molten-edge rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Secure Portal Locked</h2>
          <p className="text-zinc-400 text-sm">You need your secure access link to open this portal. Check your email or ask your service provider to resend it.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black">
        <div className="text-white/40 animate-pulse font-sans text-sm font-black uppercase tracking-[0.3em]">Loading Your Portal...</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black text-white">
        <div className="text-center px-6">
          <h1 className="text-xl sm:text-2xl font-black uppercase mb-4 text-rose-500">Link Expired or Invalid</h1>
          <p className="text-white/50">{error || "Please contact your landscape provider for a new access link."}</p>
        </div>
      </div>
    );
  }

  const upcoming = jobs
    .filter((j: any) => j.status === "SCHEDULED" || j.status === "IN_PROGRESS")
    .map((j: any) => ({ title: j.title || "Service Visit", date: j.date ? new Date(j.date).toLocaleDateString() : "Scheduled", description: j.address || "", time: "" }));
  const completed = jobs.filter((j: any) => j.status === "COMPLETED");

  return (
    <div className="min-h-[100dvh] bg-zinc-950 font-sans text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl sm:text-4xl font-black uppercase tracking-normal md:tracking-tighter italic">Your Property</h1>
            <p className="text-forest-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2 mt-1">
              <MapPin size={16} /> {client.address || "Service Location"}
            </p>
          </div>
          <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-4 sm:text-right">
            <p className="text-xs md:text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Serviced By</p>
            <p className="font-bold text-lg leading-none">{data.tenantName || "Your Service Provider"}</p>
          </div>
        </header>

        <div className="flex bg-black p-2 border border-white/5 rounded-3xl mb-8 overflow-x-auto">
          {["dashboard", "jobs", "invoices", "design", "messages"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 px-6 rounded-2xl font-black text-xs md:text-[11px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <main>
          {activeTab === "dashboard" && (
            <ClientDashboard
              client={client}
              displayName={clientDisplayName}
              upcomingServices={upcoming}
              recentProjects={completed.map((j: any) => ({
                title: j.title || "Service",
                date: j.completedAt ? new Date(j.completedAt).toLocaleDateString() : j.date ? new Date(j.date).toLocaleDateString() : "",
                statusUpdate: j.notes || "Service completed.",
              }))}
            />
          )}

          {activeTab === "jobs" && (
            <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl">
              <h2 className="text-xs font-black text-forest-400 uppercase tracking-widest mb-8">Service History</h2>
              {jobs.length === 0 ? (
                <div className="bg-black/40 border-2 border-white/5 rounded-2xl p-12 text-center text-white/40">
                  <Clock size={26} className="mx-auto mb-3 text-forest-400" />
                  <p className="font-black uppercase tracking-widest text-sm">No services scheduled yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.map((j: any) => {
                    const done = j.status === "COMPLETED";
                    return (
                      <div key={j.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/40 p-6 rounded-2xl border-2 border-white/5 gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-full shrink-0 ${done ? "bg-forest-500/20 text-forest-400" : "bg-celtic-500/20 text-celtic-400"}`}>
                            {done ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                          </div>
                          <div>
                            <p className="font-black uppercase tracking-widest text-sm mb-1">{j.title || "Service Visit"}</p>
                            <p className="text-white/50 text-xs">{j.notes || j.address || j.status}</p>
                          </div>
                        </div>
                        <div className="sm:text-right shrink-0">
                          <p className="text-xs md:text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">{done ? "Completed" : "Scheduled"}</p>
                          <p className="font-medium text-sm text-forest-400 flex items-center sm:justify-end gap-2">
                            <Calendar size={14} /> {j.date ? new Date(j.date).toLocaleDateString() : "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl">
              <h2 className="text-xs font-black text-forest-400 uppercase tracking-widest mb-8">Billing & Invoices</h2>
              {invoices.length === 0 ? (
                <div className="bg-black/40 border-2 border-white/5 rounded-2xl p-12 text-center">
                  <div className="w-14 h-14 bg-forest-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-forest-400">
                    <CreditCard size={26} />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-sm mb-1">No Invoices Yet</h3>
                  <p className="text-white/40 text-xs">You're all caught up. New invoices will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="bg-rose-500/10 border-2 border-rose-500/20 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h3 className="text-rose-400 font-black uppercase tracking-widest text-xs mb-1">Outstanding Balance</h3>
                      <p className="text-2xl sm:text-3xl sm:text-4xl font-black italic tracking-normal md:tracking-tighter text-white">${money(outstanding)}</p>
                    </div>
                    {(paymentError || downloadError) && (
                      <div className="bg-rose-500/20 text-rose-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2 max-w-sm">
                        <AlertCircle size={14} /> {paymentError || downloadError}
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    {invoices.map((inv: any) => {
                      const paid = isPaid(inv);
                      return (
                        <div key={inv.id} className={`flex flex-col sm:flex-row sm:items-center justify-between bg-black/40 p-4 sm:p-6 rounded-2xl border-2 border-white/5 gap-4 ${paid ? "opacity-50 grayscale" : ""}`}>
                          <div>
                            <h4 className="font-bold text-sm">{inv.items?.[0]?.description || "Service Invoice"}</h4>
                            <p className="text-white/50 text-xs">INV-{String(inv.id).slice(0, 6)}{inv.dueDate ? ` • Due ${new Date(inv.dueDate).toLocaleDateString()}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="text-right">
                              <p className="font-black">${money(inv.amount)}</p>
                              <p className={`text-xs md:text-[10px] font-black uppercase tracking-widest ${paid ? "text-forest-400" : "text-rose-400"}`}>{paid ? "Paid" : inv.status || "Unpaid"}</p>
                            </div>
                            <button
                              onClick={() => handleDownloadInvoicePdf(inv)}
                              disabled={downloadingInvoiceId === inv.id}
                              className="bg-white/5 text-white border-2 border-white/10 font-black uppercase tracking-widest text-[10px] sm:text-xs py-3 px-5 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                            >
                              <Download size={14} /> {downloadingInvoiceId === inv.id ? "Generating..." : "Download PDF"}
                            </button>
                            {!paid && (
                              <button
                                onClick={() => handlePayment(inv)}
                                disabled={paymentLoading}
                                className="bg-white text-black font-black uppercase tracking-widest text-[10px] sm:text-xs py-3 px-5 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                              >
                                <CreditCard size={14} /> {payingInvoiceId === inv.id ? "Processing..." : "Pay Now"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "design" && (
            <div className="space-y-8">
              {designs.length === 0 ? (
                <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-12 text-center">
                  <div className="w-14 h-14 bg-forest-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-forest-400">
                    <Leaf size={26} />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-sm mb-1">No Design Proposals Yet</h3>
                  <p className="text-white/40 text-xs">When your provider builds a design vision for your property, it will appear here.</p>
                </div>
              ) : (
                designs.map((d: any) => {
                  const p = d.proposal || {};
                  const materials = p.estimatedMaterials || [];
                  const total = materials.reduce((a: number, m: any) => a + (Number(m.estimatedCost) || 0), 0);
                  const isApproved = p.approved === true || approvedDesignIds.includes(d.id);
                  return (
                    <div key={d.id} className="bg-zinc-900 border-4 border-forest-500/10 rounded-2xl p-5 sm:p-8 shadow-2xl">
                      <div className="inline-block px-3 py-1 bg-forest-500/10 text-forest-400 font-bold uppercase tracking-widest text-xs md:text-[10px] rounded-lg mb-4">
                        Design Proposal
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white mb-2">{d.summary || p.visionSummary || "Your Design Vision"}</h3>
                      {p.strategicValue && <p className="text-white/60 text-sm leading-relaxed mb-6">{p.strategicValue}</p>}

                      {(d.beforeUrl || d.afterUrl) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                          {[{ u: d.beforeUrl, l: "Before" }, { u: d.afterUrl, l: "After (AI Vision)" }].filter((x) => x.u).map((x) => (
                            <div key={x.l} className="relative rounded-2xl overflow-hidden border-2 border-white/5 aspect-video bg-black/40">
                              <img src={x.u} alt={x.l} className="w-full h-full object-cover" />
                              <span className="absolute top-2 left-2 text-[10px] font-black uppercase tracking-widest bg-black/60 px-2 py-1 rounded">{x.l}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {materials.length > 0 && (
                        <div className="bg-black/40 rounded-2xl border border-white/5 p-6">
                          <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
                            <h5 className="text-xs font-bold uppercase tracking-widest text-white/50">Estimated Materials</h5>
                            {total > 0 && <span className="text-lg font-black text-forest-400">${money(total)}</span>}
                          </div>
                          <div className="space-y-3">
                            {materials.map((m: any, i: number) => (
                              <div key={i} className="flex justify-between items-center text-sm">
                                <span className="text-white">{m.quantity ? `${m.quantity} ` : ""}{m.item}</span>
                                <span className="text-white/50">${money(m.estimatedCost)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 pt-6 border-t border-white/10">
                        {isApproved ? (
                          <div className="inline-flex items-center gap-2 bg-forest-500/10 text-forest-400 font-black uppercase tracking-widest text-xs py-3 px-5 rounded-xl">
                            <CheckCircle2 size={16} /> Approved ✓
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApproveProposal(d)}
                              disabled={approvingDesignId === d.id}
                              className="bg-forest-500 hover:bg-forest-400 text-black font-black uppercase tracking-widest text-xs py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                            >
                              <ThumbsUp size={16} /> {approvingDesignId === d.id ? "Approving..." : "Approve Proposal"}
                            </button>
                            {approveError && approvingDesignId !== d.id && (
                              <div className="mt-3 bg-rose-500/20 text-rose-400 text-xs px-3 py-2 rounded-lg inline-flex items-center gap-2">
                                <AlertCircle size={14} /> {approveError}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "messages" && (
            <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl flex flex-col h-[500px]">
              <h2 className="text-xs font-black text-forest-400 uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Messages</h2>
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                {messages.length === 0 && (
                  <p className="text-white/30 text-sm text-center py-8">No messages yet. Say hello to your service team below.</p>
                )}
                {messages.map((m: any) => (
                  <div key={m.id} className={`rounded-2xl p-4 max-w-[85%] ${m.sender === "client" ? "bg-celtic-500/10 border border-celtic-500/20 self-end ml-auto" : "bg-forest-500/10 border border-forest-500/20 self-start"}`}>
                    <p className={`text-xs md:text-[10px] font-bold uppercase tracking-widest mb-2 ${m.sender === "client" ? "text-celtic-400" : "text-forest-400"}`}>
                      {m.sender === "client" ? "You" : data.tenantName || "Service Team"}
                    </p>
                    <p className="text-sm">{m.text}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="relative mt-auto pt-4 border-t border-white/10 flex gap-2">
                <label htmlFor="portal-message-input" className="sr-only">Message your service team</label>
                <input
                  id="portal-message-input"
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Reply to your service team..."
                  className="w-full bg-black/50 border-2 border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-forest-500/50 focus:outline-none transition-colors"
                />
                <button type="submit" disabled={!messageText.trim()} aria-label="Send Message" className="px-6 bg-forest-500 hover:bg-forest-400 disabled:opacity-50 text-black rounded-xl font-black uppercase tracking-widest transition-colors flex items-center justify-center">
                  <Send size={18} />
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
