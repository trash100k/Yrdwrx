// @ts-nocheck
import { fetchApi } from "../lib/api";
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Shield, CloudRain, Wind, AlertTriangle, CheckCircle, PenTool, Droplets, Info, List } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { useTenant } from "../contexts/TenantContext";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getCurrentUser } from "../lib/supabase";
import { useRole } from "../hooks/useRole";
import { useAuditLog } from "../hooks/useAuditLog";
import AuditTrail from "../components/AuditTrail";

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
      // Ignore missing index error or permissions for now
      console.warn("Audit logs fetch issue:", error);
    });
    return unsub;
  }, [tenant]);

  // Mock checking weather
  const checkSafety = async () => {
    if (!chemical || !amount || !jobId) {
      showToast("Please fill out job, chemical, and amount first.", "error");
      return;
    }
    setLoading(true);
    setWeatherCheck(null);
    try {
      // Simulate calling the AI for a safety/weather check
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

  const submitLog = async () => {
    const isSignatureRequired = tenant?.settings?.subFeatures?.requireSignature !== false;

    if (!chemical || !amount || !jobId) {
      showToast("Fill out job, chemical, and amount before logging.", "error");
      return;
    }
    if (isSignatureRequired && !signature) {
      showToast("A digital signature is required for EPA logging.", "error");
      return;
    }
    if (isSignatureRequired && weatherCheck?.safe === false && signature.length < 5) {
      showToast("Please provide a full signature to override the AI warning.", "error");
      return;
    }
    if (!tenant) {
      showToast("No active workspace — cannot save the log.", "error");
      return;
    }
    setLoading(true);
    try {
      // Persist a structured EPA application record to the audit ledger (the Audit tab reads it).
      await addDoc(collection(db, "audit_logs"), {
        tenantId: tenant.id,
        userId: getCurrentUser()?.uid || "unknown",
        userEmail: getCurrentUser()?.email || "unknown",
        role,
        module: "Compliance",
        actionType: "EPA Application Logged",
        details: `Applied ${amount} of ${chemical} on job ${jobId}.`,
        epa: {
          chemical,
          amount,
          jobId,
          weatherSafe: weatherCheck?.safe ?? null,
          overrodeWarning: weatherCheck?.safe === false,
        },
        signedBy: signature || null,
        timestamp: serverTimestamp(),
      });
      showToast("Application logged to the EPA compliance ledger.", "success");
      setChemical("");
      setAmount("");
      setJobId("");
      setSignature("");
      setWeatherCheck(null);
    } catch (e) {
      console.error("EPA log save failed:", e);
      showToast("Couldn't save the EPA log. Check your connection and retry.", "error");
    } finally {
      setLoading(false);
    }
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

        {/* LOG FORM */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-8">
          <h2 className="text-xl font-bold flex items-center gap-3 mb-6">
            <Droplets className="text-celtic-400" /> New Application Log
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Job ID / Client</label>
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                placeholder="Enter Job ID"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Chemical / EPA Reg #</label>
              <input
                type="text"
                value={chemical}
                onChange={(e) => setChemical(e.target.value)}
                className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                placeholder="Enter Chemical Name"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Volume / Mix Rate</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                placeholder="Enter Dosage"
              />
            </div>

            <button
              onClick={checkSafety}
              disabled={loading || !chemical || !amount || !jobId}
              className={`w-full mt-4 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
                tenant?.settings?.subFeatures?.aiSafetyCheck === false 
                  ? "bg-white/5 text-white/20 cursor-not-allowed hidden"
                  : "bg-celtic-500/20 text-celtic-400 hover:bg-celtic-500/30 disabled:opacity-50"
              }`}
            >
              {loading ? "Checking Weather & Rules..." : "Run AI Safety Check"}
            </button>
          </div>
        </div>

        {/* AI SAFETY CHECK RESULTS */}
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
                  <div className={`p-4 rounded-xl border flex items-start gap-4 ${weatherCheck.safe ? "bg-forest-500/10 border-forest-500/20 text-forest-400" : "bg-red-500/10 border-red-500/20 text-red-500"}`}>
                    {weatherCheck.safe ? <CheckCircle className="shrink-0" /> : <AlertTriangle className="shrink-0" />}
                    <div>
                      <h3 className="font-bold text-lg">{weatherCheck.safe ? "Safe to Apply" : "Warning: Suboptimal Conditions"}</h3>
                      <p className={`text-sm mt-1 ${weatherCheck.safe ? "text-forest-400/80" : "text-red-500/80"}`}>{weatherCheck.message}</p>
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

          {/* HUMAN IN THE LOOP SIGNATURE */}
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
        <div className="h-[600px] lg:h-[800px]">
          <AuditTrail />
        </div>
      )}
    </div>
  );
}
