import React, { useState, useEffect } from "react";
import { X, Shield } from "lucide-react";
import { safeStorage } from "../lib/storage";

export function ConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let consent = null;
    try {
      consent = safeStorage.getItem("cutty_data_consent");
    } catch(e) {}
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try { safeStorage.setItem("cutty_data_consent", "accepted"); } catch(e){}
    setIsVisible(false);
  };

  const handleOptOut = () => {
    try { safeStorage.setItem("cutty_data_consent", "declined"); } catch(e){}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-white/10 z-50 p-4 sm:p-6 shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-2 bg-celtic-500/10 rounded-full shrink-0">
            <Shield className="text-celtic-500" size={24} />
          </div>
          <div>
            <p className="text-sm text-zinc-300">
              <strong className="text-white">Data Privacy & Cookies</strong> - We use cookies and aggregate telemetry to improve AI performance and analyze site usage, as required under GDPR and CCPA. By accepting, you consent to our data commercialization practices outlined in our Privacy Policy.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <button
            onClick={handleOptOut}
            className="flex-1 sm:flex-none px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Opt-Out
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 sm:flex-none px-6 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 text-zinc-500 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
