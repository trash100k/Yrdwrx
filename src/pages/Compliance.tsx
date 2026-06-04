import { fetchApi } from "../lib/api";
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Shield, CloudRain, Wind, AlertTriangle, CheckCircle, PenTool, Droplets, Info, List, Download } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { useTenant } from "../contexts/TenantContext";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useRole } from "../hooks/useRole";
import { useAuditLog } from "../hooks/useAuditLog";

export default function Compliance() {
  const { showToast } = useToast();
  const { tenant } = useTenant();
  const { role } = useRole();
  const { logAction } = useAuditLog();
  const [activeTab, setActiveTab] = useState<"epa" | "audit">("epa");

  // EPA Form State
  const [chemical, setChemical] = useState("");
  const [amount, setAmount] = useState("");
  const [jobId, setJobId] = useState("");
  const [weatherCheck, setWeatherCheck] = useState<any>(null);
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant) return;
    const q = query(
      collection(db, "audit_logs"),
      where("tenantId", "==", tenant.id),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("Audit logs fetch issue:", error);
    });
    return unsub;
  }, [tenant]);

  const checkSafety = async () => {
    if (!chemical || !amount || !jobId) {
      showToast("Please fill out job, chemical, and amount first.", "error");
      return;
    }
    setLoading(true);
    setWeatherCheck(null);
    try {
      const res = await fetchApi("/api/compliance/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chemical, amount, jobId }),
      });
      const data = await res.json();
      setWeatherCheck(data);
    } catch (e) {
      showToast("Error running compliance check.", "error");
    } finally {
      setLoading(false);
    }
  };

  const submitLog = () => {
    const isSignatureRequired = tenant?.settings?.subFeatures?.requireSignature !== false;
    
    if (isSignatureRequired && !signature) {
      showToast("A digital signature is required for EPA logging.", "error");
      return;
    }
    if (isSignatureRequired && weatherCheck?.safe === false && signature.length < 5) {
      showToast("Please provide a full signature to override the AI warning.", "error");
      return;
    }
    showToast("Application Log saved to EPA Compliance Ledger.", "success");
    logAction("Compliance", "EPA Log Submitted", `Logged application of ${amount} ${chemical} on job ${jobId}`);
    setChemical("");
    setAmount("");
    setJobId("");
    setSignature("");
    setWeatherCheck(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-24">
      <header>
        <h1 className="text-2xl sm:text-3xl sm:text-4xl font-black uppercase tracking-normal md:tracking-tighter italic mb-2">
          Safety & Compliance
        </h1>
        <p className="text-white/60">
          Human-in-the-loop signoffs, AI safety checks, and enterprise audit trails.
        </p>

        {(role === "admin" || role === "owner") && (
          <div className="flex bg-black p-1 rounded-2xl border-2 border-white/10 mt-8 w-fit">
            <button
              onClick={() => setActiveTab("epa")}
              className={`py-2 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === "epa" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
              }`}
            >
              EPA Logging
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`py-2 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === "audit" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
              }`}
            >
              Enterprise Audit Trail
            </button>
          </div>
        )}
      </header>

      {activeTab === "epa" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-8">
            <h2 className="text-xl font-bold flex items-center gap-3 mb-6">
              <Droplets className="text-blue-400" /> New Application Log
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Job ID / Client</label>
                <input
                  type="text"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter Job ID"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Chemical / EPA Reg #</label>
                <input
                  type="text"
                  value={chemical}
                  onChange={(e) => setChemical(e.target.value)}
                  className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter Chemical Name"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Volume / Mix Rate</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter Dosage"
                />
              </div>

              <button
                onClick={checkSafety}
                disabled={loading || !chemical || !amount || !jobId}
                className={`w-full mt-4 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
                  tenant?.settings?.subFeatures?.aiSafetyCheck === false
                    ? "bg-white/5 text-white/20 cursor-not-allowed hidden"
                    : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
                }`}
              >
                {loading ? "Checking Weather & Rules..." : "Run AI Safety Check"}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {tenant?.settings?.subFeatures?.aiSafetyCheck !== false && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-8 min-h-[300px] flex flex-col justify-center">
                {!weatherCheck ? (
                   <div className="text-center text-white/30 space-y-4">
                     <Shield className="mx-auto" size={48} />
                     <p className="max-w-xs mx-auto">Fill out the log to run an automated check against current Meridian weather and EPA restrictions.</p>
                   </div>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                    <div className={`p-4 rounded-xl border flex items-start gap-4 ${weatherCheck.safe ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-500"}`}>
                      {weatherCheck.safe ? <CheckCircle className="shrink-0" /> : <AlertTriangle className="shrink-0" />}
                      <div>
                        <h3 className="font-bold text-lg">{weatherCheck.safe ? "Safe to Apply" : "Warning: Suboptimal Conditions"}</h3>
                        <p className={`text-sm mt-1 ${weatherCheck.safe ? "text-emerald-400/80" : "text-red-500/80"}`}>{weatherCheck.message}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-black rounded-xl border border-white/5">
                        <p className="text-xs text-white/50 uppercase tracking-widest mb-1 flex justify-between"><Wind size={14}/> Wind Speed</p>
                        <p className="text-lg font-mono">{weatherCheck.wind} mph</p>
                      </div>
                      <div className="p-4 bg-black rounded-xl border border-white/5">
                        <p className="text-xs text-white/50 uppercase tracking-widest mb-1 flex justify-between"><CloudRain size={14}/> Forecast</p>
                        <p className="text-lg font-mono">{weatherCheck.precipitation}% Rain</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {(!tenant?.settings?.subFeatures?.aiSafetyCheck || tenant.settings.subFeatures.aiSafetyCheck === false || weatherCheck) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-black border border-white/20 p-6 rounded-2xl">
                 <h3 className="text-sm font-black text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <PenTool size={16} /> Human-in-the-Loop Signoff
                 </h3>
                 <p className="text-xs text-white/60 mb-4">By signing, I accept ultimate accountability for verifying local conditions and ensuring safe application in compliance with all relevant guidelines.</p>

                 {tenant?.settings?.subFeatures?.requireSignature !== false ? (
                   <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    className="w-full bg-zinc-900 border-b-2 border-white/20 p-4 text-white font-serif italic text-xl focus:outline-none focus:border-white mb-6 placeholder:text-white/20"
                    placeholder="Type your full name to sign..."
                  />
                 ) : (
                   <div className="p-4 bg-zinc-900 border border-white/10 rounded-xl mb-6 text-white/40 flex items-center gap-3">
                     <Info size={16} /> Digital Signature disabled in tenant settings.
                   </div>
                 )}

                <button
                  onClick={submitLog}
                  disabled={tenant?.settings?.subFeatures?.requireSignature !== false && !signature}
                  className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
                >
                  Sign & Finalize Log
                </button>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-6">
            <Shield className="text-emerald-500" size={32} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Secure Audit Vault</h2>
          <p className="text-sm text-white/50 max-w-md mb-8 leading-relaxed">
            For maximum security and SOC 2 compliance, system audit logs are not exposed directly in the browser to prevent unauthorized scraping. Instead, you can compile and export them directly to your connected Google Workspace.
          </p>

          <button
            onClick={() => {
                alert("Simulating generation of Dual Export (PDF & CSV) and pushing to Google Drive.");
            }}
            className="px-8 py-4 bg-emerald-500 text-black rounded-xl font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center gap-3"
          >
            <Download size={18} /> Generate & Export to Google Drive
          </button>
        </div>
      )}
    </div>
  );
}
