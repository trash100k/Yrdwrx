// @ts-nocheck
// Public, customer-facing online booking / instant-quote request. No auth — posts to the
// rate-limited /api/public/* namespace, which creates a NEW lead in the tenant's pipeline.
// This page is fully self-contained: it must NOT depend on the app shell, auth, repos,
// or contexts (it renders for anonymous prospects at /book/:tenantId).
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Leaf, Loader2, CheckCircle2, PhoneOff, RefreshCw } from "lucide-react";

const SERVICES = [
  "Lawn Mowing & Maintenance",
  "Landscape Design / Install",
  "Mulch & Bed Refresh",
  "Hardscape / Patio / Walls",
  "Irrigation",
  "Tree & Shrub Care",
  "Seasonal Cleanup",
  "Other",
];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  address: "",
  serviceInterest: SERVICES[0],
  preferredDate: "",
  message: "",
};

// Lenient email shape check — we only validate format when an email is actually provided
// (the hard requirement is name + at-least-one-of email/phone, mirrored server-side).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BookingIntake() {
  const { tenantId } = useParams();
  const [company, setCompany] = useState<string>("");
  const [loadingTenant, setLoadingTenant] = useState<boolean>(true);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  // idle | submitting | done | unavailable (503) | error
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "unavailable" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setCompany("YardWorx");
      setLoadingTenant(false);
      return;
    }
    let alive = true;
    setLoadingTenant(true);
    // PUBLIC page: plain fetch (NO fetchApi / no auth token).
    fetch(`/api/public/tenant/${encodeURIComponent(tenantId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setCompany(d?.name || "YardWorx"); })
      .catch(() => { if (alive) setCompany("YardWorx"); })
      .finally(() => { if (alive) setLoadingTenant(false); });
    return () => { alive = false; };
  }, [tenantId]);

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const brand = company || "YardWorx";
  const firstName = form.name.trim().split(/\s+/)[0] || "";

  const validate = (): string | null => {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!name) return "Please add your name so we know who to reach out to.";
    if (!email && !phone) return "Please add an email or phone so we can get back to you.";
    if (email && !EMAIL_RE.test(email)) return "That email doesn't look right — please double-check it.";
    return null;
  };

  const submit = async (e: any) => {
    e.preventDefault();
    setError(null);
    const problem = validate();
    if (problem) { setError(problem); return; }

    setStatus("submitting");
    try {
      const res = await fetch("/api/public/lead-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          serviceInterest: form.serviceInterest,
          // Fold the preferred date into the free-text message so it reaches the
          // pipeline even though the server has no dedicated column for it.
          message: [
            form.preferredDate ? `Preferred date: ${form.preferredDate}` : "",
            form.message.trim(),
          ].filter(Boolean).join("\n"),
        }),
      });

      if (res.ok) {
        setStatus("done");
        return;
      }

      // Distinct, friendly handling per server status.
      if (res.status === 503) {
        setStatus("unavailable");
        return;
      }
      let serverMsg = "";
      try { serverMsg = (await res.json())?.error || ""; } catch { /* non-JSON body */ }
      if (res.status === 429) {
        setError(serverMsg || "Too many requests right now. Please wait a moment and try again.");
      } else if (res.status === 404) {
        setError(serverMsg || "We couldn't find that business. Please check the link you were sent.");
      } else if (res.status === 400) {
        setError(serverMsg || "Please double-check your details and try again.");
      } else {
        setError(serverMsg || "Something went wrong on our end. Please try again.");
      }
      setStatus("error");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  };

  // --- Success screen --------------------------------------------------------
  if (status === "done") {
    return (
      <Shell>
        <div className="text-center space-y-5 py-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-forest-500/15 border border-forest-500/30 flex items-center justify-center">
            <CheckCircle2 className="text-forest-400" size={34} />
          </div>
          <h1 className="text-2xl font-black italic uppercase tracking-tight">We got your request</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Thanks{firstName ? `, ${firstName}` : ""}. {brand} will be in touch shortly to schedule your estimate.
          </p>
          <button
            type="button"
            onClick={() => { setForm({ ...EMPTY_FORM }); setStatus("idle"); setError(null); }}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw size={14} /> Send another request
          </button>
        </div>
      </Shell>
    );
  }

  // --- Booking temporarily unavailable (503) ---------------------------------
  if (status === "unavailable") {
    return (
      <Shell brand={brand} loadingTenant={loadingTenant}>
        <div className="text-center space-y-5 py-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <PhoneOff className="text-amber-400" size={32} />
          </div>
          <h1 className="text-2xl font-black italic uppercase tracking-tight">Booking temporarily unavailable</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Online booking for {brand} is offline for a moment. Please call us directly and we'll get you scheduled right away.
          </p>
          <button
            type="button"
            onClick={() => { setStatus("idle"); setError(null); }}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      </Shell>
    );
  }

  // --- Form ------------------------------------------------------------------
  return (
    <Shell brand={brand} loadingTenant={loadingTenant} subtitle>
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm rounded-xl px-4 py-3" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" required>
          <input value={form.name} onChange={set("name")} className={inputCls} placeholder="Your name" autoComplete="name" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email">
            <input value={form.email} onChange={set("email")} type="email" inputMode="email" className={inputCls} placeholder="you@email.com" autoComplete="email" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" className={inputCls} placeholder="(555) 555-5555" autoComplete="tel" />
          </Field>
        </div>
        <Field label="Property address">
          <input value={form.address} onChange={set("address")} className={inputCls} placeholder="Street, City, State" autoComplete="street-address" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Service interest">
            <select value={form.serviceInterest} onChange={set("serviceInterest")} className={inputCls}>
              {SERVICES.map((s) => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
            </select>
          </Field>
          <Field label="Preferred date">
            <input value={form.preferredDate} onChange={set("preferredDate")} type="date" className={inputCls} />
          </Field>
        </div>
        <Field label="Details">
          <textarea value={form.message} onChange={set("message")} rows={4} className={inputCls} placeholder="Tell us what you'd like done…" />
        </Field>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full py-4 bg-forest-500 hover:bg-forest-400 active:bg-forest-600 disabled:opacity-60 disabled:cursor-not-allowed text-black font-black text-sm uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {status === "submitting" ? <><Loader2 className="animate-spin" size={16} /> Sending…</> : "Request estimate"}
        </button>
        <p className="text-[10px] text-zinc-600 text-center leading-relaxed">
          Your name and an email or phone are required so we can reach you.
        </p>
      </form>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Self-contained branded shell — mobile-first, high-contrast, centered card.
// ---------------------------------------------------------------------------
function Shell({
  children,
  brand,
  loadingTenant,
  subtitle,
}: {
  children: React.ReactNode;
  brand?: string;
  loadingTenant?: boolean;
  subtitle?: boolean;
}) {
  return (
    <main className="min-h-[100dvh] bg-black text-white flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full bg-zinc-950 border border-white/5 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-forest-400">
            <Leaf size={18} />
            {loadingTenant ? (
              <span className="h-3 w-28 rounded bg-white/10 animate-pulse" aria-hidden />
            ) : (
              <span className="text-xs font-bold uppercase tracking-widest truncate">{brand || "YardWorx"}</span>
            )}
          </div>
          {subtitle && (
            <>
              <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tight">Request a free estimate</h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Tell us about your project and we'll get back to you to schedule a visit.
              </p>
            </>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}

const inputCls =
  "w-full bg-black/40 border border-white/10 focus:border-forest-500/50 focus:ring-1 focus:ring-forest-500/30 outline-none rounded-xl px-4 py-3.5 text-base sm:text-sm text-white placeholder:text-zinc-600 transition-colors";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
        {label}{required && <span className="text-forest-400"> *</span>}
      </span>
      {children}
    </label>
  );
}
