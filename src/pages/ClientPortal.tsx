// @ts-nocheck
import React, { useEffect, useState, useRef } from "react";
import { MapPin, Calendar, CreditCard, Leaf, CheckCircle2, Lock, Send, AlertCircle, Clock, Image as ImageIcon, Download, ThumbsUp, FileSignature } from "lucide-react";
import { safeStorage } from "../lib/storage";
import ClientDashboard from "../components/ClientDashboard";
import SignaturePad from "../components/SignaturePad";

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

  // E-signature: the estimate currently open in the SignaturePad, any sign error, and a
  // local map of invoiceId -> signedAt so a freshly-signed estimate shows its date without
  // waiting on a re-fetch (the portal data shape doesn't return the signature block).
  const [signingEstimate, setSigningEstimate] = useState<any>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [signedAtById, setSignedAtById] = useState<Record<string, string>>({});

  // Living Proposal: when this portal link was opened via a proposal share link, the token pins
  // a proposalId and /api/portal/proposal/view returns the tiered (good/better/best) offer +
  // before/after refs + the linked estimate. Fetching it also LOGS the open (engagement tracking).
  const [livingProposal, setLivingProposal] = useState<any>(null);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [tierSaving, setTierSaving] = useState(false);

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

      // Living Proposal open: the token itself carries the proposalId (a plain magic-link token
      // just returns { proposal: null }). This call logs the open server-side (view tracking).
      try {
        const pr = await portalFetch("/api/portal/proposal/view", { method: "POST", body: JSON.stringify({}) });
        const pj = await pr.json().catch(() => ({}));
        if (active && pr.ok && pj.proposal) {
          setLivingProposal(pj.proposal);
          setSelectedTierId(pj.proposal.selectedTier || pj.proposal.recommendedTier || pj.proposal.tiers?.[0]?.id || null);
          setActiveTab("proposal"); // land them on the offer
        }
      } catch {
        /* proposal view is best-effort; the rest of the portal still works */
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
  // Proposal is "signed" once the linked estimate is accepted (server flag) or was signed this session.
  const proposalSigned = livingProposal
    ? !!(livingProposal.signed || signedAtById[livingProposal.estimateInvoiceId])
    : false;

  const isPaid = (inv: any) => String(inv?.status || "").toLowerCase() === "paid";
  // Payments are recorded on the invoice's `data`: data.amountPaid (running total) and
  // data.payments[]. The portal endpoint flattens some invoice fields, so read defensively
  // from both the nested `data` shape and any flattened mirror.
  const amountPaidOf = (inv: any) => Number(inv?.data?.amountPaid ?? inv?.amountPaid ?? 0) || 0;
  const balanceOf = (inv: any) => Math.max(0, (Number(inv?.amount) || 0) - amountPaidOf(inv));
  // Outstanding = sum of remaining balances across not-fully-paid invoices (partials count
  // only their balance, not the full face amount).
  const outstanding = invoices.filter((i: any) => !isPaid(i)).reduce((a: number, i: any) => a + balanceOf(i), 0);
  const money = (n: number) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handlePayment = async (invoice: any) => {
    if (!invoice?.id) return;
    setPaymentLoading(true);
    setPayingInvoiceId(invoice.id);
    setPaymentError(null);
    try {
      // Charge the remaining BALANCE, not the full face amount. The server derives the
      // authoritative charge amount from Supabase; we pass the balance so it can honor a
      // partial payment when it supports it (and so the client UI is consistent).
      const balance = balanceOf(invoice);
      const res = await portalFetch("/api/portal/checkout", {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoice.id, amount: balance, successUrl: window.location.href, cancelUrl: window.location.href }),
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

  // Client e-signs + accepts an estimate (a draft/quote invoice) from the portal. The
  // signature block is recorded server-side, which flips the estimate to "accepted".
  // SignaturePad manages its own "Signing..." state while this promise is in flight.
  const handleSignEstimate = async ({ name, dataUrl }: { name: string; dataUrl: string }) => {
    const est = signingEstimate;
    if (!est?.id) return;
    setSignError(null);
    try {
      const res = await portalFetch("/api/portal/estimate/sign", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: est.id,
          signerName: name,
          // Only send a drawn signature when one exists (typed-only signs name-only).
          ...(dataUrl ? { signatureDataUrl: dataUrl } : {}),
          // Record the chosen good/better/best tier when signing off a Living Proposal.
          ...(est._acceptedTier ? { acceptedTier: est._acceptedTier } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      // 409 => already accepted/paid elsewhere. Treat as signed so the UI settles cleanly.
      if (res.status === 409) {
        setSignedAtById((prev) => ({ ...prev, [est.id]: prev[est.id] || new Date().toISOString() }));
        setSigningEstimate(null);
        await refreshPortalData();
        return;
      }
      if (!res.ok || json.success === false) {
        setSignError(json.error || "Couldn't record your signature. Please try again.");
        setSigningEstimate(null);
        return;
      }
      setSignedAtById((prev) => ({ ...prev, [est.id]: json.signedAt || new Date().toISOString() }));
      setSigningEstimate(null);
      // Deposit on acceptance: if a deposit is due, take the client straight to Stripe Checkout.
      if (json.depositRequired && json.depositCheckoutUrl) {
        window.location.href = json.depositCheckoutUrl;
        return;
      }
      if (json.depositRequired && json.depositSimulated) {
        setSignError(
          `Signed! A ${json.depositAmount ? `$${Number(json.depositAmount).toLocaleString()} ` : ""}deposit is due — online payments aren't configured for this account, so the deposit is simulated.`,
        );
      }
      await refreshPortalData();
    } catch (e: any) {
      setSignError(e?.message || "Network error while signing. Please try again.");
      setSigningEstimate(null);
    }
  };

  // Accept a Living Proposal tier: reflect the chosen tier's price onto the linked estimate
  // (server-side, so the shipped deposit math is right), then open the SignaturePad to accept &
  // sign that estimate — reusing the exact same e-sign + deposit flow the invoice list uses.
  const handleAcceptProposal = async () => {
    const p = livingProposal;
    if (!p?.estimateInvoiceId || tierSaving) return;
    const tier = (p.tiers || []).find((t: any) => t.id === selectedTierId) || (p.tiers || [])[0] || null;
    setSignError(null);
    setTierSaving(true);
    try {
      if (tier?.id) {
        // Best-effort: if this fails we still let them sign (deposit falls back to the base amount).
        await portalFetch("/api/portal/proposal/select-tier", {
          method: "POST",
          body: JSON.stringify({ proposalId: p.id, tierId: tier.id }),
        }).catch(() => {});
      }
      setSigningEstimate({
        id: p.estimateInvoiceId,
        amount: tier?.price ?? p.estimate?.amount ?? 0,
        _acceptedTier: tier?.name || null,
      });
    } finally {
      setTierSaving(false);
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
          {[...(livingProposal ? ["proposal"] : []), "dashboard", "jobs", "invoices", "design", "messages"].map((tab) => (
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
          {activeTab === "proposal" && livingProposal && (() => {
            const p = livingProposal;
            const tiers = p.tiers || [];
            const selected = tiers.find((t: any) => t.id === selectedTierId) || tiers[0] || null;
            return (
              <div className="bg-zinc-900 border-4 border-forest-500/10 rounded-2xl p-5 sm:p-8 shadow-2xl space-y-8">
                <div>
                  <div className="inline-block px-3 py-1 bg-forest-500/10 text-forest-400 font-bold uppercase tracking-widest text-xs md:text-[10px] rounded-lg mb-4">
                    Your Proposal
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{p.title || "Your Proposal"}</h2>
                  {p.summary && <p className="text-white/60 text-sm leading-relaxed">{p.summary}</p>}
                </div>

                {(p.beforeUrl || p.afterUrl) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[{ u: p.beforeUrl, l: "Before" }, { u: p.afterUrl, l: "After (Your Vision)" }].filter((x) => x.u).map((x) => (
                      <div key={x.l} className="relative rounded-2xl overflow-hidden border-2 border-white/5 aspect-video bg-black/40">
                        <img src={x.u} alt={x.l} loading="lazy" className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 text-[10px] font-black uppercase tracking-widest bg-black/60 px-2 py-1 rounded">{x.l}</span>
                      </div>
                    ))}
                  </div>
                )}

                {tiers.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black text-forest-400 uppercase tracking-widest mb-4">Choose Your Package</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {tiers.map((t: any) => {
                        const isSel = t.id === selectedTierId;
                        const isRec = t.id === p.recommendedTier;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            disabled={proposalSigned}
                            onClick={() => setSelectedTierId(t.id)}
                            className={`text-left rounded-2xl border-2 p-5 transition-all relative disabled:cursor-default ${isSel ? "border-forest-500 bg-forest-500/10" : "border-white/10 bg-black/40 hover:border-white/25"}`}
                          >
                            {isRec && (
                              <span className="absolute -top-2 right-3 text-[9px] font-black uppercase tracking-widest bg-forest-500 text-black px-2 py-0.5 rounded">Recommended</span>
                            )}
                            <p className="font-black uppercase tracking-widest text-xs text-white/60 mb-2">{t.name}</p>
                            <p className="text-2xl font-black text-white mb-2">${money(t.price)}</p>
                            {t.blurb && <p className="text-white/50 text-xs leading-relaxed mb-3">{t.blurb}</p>}
                            {Array.isArray(t.bullets) && t.bullets.length > 0 && (
                              <ul className="space-y-1.5">
                                {t.bullets.map((b: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                                    <CheckCircle2 size={13} className="text-forest-400 shrink-0 mt-0.5" /> {b}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className={`mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isSel ? "text-forest-400" : "text-white/30"}`}>
                              <span className={`w-3 h-3 rounded-full border-2 ${isSel ? "border-forest-400 bg-forest-400" : "border-white/30"}`} /> {isSel ? "Selected" : "Select"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-white/10">
                  {proposalSigned ? (
                    <div className="inline-flex items-center gap-2 bg-forest-500/10 text-forest-400 font-black uppercase tracking-widest text-xs py-3 px-5 rounded-xl">
                      <CheckCircle2 size={16} /> Accepted &amp; Signed{selected ? ` — ${selected.name}` : ""}
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <button
                        onClick={handleAcceptProposal}
                        disabled={tierSaving || !p.estimateInvoiceId || tiers.length === 0}
                        className="bg-forest-500 hover:bg-forest-400 text-black font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-transform hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                      >
                        <FileSignature size={16} /> {tierSaving ? "Preparing..." : `Accept & Sign${selected ? ` — $${money(selected.price)}` : ""}`}
                      </button>
                      {!p.estimateInvoiceId && (
                        <p className="text-white/40 text-xs">This proposal isn't ready to sign yet — your provider will follow up.</p>
                      )}
                      {signError && (
                        <div className="bg-rose-500/20 text-rose-400 text-xs px-3 py-2 rounded-lg inline-flex items-center gap-2">
                          <AlertCircle size={14} /> {signError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

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
                    {(paymentError || downloadError || signError) && (
                      <div className="bg-rose-500/20 text-rose-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2 max-w-sm">
                        <AlertCircle size={14} /> {paymentError || downloadError || signError}
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    {invoices.map((inv: any) => {
                      const paid = isPaid(inv);
                      const amountPaid = amountPaidOf(inv);
                      const balance = balanceOf(inv);
                      // Partially paid: some money in, but a balance remains (and not flagged fully paid).
                      const isPartial = !paid && amountPaid > 0 && balance > 0;
                      // Estimate = a quote awaiting acceptance ("draft") or one already e-signed
                      // ("accepted"). The portal only exposes `status`, so we key off that plus any
                      // signature captured this session. Signed estimates show a green ✓ state; unsigned
                      // ones offer "Accept & Sign" instead of "Pay Now".
                      const statusLc = String(inv.status || "").toLowerCase();
                      const signedAt = signedAtById[inv.id];
                      const isSigned = statusLc === "accepted" || !!signedAt;
                      const isEstimate = statusLc === "draft" || isSigned;
                      return (
                        <div key={inv.id} className={`flex flex-col sm:flex-row sm:items-center justify-between bg-black/40 p-4 sm:p-6 rounded-2xl border-2 border-white/5 gap-4 ${paid ? "opacity-50 grayscale" : ""}`}>
                          <div>
                            <h4 className="font-bold text-sm">{inv.items?.[0]?.description || "Service Invoice"}</h4>
                            <p className="text-white/50 text-xs">INV-{String(inv.id).slice(0, 6)}{inv.dueDate ? ` • Due ${new Date(inv.dueDate).toLocaleDateString()}` : ""}</p>
                            {isPartial && (
                              <p className="text-white/50 text-xs mt-1">
                                Paid ${money(amountPaid)} <span className="text-white/30">·</span> Balance ${money(balance)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="text-right">
                              <p className="font-black">${money(isPartial ? balance : inv.amount)}</p>
                              {isPartial ? (
                                <span className="inline-block text-[10px] font-black uppercase tracking-widest text-celtic-400 bg-celtic-500/10 border border-celtic-500/20 px-2 py-1 rounded-lg">
                                  Partially paid
                                </span>
                              ) : (
                                <p className={`text-xs md:text-[10px] font-black uppercase tracking-widest ${paid || isSigned ? "text-forest-400" : "text-rose-400"}`}>{paid ? "Paid" : isSigned ? "Accepted" : isEstimate ? "Estimate" : inv.status || "Unpaid"}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDownloadInvoicePdf(inv)}
                              disabled={downloadingInvoiceId === inv.id}
                              className="bg-white/5 text-white border-2 border-white/10 font-black uppercase tracking-widest text-[10px] sm:text-xs py-3 px-5 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                            >
                              <Download size={14} /> {downloadingInvoiceId === inv.id ? "Generating..." : "Download PDF"}
                            </button>
                            {isEstimate ? (
                              isSigned ? (
                                <div className="inline-flex items-center gap-2 bg-forest-500/10 text-forest-400 border-2 border-forest-500/20 font-black uppercase tracking-widest text-[10px] sm:text-xs py-3 px-5 rounded-xl whitespace-nowrap">
                                  <CheckCircle2 size={14} /> Signed{signedAt ? ` ${new Date(signedAt).toLocaleDateString()}` : ""}
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setSignError(null); setSigningEstimate(inv); }}
                                  className="bg-forest-500 hover:bg-forest-400 text-black font-black uppercase tracking-widest text-[10px] sm:text-xs py-3 px-5 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 whitespace-nowrap"
                                >
                                  <FileSignature size={14} /> Accept &amp; Sign
                                </button>
                              )
                            ) : (
                              !paid && (
                              <button
                                onClick={() => handlePayment(inv)}
                                disabled={paymentLoading}
                                className="bg-white text-black font-black uppercase tracking-widest text-[10px] sm:text-xs py-3 px-5 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                              >
                                <CreditCard size={14} /> {payingInvoiceId === inv.id ? "Processing..." : isPartial ? `Pay balance $${money(balance)}` : "Pay Now"}
                              </button>
                              )
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

      {/* E-signature capture for accepting an estimate ("sign it in the driveway"). */}
      <SignaturePad
        open={!!signingEstimate}
        title="Accept & Sign Estimate"
        amountLabel={signingEstimate ? `$${money(signingEstimate.amount)}` : undefined}
        onCancel={() => setSigningEstimate(null)}
        onSign={handleSignEstimate}
      />
    </div>
  );
}
