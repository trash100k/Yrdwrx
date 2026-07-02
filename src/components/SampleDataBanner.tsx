// @ts-nocheck
// Slim dismissable banner shown while seeded practice ("sample") data is present.
// The onboarding seeder stamps every practice row with data.isSample = true
// (server.ts /api/tenants/provision); src/lib/sampleData.ts owns detection/removal.
// Mounted by the app shell — renders null when the tenant has no sample rows.

import { useEffect, useState } from "react";
import { Sparkles, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "../contexts/ToastContext";
import { hasSampleData, clearSampleData } from "../lib/sampleData";

// Per-tab dismissal only: the banner comes back next session as long as sample
// rows still exist, so "clear" stays discoverable without nagging mid-session.
const DISMISS_KEY = "yardworx_sample_banner_dismissed";

export function SampleDataBanner() {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {}
    hasSampleData()
      .then((found) => {
        if (active && found) setVisible(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const { total } = await clearSampleData();
      setVisible(false);
      showToast(
        total > 0
          ? `Sample data cleared — ${total} record${total === 1 ? "" : "s"} removed.`
          : "No sample records left to remove.",
        "success",
      );
    } catch {
      showToast("Couldn't clear sample data. Please try again.", "error");
    } finally {
      setClearing(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-forest-500/10 border border-forest-500/20 rounded-2xl">
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          <div className="p-1.5 bg-forest-500/10 rounded-lg shrink-0">
            <Sparkles size={14} className="text-forest-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-forest-400 mb-0.5">
              Sample Data Loaded
            </p>
            <p className="text-xs text-zinc-400 font-medium leading-relaxed">
              Sample data is loaded so you can explore — everything marked as sample can be
              cleared anytime.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setConfirming(true)}
            disabled={clearing}
            className="px-4 py-2 bg-forest-500/10 hover:bg-forest-500/20 text-forest-400 border border-forest-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            {clearing ? "Clearing…" : "Clear Sample Data"}
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss sample data banner"
            className="p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleClear}
        title="Clear sample data?"
        description="This permanently removes every sample-flagged customer, job, invoice, crew, lead, vendor, and inventory item. Your real records are not touched."
        confirmText="Clear Sample Data"
        cancelText="Keep It"
        danger
      />
    </>
  );
}

export default SampleDataBanner;
