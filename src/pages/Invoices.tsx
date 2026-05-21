
import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
  where,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
  logSystemEvent,
} from "../lib/firebase";
import {
  FileText,
  Plus,
  Search,
  DollarSign,
  Clock,
  CheckCircle2,
  MoreVertical,
  Send,
  Trash2,
  ShieldCheck,
  Download,
  Filter,
  Camera,
  Loader2,
  X,
  Receipt,
  Brain,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";
import { syncService } from "../services/syncService";

import { useLocation } from "react-router-dom";
import { Invoice } from "../types";

export default function Invoices() {
  const { tenant } = useTenant();
  const location = useLocation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<
    { id: string; amount: number; vendor: string; date: string }[]
  >([]);
  const [activeTab, setActiveTab] = useState("Invoices");
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, any> | null>(
    null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tenantId = tenant?.id || "genesis-1";
    const qInv = query(
      collection(db, "invoices"),
      where("tenantId", "==", tenantId),
    );
    const unsubscribeInv = onSnapshot(
      qInv,
      (snapshot) => {
        setInvoices(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "invoices");
      },
    );

    const qExp = query(
      collection(db, "expenses"),
      where("tenantId", "==", tenantId),
    );
    const unsubscribeExp = onSnapshot(
      qExp,
      (snapshot) => {
        setExpenses(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "expenses");
      },
    );

    return () => {
      unsubscribeInv();
      unsubscribeExp();
    };
  }, []);

  useEffect(() => {
    if (location.state?.client) {
      setAiAnalysis({
        clientName: location.state.client,
        items: [
          { description: "Pending Service Review", quantity: 1, rate: 0 },
        ],
        total: 0,
        summary: `Invoice started for ${location.state.client}.`,
      });
      setShowAIModal(true);
    }
  }, [location.state]);

  useEffect(() => {
    const handleVoiceAction = (e: CustomEvent) => {
      const { name, args } = e.detail;
      console.debug("Invoices Voice Action:", name, args);

      if (name === "create_invoice") {
        const mockAnalysis = {
          clientName: args.clientName || "Mrs. Gable",
          items: [
            {
              description: args.serviceDescription || "Landscaping Work",
              quantity: 1,
              rate: args.amount || 0,
            },
          ],
          total: args.amount || 0,
          summary: args.serviceDescription || "Auto-generated from live ear.",
        };
        setAiAnalysis(mockAnalysis);
        setShowAIModal(true);
      }
    };

    window.addEventListener("cutty-action", handleVoiceAction as EventListener);
    return () =>
      window.removeEventListener(
        "cutty-action",
        handleVoiceAction as EventListener,
      );
  }, []);

  const simulateAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null); // Clear previous to prevent ghost data
    try {
      const mockCall = `Hey Meridian, this is Mrs. Gable over on Poplar Springs. I need to get billed for that 2-hour hedge sculpting you guys did yesterday, and also that 30-minute flower bed touchup. Can you send that over today?`;

      const response = await fetch("/api/invoice/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: mockCall }),
      });

      if (!response.ok) {
        throw new Error(`Extraction logic returned status ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.clientName) {
        throw new Error("Could not find invoice info. Please try again.");
      }

      setAiAnalysis({ ...data, transcript: mockCall });
      setShowAIModal(true);
      await logSystemEvent("INVOICE_DRAFT_BRAIN_EXTRACTED", {
        client: data.clientName,
      });
    } catch (error) {
      console.error("AI Extraction Error:", error);
      // Enterprise Fallback: Show toast or alert in a non-blocking way
      setAiAnalysis({
        clientName: "Error Recovery",
        items: [],
        total: 0,
        summary: `Warning: ${error.message || "System error"}.`,
        isError: true,
      });
      setShowAIModal(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExpenseScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(",")[1];
        const res = await fetch("/api/expenses/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: base64String }),
        });
        const data = await res.json();
        const path = "expenses";
        const tenantId = tenant?.id || "genesis-1";

        if (navigator.onLine) {
          const docRef = await addDoc(collection(db, path), {
            ...data,
            status: "cleared",
            tenantId,
            createdAt: serverTimestamp(),
          });
          await logSystemEvent("EXPENSE_SCAN_COMPLETED", {
            expenseId: docRef.id,
            merchant: data.merchant,
            tenantId,
          });
        } else {
          await syncService.queueAction(
            "CREATE",
            "expenses",
            {
              ...data,
              status: "cleared",
              createdAt: new Date().toISOString(),
            },
            tenantId,
          );
          await logSystemEvent("EXPENSE_SCAN_OFFLINE", {
            merchant: data.merchant,
            tenantId,
          });
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "expenses");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500 text-xs font-black uppercase tracking-widest text-emerald-500">
            <FileText size={16} />
            Finance Ledger
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Capital Flow
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Professional Billing & Expense Tracking
          </p>
        </div>

        <div
          className="flex bg-black p-2 rounded-[32px] border-4 border-white/10 shrink-0 overflow-x-auto max-w-full shadow-inner"
          role="tablist"
        >
          {["Invoices", "Expenses"].map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-transform whitespace-nowrap border-4 ${
                activeTab === tab
                  ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105"
                  : "border-transparent text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "Invoices" ? (
        <div className="space-y-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <button
                onClick={simulateAIAnalysis}
                disabled={isAnalyzing}
                className="flex items-center gap-3 px-8 py-4 bg-emerald-500 text-black rounded-[24px] micro-label font-black shadow-[0_20px_40px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 group"
              >
                {isAnalyzing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Brain size={18} className="shadow-glow" />
                )}
                Draft with AI
              </button>
            </div>
            <button
              onClick={() => {
                setAiAnalysis({
                  clientName: "New Client",
                  items: [{ description: "New Service", quantity: 1, rate: 0 }],
                  total: 0,
                  summary: "Manual proposal creation",
                });
                setShowAIModal(true);
              }}
              className="flex items-center gap-4 px-10 py-5 bg-white text-black rounded-[28px] font-black text-xs uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={20} />
              Generate Proposal
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 min-h-[600px]">
            {invoices.map((inv) => (
              <motion.div
                layout
                key={inv.id}
                className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-8 flex items-center justify-between group hover:border-blue-500/50 transition-all duration-700"
              >
                <div className="flex items-center gap-8">
                  <div
                    className={`w-16 h-16 rounded-[24px] flex items-center justify-center border transition-all duration-700 group-hover:scale-110 ${
                      inv.status === "paid"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-2xl"
                        : "bg-white/5 border-white/10 text-white/30"
                    }`}
                  >
                    {inv.status === "paid" ? (
                      <CheckCircle2 size={28} />
                    ) : (
                      <FileText size={28} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-white text-2xl italic tracking-tight uppercase group-hover:text-emerald-400 transition-colors leading-none mb-2">
                      {inv.client}
                    </h4>
                    <p className="micro-label text-white/20 font-black uppercase tracking-[0.3em]">
                      {inv.date || "Today"} • INV-{inv.id.slice(0, 6)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-16 pr-6">
                  <div className="text-right">
                    <p className="text-4xl font-black text-white italic tracking-tighter leading-none mb-2">
                      ${inv.amount?.toLocaleString()}
                    </p>
                    <span
                      className={`px-3 py-1 bg-white/5 border rounded-lg micro-label font-black uppercase tracking-widest ${
                        inv.status === "paid"
                          ? "border-emerald-500/30 text-emerald-400"
                          : "border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                    <button
                      onClick={async () => {
                        const tenantId = tenant?.id || "genesis-1";
                        try {
                          if (navigator.onLine) {
                            await updateDoc(doc(db, "invoices", inv.id), {
                              status: "sent",
                              updatedAt: serverTimestamp(),
                              tenantId,
                            });
                          } else {
                            await syncService.queueAction(
                              "UPDATE",
                              "invoices",
                              { status: "sent" },
                              tenantId,
                              inv.id,
                            );
                          }
                          await logSystemEvent("INVOICE_SENT", {
                            invoiceId: inv.id,
                            client: inv.client,
                            tenantId,
                          });
                        } catch (err) {
                          handleFirestoreError(
                            err,
                            OperationType.UPDATE,
                            `invoices/${inv.id}`,
                          );
                        }
                      }}
                      className="p-4 bg-white text-black rounded-[20px] shadow-2xl hover:scale-110 active:scale-95 transition-all"
                      aria-label={`Send invoice to ${inv.client}`}
                    >
                      <Send size={18} aria-hidden="true" />
                    </button>
                    <button
                      onClick={async () => {
                        const tenantId = tenant?.id || "genesis-1";
                        try {
                          if (navigator.onLine) {
                            await deleteDoc(doc(db, "invoices", inv.id));
                          } else {
                            console.warn("Deletions require active sync.");
                            return;
                          }
                          await logSystemEvent("INVOICE_DELETED", {
                            invoiceId: inv.id,
                            client: inv.client,
                            tenantId,
                          });
                        } catch (err) {
                          handleFirestoreError(
                            err,
                            OperationType.DELETE,
                            `invoices/${inv.id}`,
                          );
                        }
                      }}
                      className="p-4 bg-white/5 text-white/20 rounded-[20px] hover:text-red-400 hover:bg-red-500/10 transition-all border-4 border-white/10"
                      aria-label={`Delete invoice for ${inv.client}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <div className="flex justify-end">
            <button
              onClick={() => setIsScanning(true)}
              className="flex items-center gap-4 bg-white text-black px-10 py-5 rounded-[28px] font-black text-xs uppercase tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
            >
              <Camera size={20} />
              Scan Receipt
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="bg-zinc-900 border-4 border-white/10 shadow-2xl rounded-[32px] overflow-hidden group hover:border-blue-500/50 transition-all duration-700"
              >
                <div className="p-10">
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center text-white border-4 border-white/10 group-hover:scale-110 transition-all duration-700">
                      <Receipt size={32} />
                    </div>
                    <button
                      onClick={async () => {
                        const tenantId = tenant?.id || "genesis-1";
                        try {
                          if (navigator.onLine) {
                            await deleteDoc(doc(db, "expenses", exp.id));
                          } else {
                            console.warn("Deletions require active sync.");
                            return;
                          }
                          await logSystemEvent("EXPENSE_DELETED", {
                            expenseId: exp.id,
                            merchant: exp.merchant,
                            tenantId,
                          });
                        } catch (err) {
                          handleFirestoreError(
                            err,
                            OperationType.DELETE,
                            `expenses/${exp.id}`,
                          );
                        }
                      }}
                      className="text-white/10 hover:text-red-400 transition-colors"
                      aria-label={`Delete expense from ${exp.merchant}`}
                    >
                      <Trash2 size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2 italic tracking-tight uppercase group-hover:text-emerald-400 transition-colors leading-none">
                    {exp.merchant}
                  </h3>
                  <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em] mb-10 italic">
                    {exp.category} • {exp.date}
                  </p>
                  <div className="flex items-end justify-between border-t border-white/10 pt-8">
                    <div>
                      <p className="micro-label font-black text-white/10 uppercase tracking-widest mb-2 italic">
                        Capital Outflow
                      </p>
                      <p className="text-4xl font-black text-white italic tracking-tighter leading-none">
                        ${exp.amount}
                      </p>
                    </div>
                    <span className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full micro-label font-black uppercase tracking-widest shadow-glow">
                      Cleared
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="border-4 border-white/10 shadow-2xl bg-black rounded-[40px] w-full max-w-lg p-12 relative overflow-hidden"
            >
              <div className="text-center space-y-12">
                <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mx-auto text-black shadow-2xl relative">
                  <Receipt size={48} aria-hidden="true" />
                  <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full -z-10 animate-pulse" />
                </div>
                <div>
                  <h2
                    id="scanner-title"
                    className="text-4xl font-black text-white italic tracking-tighter lowercase leading-none mb-4"
                  >
                    Scan Receipt.
                  </h2>
                  <p className="text-white/40 font-bold text-lg italic">
                    Scanning... Capture clear receipts.
                  </p>
                </div>
                <div
                  id="receipt-upload-zone"
                  className="aspect-video bg-zinc-900 rounded-[40px] border-2 border-dashed flex flex-col items-center justify-center relative hover:bg-zinc-900 hover:border-white/20 transition-all cursor-pointer group overflow-hidden"
                >
                  {isProcessing ? (
                    <div
                      className="flex flex-col items-center gap-6"
                      role="status"
                    >
                      <Loader2
                        size={48}
                        className="animate-spin text-white shadow-glow"
                        aria-label="Processing image"
                      />
                      <p className="micro-label font-black text-white uppercase tracking-[0.3em]">
                        Extracting Entities...
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Camera
                        size={48}
                        className="text-white/10 mb-6 group-hover:scale-110 group-hover:text-white transition-all duration-700 relative z-10"
                        aria-hidden="true"
                      />
                      <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em] group-hover:text-white/40 transition-colors relative z-10">
                        Select Asset Metadata
                      </p>
                      <label htmlFor="receipt-input" className="sr-only">
                        Upload receipt image
                      </label>
                      <input
                        id="receipt-input"
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleExpenseScan}
                        className="absolute inset-0 opacity-0 cursor-pointer z-20"
                        aria-describedby="scanner-title"
                      />
                    </>
                  )}
                </div>

                <button
                  onClick={() => setIsScanning(false)}
                  className="w-full py-6 bg-white/5 border-4 border-white/10 text-white/60 hover:text-white rounded-[32px] font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Cancel / Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Extraction Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="border-4 border-white/10 shadow-2xl bg-black rounded-[40px] w-full max-w-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 blur-sm" />
              <div className="p-14">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center text-black shadow-2xl relative">
                      <Brain size={32} aria-hidden="true" />
                      <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full -z-10 animate-pulse" />
                    </div>
                    <div>
                      <h2
                        id="ai-modal-title"
                        className="text-3xl font-black text-white italic tracking-tighter leading-none mb-1"
                      >
                        Draft Proposal.
                      </h2>
                      <p className="micro-label font-black uppercase text-emerald-400 tracking-[0.3em] italic">
                        Created from voice
                      </p>
                    </div>
                  </div>
                  {/* X Button removed */}
                </div>
                <div
                  className="bg-zinc-900 rounded-[32px] p-10 border-4 border-white/10 mb-10 space-y-8 shadow-inner"
                  aria-labelledby="ai-modal-title"
                >
                  {aiAnalysis?.isError ? (
                    <div className="py-10 text-center space-y-4">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                        <Brain size={32} />
                      </div>
                      <p className="text-white/60 font-bold italic">
                        {aiAnalysis.summary}
                      </p>
                      <button
                        onClick={simulateAIAnalysis}
                        className="px-6 py-2 bg-white/5 border-4 border-white/10 rounded-xl text-[10px] font-black uppercase text-white hover:bg-white/10"
                      >
                        RETRY
                      </button>
                    </div>
                  ) : (
                    <>
                      {aiAnalysis?.transcript && (
                        <div className="pb-8 border-b border-white/10">
                          <span className="micro-label font-black text-white/20 uppercase tracking-widest italic block mb-4">
                            Voice Transcript
                          </span>
                          <div className="bg-white/5 p-6 rounded-3xl border-4 border-white/10 italic text-xs text-white/60 leading-relaxed font-medium">
                            "{aiAnalysis.transcript}"
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-center pb-6 border-b border-white/10">
                        <span className="micro-label font-black text-white/20 uppercase tracking-widest italic">
                          Stakeholder
                        </span>
                        <span className="text-xl font-black text-white italic truncate">
                          {aiAnalysis?.clientName}
                        </span>
                      </div>
                      {aiAnalysis?.summary && (
                        <div className="pb-6 border-b border-white/10">
                          <span className="micro-label font-black text-white/20 uppercase tracking-widest italic block mb-2">
                            Executive Summary
                          </span>
                          <p className="text-sm text-white/60 font-medium italic">
                            "{aiAnalysis.summary}"
                          </p>
                        </div>
                      )}
                      <div className="space-y-4">
                        {aiAnalysis?.items?.map(
                          (
                            item: {
                              description: string;
                              quantity: number;
                              rate: number;
                            },
                            idx: number,
                          ) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center group"
                            >
                              <span className="font-bold text-white/40 italic group-hover:text-white transition-colors capitalize">
                                {item.description}
                              </span>
                              <span className="font-black text-white italic text-lg tracking-tight">
                                ${(item.quantity * item.rate).toFixed(2)}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                      <div className="pt-8 border-t-2 border-white flex justify-between items-center">
                        <span className="micro-label font-black text-white/40 uppercase tracking-widest italic">
                          Total Amount
                        </span>
                        <span className="text-5xl font-black text-white italic tracking-tighter leading-none">
                          ${(aiAnalysis?.total || 0).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-6">
                  <button
                    onClick={() => setShowAIModal(false)}
                    className="flex-1 py-8 bg-white/10 hover:bg-white/20 border-4 border-white/10 text-white hover:text-white rounded-[28px] font-black text-xs sm:text-sm uppercase tracking-widest transition-all"
                  >
                    Cancel / Discard Draft
                  </button>
                  <button
                    onClick={async () => {
                      const path = "invoices";
                      const tenantId = tenant?.id || "genesis-1";
                      try {
                        if (navigator.onLine) {
                          const docRef = await addDoc(collection(db, path), {
                            client: aiAnalysis.clientName,
                            amount: aiAnalysis.total,
                            status: "sent",
                            tenantId,
                            createdAt: serverTimestamp(),
                          });
                          await logSystemEvent("INVOICE_CREATED_FROM_AI", {
                            invoiceId: docRef.id,
                            client: aiAnalysis.clientName,
                            tenantId,
                          });
                        } else {
                          await syncService.queueAction(
                            "CREATE",
                            "invoices",
                            {
                              client: aiAnalysis.clientName,
                              amount: aiAnalysis.total,
                              status: "sent",
                              createdAt: new Date().toISOString(),
                            },
                            tenantId,
                          );
                          await logSystemEvent(
                            "INVOICE_CREATED_FROM_AI_OFFLINE",
                            { client: aiAnalysis.clientName, tenantId },
                          );
                        }
                        setShowAIModal(false);
                      } catch (err) {
                        handleFirestoreError(err, OperationType.CREATE, path);
                      }
                    }}
                    className="flex-[2] py-6 bg-white text-black rounded-[28px] font-black text-xs uppercase tracking-[0.4em] shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-95 transition-all text-center"
                  >
                    Send Invoice
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
