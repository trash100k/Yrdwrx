// @ts-nocheck
// Referral & Advocacy Engine — turn happy customers into a growth channel.
//
// What an owner buys this for: the cheapest new job is a referred one. This page:
//   1) Summarizes the referral pipeline (total, converted, rewards owed).
//   2) Surfaces ADVOCATES — customers who already left a strong review (rating >= 4) —
//      and lets you ask them for a referral in one click (generates a trackable share
//      code, records the referral, and emails the share link when an address is on file).
//   3) Lets you log a referral manually (e.g. one that came in by word of mouth).
//   4) Tracks every referral through its lifecycle with inline status controls and a
//      one-click "mark rewarded".
//
// Honesty policy: the server tells us whether an email actually SENT or was simulated;
// we toast exactly what happened and never claim a send we didn't make. If a customer
// has no email we still record the referral and hand the operator the link to share.

import React, { useEffect, useMemo, useState } from "react";
import {
  Gift,
  Users,
  Share2,
  CheckCircle2,
  Trophy,
  Sparkles,
  RefreshCw,
  Plus,
  Star,
  Mail,
  Link2,
  Loader2,
  Info,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";
import { referralsRepo, customersRepo, reviewsRepo } from "../lib/repos";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { fetchApi } from "../lib/api";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Flatten a repo row's freeform jsonb (data) under its top-level columns so per-row
// extras nested in `data` are visible alongside real columns.
const flatten = (r: any) => ({ ...(r?.data || {}), ...r });

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const fmtDate = (v: any) => {
  if (!v) return "—";
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const customerName = (c: any) =>
  [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
  c?.companyName ||
  c?.name ||
  c?.email ||
  "Unnamed Customer";

// Pull a customer id off a row under any of the common field names.
const customerIdOf = (r: any) =>
  r?.customerId ?? r?.customer_id ?? r?.clientId ?? r?.client_id ?? null;

// The referral lifecycle, in order. Inline <select> walks a referral along it.
const STATUS_FLOW = ["invited", "clicked", "signed_up", "converted", "rewarded"];

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  clicked: "Clicked",
  signed_up: "Signed up",
  converted: "Converted",
  rewarded: "Rewarded",
};

// Status color bands — cool for early funnel, forest as it converts.
const statusBand = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "rewarded")
    return { text: "text-forest-400", bg: "bg-forest-500/10", border: "border-forest-500/30", dot: "bg-forest-400" };
  if (s === "converted")
    return { text: "text-celtic-400", bg: "bg-celtic-500/10", border: "border-celtic-500/30", dot: "bg-celtic-400" };
  if (s === "signed_up")
    return { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30", dot: "bg-sky-400" };
  if (s === "clicked")
    return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400" };
  return { text: "text-zinc-400", bg: "bg-white/5", border: "border-white/10", dot: "bg-zinc-400" };
};

const REWARD_TYPES = ["credit", "discount", "gift"];

const rewardLabel = (type: string, value: any) => {
  const t = String(type || "credit").toLowerCase();
  const v = num(value);
  if (t === "discount") return v ? `${v}% off` : "Discount";
  if (t === "gift") return v ? `${money(v)} gift` : "Gift";
  return v ? `${money(v)} credit` : "Credit";
};

// Generate a short, human-typeable share code scoped to the tenant + customer.
const makeShareCode = (tenant: any, customer: any) =>
  `${(tenant?.name || "YW").slice(0, 3).toUpperCase()}-${(customer?.id || "")
    .slice(0, 4)
    .toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export default function Referrals() {
  const { tenant } = useTenant();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  // Per-customer "asking" spinner state, keyed by customer id.
  const [asking, setAsking] = useState<Record<string, boolean>>({});

  // Manual referral form state.
  const [form, setForm] = useState({
    referrerCustomerId: "",
    referredName: "",
    referredEmail: "",
    referredPhone: "",
    rewardType: "credit",
    rewardValue: "50",
  });
  const [submitting, setSubmitting] = useState(false);

  const shareBase = useMemo(() => {
    const origin = typeof location !== "undefined" ? location.origin : "";
    return `${origin}/book/${tenant?.id || ""}`;
  }, [tenant?.id]);

  // --- data load ------------------------------------------------------------
  const load = async () => {
    setLoading(true);
    try {
      const [refRaw, custRaw, revRaw] = await Promise.all([
        referralsRepo.list().catch(() => []),
        customersRepo.list().catch(() => []),
        reviewsRepo.list().catch(() => []),
      ]);
      setReferrals((refRaw || []).map(flatten));
      setCustomers((custRaw || []).map(flatten));
      setReviews((revRaw || []).map(flatten));
    } catch (err: any) {
      console.error("[Referrals] load failed", err);
      showToast("Could not load referral data.", "error");
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Live updates: re-pull the referral list whenever the table changes.
    const unsub = referralsRepo.subscribe((rows: any[]) =>
      setReferrals((rows || []).map(flatten)),
    );
    return () => {
      try {
        unsub && unsub();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  // --- customer lookup ------------------------------------------------------
  const customerById = useMemo(() => {
    const m: Record<string, any> = {};
    for (const c of customers) if (c.id) m[c.id] = c;
    return m;
  }, [customers]);

  // --- summary rollups ------------------------------------------------------
  const summary = useMemo(() => {
    const total = referrals.length;
    const converted = referrals.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return s === "converted" || s === "rewarded";
    }).length;
    // Pending rewards = rewardStatus === 'pending'; sum their reward value.
    const pendingRows = referrals.filter(
      (r) => String(r.rewardStatus || "").toLowerCase() === "pending",
    );
    const pendingCount = pendingRows.length;
    const pendingSum = pendingRows.reduce((a, r) => a + num(r.rewardValue), 0);
    return { total, converted, pendingCount, pendingSum };
  }, [referrals]);

  // --- advocates (review rating >= 4, resolved to a customer) ----------------
  const advocates = useMemo(() => {
    // Customers we've ALREADY created a referral for shouldn't be re-asked here.
    const askedIds = new Set(
      referrals.map((r) => r.referrerCustomerId).filter(Boolean),
    );
    // Keep the best rating per customer, newest review wins for date.
    const best: Record<string, any> = {};
    for (const rv of reviews) {
      const rating = num(rv.rating);
      if (rating < 4) continue;
      const cid = customerIdOf(rv);
      if (!cid || !customerById[cid]) continue;
      const prev = best[cid];
      if (!prev || rating > prev.rating) {
        best[cid] = { rating, review: rv };
      }
    }
    return Object.entries(best)
      .filter(([cid]) => !askedIds.has(cid))
      .map(([cid, info]: any) => ({
        customer: customerById[cid],
        rating: info.rating,
        review: info.review,
      }))
      .sort((a, b) => b.rating - a.rating);
  }, [reviews, customerById, referrals]);

  // --- ask an advocate for a referral ---------------------------------------
  const askForReferral = async (customer: any) => {
    if (!customer?.id) return;
    setAsking((m) => ({ ...m, [customer.id]: true }));
    const shareCode = makeShareCode(tenant, customer);
    const shareLink = `${shareBase}?ref=${shareCode}`;
    try {
      // 1) Always record the referral first so the offer is trackable.
      await referralsRepo.create({
        referrerCustomerId: customer.id,
        status: "invited",
        shareCode,
        rewardType: "credit",
        rewardValue: 50,
        rewardStatus: "pending",
      });

      // 2) If we have an email, try to send the share link — and report honestly.
      const email = customer.email;
      if (email) {
        try {
          const res = await fetchApi("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: email,
              subject: `${tenant?.name || "We"} would love your referral`,
              text:
                `Hi ${customerName(customer)},\n\n` +
                `Thanks so much for being a great customer. If you know anyone who could use our help, ` +
                `we'd be grateful for the introduction — and there's a $50 credit in it for you when they book.\n\n` +
                `Share this link: ${shareLink}\n\n` +
                `Thank you!\n${tenant?.name || "The team"}`,
            }),
          });
          if (!res.ok) {
            const e = await res.text().catch(() => "");
            throw new Error(e || `HTTP ${res.status}`);
          }
          const data = await res.json().catch(() => ({}));
          if (data?.sent) {
            showToast(`Referral invite emailed to ${email}.`, "success");
          } else {
            showToast(
              `Referral created. Email simulated — not actually sent${
                data?.reason ? ` (${data.reason})` : " (no email provider configured)"
              }. Link: ${shareLink}`,
              "warning",
            );
          }
        } catch (mailErr: any) {
          console.error("[Referrals] email failed", mailErr);
          // The record was created; only the email failed — say so.
          showToast(
            `Referral created, but the email failed to send. Share manually: ${shareLink}`,
            "warning",
          );
        }
      } else {
        // No email on file — record stands, hand the operator the link.
        showToast(
          `Referral created — share the link manually: ${shareLink}`,
          "info",
        );
      }
    } catch (err: any) {
      console.error("[Referrals] askForReferral failed", err);
      showToast("Could not create that referral. Try again.", "error");
    } finally {
      setAsking((m) => ({ ...m, [customer.id]: false }));
    }
  };

  // --- manual referral submit -----------------------------------------------
  const submitManual = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = form.referredName.trim();
    if (!name) {
      showToast("Add the referred person's name first.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const referrer = form.referrerCustomerId
        ? customerById[form.referrerCustomerId]
        : null;
      const shareCode = makeShareCode(tenant, referrer || { id: name });
      await referralsRepo.create({
        referrerCustomerId: form.referrerCustomerId || null,
        referredName: name,
        referredEmail: form.referredEmail.trim() || null,
        referredPhone: form.referredPhone.trim() || null,
        status: "invited",
        shareCode,
        rewardType: form.rewardType,
        rewardValue: num(form.rewardValue),
        rewardStatus: "pending",
      });
      showToast(`Referral for ${name} added.`, "success");
      setForm({
        referrerCustomerId: "",
        referredName: "",
        referredEmail: "",
        referredPhone: "",
        rewardType: "credit",
        rewardValue: "50",
      });
    } catch (err: any) {
      console.error("[Referrals] submitManual failed", err);
      showToast("Could not save that referral. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // --- inline status + reward actions ---------------------------------------
  const setStatus = async (row: any, status: string) => {
    if (!row?.id || status === row.status) return;
    try {
      await referralsRepo.update(row.id, { status });
      // Optimistic; subscribe() will reconcile.
      setReferrals((rows) =>
        rows.map((r) => (r.id === row.id ? { ...r, status } : r)),
      );
    } catch (err: any) {
      console.error("[Referrals] setStatus failed", err);
      showToast("Could not update status.", "error");
    }
  };

  const markRewarded = async (row: any) => {
    if (!row?.id) return;
    try {
      await referralsRepo.update(row.id, {
        status: "rewarded",
        rewardStatus: "fulfilled",
      });
      setReferrals((rows) =>
        rows.map((r) =>
          r.id === row.id
            ? { ...r, status: "rewarded", rewardStatus: "fulfilled" }
            : r,
        ),
      );
      showToast("Reward marked as fulfilled.", "success");
    } catch (err: any) {
      console.error("[Referrals] markRewarded failed", err);
      showToast("Could not mark rewarded.", "error");
    }
  };

  // Newest referrals first.
  const sortedReferrals = useMemo(
    () =>
      [...referrals].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      ),
    [referrals],
  );

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-forest-500/10 rounded-full border border-forest-500 text-xs font-black uppercase tracking-widest text-forest-400">
            <Gift size={16} />
            Growth Engine
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Referral &amp; Advocacy
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Turn Fans Into New Jobs
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-black border border-white/5 text-xs font-black uppercase tracking-widest text-zinc-400">
            <Share2 size={14} className="text-forest-400" />
            {summary.total} Tracked
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest whitespace-nowrap border-4 border-transparent bg-forest-500/10 text-forest-400 hover:bg-forest-500/20 transition-colors shrink-0 disabled:opacity-40"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {/* Summary tiles */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            icon={Share2}
            tone="celtic"
            label="Total Referrals"
            value={String(summary.total)}
            sub={`${advocates.length} advocate${advocates.length === 1 ? "" : "s"} ready to ask`}
          />
          <MetricCard
            icon={CheckCircle2}
            tone="forest"
            label="Converted"
            value={String(summary.converted)}
            sub={
              summary.total > 0
                ? `${Math.round((summary.converted / summary.total) * 100)}% conversion`
                : "no referrals yet"
            }
          />
          <MetricCard
            icon={Trophy}
            tone={summary.pendingCount > 0 ? "amber" : "forest"}
            label="Rewards Pending"
            value={String(summary.pendingCount)}
            valueClass={summary.pendingCount > 0 ? "text-amber-400" : "text-forest-400"}
            sub={
              summary.pendingCount > 0
                ? `${money(summary.pendingSum)} owed in rewards`
                : "all rewards fulfilled"
            }
          />
        </div>
      )}

      {/* Advocates to ask */}
      <section className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-8 border-b border-white/10 flex items-center gap-4">
          <Sparkles size={22} className="text-forest-400" />
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tight uppercase leading-none">
              Advocates To Ask
            </h3>
            <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em] mt-1.5 text-[10px]">
              Customers who rated you 4★ or higher
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : advocates.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Star}
              title="No advocates queued up"
              description="Once customers leave reviews rating you 4 stars or higher, they'll appear here so you can ask them for a referral in one click — and we'll track the offer."
            />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {advocates.map((a, i) => {
              const c = a.customer;
              const busy = !!asking[c.id];
              return (
                <motion.div
                  key={c.id || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  className="px-8 py-5 flex flex-col sm:flex-row sm:items-center gap-5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-forest-500/10 border border-forest-500/20 text-forest-400 flex items-center justify-center shrink-0 font-black italic">
                      {customerName(c).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white italic uppercase truncate">
                        {customerName(c)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          {[...Array(Math.min(5, Math.round(a.rating)))].map((_, k) => (
                            <Star key={k} size={11} className="fill-amber-400" />
                          ))}
                        </span>
                        <span className="micro-label font-black text-white/25 uppercase tracking-widest text-[9px]">
                          {c.email ? c.email : "No email on file"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => askForReferral(c)}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-forest-500/10 text-forest-400 border border-forest-500/30 hover:bg-forest-500/20 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : c.email ? (
                      <Mail size={14} />
                    ) : (
                      <Link2 size={14} />
                    )}
                    {busy ? "Asking…" : "Ask for referral"}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* New referral (manual) */}
      <section className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-8 border-b border-white/10 flex items-center gap-4">
          <Plus size={22} className="text-forest-400" />
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tight uppercase leading-none">
              Log A Referral
            </h3>
            <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em] mt-1.5 text-[10px]">
              Word-of-mouth came in? Track it here
            </p>
          </div>
        </div>

        <form onSubmit={submitManual} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Referred by (optional)">
              <select
                value={form.referrerCustomerId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, referrerCustomerId: e.target.value }))
                }
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-forest-500 focus:outline-none transition-colors"
              >
                <option value="">— Select a customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {customerName(c)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Referred name *">
              <input
                value={form.referredName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, referredName: e.target.value }))
                }
                placeholder="Jane Doe"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-white/20 focus:border-forest-500 focus:outline-none transition-colors"
              />
            </Field>

            <Field label="Referred email">
              <input
                type="email"
                value={form.referredEmail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, referredEmail: e.target.value }))
                }
                placeholder="jane@example.com"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-white/20 focus:border-forest-500 focus:outline-none transition-colors"
              />
            </Field>

            <Field label="Referred phone">
              <input
                value={form.referredPhone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, referredPhone: e.target.value }))
                }
                placeholder="(555) 123-4567"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-white/20 focus:border-forest-500 focus:outline-none transition-colors"
              />
            </Field>

            <Field label="Reward type">
              <select
                value={form.rewardType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rewardType: e.target.value }))
                }
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-forest-500 focus:outline-none transition-colors capitalize"
              >
                {REWARD_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={form.rewardType === "discount" ? "Reward value (%)" : "Reward value ($)"}>
              <input
                type="number"
                min="0"
                value={form.rewardValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rewardValue: e.target.value }))
                }
                placeholder="50"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-white/20 focus:border-forest-500 focus:outline-none transition-colors"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-4 bg-forest-500 hover:bg-forest-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-forest-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              {submitting ? "Saving…" : "Add referral"}
            </button>
          </div>
        </form>
      </section>

      {/* Referrals list */}
      <section className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-8 border-b border-white/10 flex items-center gap-4">
          <Users size={22} className="text-forest-400" />
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tight uppercase leading-none">
              All Referrals
            </h3>
            <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em] mt-1.5 text-[10px]">
              Newest first · move each along the funnel
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : sortedReferrals.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Gift}
              title="No referrals yet"
              description="Ask an advocate above or log a word-of-mouth referral. Every referral you track will appear here with its status and reward so nothing slips through the cracks."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-white/30">
                  <th className="px-8 py-4">Referred</th>
                  <th className="px-4 py-4">Referrer</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Reward</th>
                  <th className="px-4 py-4">Created</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedReferrals.map((r, i) => {
                  const band = statusBand(r.status);
                  const referrer = r.referrerCustomerId
                    ? customerById[r.referrerCustomerId]
                    : null;
                  const rewarded =
                    String(r.status || "").toLowerCase() === "rewarded" ||
                    String(r.rewardStatus || "").toLowerCase() === "fulfilled";
                  return (
                    <motion.tr
                      key={r.id || i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.4) }}
                      className="hover:bg-white/[0.02] transition-colors group align-top"
                    >
                      {/* Referred name/email */}
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${band.dot} shadow-glow`} />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white italic uppercase truncate">
                              {r.referredName || "—"}
                            </p>
                            <p className="micro-label font-black text-white/25 uppercase tracking-widest text-[10px] mt-0.5 truncate">
                              {r.referredEmail || r.referredPhone || r.shareCode || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Referrer */}
                      <td className="px-4 py-5">
                        <span className="text-sm font-bold text-white/80 italic">
                          {referrer ? customerName(referrer) : "—"}
                        </span>
                      </td>

                      {/* Status (inline control) */}
                      <td className="px-4 py-5">
                        <select
                          value={STATUS_FLOW.includes(String(r.status)) ? r.status : "invited"}
                          onChange={(e) => setStatus(r, e.target.value)}
                          className={`bg-black border rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none transition-colors ${band.border} ${band.text}`}
                        >
                          {STATUS_FLOW.map((s) => (
                            <option key={s} value={s} className="text-white bg-black">
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Reward */}
                      <td className="px-4 py-5">
                        <span className="text-sm font-bold text-white/80 italic">
                          {rewardLabel(r.rewardType, r.rewardValue)}
                        </span>
                        <p className="micro-label font-black text-white/20 uppercase tracking-widest text-[9px] mt-0.5">
                          {String(r.rewardStatus || "pending")}
                        </p>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-5">
                        <span className="text-sm font-bold text-white/60 italic">
                          {fmtDate(r.createdAt)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-8 py-5 text-right">
                        {rewarded ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-forest-500/10 border border-forest-500/30 text-forest-400">
                            <Trophy size={12} />
                            Rewarded
                          </span>
                        ) : (
                          <button
                            onClick={() => markRewarded(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/60 hover:text-forest-400 hover:border-forest-500/30 transition-colors whitespace-nowrap"
                          >
                            <Trophy size={12} />
                            Mark rewarded
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Methodology footnote */}
      {!loading && (
        <div className="flex items-start gap-3 px-6 py-5 rounded-2xl bg-black/40 border border-white/5 text-xs text-white/40 font-bold leading-relaxed">
          <Info size={16} className="text-forest-400 shrink-0 mt-0.5" />
          <p>
            Advocates are customers who left a review rating of 4★ or higher (and
            haven't been asked yet). Asking generates a trackable share code, records
            the referral, and — when the customer has an email — sends the share link;
            we report exactly whether the email{" "}
            <span className="inline-flex items-center gap-1 align-middle rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">
              <ArrowRight size={9} /> sent
            </span>{" "}
            or was simulated. Rewards stay <em>pending</em> until you mark them
            fulfilled.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// small presentational pieces (page-only)
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="micro-label font-black text-white/30 uppercase tracking-[0.3em] text-[10px] block mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "forest",
  valueClass = "text-white",
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "forest" | "celtic" | "amber" | "rose";
  valueClass?: string;
}) {
  const tones: Record<string, string> = {
    forest: "text-forest-400 bg-forest-500/10 border-forest-500/20",
    celtic: "text-celtic-400 bg-celtic-500/10 border-celtic-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl rounded-2xl p-8 relative overflow-hidden group"
    >
      <div className="flex items-center justify-between mb-6">
        <p className="micro-label font-black text-white/30 uppercase tracking-[0.3em] text-[10px]">
          {label}
        </p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-4xl font-black italic tracking-tighter leading-none ${valueClass}`}>
        {value}
      </p>
      {sub != null && (
        <p className="micro-label font-black text-white/25 uppercase tracking-widest text-[10px] mt-4">
          {sub}
        </p>
      )}
    </motion.div>
  );
}
