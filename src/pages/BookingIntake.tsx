// @ts-nocheck
// Public, customer-facing online booking / instant-quote request. No auth — posts to the
// rate-limited /api/public/* namespace, which creates a NEW lead in the tenant's pipeline.
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Leaf, Loader2, CheckCircle2 } from "lucide-react";

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

export default function BookingIntake() {
  const { tenantId } = useParams();
  const [company, setCompany] = useState<string>("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", serviceInterest: SERVICES[0], message: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/public/tenant/${encodeURIComponent(tenantId)}`)
      .then((r) => r.json())
      .then((d) => setCompany(d?.name || "YardWorx"))
      .catch(() => setCompany("YardWorx"));
  }, [tenantId]);

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: any) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setError("Please add your name and an email or phone so we can reach you.");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/public/lead-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...form }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Submission failed");
      }
      setStatus("done");
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Something went wrong. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <main className="min-h-[100dvh] bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-950 border border-white/5 rounded-2xl p-8 text-center space-y-4">
          <CheckCircle2 className="mx-auto text-forest-400" size={48} />
          <h1 className="text-2xl font-black italic uppercase tracking-tight">Request received</h1>
          <p className="text-zinc-400 text-sm">
            Thanks{form.name ? `, ${form.name.split(" ")[0]}` : ""}. {company || "The team"} will reach out shortly to schedule your estimate.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-black text-white flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full bg-zinc-950 border border-white/5 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-forest-400">
            <Leaf size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">{company || "YardWorx"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tight">Request a free estimate</h1>
          <p className="text-zinc-400 text-sm">Tell us about your project and we’ll get back to you to schedule a visit.</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Field label="Name" required>
            <input value={form.name} onChange={set("name")} className={inputCls} placeholder="Your name" autoComplete="name" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email">
              <input value={form.email} onChange={set("email")} type="email" className={inputCls} placeholder="you@email.com" autoComplete="email" />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={set("phone")} type="tel" className={inputCls} placeholder="(555) 555-5555" autoComplete="tel" />
            </Field>
          </div>
          <Field label="Property address">
            <input value={form.address} onChange={set("address")} className={inputCls} placeholder="Street, City, State" autoComplete="street-address" />
          </Field>
          <Field label="Service interest">
            <select value={form.serviceInterest} onChange={set("serviceInterest")} className={inputCls}>
              {SERVICES.map((s) => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
            </select>
          </Field>
          <Field label="Details">
            <textarea value={form.message} onChange={set("message")} rows={4} className={inputCls} placeholder="Tell us what you'd like done…" />
          </Field>
          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full py-3.5 bg-forest-500 hover:bg-forest-400 disabled:opacity-60 text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {status === "submitting" ? <><Loader2 className="animate-spin" size={16} /> Sending…</> : "Request estimate"}
          </button>
          <p className="text-[10px] text-zinc-600 text-center">Your name and an email or phone are required so we can reach you.</p>
        </form>
      </div>
    </main>
  );
}

const inputCls =
  "w-full bg-black/40 border border-white/10 focus:border-forest-500/50 focus:ring-1 focus:ring-forest-500/30 outline-none rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 transition-colors";

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
