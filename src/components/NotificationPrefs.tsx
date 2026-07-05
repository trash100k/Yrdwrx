// @ts-nocheck
// Notification preferences (tenant-level defaults) — channel toggles + quiet hours + an
// owner contact for ops alerts. Persisted into tenants.settings.notificationPrefs via the
// existing tenantsRepo.updateSettings shallow-merge; the server dispatcher (dispatchNotification
// in server.ts) reads the SAME shape and feeds it to resolveNotification() to decide which
// channels actually fire for each event. Per-customer opt-out lives on customers.data.notifPrefs
// (set from the CRM + auto-set on an inbound "STOP") and is layered on top server-side.
import React, { useState } from "react";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { tenantsRepo } from "../lib/repos";
import { Bell, ToggleRight, ToggleLeft, Mail, MessageSquare, Smartphone } from "lucide-react";

const CHANNELS: { id: "email" | "sms" | "push"; label: string; icon: any; desc: string }[] = [
  { id: "email", label: "Email", icon: Mail, desc: "Invoices, receipts, approvals & ops alerts by email." },
  { id: "sms", label: "SMS / Text", icon: MessageSquare, desc: "Time-sensitive texts (on-my-way, receipts). Held during quiet hours." },
  { id: "push", label: "Web Push", icon: Smartphone, desc: "Browser push (delivery pending device enrollment)." },
];

export function NotificationPrefs() {
  const { tenant } = useTenant();
  const { showToast } = useToast();

  const existing = (tenant?.settings as any)?.notificationPrefs || {};
  const [channels, setChannels] = useState<Record<string, boolean>>({
    email: existing.channels?.email ?? true,
    sms: existing.channels?.sms ?? false,
    push: existing.channels?.push ?? false,
  });
  const [quietEnabled, setQuietEnabled] = useState<boolean>(!!existing.quietHours);
  const [startHour, setStartHour] = useState<number>(existing.quietHours?.startHour ?? 21);
  const [endHour, setEndHour] = useState<number>(existing.quietHours?.endHour ?? 7);
  const [tz, setTz] = useState<string>(existing.quietHours?.tz ?? "");
  const [ownerPhone, setOwnerPhone] = useState<string>(existing.ownerPhone ?? "");
  const [saving, setSaving] = useState(false);

  const demo = tenant?.id?.startsWith("demo-");

  const toggleChannel = (id: string) => setChannels((c) => ({ ...c, [id]: !c[id] }));

  const save = async () => {
    if (!tenant) return;
    if (demo) { showToast("Settings updates are disabled in Demo mode."); return; }
    setSaving(true);
    try {
      const clampHour = (n: number) => Math.max(0, Math.min(24, Math.floor(Number(n) || 0)));
      const prefs: any = {
        channels: { email: !!channels.email, sms: !!channels.sms, push: !!channels.push },
        quietHours: quietEnabled ? { startHour: clampHour(startHour), endHour: clampHour(endHour), tz: tz.trim() || undefined } : null,
        ownerPhone: ownerPhone.trim() || null,
      };
      // Shallow-merges into tenants.settings; the server reads settings.notificationPrefs.
      await tenantsRepo.updateSettings({ notificationPrefs: prefs });
      showToast("Notification preferences saved.", "success");
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || "Failed to save notification preferences.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-zinc-950 border border-white/5 rounded-2xl p-5 sm:p-8 space-y-6">
      <div className="space-y-1">
        <span className="text-xs md:text-[10px] font-bold tracking-widest text-forest-400 uppercase flex items-center gap-2">
          <Bell size={14} /> Notifications
        </span>
        <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">Event Notifications</h3>
        <p className="text-sm text-zinc-400">
          Default channels for the events your customers &amp; crew expect — new invoice, payment received,
          new message, design approved, low stock, and on-my-way. Customers can still opt out per-channel,
          and texting honors quiet hours + STOP.
        </p>
      </div>

      {/* Channel defaults */}
      <div className="grid gap-3">
        {CHANNELS.map((ch) => {
          const on = !!channels[ch.id];
          return (
            <div key={ch.id} className="flex items-center justify-between gap-4 p-4 bg-black/40 rounded-2xl border border-white/5">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${on ? "bg-forest-500/10 text-forest-400" : "bg-white/5 text-white/40"}`}>
                  <ch.icon size={18} />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">{ch.label}</p>
                  <p className="text-xs text-white/50">{ch.desc}</p>
                </div>
              </div>
              <button
                onClick={() => toggleChannel(ch.id)}
                className={`text-3xl sm:text-4xl focus:outline-none transition-colors ${on ? "text-forest-500" : "text-white/20"}`}
                aria-label={`Toggle ${ch.label}`}
              >
                {on ? <ToggleRight /> : <ToggleLeft />}
              </button>
            </div>
          );
        })}
      </div>

      {/* Quiet hours */}
      <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm text-white">Quiet Hours</p>
            <p className="text-xs text-white/50">Hold texts &amp; push during these hours (email still sends). TCPA-friendly.</p>
          </div>
          <button
            onClick={() => setQuietEnabled((v) => !v)}
            className={`text-3xl sm:text-4xl focus:outline-none transition-colors ${quietEnabled ? "text-forest-500" : "text-white/20"}`}
            aria-label="Toggle quiet hours"
          >
            {quietEnabled ? <ToggleRight /> : <ToggleLeft />}
          </button>
        </div>
        {quietEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-forest-500 mb-1.5 block">Start Hour (0–23)</label>
              <input type="number" min={0} max={23} value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="w-full bg-black border-2 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:border-forest-500/50 outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-forest-500 mb-1.5 block">End Hour (0–24)</label>
              <input type="number" min={0} max={24} value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-full bg-black border-2 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:border-forest-500/50 outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-forest-500 mb-1.5 block">Timezone (IANA)</label>
              <input type="text" value={tz} placeholder="America/Chicago"
                onChange={(e) => setTz(e.target.value)}
                className="w-full bg-black border-2 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:border-forest-500/50 outline-none" />
            </div>
          </div>
        )}
      </div>

      {/* Owner phone for ops SMS (low stock / new message). Owner email is set in Business Defaults. */}
      <div>
        <label className="text-[10px] uppercase font-black tracking-widest text-forest-500 mb-1.5 block">Owner Mobile (ops-alert SMS)</label>
        <input type="tel" value={ownerPhone} placeholder="(601) 555-0123"
          onChange={(e) => setOwnerPhone(e.target.value)}
          className="w-full bg-black border-2 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:border-forest-500/50 outline-none" />
        <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest mt-2">
          Low-stock &amp; new-message ops alerts text here. Owner email (for digests) is under Business Defaults.
        </p>
      </div>

      <button
        onClick={save}
        disabled={saving || demo}
        className="px-6 py-3 bg-forest-500 hover:bg-forest-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all"
      >
        {saving ? "Saving…" : "Save Notification Preferences"}
      </button>
    </section>
  );
}

export default NotificationPrefs;
