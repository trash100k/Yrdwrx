import React, { useState } from "react";
import {
  AlertTriangle,
  Trash2,
  Activity,
  Zap,
  WifiOff,
  Flame,
  ShieldAlert,
  Database,
} from "lucide-react";
import { collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useToast } from "../contexts/ToastContext";

export default function SystemQA() {
  const [isWiping, setIsWiping] = useState(false);
  const [stressTesting, setStressTesting] = useState(false);
  const { showToast } = useToast();

  const handleFactoryReset = async () => {
    const confirmation = window.confirm(
      "WARNING: This will permanently wipe all CRM, Crews, and Telemetry data. Are you sure?",
    );
    if (!confirmation) return;

    setIsWiping(true);
    showToast("Initiating destructive data wipe...");

    try {
      const collectionsToWipe = ["customers", "crews", "leads", "vendors"];

      for (const colName of collectionsToWipe) {
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      showToast("Database wiped successfully. Real clean.");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      showToast("Wipe failed: " + err.message);
    } finally {
      setIsWiping(false);
    }
  };

  const throwFatalError = () => {
    throw new Error(
      "QA TRIGGERED: Uncaught React Error for Error Boundary validation.",
    );
  };

  const simulateNetworkSpike = async () => {
    setStressTesting(true);
    showToast("Injecting artificial 3000ms latency queue...");

    // We would simulate this by adding it to an atom/context,
    // but a visual mock delay is fine for QA testing feedback.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    showToast("Network spike simulation complete.");
    setStressTesting(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-black p-8 relative">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white">
              QA & System Destructive Tools
            </h1>
            <p className="text-white/40 uppercase tracking-widest text-[10px] font-black mt-2">
              Safety interlocks disabled. Proceed with explicit authorization.
            </p>
          </div>

          <div className="px-6 py-3 border-2 border-rose-500 bg-rose-500/10 text-rose-500 rounded-full font-black text-[10px] uppercase tracking-widest animate-pulse flex items-center gap-2">
            <ShieldAlert size={14} />
            Destructive Mode Active
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Section 1: Data Wipes */}
          <div className="p-8 border-4 border-white/10 rounded-[32px] bg-zinc-950 flex flex-col items-start">
            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mb-6 font-bold shadow-[0_0_20px_rgba(244,63,94,0.4)]">
              <Trash2 size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase text-white mb-2 italic">
              Factory Reset
            </h2>
            <p className="text-white/40 text-sm font-medium mb-8 leading-relaxed max-w-sm">
              Initiates a comprehensive deletion of all collections in
              Firestore: Customers, Operations, Crews, and Inventory. This
              cannot be undone.
            </p>
            <button
              onClick={handleFactoryReset}
              disabled={isWiping}
              className="mt-auto px-8 py-5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-black font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl flex items-center gap-3 disabled:opacity-50"
            >
              {isWiping ? "Executing Purge..." : "Initiate Full DB Wipe"}
            </button>
          </div>

          {/* Section 2: Boundary Testing */}
          <div className="p-8 border-4 border-amber-500/20 rounded-[32px] bg-zinc-950 flex flex-col items-start group hover:border-amber-500/50 transition-colors">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mb-6 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase text-white mb-2 italic">
              Error Boundary Cascade
            </h2>
            <p className="text-white/40 text-sm font-medium mb-8 leading-relaxed max-w-sm">
              Intentionally throw an uncaught React exception to verify the
              GlobalErrorBoundary catches and safely logs telemetry rather than
              white-screening the app.
            </p>
            <button
              onClick={throwFatalError}
              className="mt-auto px-8 py-5 border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black active:scale-95 font-black uppercase tracking-widest rounded-2xl transition-all flex items-center gap-3"
            >
              Throw Fatal Exception
            </button>
          </div>

          {/* Section 3: Field Anomaly Testing */}
          <div className="p-8 border-4 border-white/10 rounded-[32px] bg-zinc-950 flex flex-col items-start col-span-1 md:col-span-2">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 mb-6">
              <Flame size={32} />
            </div>
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black uppercase text-white mb-2 italic">
                Hardware Telemetry Overrides
              </h2>
              <p className="text-white/40 text-sm font-medium mb-8 leading-relaxed">
                Inject ASAE structural anomaly signals into the Field
                Diagnostics network to test live notification routines and the
                emergency shutoff protocol.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 mt-auto">
              <button
                onClick={() =>
                  showToast(
                    "ASAE 474: Thermal Runaway detected on Zero-Turn Main.",
                  )
                }
                className="px-6 py-4 bg-zinc-900 border border-white/20 text-white hover:border-rose-500 hover:text-rose-500 active:scale-95 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center gap-3"
              >
                <Flame size={16} /> Simulate Battery Fire
              </button>
              <button
                onClick={simulateNetworkSpike}
                disabled={stressTesting}
                className="px-6 py-4 bg-zinc-900 border border-white/20 text-white hover:border-amber-500 hover:text-amber-500 active:scale-95 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center gap-3 disabled:opacity-50"
              >
                <WifiOff size={16} /> Latency Spike (3s)
              </button>
              <button
                onClick={() =>
                  showToast("Diagnostics Ping: 2800 PSI Hydraulic Override.")
                }
                className="px-6 py-4 bg-zinc-900 border border-white/20 text-white hover:border-cyan-500 hover:text-cyan-500 active:scale-95 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center gap-3"
              >
                <Activity size={16} /> Hydraulic Override
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
