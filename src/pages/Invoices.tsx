import { fetchApi } from "../lib/api";
// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  handleFirestoreError,
  OperationType,
  logSystemEvent,
  auth
} from "../lib/firebase";
import { invoicesRepo, expensesRepo, jobsRepo, contractsRepo, customersRepo } from "../lib/repos";
import { runAutomations } from "../lib/automations";
import { applyPayment, bucketInvoices } from "../lib/payments";
import {
  FileText,
  Plus,
  Search,
  Copy,
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
  Printer,
  Repeat,
  FileSignature,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { syncService } from "../services/syncService";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useReactToPrint } from "react-to-print";
import { PrinterFriendlyInvoice } from "../components/PrinterFriendlyInvoice";

import { useLocation } from "react-router-dom";
import { Invoice } from "../types";
import { ServicePricingCatalog } from "../components/ServicePricingCatalog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

// Surface invoice fields that have no Supabase column (client name, clientEmail,
// clientPhone, clientId) — they live in the `data` jsonb. Spread `data` first so
// real columns win on key collisions. Status is normalized to lowercase so the
// agent's "DRAFT" writes line up with the lowercase strings ("sent"/"paid") this
// UI and ClientPortal already use for filtering/badges.
const adaptInvoice = (r: any): any => ({
  ...(r?.data || {}),
  ...r,
  status: (r?.status || "").toString().toLowerCase(),
});

// Map a camelCase invoice to a Supabase `invoices` row. Columnless fields
// (client/clientEmail/clientPhone/clientId) nest into `data`; tenant/timestamps
// are stamped server-side (RLS / column defaults) so we drop them here.
const toInvoiceRow = (i: any) => ({
  amount: i.amount,
  status: i.status,
  date: i.date,
  dueDate: i.dueDate,
  items: i.items,
  customerId: i.customerId,
  data: {
    client: i.client,
    clientEmail: i.clientEmail,
    clientPhone: i.clientPhone,
    clientId: i.clientId,
    ...(i.data || {}),
  },
});

// Money formatter used across the invoice UI.
const formatCurrency = (n: any) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Surface expense fields without a column (vendor/notes/status) from `data`.
const adaptExpense = (r: any): any => ({ ...(r?.data || {}), ...r });

// Map a camelCase expense to a Supabase `expenses` row. amount/merchant/category/
// date stay as columns; vendor/notes/status nest into `data`.
const toExpenseRow = (x: any) => ({
  amount: x.amount,
  merchant: x.merchant,
  category: x.category,
  date: x.date,
  data: { vendor: x.vendor, notes: x.notes, status: x.status, ...(x.data || {}) },
});

export default function Invoices() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const location = useLocation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Pending destructive action (invoice deletion), gated behind a confirm dialog.
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = useState<any>(null);
  const [expenses, setExpenses] = useState<
    { id: string; amount: number; vendor?: string; merchant?: string; category?: string; date: string; notes?: string; status?: string; isArchived?: boolean; }[]
  >([]);
  const [activeTab, setActiveTab] = useState("Invoices");
  const [quarterFilter, setQuarterFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [scheduleDate, setScheduleDate] = useState("");
  // Billing controls (tax / discount / due date). Tax + net-terms default from tenant settings.
  const [taxRate, setTaxRate] = useState<number>(Number((tenant?.settings as any)?.taxRate) || 0);
  const [discount, setDiscount] = useState<number>(0);
  const [dueDays, setDueDays] = useState<number>(Number((tenant?.settings as any)?.invoiceNetDays) || 30);
  // Record-payment (deposits / partial payments) modal state.
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [savingPayment, setSavingPayment] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, any> | null>(
    null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Customer roster for the invoice customer selector. Persisting the selected
  // customer's id as invoices.customer_id is what lets Job Costing, Customer
  // Intelligence profitability, and reporting attribute revenue to a customer.
  const [customers, setCustomers] = useState<any[]>([]);
  // Currently selected customer id for the new-invoice form (-> invoice.customerId).
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  // Human-readable label for a customer (mirrors the camelCased repo shape).
  const customerLabel = (c: any) =>
    (c.companyName ||
      [c.firstName, c.lastName].filter(Boolean).join(" ") ||
      c.name ||
      c.phone ||
      "Unnamed Customer");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks which invoice ids were already "paid" on the last subscription push, so we can
  // detect a transition into paid and fire the automation engine exactly once per flip.
  const paidInvoiceIds = useRef<Set<string>>(new Set());
  const sawFirstInvoiceSnapshot = useRef(false);
  
  const [printingInvoice, setPrintingInvoice] = useState<any>(null);
  const printComponentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printComponentRef,
    documentTitle: printingInvoice ? `Invoice-${printingInvoice.id.slice(0, 6)}` : "Invoice",
    onAfterPrint: () => setPrintingInvoice(null),
  });

  const triggerPrint = (inv: any) => {
    setPrintingInvoice(inv);
    setTimeout(() => {
      handlePrint();
    }, 100);
  };
  
  const scannerModalRef = useFocusTrap<HTMLDivElement>(isScanning);
  const aiModalRef = useFocusTrap<HTMLDivElement>(showAIModal);

  useEffect(() => {
    // RLS scopes invoices/expenses to the caller's tenant, so no tenantId filter
    // is needed. subscribe() pushes a fresh full list on any change (onSnapshot
    // equivalent) and returns an unsubscribe fn.
    const unsubscribeInv = invoicesRepo.subscribe((rows) => {
      const adapted = (rows || []).map(adaptInvoice);

      // Fire "invoice_paid" automations on any invoice that just transitioned into paid.
      // adaptInvoice lowercases status, so "PAID"/"paid" both normalize to "paid".
      // Skip the very first snapshot so we don't replay history on initial load.
      const nextPaid = new Set<string>();
      for (const inv of adapted) {
        if (inv.status === "paid") {
          nextPaid.add(inv.id);
          if (sawFirstInvoiceSnapshot.current && !paidInvoiceIds.current.has(inv.id)) {
            runAutomations("invoice_paid", {
              clientName: inv.client,
              customerId: inv.customerId || inv.clientId,
              invoiceId: inv.id,
              amount: inv.amount,
            }).catch(() => {});
          }
        }
      }
      paidInvoiceIds.current = nextPaid;
      sawFirstInvoiceSnapshot.current = true;

      setInvoices(adapted);
      setLoaded(true);
    });
    const unsubscribeExp = expensesRepo.subscribe((rows) =>
      setExpenses((rows || []).map(adaptExpense)),
    );

    return () => {
      unsubscribeInv();
      unsubscribeExp();
    };
  }, []);

  // Load the customer roster once so the new-invoice form can attach a customerId
  // (invoices.customer_id) for per-customer revenue attribution. Best-effort: if it
  // fails the form still works as a free-text "client" entry.
  useEffect(() => {
    customersRepo
      .list()
      .then((rows) => setCustomers(rows || []))
      .catch(() => {});
  }, []);

  // When the proposal modal opens, sync the customer selector to whatever the
  // current draft carries (CRM/job context seeds aiAnalysis.customerId). Manual
  // "Quick Add"/"Generate Invoice" drafts have none, so the selector resets to
  // "no customer linked" rather than leaking a prior selection.
  useEffect(() => {
    if (showAIModal) {
      setSelectedCustomerId(aiAnalysis?.customerId || "");
      // Reset billing controls to tenant defaults each time a draft opens.
      setTaxRate(Number((tenant?.settings as any)?.taxRate) || 0);
      setDiscount(0);
      setDueDays(Number((tenant?.settings as any)?.invoiceNetDays) || 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAIModal]);

  // Next human-friendly sequential invoice number (max existing + 1, base 1001).
  const nextInvoiceNumber = () => {
    const nums = (invoices || [])
      .map((i: any) => Number(i?.number ?? i?.data?.number))
      .filter((n) => Number.isFinite(n) && n > 0);
    return (nums.length ? Math.max(...nums) : 1000) + 1;
  };

  useEffect(() => {
    if (location.state?.client) {
      // Carry the originating customer's id through so the created invoice attributes
      // revenue to that customer (Job Costing / Customer Intelligence profitability).
      setSelectedCustomerId(location.state.customer?.id || "");
      setAiAnalysis({
        clientName: location.state.client,
        customerId: location.state.customer?.id || "",
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
          expensesRepo
            .create(
              toExpenseRow({
                amount: args.amount,
                merchant: args.vendor || "Field Expense",
                category: "Other",
                notes: args.description || "Added via voice",
                date: new Date().toISOString(),
                status: "cleared",
              }),
            )
            .catch((err) =>
              handleFirestoreError(err, OperationType.CREATE, "expenses"),
            );
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
        
        const tenantId = tenant?.id || "genesis-1";

        if (navigator.onLine) {
          const created = await expensesRepo.create(
            toExpenseRow({ ...data, status: "cleared" }),
          );
          await logSystemEvent("EXPENSE_SCAN_COMPLETED", {
            expenseId: created?.id,
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
  // Per-row spinner/disable while a payment reminder is being sent.
  const [remindingId, setRemindingId] = useState<string | null>(null);

  // Send an overdue/balance payment reminder for an unpaid invoice. Resolves the
  // client's email (then phone) from the invoice or the customer roster, computes the
  // outstanding balance, and emails a portal pay link — falling back to SMS. Branches
  // honestly on the server's {sent}/{simulated} shapes so we never claim a delivery
  // that didn't actually happen.
  const handleSendReminder = async (inv: any) => {
    if (remindingId) return;
    const customer = customers.find(
      (c: any) => c.id === (inv.customerId || inv.clientId),
    );
    const email = inv.clientEmail || inv.email || customer?.email || "";
    const phone = inv.clientPhone || inv.phone || customer?.phone || "";
    if (!email && !phone) {
      showToast("No email or phone on file.", "error");
      return;
    }
    const balance = (Number(inv.amount) || 0) - (Number((inv as any).amountPaid) || 0);
    const clientName = inv.client || "there";
    const invLabel = `INV-${(inv as any).number || String(inv.id).slice(0, 6)}`;
    const payLink = `${window.location.origin}/portal/${inv.customerId || inv.clientId || ""}`;
    const tenantId = tenant?.id || "genesis-1";

    setRemindingId(inv.id);
    try {
      if (email) {
        const res = await fetchApi("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: `Payment reminder — ${invLabel}`,
            text: `Hi ${clientName}, this is a friendly reminder that ${formatCurrency(balance)} is due on ${invLabel}. Pay securely: ${payLink}`,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(data?.error || "Could not send reminder.", "error");
          return;
        }
        if (data?.simulated) {
          showToast("Email isn't configured — reminder not actually sent.", "info");
          return;
        }
        if (data?.sent) {
          await logSystemEvent("INVOICE_REMINDER_SENT", {
            invoiceId: inv.id,
            client: inv.client,
            channel: "email",
            to: email,
            balance,
            tenantId,
          });
          showToast(`Payment reminder emailed to ${clientName}.`, "success");
          return;
        }
        showToast("Could not send reminder.", "error");
        return;
      }

      // No email on file — fall back to SMS with a short reminder + pay link.
      const res = await fetchApi("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          message: `Reminder: ${formatCurrency(balance)} is due on ${invLabel}. Pay securely: ${payLink}`,
          customerId: inv.customerId || inv.clientId || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not send reminder.", "error");
        return;
      }
      if (data?.simulated) {
        showToast("SMS isn't configured — reminder not actually sent.", "info");
        return;
      }
      if (data?.sent || data?.delivered) {
        await logSystemEvent("INVOICE_REMINDER_SENT", {
          invoiceId: inv.id,
          client: inv.client,
          channel: "sms",
          to: phone,
          balance,
          tenantId,
        });
        showToast(`Payment reminder texted to ${clientName}.`, "success");
        return;
      }
      showToast("Could not send reminder.", "error");
    } catch (err: any) {
      showToast(err?.message || "Could not send reminder.", "error");
    } finally {
      setRemindingId(null);
    }
  };

  // Finalize a draft estimate into a live invoice: flip status to "sent" and, if it
  // has no due date yet, set one ~30 days out. Honest try/catch — only toast success
  // after the write lands.
  const handleFinalizeEstimate = async (inv: any) => {
    const tenantId = tenant?.id || "genesis-1";
    try {
      const update: any = { status: "sent" };
      if (!inv.dueDate) {
        update.dueDate = new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .slice(0, 10);
      }
      await invoicesRepo.update(inv.id, update);
      await logSystemEvent("ESTIMATE_FINALIZED", {
        invoiceId: inv.id,
        client: inv.client,
        tenantId,
      });
      showToast("Estimate sent as invoice.", "success");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${inv.id}`);
      showToast(err?.message || "Could not finalize estimate.", "error");
    }
  };

  const handleGeneratePdf = async (inv: any) => {
    try {
      setGeneratingPdfId(inv.id);

      const res = await fetchApi("/api/invoices/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: inv.id,
          merchant: inv.client || "Client",
          amount: inv.amount || 0,
          items: inv.items || [],
        }),
      });

      if (!res.ok) {
        let msg = "PDF generation failed.";
        try { const d = await res.json(); msg = d?.error || msg; } catch { /* non-JSON error */ }
        throw new Error(msg);
      }

      // The server returns the rendered PDF bytes — download them directly (no Google account).
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${String(inv.id).slice(0, 6)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Flip status to "sent" once the invoice has been produced + (below) texted to the client.
      const tenantId = tenant?.id || "genesis-1";
      await invoicesRepo.update(inv.id, { status: "sent" });
      await logSystemEvent("INVOICE_PDF_GENERATED", {
        invoiceId: inv.id,
        client: inv.client,
        tenantId,
      });

      showToast("Invoice PDF downloaded.", "success");

      // Best-effort SMS delivery with a pay link to the client portal. Never let an SMS
      // failure block or revert the PDF + status flow.
      const phone = inv.clientPhone || inv.phone;
      if (phone) {
        try {
          const portalLink = `${window.location.origin}/portal/${inv.customerId || inv.clientId || ""}`;
          await fetchApi("/api/sms/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: phone,
              message: `Your invoice INV-${String(inv.id).slice(0, 6)} for $${(inv.amount || 0).toLocaleString()} is ready. Pay securely here: ${portalLink}`,
            }),
          });
        } catch (smsErr) {
          console.warn("Invoice SMS delivery failed (non-blocking):", smsErr);
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "Failed to generate invoice PDF.", "error");
    } finally {
      setGeneratingPdfId(null);
    }
  };

  // Set up recurring/seasonal billing for this invoice's customer (Stripe subscription on the
  // connected account). Opens Stripe Checkout, or confirms a simulated plan without keys.
  const handleMakeRecurring = async (inv: any) => {
    const interval = (typeof window !== "undefined" && window.prompt
      ? window.prompt("Billing interval: weekly, biweekly, monthly, quarterly, seasonal, or yearly", "monthly")
      : "monthly");
    if (!interval) return;
    try {
      const res = await fetchApi("/api/stripe/recurring/checkout", {
        method: "POST",
        body: JSON.stringify({
          customerId: inv.customerId || inv.clientId || inv.client,
          amount: inv.amount,
          description: `Recurring service — ${inv.client || "Customer"}`,
          interval: String(interval).toLowerCase().trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data?.error || "Could not set up recurring billing.", "error"); return; }
      if (data?.url || data?.checkoutUrl) { window.location.href = data.url || data.checkoutUrl; return; }
      showToast(data?.simulated ? `Recurring plan ready (${data.interval}). Connect Stripe to go live.` : "Recurring billing set up.", "success");
    } catch (err: any) {
      showToast(err?.message || "Could not set up recurring billing.", "error");
    }
  };

  // Close out a cash/check/card invoice that was settled offline. Flipping the row to
  // "paid" lets the subscribe() handler above fire the invoice_paid automations exactly
  // once on the transition.
  const handleMarkPaid = async (inv: any) => {
    const tenantId = tenant?.id || "genesis-1";
    try {
      // Settle the full balance: stamp amountPaid = total so AR "collected", the portal
      // balance, and the checkout guard all agree this invoice is fully paid (otherwise
      // amountPaid stays stale and the client could be charged the full amount again online).
      const total = Number(inv.amount) || 0;
      const paidPatch = {
        status: "paid",
        data: { ...(inv.data || {}), amountPaid: total },
      };
      if (navigator.onLine) {
        await invoicesRepo.update(inv.id, paidPatch);
      } else {
        await syncService.queueAction("UPDATE", "invoices", paidPatch, tenantId, inv.id);
      }
      await logSystemEvent("INVOICE_MARKED_PAID", {
        invoiceId: inv.id,
        client: inv.client,
        tenantId,
      });
      showToast(`Invoice for ${inv.client || "client"} marked paid.`, "success");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${inv.id}`);
      showToast(err?.message || "Could not mark invoice paid.", "error");
    }
  };

  // Record a deposit / partial (or full) payment against an invoice. Tracks the running
  // total in data.amountPaid + an itemized data.payments[]; flips status to "partial" or
  // "paid" based on the new balance.
  const openPayment = (inv: any) => {
    const balance = Math.max(0, (Number(inv.amount) || 0) - (Number(inv.amountPaid) || 0));
    setPaymentInvoice(inv);
    setPayAmount(balance ? String(balance.toFixed(2)) : "");
    setPayMethod("cash");
  };
  const handleRecordPayment = async () => {
    if (!paymentInvoice) return;
    const rawAmt = Number(payAmount) || 0;
    if (rawAmt <= 0) { showToast("Enter a payment amount.", "error"); return; }
    setSavingPayment(true);
    const tenantId = tenant?.id || "genesis-1";
    try {
      const prevPaid = Number(paymentInvoice.amountPaid) || 0;
      const total = Number(paymentInvoice.amount) || 0;
      // applyPayment clamps overpayment to the remaining balance (so the AR "collected"
      // total can't report e.g. $9,999 on a $100 invoice) and decides partial vs paid.
      const { accepted: amt, amountPaid, status: newStatus } = applyPayment(prevPaid, rawAmt, total);
      const payments = Array.isArray(paymentInvoice.payments) ? paymentInvoice.payments : [];
      const newPayments = [...payments, { amount: amt, date: new Date().toISOString().slice(0, 10), method: payMethod }];
      await invoicesRepo.update(paymentInvoice.id, {
        status: newStatus,
        data: { ...(paymentInvoice.data || {}), amountPaid, payments: newPayments },
      });
      await logSystemEvent("INVOICE_PAYMENT_RECORDED", { invoiceId: paymentInvoice.id, amount: amt, method: payMethod, amountPaid, tenantId });
      showToast(
        newStatus === "paid"
          ? "Payment recorded — invoice paid in full."
          : `Payment recorded — balance ${formatCurrency(total - amountPaid)}.`,
        "success",
      );
      setPaymentInvoice(null);
    } catch (err: any) {
      showToast(err?.message || "Could not record payment.", "error");
    } finally {
      setSavingPayment(false);
    }
  };

  // Turn an accepted estimate (a sent/draft invoice) into a recurring contract row and
  // fire the quote_approved automation trigger. Defaults to a monthly cadence — the user
  // can adjust the cycle/dates afterward on the Contracts page.
  const handleConvertToContract = async (inv: any) => {
    try {
      await contractsRepo.create({
        name: inv.client || "New Contract",
        status: "active",
        mrr: Number(inv.amount) || 0,
        customer_id: inv.customerId || inv.clientId || null,
        data: {
          cycle: "Monthly",
          start_date: new Date().toISOString().split("T")[0],
          end_date: null,
          services: (inv.items || [])
            .map((it: any) => it.description)
            .filter(Boolean)
            .join(", "),
          sourceInvoiceId: inv.id,
        },
      });
      runAutomations("quote_approved", {
        clientName: inv.client,
        customerId: inv.customerId || inv.clientId,
        amount: inv.amount,
      }).catch(() => {});
      await logSystemEvent("INVOICE_CONVERTED_TO_CONTRACT", {
        invoiceId: inv.id,
        client: inv.client,
      });
      showToast(`Contract created for ${inv.client || "client"} (monthly).`, "success");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, "contracts");
      showToast(err?.message || "Could not convert to contract.", "error");
    }
  };

  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => !inv.isArchived);
    // Quarter filter.
    if (quarterFilter !== "All") {
      result = result.filter(inv => {
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
    }
    // Text search: case-insensitive substring match on client name + invoice number.
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter(inv => {
        const client = (inv.client || "").toString().toLowerCase();
        const number = ((inv as any).number ?? (inv as any).data?.number ?? "").toString().toLowerCase();
        return client.includes(q) || number.includes(q);
      });
    }
    return result;
  }, [invoices, quarterFilter, searchTerm]);

  // Accounts-receivable aging — bucket outstanding balances by days past due. Logic lives in
  // the tested src/lib/payments.ts (bucketInvoices) so the AR/dunning math has coverage.
  const arAging = useMemo(() => bucketInvoices(invoices), [invoices]);

  const [remindingAll, setRemindingAll] = useState(false);

  // Email a payment reminder to every overdue invoice's client; one honest summary toast.
  const handleRemindAllOverdue = async () => {
    const list = arAging.overdueInvoices;
    if (!list.length) { showToast("No overdue invoices to remind.", "info"); return; }
    setRemindingAll(true);
    let sent = 0, simulated = 0, skipped = 0, failed = 0;
    try {
      for (const inv of list) {
        const cust = customers.find((c: any) => c.id === (inv.customerId || inv.clientId));
        const email = inv.clientEmail || (inv as any).email || cust?.email;
        if (!email) { skipped++; continue; }
        const bal = (Number(inv.amount) || 0) - (Number((inv as any).amountPaid) || 0);
        const link = `${window.location.origin}/portal/${inv.customerId || inv.clientId || ""}`;
        try {
          const res = await fetchApi("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: email,
              subject: `Payment reminder — INV-${(inv as any).number || inv.id.slice(0, 6)}`,
              text: `Hi ${inv.client || "there"}, a friendly reminder that ${formatCurrency(bal)} is past due. Pay securely here: ${link}. Thank you!`,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data?.error) failed++;
          else if (data.simulated) simulated++;
          else { sent++; }
        } catch { failed++; }
      }
      const parts = [];
      if (sent) parts.push(`${sent} sent`);
      if (simulated) parts.push(`${simulated} not configured`);
      if (skipped) parts.push(`${skipped} no email`);
      if (failed) parts.push(`${failed} failed`);
      showToast(`Reminders: ${parts.join(" · ") || "none"}.`, sent ? "success" : simulated || skipped ? "info" : "error");
      if (sent) await logSystemEvent("INVOICE_REMINDERS_BULK", { count: sent, tenantId: tenant?.id || "genesis-1" });
    } finally {
      setRemindingAll(false);
    }
  };

  // Perform the actual invoice deletion (soft-delete/archive). Gated by the
  // ConfirmDialog — only called after the user confirms.
  const performDeleteInvoice = async (inv: any) => {
    if (!inv?.id) return;
    const tenantId = tenant?.id || "genesis-1";
    try {
      if (navigator.onLine) {
        await invoicesRepo.archive(inv.id);
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
      handleFirestoreError(err, OperationType.DELETE, `invoices/${inv.id}`);
    }
  };

  // Duplicate an existing invoice as a fresh DRAFT. Carries over client, items,
  // amount, customer linkage and the tax/discount breakdown, assigns a brand-new
  // sequential number, dates it today, and starts payment state clean (no
  // amountPaid/payments copied). Mirrors the toInvoiceRow + nextInvoiceNumber path
  // used by handleCreateInvoice.
  const handleDuplicateInvoice = async (inv: any) => {
    if (!inv?.id) return;
    const tenantId = tenant?.id || "genesis-1";
    const src = inv?.data || {};
    const today = new Date().toISOString().slice(0, 10);
    const billing: any = { number: nextInvoiceNumber() };
    // Carry over the source's tax/discount breakdown when present.
    if (src.subtotal != null) billing.subtotal = src.subtotal;
    if (src.discount != null) billing.discount = src.discount;
    if (src.taxRate != null) billing.taxRate = src.taxRate;
    if (src.taxAmount != null) billing.taxAmount = src.taxAmount;
    try {
      await invoicesRepo.create(
        toInvoiceRow({
          client: inv.client,
          amount: inv.amount,
          items: inv.items,
          status: "draft",
          date: today,
          ...(inv.customerId ? { customerId: inv.customerId } : {}),
          data: billing,
        }),
      );
      await logSystemEvent("INVOICE_DUPLICATED", {
        sourceInvoiceId: inv.id,
        client: inv.client,
        number: billing.number,
        tenantId,
      });
      showToast("Invoice duplicated as draft.", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "invoices");
      showToast("Could not duplicate invoice.", "error");
    }
  };

  // Create the invoice from the draft modal. `mode` controls the persisted status:
  // "estimate" -> draft (Save as estimate), "invoice" -> sent (Send Invoice). All other
  // logic (billing math, customer linkage, auto-schedule, offline queue) is shared.
  const handleCreateInvoice = async (mode: "estimate" | "invoice") => {
    const path = "invoices";
    const tenantId = tenant?.id || "genesis-1";
    if (!aiAnalysis) return;
    const status = mode === "estimate" ? "draft" : "sent";
    // Billing math (mirror the summary block): subtotal -> discount -> tax -> total.
    const subtotal = (aiAnalysis.items || []).reduce((acc: number, curr: any) => acc + ((curr.rate || 0) * (curr.quantity || 0)), 0);
    const discountAmt = Math.min(Number(discount) || 0, subtotal);
    const taxableBase = subtotal - discountAmt;
    const taxAmount = taxableBase * ((Number(taxRate) || 0) / 100);
    const calculatedTotal = taxableBase + taxAmount;
    const invNumber = nextInvoiceNumber();
    const today = new Date();
    const dueDate = new Date(today.getTime() + (Number(dueDays) || 0) * 86400000)
      .toISOString()
      .slice(0, 10);
    const billing = {
      number: invNumber,
      subtotal,
      discount: discountAmt,
      taxRate: Number(taxRate) || 0,
      taxAmount,
    };
    // Resolve the linked customer id so the invoice attributes revenue
    // to a customer (invoices.customer_id). Prefer the explicit selector,
    // then any customerId carried in from CRM/job context.
    const customerId = selectedCustomerId || aiAnalysis.customerId || "";
    try {
      let invoiceId = "";
      if (navigator.onLine) {
        const created = await invoicesRepo.create(
          toInvoiceRow({
            client: aiAnalysis.clientName,
            amount: calculatedTotal,
            items: aiAnalysis.items,
            status,
            dueDate,
            // Persist the customer linkage for profitability/job costing/reporting.
            ...(customerId ? { customerId } : {}),
            // Sequential number + tax/discount breakdown + optional job link.
            data: { ...billing, ...(aiAnalysis.jobId ? { jobId: aiAnalysis.jobId } : {}) },
          }),
        );
        invoiceId = created?.id;
        await logSystemEvent(
          mode === "estimate" ? "ESTIMATE_CREATED_FROM_AI" : "INVOICE_CREATED_FROM_AI",
          {
            invoiceId: created?.id,
            client: aiAnalysis.clientName,
            customerId,
            tenantId,
          },
        );
      } else {
        // Note: Offline scheduling sync not fully linked here for simplicity
        await syncService.queueAction(
          "CREATE",
          "invoices",
          {
            client: aiAnalysis.clientName,
            amount: calculatedTotal,
            items: aiAnalysis.items,
            status,
            dueDate,
            ...(customerId ? { customerId } : {}),
            ...billing,
            ...(aiAnalysis.jobId ? { jobId: aiAnalysis.jobId } : {}),
            createdAt: new Date().toISOString(),
          },
          tenantId,
        );
        await logSystemEvent(
          mode === "estimate"
            ? "ESTIMATE_CREATED_FROM_AI_OFFLINE"
            : "INVOICE_CREATED_FROM_AI_OFFLINE",
          { client: aiAnalysis.clientName, customerId, tenantId },
        );
      }

      if (autoSchedule && invoiceId && navigator.onLine) {
        await jobsRepo.create({
          title: aiAnalysis.items[0]?.description || "Scheduled Service",
          date: scheduleDate || new Date().toISOString().split('T')[0],
          status: "SCHEDULED",
          // Link the scheduled job to the same customer so job costing lines up.
          ...(customerId ? { customerId } : {}),
          data: {
            client: aiAnalysis.clientName,
            invoiceId,
          },
        });
      }

      showToast(
        mode === "estimate" ? "Estimate saved as draft." : "Invoice sent.",
        "success",
      );
      setShowAIModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!aiAnalysis) return;
    const newItems = [...aiAnalysis.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    const newTotal = newItems.reduce((acc: number, curr: any) => acc + (Number(curr.rate) || 0) * (Number(curr.quantity) || 0), 0);
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
          <div className="flex flex-col items-center justify-center gap-2 p-6 bg-zinc-900 border border-white/5 molten-edge rounded-[20px] text-zinc-400 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
             <Zap size={24} className="text-yellow-400 animate-pulse" />
             <span className="font-bold text-sm text-yellow-400/80">Easy Mode Active</span>
          </div>
        </div>
      )}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 pb-8 border-b border-white/5 molten-edge relative z-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-forest-500/10 rounded-md border border-forest-500/20 text-xs font-medium tracking-wide text-forest-400">
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
          {/* Accounts-receivable aging — outstanding balances by how overdue they are. */}
          {(arAging.outstanding > 0 || arAging.collected > 0) && (
            <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Accounts Receivable</p>
                  <p className="text-2xl font-black text-white">{formatCurrency(arAging.outstanding)} <span className="text-sm font-medium text-zinc-500">outstanding</span></p>
                  <p className="text-[11px] text-forest-400/80 mt-0.5">{formatCurrency(arAging.collected)} collected</p>
                </div>
                {arAging.overdueInvoices.length > 0 && (
                  <button
                    onClick={handleRemindAllOverdue}
                    disabled={remindingAll}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all disabled:opacity-50"
                  >
                    {remindingAll ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                    Remind {arAging.overdueInvoices.length} Overdue
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Current", val: arAging.current, cls: "text-forest-400" },
                  { label: "1–30 days", val: arAging.d1_30, cls: "text-amber-400" },
                  { label: "31–60 days", val: arAging.d31_60, cls: "text-amber-400" },
                  { label: "61–90 days", val: arAging.d61_90, cls: "text-rose-400" },
                  { label: "90+ days", val: arAging.d90, cls: "text-rose-400" },
                ].map((b) => (
                  <div key={b.label} className="bg-black/30 border border-white/5 rounded-xl px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{b.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${b.val > 0 ? b.cls : "text-zinc-600"}`}>{formatCurrency(b.val)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={simulateAIAnalysis}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-5 py-2.5 bg-forest-500/10 text-forest-400 border border-forest-500/20 rounded-lg text-sm font-medium hover:bg-forest-500/20 transition-all disabled:opacity-50"
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

              <div className="relative group">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-forest-400 transition-colors"
                  aria-hidden="true"
                />
                <label htmlFor="invoice-search-input" className="sr-only">
                  Search invoices
                </label>
                <input
                  id="invoice-search-input"
                  type="text"
                  placeholder="Search client or invoice #..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-64 pl-12 pr-6 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm font-medium focus:bg-white/10 focus:border-forest-500/30 focus:outline-none placeholder:text-zinc-600 transition-all"
                />
              </div>
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
            {!loaded ? (
              [...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))
            ) : filteredInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={quarterFilter === "All" ? "No invoices yet" : "No invoices this quarter"}
                description={
                  quarterFilter === "All"
                    ? "Generate your first invoice with AI or create one manually to start billing clients."
                    : "There are no invoices in the selected quarter. Adjust the filter or generate a new invoice."
                }
                action={{
                  label: "Generate Invoice",
                  onClick: () => {
                    setAiAnalysis({
                      clientName: "New Client",
                      items: [{ description: "New Service", quantity: 1, rate: 0 }],
                      total: 0,
                      summary: "Manual proposal creation",
                    });
                    setShowAIModal(true);
                  },
                }}
              />
            ) : (
              filteredInvoices.map((inv) => (
              <motion.div
                layout
                key={inv.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5 flex items-center justify-between group hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                      inv.status === "PAID" || inv.status === "paid"
                        ? "bg-forest-500/10 text-forest-400"
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
                    <h4 className="font-semibold text-white text-lg group-hover:text-forest-400 transition-colors">
                      {inv.client}
                    </h4>
                    <p className="text-zinc-500 text-sm flex items-center gap-2 flex-wrap">
                      <span>{inv.date || "Today"} • INV-{(inv as any).number || inv.id.slice(0, 6)}</span>
                      {(() => {
                        const s = (inv.status || "").toLowerCase();
                        const unpaid = !["paid", "draft", "void", "cancelled", "canceled"].includes(s);
                        const overdue = unpaid && inv.dueDate && new Date(inv.dueDate) < new Date(new Date().toDateString());
                        if (overdue) return <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded">Overdue</span>;
                        if (unpaid && inv.dueDate) return <span className="text-[10px] text-zinc-600">Due {inv.dueDate}</span>;
                        return null;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8 pl-4">
                  <div className="text-right">
                    <p className="text-xl sm:text-2xl font-bold text-white leading-none">
                      ${inv.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {(() => {
                      const paid = Number((inv as any).amountPaid) || 0;
                      const bal = (Number(inv.amount) || 0) - paid;
                      const s = (inv.status || "").toLowerCase();
                      if (paid > 0 && bal > 0.005) {
                        return <p className="text-[11px] text-amber-400 mt-1">Paid {formatCurrency(paid)} · Bal {formatCurrency(bal)}</p>;
                      }
                      return (
                        <span
                          className={`text-xs mt-1 font-medium px-2.5 py-0.5 rounded-full inline-block ${
                            s === "paid" ? "bg-forest-500/10 text-forest-400" : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {inv.status}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => triggerPrint(inv)}
                      className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-all"
                      aria-label={`Print PDF for ${inv.client}`}
                      title="Print Invoice PDF"
                    >
                      <Printer size={18} aria-hidden="true" />
                    </button>
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
                      onClick={() => handleMakeRecurring(inv)}
                      className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-all"
                      aria-label={`Set up recurring billing for ${inv.client}`}
                      title="Set up recurring / seasonal billing"
                    >
                      <Repeat size={18} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleDuplicateInvoice(inv)}
                      className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-all"
                      aria-label={`Duplicate invoice for ${inv.client} as a draft`}
                      title="Duplicate as draft"
                    >
                      <Copy size={18} aria-hidden="true" />
                    </button>
                    {!["paid", "draft", "void", "cancelled", "canceled"].includes(
                      (inv.status || "").toLowerCase(),
                    ) && (
                      <button
                        onClick={() => handleSendReminder(inv)}
                        disabled={remindingId === inv.id}
                        className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-all disabled:opacity-50"
                        aria-label={`Send payment reminder to ${inv.client}`}
                        title="Send payment reminder"
                      >
                        {remindingId === inv.id ? (
                          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Bell size={18} aria-hidden="true" />
                        )}
                      </button>
                    )}
                    {(inv.status || "").toLowerCase() === "draft" && (
                      <button
                        onClick={() => handleFinalizeEstimate(inv)}
                        className="p-2.5 text-forest-400 hover:bg-forest-500/10 rounded-md transition-all"
                        aria-label={`Send / finalize estimate for ${inv.client}`}
                        title="Send / Finalize estimate as invoice"
                      >
                        <Send size={18} aria-hidden="true" />
                      </button>
                    )}
                    {inv.status !== "paid" && (
                      <button
                        onClick={() => handleConvertToContract(inv)}
                        className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-all"
                        aria-label={`Convert estimate for ${inv.client} into a contract`}
                        title="Convert to recurring contract"
                      >
                        <FileSignature size={18} aria-hidden="true" />
                      </button>
                    )}
                    {inv.status !== "paid" && (
                      <button
                        onClick={() => openPayment(inv)}
                        className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-all"
                        aria-label={`Record a payment for ${inv.client}`}
                        title="Record a payment / deposit"
                      >
                        <DollarSign size={18} aria-hidden="true" />
                      </button>
                    )}
                    {inv.status !== "paid" && (
                      <button
                        onClick={() => handleMarkPaid(inv)}
                        className="p-2.5 text-forest-400 hover:bg-forest-500/10 rounded-md transition-all"
                        aria-label={`Mark invoice for ${inv.client} as paid`}
                        title="Mark Paid (full)"
                      >
                        <CheckCircle2 size={18} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const tenantId = tenant?.id || "genesis-1";
                        try {
                          if (navigator.onLine) {
                            await invoicesRepo.update(inv.id, { status: "sent" });
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
                          showToast(`Invoice for ${inv.client || "client"} marked sent.`, "success");
                        } catch (err) {
                          handleFirestoreError(
                            err,
                            OperationType.UPDATE,
                            `invoices/${inv.id}`,
                          );
                        }
                      }}
                      className="p-2.5 text-forest-400 hover:bg-forest-500/10 rounded-md transition-all"
                      aria-label={`Mark invoice for ${inv.client} as sent`}
                      title="Mark Sent"
                    >
                      <Send size={18} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => setPendingDeleteInvoice(inv)}
                      className="p-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                      aria-label={`Delete invoice for ${inv.client}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </motion.div>
              ))
            )}
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
                            await expensesRepo.archive(exp.id);
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
                  <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-forest-400 transition-colors">
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
                    <span className="px-2.5 py-0.5 bg-forest-500/10 text-forest-400 rounded-full text-xs font-medium">
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
                      <div className="absolute inset-0 bg-gradient-to-br from-forest-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-forest-500 to-celtic-500" />
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-forest-500/10 rounded-xl flex items-center justify-center text-forest-400">
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
                        <div className="pb-6 border-b border-white/5 molten-edge">
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-3">
                            Source Transcript
                          </span>
                          <div className="bg-black/50 p-4 rounded-lg border border-white/5 text-sm text-zinc-300 leading-relaxed italic">
                            "{aiAnalysis.transcript}"
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center pb-4 border-b border-white/5 molten-edge">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Client Info
                        </span>
                        <input
                          type="text"
                          value={aiAnalysis?.clientName || ""}
                          onChange={(e) => setAiAnalysis({...aiAnalysis, clientName: e.target.value})}
                          className="text-base font-semibold text-white bg-transparent text-right outline-none focus:border-forest-500 border-b border-transparent"
                        />
                      </div>

                      {/* Customer link — persists invoices.customer_id so this invoice's
                          revenue is attributed to the customer in Job Costing,
                          Customer Intelligence profitability, and reporting. */}
                      <div className="pb-4 border-b border-white/5 molten-edge">
                        <label
                          htmlFor="invoice-customer-select"
                          className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2"
                        >
                          Link to Customer
                        </label>
                        <select
                          id="invoice-customer-select"
                          value={selectedCustomerId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedCustomerId(id);
                            const c = customers.find((x: any) => x.id === id);
                            // Keep clientName/customerId in sync with the picked customer so
                            // the human-readable name (data.client) and customer_id both persist.
                            setAiAnalysis({
                              ...aiAnalysis,
                              customerId: id,
                              ...(c ? { clientName: customerLabel(c) } : {}),
                            });
                          }}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-base sm:text-sm text-white focus:outline-none focus:border-forest-500"
                        >
                          <option value="">No customer linked (free-text only)</option>
                          {customers.map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {customerLabel(c)}
                            </option>
                          ))}
                        </select>
                        {!selectedCustomerId && (
                          <p className="text-[10px] text-amber-400/70 mt-2">
                            Link a customer so this invoice's revenue is tracked in
                            profitability &amp; job costing.
                          </p>
                        )}
                      </div>
                      
                      {aiAnalysis?.summary && (
                        <div className="pb-4 border-b border-white/5 molten-edge">
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
                            Summary
                          </span>
                          <textarea
                            value={aiAnalysis.summary}
                            onChange={(e) => setAiAnalysis({...aiAnalysis, summary: e.target.value})}
                            className="w-full text-sm text-zinc-300 bg-black/50 p-3 rounded-lg outline-none border border-white/5 focus:border-forest-500"
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
                           }} className="text-forest-400 hover:text-forest-300 flex items-center gap-1"><Plus size={14}/> Add Item</button>
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
                                    const newTotal = newItems.reduce((acc, curr) => acc + (Number(curr.rate) || 0) * (Number(curr.quantity) || 0), 0);
                                    setAiAnalysis({...aiAnalysis, items: newItems, total: newTotal});
                                 }} className="text-zinc-600 hover:text-red-400 p-1">
                                    <X size={16} />
                                 </button>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                      
                      {/* Billing summary: subtotal -> discount -> tax -> total, with due terms. */}
                      {(() => {
                        const subtotal = (aiAnalysis?.items || []).reduce((acc: number, curr: any) => acc + ((curr.rate || 0) * (curr.quantity || 0)), 0);
                        const disc = Math.min(Number(discount) || 0, subtotal);
                        const taxable = subtotal - disc;
                        const tax = taxable * ((Number(taxRate) || 0) / 100);
                        const total = taxable + tax;
                        const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        return (
                          <div className="pt-6 border-t border-white/10 space-y-2.5">
                            <div className="flex justify-between text-sm text-zinc-400"><span>Subtotal</span><span className="font-mono text-white">{money(subtotal)}</span></div>
                            <div className="flex justify-between items-center text-sm text-zinc-400">
                              <span>Discount ($)</span>
                              <input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-24 bg-zinc-900 border border-white/10 rounded-lg p-1.5 text-right text-white text-sm focus:outline-none focus:border-forest-500" />
                            </div>
                            <div className="flex justify-between items-center text-sm text-zinc-400">
                              <span>Tax (%)</span>
                              <div className="flex items-center gap-2">
                                <input type="number" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} className="w-16 bg-zinc-900 border border-white/10 rounded-lg p-1.5 text-right text-white text-sm focus:outline-none focus:border-forest-500" />
                                <span className="font-mono text-white w-24 text-right">{money(tax)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm text-zinc-400">
                              <span>Payment due in (days)</span>
                              <input type="number" value={dueDays} onChange={(e) => setDueDays(parseInt(e.target.value) || 0)} className="w-20 bg-zinc-900 border border-white/10 rounded-lg p-1.5 text-right text-white text-sm focus:outline-none focus:border-forest-500" />
                            </div>
                            <div className="flex justify-between items-end pt-2.5 border-t border-white/5">
                              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Total Due</span>
                              <span className="text-3xl font-bold text-white leading-none">{money(total)}</span>
                            </div>
                          </div>
                        );
                      })()}
                      
                      <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-4">
                           <input 
                              type="checkbox" 
                              id="autoSchedule" 
                              checked={autoSchedule} 
                              onChange={(e) => setAutoSchedule(e.target.checked)}
                              className="w-5 h-5 accent-forest-500"
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
                    onClick={() => handleCreateInvoice("estimate")}
                    className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-all"
                    title="Save as a draft estimate (status: draft)"
                  >
                    Save as Estimate
                  </button>
                  <button
                    onClick={() => handleCreateInvoice("invoice")}
                    className="px-6 py-2.5 bg-forest-500 hover:bg-forest-600 text-white rounded-lg text-sm font-medium shadow-sm transition-all"
                  >
                    Send Invoice
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record-payment (deposit / partial / full) modal */}
      <AnimatePresence>
        {paymentInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !savingPayment && setPaymentInvoice(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><DollarSign size={18} className="text-forest-400" /> Record Payment</h3>
                <button onClick={() => setPaymentInvoice(null)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
              </div>
              {(() => {
                const total = Number(paymentInvoice.amount) || 0;
                const paid = Number(paymentInvoice.amountPaid) || 0;
                const bal = Math.max(0, total - paid);
                return (
                  <p className="text-xs text-zinc-400 mb-4">
                    {paymentInvoice.client || "Client"} · Total {formatCurrency(total)}{paid > 0 ? ` · Paid ${formatCurrency(paid)} · Balance ${formatCurrency(bal)}` : ""}
                  </p>
                );
              })()}
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Amount</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 mb-4" placeholder="0.00" />
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 mb-5">
                {["cash", "check", "card", "ach", "other"].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setPaymentInvoice(null)} disabled={savingPayment} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={handleRecordPayment} disabled={savingPayment} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-colors disabled:opacity-50">
                  {savingPayment ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />} Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!pendingDeleteInvoice}
        onClose={() => setPendingDeleteInvoice(null)}
        onConfirm={() => performDeleteInvoice(pendingDeleteInvoice)}
        title="Delete invoice?"
        description={`This removes the invoice for "${pendingDeleteInvoice?.client || "this client"}"${
          pendingDeleteInvoice?.id ? ` (INV-${String(pendingDeleteInvoice.id).slice(0, 6)})` : ""
        } from your ledger. This can't be undone.`}
        confirmText="Delete"
        danger
      />

      <div className="hidden">
        {printingInvoice && (
          <PrinterFriendlyInvoice ref={printComponentRef} invoice={printingInvoice} />
        )}
      </div>
    </div>
  );
}
