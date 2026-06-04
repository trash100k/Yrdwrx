import { fetchApi } from "../lib/api";
// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from "react";
import { collection, onSnapshot, query, doc, serverTimestamp, deleteDoc, where,  } from "firebase/firestore";
import { safeAddDoc as addDoc, safeUpdateDoc as updateDoc } from "../lib/firebase";;
import {
  db,
  handleFirestoreError,
  OperationType,
  logSystemEvent,
  auth
} from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
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
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";
import { syncService } from "../services/syncService";
import { useFocusTrap } from "../hooks/useFocusTrap";

import { useLocation } from "react-router-dom";
import { Invoice } from "../types";
import { ServicePricingCatalog } from "../components/ServicePricingCatalog";

export default function Invoices() {
  const { tenant } = useTenant();
  const location = useLocation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<
    { id: string; amount: number; vendor?: string; merchant?: string; category?: string; date: string; notes?: string; status?: string; isArchived?: boolean; }[]
  >([]);
  const [activeTab, setActiveTab] = useState("Invoices");
  const [quarterFilter, setQuarterFilter] = useState("All");
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [scheduleDate, setScheduleDate] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, any> | null>(
    null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const scannerModalRef = useFocusTrap<HTMLDivElement>(isScanning);
  const aiModalRef = useFocusTrap<HTMLDivElement>(showAIModal);

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
      } else if (name === "log_expense") {
        setActiveTab("Expenses");
        if (args && args.amount) {
          const tenantId = tenant?.id || "genesis-1";
          const newDoc = {
            amount: args.amount,
            merchant: args.vendor || "Field Expense",
            category: "Other",
            notes: args.description || "Added via voice",
            date: new Date().toISOString(),
            status: "cleared",
            tenantId,
            createdAt: new Date().toISOString()
          };
          if (navigator.onLine) {
            import("firebase/firestore").then(({ addDoc, collection, serverTimestamp }) => {
              import("../lib/firebase").then(({ db }) => {
                addDoc(collection(db, "expenses"), {
                  ...newDoc,
                  createdAt: serverTimestamp()
                });
              });
            });
          }
        } else {
          setIsScanning(true);
        }
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
    const userInput = window.prompt("Enter call transcript or job description to generate an invoice:");
    if (!userInput) return;

    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const response = await fetchApi("/api/invoice/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: userInput })
      });
      const data = await response.json();

      setAiAnalysis({ ...data, transcript: userInput, summary: data.summary || "Auto-generated from voice transcript." });
      setShowAIModal(true);
      await logSystemEvent("INVOICE_DRAFT_BRAIN_EXTRACTED", {
        client: data.clientName,
      });
    } catch (error: any) {
      console.error("AI Extraction Error:", error);
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
        let data;
        if (navigator.onLine) {
           const base64Data = (reader.result as string).split(',')[1];
           const res = await fetchApi("/api/expenses/ocr", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ imageData: base64Data })
           });
           data = await res.json();
        } else {
           // Fallback if offline
           await new Promise(resolve => setTimeout(resolve, 2000));
           data = {
             merchant: "Home Depot (Offline)",
             amount: 145.20,
             category: "Supplies",
             date: new Date().toLocaleDateString(),
           };
        }
        
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

  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

  const handleGeneratePdf = async (inv: any) => {
    try {
      setGeneratingPdfId(inv.id);
      
      // Mock network delay for PDF generation
      await new Promise(resolve => setTimeout(resolve, 2500));

      await updateDoc(doc(db, "invoices", inv.id), {
        status: "sent",
        updatedAt: serverTimestamp(),
      });
      
    } catch (err: any) {
      console.error(err);
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => !inv.isArchived);
    if (quarterFilter === "All") return result;
    return result.filter(inv => {
      if (!inv.date) return false;
      const d = new Date(inv.date);
      if (isNaN(d.getTime())) return false;
      const month = d.getMonth() + 1;
      if (quarterFilter === "Q1" && month >= 1 && month <= 3) return true;
      if (quarterFilter === "Q2" && month >= 4 && month <= 6) return true;
      if (quarterFilter === "Q3" && month >= 7 && month <= 9) return true;
      if (quarterFilter === "Q4" && month >= 10 && month <= 12) return true;
      return false;
    });
  }, [invoices, quarterFilter]);

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!aiAnalysis) return;
    const newItems = [...aiAnalysis.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    const newTotal = newItems.reduce((acc: number, curr: any) => acc + (curr.rate * curr.quantity), 0);
    setAiAnalysis({ ...aiAnalysis, items: newItems, total: newTotal });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {tenant?.settings?.features?.cockpit_buttons && (
        <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => {
                setAiAnalysis({
                  clientName: "New Client",
                  items: [{ description: "New Service", quantity: 1, rate: 0 }],
                  total: 0,
                  summary: "Manual proposal creation",
                });
                setShowAIModal(true);
              }} className="flex flex-col items-center justify-center gap-2 p-6 bg-amber-500/10 border border-amber-500/20 rounded-[20px] text-amber-400 hover:bg-amber-500/20 transition-all shadow-sm">
            <Plus size={24} className="hover:scale-110 transition-transform" />
            <span className="font-bold text-sm">Quick Add</span>
          </button>
          <div className="flex flex-col items-center justify-center gap-2 p-6 bg-zinc-900 border border-white/5 rounded-[20px] text-zinc-400 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
             <Zap size={24} className="text-yellow-400 animate-pulse" />
             <span className="font-bold text-sm text-yellow-400/80">Easy Mode Active</span>
          </div>
        </div>
      )}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 pb-8 border-b border-white/5 relative z-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20 text-xs font-medium tracking-wide text-emerald-400">
            <FileText size={14} />
            Finance Ledger
          </div>
          <h1 className="text-3xl sm:text-4xl font-sans font-bold tracking-tight text-white mt-2">
            Invoices & Expenses
          </h1>
          <p className="text-zinc-400 font-medium text-sm">
            Professional Billing & Expense Tracking
          </p>
        </div>

        <div
          className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0"
          role="tablist"
        >
          {["Invoices", "Expenses", "Service Rates"].map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "bg-white text-black shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "Invoices" && (
        <div className="space-y-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={simulateAIAnalysis}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Brain size={16} />
                )}
                Draft with AI
              </button>
              
              <select
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value)}
                className="bg-zinc-900 border border-white/10 text-white px-4 py-2.5 rounded-lg text-sm font-medium outline-none hover:border-white/20 transition-colors"
              >
                <option value="All">All Quarters</option>
                <option value="Q1">Q1 (Jan-Mar)</option>
                <option value="Q2">Q2 (Apr-Jun)</option>
                <option value="Q3">Q3 (Jul-Sep)</option>
                <option value="Q4">Q4 (Oct-Dec)</option>
              </select>
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
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              <Plus size={16} />
              Generate Invoice
            </button>
          </div>

          <div className="flex flex-col gap-3 min-h-[600px]">
            {filteredInvoices.map((inv) => (
              <motion.div
                layout
                key={inv.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5 flex items-center justify-between group hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                      inv.status === "PAID" || inv.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-white/5 text-white/40"
                    }`}
                  >
                    {inv.status === "PAID" || inv.status === "paid" ? (
                      <CheckCircle2 size={24} />
                    ) : (
                      <FileText size={24} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg group-hover:text-emerald-400 transition-colors">
                      {inv.client}
                    </h4>
                    <p className="text-zinc-500 text-sm">
                      {inv.date || "Today"} • INV-{inv.id.slice(0, 6)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8 pl-4">
                  <div className="text-right">
                    <p className="text-xl sm:text-2xl font-bold text-white leading-none">
                      ${inv.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span
                      className={`text-xs mt-1 font-medium px-2.5 py-0.5 rounded-full inline-block ${
                        inv.status === "PAID" || inv.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleGeneratePdf(inv)}
                      disabled={generatingPdfId === inv.id}
                      className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-all disabled:opacity-50"
                      aria-label={`Generate PDF draft for ${inv.client}`}
                      title="Generate PDF & Draft Email"
                    >
                      {generatingPdfId === inv.id ? (
                        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Download size={18} aria-hidden="true" />
                      )}
                    </button>
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
                      className="p-2.5 text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-all"
                      aria-label={`Send invoice to ${inv.client}`}
                    >
                      <Send size={18} aria-hidden="true" />
                    </button>
                    <button
                      onClick={async () => {
                        const tenantId = tenant?.id || "genesis-1";
                        try {
                          if (navigator.onLine) {
                            await updateDoc(doc(db, "invoices", inv.id), { isArchived: true, deletedAt: serverTimestamp() });
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
                      className="p-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
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
      )}
      
      {activeTab === "Expenses" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => setIsScanning(true)}
              className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-white/90 transition-all shadow-sm"
            >
              <Camera size={16} />
              Scan Receipt
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {expenses.filter(exp => !exp.isArchived).map((exp) => (
              <div
                key={exp.id}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden group hover:bg-white/10 transition-all duration-300"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center text-white/50 group-hover:text-white transition-colors">
                      <Receipt size={24} />
                    </div>
                    <button
                      onClick={async () => {
                        const tenantId = tenant?.id || "genesis-1";
                        try {
                          if (navigator.onLine) {
                            await updateDoc(doc(db, "expenses", exp.id), { isArchived: true, deletedAt: serverTimestamp() });
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
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                      aria-label={`Delete expense from ${exp.merchant}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                    {exp.merchant}
                  </h3>
                  <p className="text-zinc-500 text-sm mb-6">
                    {exp.category} • {exp.date}
                  </p>
                  <div className="flex items-end justify-between border-t border-white/5 pt-4">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">
                        Amount
                      </p>
                      <p className="text-2xl font-bold text-white">
                        ${exp.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium">
                      Cleared
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {activeTab === "Service Rates" && (
        <div className="max-w-5xl mx-auto mt-8">
          <ServicePricingCatalog />
        </div>
      )}

      {/* Expense Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <div ref={scannerModalRef} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="border border-white/5 shadow-2xl bg-black rounded-2xl w-full max-w-lg p-12 relative overflow-hidden"
            >
              <div className="text-center space-y-12">
                <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mx-auto text-black shadow-2xl relative">
                  <Receipt size={48} aria-hidden="true" />
                  <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full -z-10 animate-pulse" />
                </div>
                <div>
                  <h2
                    id="scanner-title"
                    className="text-2xl sm:text-3xl sm:text-4xl font-black text-white italic tracking-normal md:tracking-tighter lowercase leading-none mb-4"
                  >
                    Scan Receipt.
                  </h2>
                  <p className="text-white/40 font-bold text-lg italic">
                    Scanning... Capture clear receipts.
                  </p>
                </div>
                <div
                  id="receipt-upload-zone"
                  className="aspect-video bg-zinc-900 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative hover:bg-zinc-900 hover:border-white/20 transition-all cursor-pointer group overflow-hidden"
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
                  className="w-full py-6 bg-white/5 border border-white/5 text-white/60 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
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
          <div ref={aiModalRef} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl w-full max-w-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-blue-500" />
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                      <Brain size={24} aria-hidden="true" />
                    </div>
                    <div>
                      <h2
                        id="ai-modal-title"
                        className="text-xl font-bold text-white mb-1"
                      >
                        Draft Proposal
                      </h2>
                      <p className="text-sm font-medium text-zinc-400">
                        Created from voice input
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowAIModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>
                
                <div
                  className="bg-white/5 rounded-xl p-6 border border-white/5 mb-8 space-y-6"
                  aria-labelledby="ai-modal-title"
                >
                  {aiAnalysis?.isError ? (
                    <div className="py-8 text-center space-y-4">
                      <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                        <Brain size={24} />
                      </div>
                      <p className="text-zinc-400 text-sm">
                        {aiAnalysis.summary}
                      </p>
                      <button
                        onClick={simulateAIAnalysis}
                        className="px-4 py-2 bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/20 transition-all"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <>
                      {aiAnalysis?.transcript && (
                        <div className="pb-6 border-b border-white/5">
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-3">
                            Source Transcript
                          </span>
                          <div className="bg-black/50 p-4 rounded-lg border border-white/5 text-sm text-zinc-300 leading-relaxed italic">
                            "{aiAnalysis.transcript}"
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Client Info
                        </span>
                        <input 
                          type="text"
                          value={aiAnalysis?.clientName || ""}
                          onChange={(e) => setAiAnalysis({...aiAnalysis, clientName: e.target.value})}
                          className="text-base font-semibold text-white bg-transparent text-right outline-none focus:border-emerald-500 border-b border-transparent"
                        />
                      </div>
                      
                      {aiAnalysis?.summary && (
                        <div className="pb-4 border-b border-white/5">
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
                            Summary
                          </span>
                          <textarea
                            value={aiAnalysis.summary}
                            onChange={(e) => setAiAnalysis({...aiAnalysis, summary: e.target.value})}
                            className="w-full text-sm text-zinc-300 bg-black/50 p-3 rounded-lg outline-none border border-white/5 focus:border-emerald-500"
                            rows={2}
                          />
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                           <span>Service Items ({aiAnalysis?.items?.length || 0})</span>
                           <button onClick={() => {
                              const newItems = [...(aiAnalysis?.items || []), { description: "New Item", quantity: 1, rate: 0 }];
                              setAiAnalysis({...aiAnalysis, items: newItems});
                           }} className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><Plus size={14}/> Add Item</button>
                        </div>
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
                              className="flex justify-between items-start gap-4 p-3 bg-black/30 rounded-xl border border-white/5"
                            >
                              <div className="flex-1 space-y-2">
                                <div className="flex flex-col">
                                  <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1 mb-1">Service Match</label>
                                  <select 
                                    className="w-full min-w-0 bg-zinc-900 border border-white/10 rounded-lg p-2 text-base sm:text-sm text-white focus:outline-none"
                                    value={item.description}
                                    onChange={(e) => {
                                       const cat = tenant?.settings?.serviceCatalog?.flatMap((c: any) => c.services) || [];
                                       const srv = cat.find((s: any) => s.name === e.target.value);
                                       handleItemChange(idx, "description", e.target.value);
                                       if(srv) handleItemChange(idx, "rate", srv.price);
                                    }}
                                  >
                                    <option value={item.description}>{item.description} (Custom Entry)</option>
                                    {tenant?.settings?.serviceCatalog?.map((cat: any) => (
                                      <optgroup key={cat.name} label={cat.name}>
                                        {cat.services.map((srv: any) => (
                                           <option key={srv.name} value={srv.name}>{srv.name} (${srv.price})</option>
                                        ))}
                                      </optgroup>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="w-16 flex flex-col">
                                 <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1 mb-1">Qty</label>
                                 <input 
                                   type="number" 
                                   className="w-full min-w-0 bg-zinc-900 border border-white/10 rounded-lg p-2 text-base sm:text-sm text-white text-center focus:outline-none"
                                   value={item.quantity || 1}
                                   onChange={(e) => handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                                 />
                              </div>
                              <div className="w-24 flex flex-col">
                                 <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1 mb-1">Rate</label>
                                 <input 
                                   type="number" 
                                   className="w-full min-w-0 bg-zinc-900 border border-white/10 rounded-lg p-2 text-base sm:text-sm text-white text-right focus:outline-none"
                                   value={item.rate || 0}
                                   onChange={(e) => handleItemChange(idx, "rate", parseFloat(e.target.value) || 0)}
                                 />
                              </div>
                              <div className="flex flex-col justify-center items-end pt-5">
                                 <button onClick={() => {
                                    const newItems = [...aiAnalysis.items];
                                    newItems.splice(idx, 1);
                                    const newTotal = newItems.reduce((acc, curr) => acc + (curr.rate * curr.quantity), 0);
                                    setAiAnalysis({...aiAnalysis, items: newItems, total: newTotal});
                                 }} className="text-zinc-600 hover:text-red-400 p-1">
                                    <X size={16} />
                                 </button>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                      
                      <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                        <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                          Total Estimate
                        </span>
                        <span className="text-3xl font-bold text-white leading-none">
                          ${((aiAnalysis?.items?.reduce((acc: number, curr: any) => acc + ((curr.rate || 0) * (curr.quantity || 0)), 0) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-4">
                           <input 
                              type="checkbox" 
                              id="autoSchedule" 
                              checked={autoSchedule} 
                              onChange={(e) => setAutoSchedule(e.target.checked)}
                              className="w-5 h-5 accent-emerald-500"
                           />
                           <label htmlFor="autoSchedule" className="text-sm font-bold text-white uppercase tracking-widest">Auto-Schedule Service Visit</label>
                        </div>
                        {autoSchedule && (
                           <div>
                              <label className="block text-xs md:text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                                Preferred Date
                              </label>
                              <input
                                type="date"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                className="w-full bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white/60 outline-none"
                              />
                           </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowAIModal(false)}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const path = "invoices";
                      const tenantId = tenant?.id || "genesis-1";
                      if (!aiAnalysis) return;
                      const calculatedTotal = (aiAnalysis.items || []).reduce((acc: number, curr: any) => acc + ((curr.rate || 0) * (curr.quantity || 0)), 0);
                      try {
                        let invoiceId = "";
                        if (navigator.onLine) {
                          const docRef = await addDoc(collection(db, path), {
                            client: aiAnalysis.clientName,
                            amount: calculatedTotal,
                            items: aiAnalysis.items,
                            status: "sent",
                            tenantId,
                            createdAt: serverTimestamp(),
                          });
                          invoiceId = docRef.id;
                          await logSystemEvent("INVOICE_CREATED_FROM_AI", {
                            invoiceId: docRef.id,
                            client: aiAnalysis.clientName,
                            tenantId,
                          });
                        } else {
                          // Note: Offline scheduling sync not fully linked here for simplicity
                          await syncService.queueAction(
                            "CREATE",
                            "invoices",
                            {
                              client: aiAnalysis.clientName,
                              amount: calculatedTotal,
                              items: aiAnalysis.items,
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

                        if (autoSchedule && invoiceId && navigator.onLine) {
                            await addDoc(collection(db, "jobs"), {
                                title: aiAnalysis.items[0]?.description || "Scheduled Service",
                                client: aiAnalysis.clientName,
                                date: scheduleDate || new Date().toISOString().split('T')[0],
                                status: "SCHEDULED",
                                invoiceId,
                                tenantId
                            });
                        }

                        setShowAIModal(false);
                      } catch (err) {
                        handleFirestoreError(err, OperationType.CREATE, path);
                      }
                    }}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium shadow-sm transition-all"
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
