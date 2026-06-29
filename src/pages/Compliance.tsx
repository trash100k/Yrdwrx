// @ts-nocheck
import { fetchApi } from "../lib/api";
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Shield, CloudRain, Wind, AlertTriangle, CheckCircle, PenTool, Droplets, Info, List, FlaskConical, Plus, Bug, MapPin } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { useTenant } from "../contexts/TenantContext";
import { supabase, getCurrentUser } from "../lib/supabase";
import { useRole } from "../hooks/useRole";
import { useAuditLog } from "../hooks/useAuditLog";
import AuditTrail from "../components/AuditTrail";
import { complianceLogsRepo, customersRepo } from "../lib/repos";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

export default function Compliance() {
  const { showToast } = useToast();
  const { tenant } = useTenant();
  const { role } = useRole();
  const { logAction } = useAuditLog();
  const [activeTab, setActiveTab] = useState<"epa" | "chemical" | "audit">("epa");

  // EPA Form State
  const [chemical, setChemical] = useState("");
  const [amount, setAmount] = useState("");
  const [jobId, setJobId] = useState("");
  const [weatherCheck, setWeatherCheck] = useState<any>(null);
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  // Chemical / Pesticide Application Log State
  const [chemLogs, setChemLogs] = useState<any[]>([]);
  const [chemLoading, setChemLoading] = useState(true);
  const [chemCustomers, setChemCustomers] = useState<any[]>([]);
  const [chemSubmitting, setChemSubmitting] = useState(false);
  const [chemForm, setChemForm] = useState({
    productName: "",
    epaRegNumber: "",
    applicator: "",
    applicationDate: new Date().toISOString().slice(0, 10),
    target: "",
    rate: "",
    area: "",
    weather: "",
    notes: "",
    customerId: "",
  });

  // Realtime subscription to the chemical application ledger.
  useEffect(() => {
    if (!tenant) return;
    setChemLoading(true);
    const unsub = complianceLogsRepo.subscribe((rows) => {
      setChemLogs(rows || []);
      setChemLoading(false);
    });
    return () => unsub();
  }, [tenant]);

  // Customer dropdown (optional link for each application record).
  useEffect(() => {
    if (!tenant) return;
    customersRepo
      .list()
      .then((rows) => setChemCustomers(rows || []))
      .catch(() => setChemCustomers([]));
  }, [tenant]);

  const customerLabel = (c: any) => {
    const name = [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim();
    return c?.companyName || name || c?.email || "Unnamed customer";
  };

  const customerNameById = (id: string) => {
    if (!id) return null;
    const c = chemCustomers.find((x) => x.id === id);
    return c ? customerLabel(c) : null;
  };

  const updateChemField = (key: string, value: string) =>
    setChemForm((prev) => ({ ...prev, [key]: value }));

  const submitChemLog = async () => {
    if (!tenant) {
      showToast("No active workspace — cannot save the log.", "error");
      return;
    }
    if (!chemForm.productName.trim() || !chemForm.applicator.trim() || !chemForm.applicationDate) {
      showToast("Product name, applicator, and application date are required.", "error");
      return;
    }
    setChemSubmitting(true);
    try {
      // Repo snake-izes top-level keys: productName -> product_name, epaRegNumber ->
      // epa_reg_number, applicationDate -> application_date, customerId -> customer_id.
      await complianceLogsRepo.create({
        productName: chemForm.productName.trim(),
        epaRegNumber: chemForm.epaRegNumber.trim(),
        applicator: chemForm.applicator.trim(),
        applicationDate: chemForm.applicationDate,
        target: chemForm.target.trim(),
        rate: chemForm.rate.trim(),
        area: chemForm.area.trim(),
        weather: chemForm.weather.trim(),
        notes: chemForm.notes.trim(),
        customerId: chemForm.customerId || null,
      });
      showToast("Chemical application logged.", "success");
      setChemForm({
        productName: "",
        epaRegNumber: "",
        applicator: "",
        applicationDate: new Date().toISOString().slice(0, 10),
        target: "",
        rate: "",
        area: "",
        weather: "",
        notes: "",
        customerId: "",
      });
    } catch (e) {
      console.error("Chemical log save failed:", e);
      showToast("Couldn't save the application log. Check your connection and retry.", "error");
    } finally {
      setChemSubmitting(false);
    }
  };

  // Adapt Supabase audit_logs rows to the shape AuditTrail renders.
  // ts -> timestamp, event -> module, action -> actionType, target -> details,
  // actor -> userEmail. `role` lives in the meta jsonb column.
  const adaptLog = (row: any) => ({
    id: row.id,
    timestamp: row.ts || row.created_at || null,
    module: row.event,
    actionType: row.action,
    details: row.target,
    userEmail: row.actor,
    role: row.meta?.role ?? row.role ?? null,
  });

  const fetchLogs = async () => {
    if (!tenant) return;
    setAuditLoading(true);
    try {
      // RLS scopes the query to the caller's tenant automatically.
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("ts", { ascending: false })
        .limit(200);
      if (error) throw error;
      setAuditLogs((data || []).map(adaptLog));
    } catch (error) {
      console.warn("Audit logs fetch issue:", error);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
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
      const { error } = await supabase.from("audit_logs").insert({
        tenant_id: tenant.id,
        user_id: getCurrentUser()?.uid || "unknown",
        actor: getCurrentUser()?.email,
        event: "Compliance",
        action: "EPA Application Logged",
        target: `Applied ${amount} of ${chemical} on job ${jobId}.`,
        meta: {
          chemical,
          amount,
          jobId,
          signedBy: signature,
          weatherSafe: weatherCheck?.safe ?? null,
        },
      });
      if (error) throw error;
      showToast("Application logged to the EPA compliance ledger.", "success");
      setChemical("");
      setAmount("");
      setJobId("");
      setSignature("");
      setWeatherCheck(null);
      // Re-fetch so the new entry shows in the Audit tab.
      fetchLogs();
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
              onClick={() => setActiveTab("chemical")}
              className={`py-2 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === "chemical" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
              }`}
            >
              Chemical Log
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

      {activeTab === "chemical" && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-4 sm:gap-8 items-start">

          {/* ADD APPLICATION FORM */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-8">
            <h2 className="text-xl font-bold flex items-center gap-3 mb-2">
              <FlaskConical className="text-celtic-400" /> Add Application
            </h2>
            <p className="text-xs text-white/50 mb-6 leading-relaxed">
              Record each pesticide / herbicide / fertilizer application for your state &amp; EPA recordkeeping requirements.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Product Name *</label>
                <input
                  type="text"
                  value={chemForm.productName}
                  onChange={(e) => updateChemField("productName", e.target.value)}
                  className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                  placeholder="e.g. Roundup PRO Concentrate"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-widest font-bold">EPA Reg #</label>
                  <input
                    type="text"
                    value={chemForm.epaRegNumber}
                    onChange={(e) => updateChemField("epaRegNumber", e.target.value)}
                    className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                    placeholder="524-579"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Application Date *</label>
                  <input
                    type="date"
                    value={chemForm.applicationDate}
                    onChange={(e) => updateChemField("applicationDate", e.target.value)}
                    className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Applicator *</label>
                <input
                  type="text"
                  value={chemForm.applicator}
                  onChange={(e) => updateChemField("applicator", e.target.value)}
                  className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                  placeholder="Certified applicator name / license #"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Target (Pest / Weed)</label>
                  <input
                    type="text"
                    value={chemForm.target}
                    onChange={(e) => updateChemField("target", e.target.value)}
                    className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                    placeholder="Crabgrass, grubs..."
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Rate</label>
                  <input
                    type="text"
                    value={chemForm.rate}
                    onChange={(e) => updateChemField("rate", e.target.value)}
                    className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                    placeholder="2 oz / 1000 sqft"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Area Treated</label>
                  <input
                    type="text"
                    value={chemForm.area}
                    onChange={(e) => updateChemField("area", e.target.value)}
                    className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                    placeholder="Front lawn / 5,000 sqft"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Weather</label>
                  <input
                    type="text"
                    value={chemForm.weather}
                    onChange={(e) => updateChemField("weather", e.target.value)}
                    className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                    placeholder="72°F, wind 4mph NW"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Customer (optional)</label>
                <select
                  value={chemForm.customerId}
                  onChange={(e) => updateChemField("customerId", e.target.value)}
                  className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500"
                >
                  <option value="">— No customer linked —</option>
                  {chemCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {customerLabel(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Notes</label>
                <textarea
                  value={chemForm.notes}
                  onChange={(e) => updateChemField("notes", e.target.value)}
                  rows={3}
                  className="w-full mt-1 bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500 resize-none"
                  placeholder="Re-entry interval, PPE used, observations..."
                />
              </div>

              <button
                onClick={submitChemLog}
                disabled={chemSubmitting}
                className="w-full mt-2 py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus size={16} /> {chemSubmitting ? "Saving..." : "Log Application"}
              </button>
            </div>
          </div>

          {/* APPLICATION LEDGER */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-8">
            <h2 className="text-xl font-bold flex items-center gap-3 mb-6">
              <List className="text-celtic-400" /> Application Ledger
              {!chemLoading && chemLogs.length > 0 && (
                <span className="text-xs font-mono text-white/40 bg-black border border-white/10 rounded-full px-2 py-1">
                  {chemLogs.length}
                </span>
              )}
            </h2>

            {chemLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : chemLogs.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="No applications logged"
                description="Record your first pesticide, herbicide, or fertilizer application to start your regulatory paper trail."
              />
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-xs text-white/40 uppercase tracking-widest border-b border-white/10">
                      <th className="py-3 px-2 font-bold">Date</th>
                      <th className="py-3 px-2 font-bold">Product</th>
                      <th className="py-3 px-2 font-bold">EPA #</th>
                      <th className="py-3 px-2 font-bold">Applicator</th>
                      <th className="py-3 px-2 font-bold">Target</th>
                      <th className="py-3 px-2 font-bold">Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chemLogs.map((log) => {
                      const linked = customerNameById(log.customerId);
                      return (
                        <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors align-top">
                          <td className="py-3 px-2 font-mono text-white/70 whitespace-nowrap">
                            {log.applicationDate || "—"}
                          </td>
                          <td className="py-3 px-2">
                            <div className="font-bold text-white">{log.productName || "—"}</div>
                            {linked && (
                              <div className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                                <MapPin size={11} /> {linked}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2 font-mono text-white/60 whitespace-nowrap">{log.epaRegNumber || "—"}</td>
                          <td className="py-3 px-2 text-white/70">{log.applicator || "—"}</td>
                          <td className="py-3 px-2 text-white/70">
                            {log.target ? (
                              <span className="inline-flex items-center gap-1">
                                <Bug size={12} className="text-celtic-400/70" /> {log.target}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3 px-2 text-white/60">{log.area || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="h-[600px] lg:h-[800px]">
          <AuditTrail logs={auditLogs} loading={auditLoading} />
        </div>
      )}
    </div>
  );
}
