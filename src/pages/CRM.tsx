// @ts-nocheck
import { fetchApi } from "../lib/api";
import { safeStorage } from '../lib/storage';
import React, { useState, useEffect, useRef } from "react";
import { auth, handleFirestoreError, OperationType, logSystemEvent } from "../lib/firebase";
import { customersRepo, knowledgeRepo, invoicesRepo } from "../lib/repos";
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  MoreVertical,
  Star,
  Filter,
  Brain,
  Sparkles,
  BookOpen,
  Clock,
  Trash2,
  X,
  Save,
  ShieldAlert,
  Zap,
  History,
  CreditCard,
  LayoutGrid,
  Eye,
  FileText,
  Send,
  MessageSquare,
  MapPin,
  Database,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
  BarChart3,
  Upload,
  Share,
  Download,
  CheckSquare,
  Folder,
  User,
  Briefcase,
  Activity,
} from "lucide-react";
import Papa from "papaparse";
import { motion, AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { ingestKnowledge, fetchRelevantMemory } from "../services/brainService";
import { z } from "zod";
import { useTenant } from "../contexts/TenantContext";
import { AutonomousCampaigns } from "../components/AutonomousCampaigns";
import { Pipeline } from "../components/Pipeline";
import { CustomerMap } from "../components/CustomerMap";
import { CRMDashboard } from "../components/CRMDashboard";
import { CRMTasks } from "../components/CRMTasks";
import { CRMDocuments } from "../components/CRMDocuments";
import { CRMJobs } from "../components/CRMJobs";
import { CRMCustomFields } from "../components/CRMCustomFields";
import { CustomerPortalCard } from "../components/CustomerPortalCard";
import { useToast } from "../contexts/ToastContext";
import { useWorkspaceOutbox } from "../contexts/WorkspaceOutboxContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { Customer, Insight } from "../types";
import { LeadVerificationPanel } from "../components/LeadVerificationPanel";
import { runAutomations } from "../lib/automations";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

// Deterministic lead score (0-100) derived from a lead's real, on-file fields.
// Stable across reloads (no Math.random) so the displayed score is meaningful.
function computeLeadScore(lead: any): number {
  if (!lead) return 0;
  let score = 0;
  const has = (v: any) =>
    v != null && String(v).trim() !== "" && String(v).trim().toLowerCase() !== "unknown";
  if (has(lead.email)) score += 20;
  if (has(lead.phone)) score += 20;
  if (has(lead.address)) score += 20;
  if (has(lead.serviceInterest) || has(lead.segment) || (Array.isArray(lead.tags) && lead.tags.length > 0))
    score += 15;
  if (has(lead.budget) || has(lead.propertySize)) score += 15;
  if (has(lead.notes)) score += 5;
  if (lead.isHOA || lead.priority) score += 5;
  return Math.min(100, score);
}

// Deterministic value in [0, n) derived from a stable entity id (simple string hash).
function stableIndexFromId(id: string | undefined, n: number): number {
  if (!id || n <= 0) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % n;
}

// Repos return camelCase columns; some UI/logic fields live in the `data`/`customFields`
// jsonb (serviceInterest, budget, leadScore) or use a different casing (isHOA vs isHoa).
// adaptCustomer flattens jsonb + fixes casing for READS (spread jsonb first so real
// columns win, then add the isHOA alias).
const adaptCustomer = (r: any) => ({
  ...(r?.data || {}),
  ...(r?.customFields || {}),
  ...r,
  isHOA: r?.isHoa ?? r?.isHOA,
});

// Map UI customer fields to columns for WRITES; tuck non-column fields into `data`.
// RLS + DB defaults handle tenant_id / created_at / updated_at, so those are dropped.
const toRow = (c: any) => ({
  firstName: c.firstName,
  lastName: c.lastName,
  companyName: c.companyName,
  email: c.email,
  phone: c.phone,
  address: c.address,
  propertySize: c.propertySize,
  status: c.status,
  segment: c.segment,
  tags: c.tags,
  notes: c.notes,
  isHoa: c.isHOA ?? c.isHoa,
  priority: c.priority,
  data: { serviceInterest: c.serviceInterest, budget: c.budget, ...(c.data || {}) },
});

// Adding a client should be a 10-second job for a contractor standing in a driveway:
// a name and a way to reach them. Email + full address are NICE to have, not required —
// they can be filled in later. Only hard requirements: a name and a phone number (email
// counts as a fallback contact method). Messages are plain English, not raw zod codes.
const NEED_NAME_AND_CONTACT = "Add a name and a phone number to save this customer.";
const customerSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => Boolean((d.firstName || "").trim() || (d.lastName || "").trim()), {
    message: NEED_NAME_AND_CONTACT,
    path: ["firstName"],
  })
  .refine((d) => Boolean((d.phone || "").trim() || (d.email || "").trim()), {
    message: NEED_NAME_AND_CONTACT,
    path: ["phone"],
  })
  .refine(
    (d) => {
      const email = (d.email || "").trim();
      return !email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    },
    {
      message: "That email doesn't look right — fix it or leave it blank.",
      path: ["email"],
    },
  );

// Safe avatar initials for ANY record. People have first/last names, but a company-only
// or HOA record may carry only a companyName (or nothing at all). Indexing into a null/
// empty name ([0]) white-screened the whole client book, so always derive from a
// guaranteed-string fallback chain and guard the character access.
const getInitials = (c: any): string => {
  const primary = String(c?.firstName || c?.companyName || c?.lastName || "?").trim();
  const secondary = c?.firstName ? String(c?.lastName || "").trim() : "";
  const initials = `${primary.charAt(0)}${secondary.charAt(0)}`.toUpperCase().trim();
  return initials || "?";
};

// Removed: generatePropertyGrowthData — it fabricated static property-value growth
// numbers (fixed base + hard-coded multipliers) that were charted as if real.

export default function CRM() {
  const { tenant, userRole } = useTenant();
  const { showToast } = useToast();
  const { addLog } = useWorkspaceOutbox();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [knowledge, setKnowledge] = useState<Record<string, any>[]>([]);
  // Pending destructive action surfaced through a single shared ConfirmDialog.
  const [confirmAction, setConfirmAction] = useState<
    { title: string; description: string; onConfirm: () => void } | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "brain" | "campaigns" | "pipeline" | "map" | "dashboard" | "tasks" | "documents">("dashboard");
  const [selectedSegment, setSelectedSegment] = useState<
    | "all"
    | "priority"
    | "enterprise"
    | "hoa"
    | "government"
    | "hospitality"
    | "legacy"
    | "luxury_retail"
  >("all");
  const [isIngesting, setIsIngesting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  // Draft (estimate) invoices for the selected customer — powers the Estimates tab.
  const [customerEstimates, setCustomerEstimates] = useState<any[]>([]);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [briefing, setBriefing] = useState<Record<string, any> | null>(null);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [customerNotes, setCustomerNotes] = useState("");
  const [propertyInsights, setPropertyInsights] = useState<Insight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proposalDraft, setProposalDraft] = useState("");
  const [isDraftingProposal, setIsDraftingProposal] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [enrichedData, setEnrichedData] = useState<Record<string, any> | null>(
    null,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    isHOA: false,
    gateCode: "",
    hoaRulesText: "",
  });

  const [lowStockAlert, setLowStockAlert] = useState<
    { id: string; name: string; currentStock: number }[]
  >([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showBulkActionMenu, setShowBulkActionMenu] = useState(false);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  // Inline "Edit Bylaws" editor on the Community Rules card (HOA only).
  const [isEditingBylaws, setIsEditingBylaws] = useState(false);
  const [bylawsForm, setBylawsForm] = useState({
    isHOA: false,
    hoaRulesText: "",
    gateCode: "",
  });
  const [isSavingBylaws, setIsSavingBylaws] = useState(false);

  const [customerViewTab, setCustomerViewTab] = useState<"overview" | "sms" | "tasks" | "documents" | "estimates" | "jobs">("overview");
  
  const [smsMessage, setSmsMessage] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsHistory, setSmsHistory] = useState<any[]>([]);

  const addModalRef = useFocusTrap<HTMLDivElement>(showAddModal);
  const lowStockModalRef = useFocusTrap<HTMLDivElement>(showLowStockModal);
  const detailModalRef = useFocusTrap<HTMLDivElement>(!!selectedCustomer);

  const enrichData = async (customer: Customer) => {
    if (customer.semanticEnrichment) {
      setEnrichedData(customer.semanticEnrichment);
      return;
    }
    setIsEnriching(true);
    try {
      const res = await fetchApi("/api/crm/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer }),
      });
      if (!res.ok) throw new Error(`Data Enrichment Failed: ${res.statusText}`);
      const data = await res.json();
      setEnrichedData(data);
      if (customer.id) {
        await customersRepo.update(customer.id, {
          data: { ...(customer.data || {}), semanticEnrichment: data },
        });
      }
    } catch (err) {
      console.error(err);
      logSystemEvent("ENRICHMENT_ERROR", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsEnriching(false);
    }
  };

  const analyzeProperty = async (customer: Customer) => {
    if (customer.semanticInsights) {
      setPropertyInsights(customer.semanticInsights);
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetchApi("/api/crm/analyze-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer }),
      });
      if (!res.ok) throw new Error(`Property Analysis failed: ${res.status}`);
      const data = await res.json();
      setPropertyInsights(data);
      if (customer.id) {
        await customersRepo.update(customer.id, {
          data: { ...(customer.data || {}), semanticInsights: data },
        });
      }
    } catch (err) {
      console.error(err);
      logSystemEvent("ANALYSIS_ERROR", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedClients.length === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredCustomers.map(c => c.id as string));
    }
  };

  const handleToggleSelectClient = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedClients.includes(clientId)) {
      setSelectedClients(selectedClients.filter(id => id !== clientId));
    } else {
      setSelectedClients([...selectedClients, clientId]);
    }
  };

  const handleBulkDelete = () => {
    if (!tenant) return;
    if (selectedClients.length === 0) return;
    setConfirmAction({
      title: `Delete ${selectedClients.length} clients?`,
      description: `This will permanently remove ${selectedClients.length} selected clients and cannot be undone.`,
      onConfirm: performBulkDelete,
    });
  };

  const performBulkDelete = async () => {
    if (!tenant) return;
    if (selectedClients.length === 0) return;
    setIsSaving(true);
    try {
      // In a real app we might batch this
      for (const id of selectedClients) {
        await customersRepo.remove(id);
      }
      showToast(`${selectedClients.length} clients deleted successfully`, "success");
      setSelectedClients([]);
      setShowBulkActionMenu(false);
    } catch (error) {
      console.error("Error bulk deleting clients:", error);
      showToast("Failed to delete clients", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkTag = async () => {
    if (!tenant || !bulkTagInput) return;
    if (selectedClients.length === 0) return;
    
    setIsSaving(true);
    try {
      const tagList = bulkTagInput.split(',').map(t => t.trim()).filter(Boolean);
      for (const id of selectedClients) {
        const client = customers.find(c => c.id === id);
        if (client) {
          const currentTags = client.tags || [];
          const newTags = Array.from(new Set([...currentTags, ...tagList]));
          await customersRepo.update(id, { tags: newTags });
        }
      }
      showToast(`${selectedClients.length} clients tagged successfully`, "success");
      setShowBulkTagModal(false);
      setBulkTagInput("");
      setSelectedClients([]);
      setShowBulkActionMenu(false);
    } catch (error) {
      console.error("Error bulk tagging clients:", error);
      showToast("Failed to tag clients", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const draftProposal = async (suggestion: string) => {
    setIsDraftingProposal(true);
    try {
      // Check for low inventory related to the suggestion
      // We look for keywords like 'mulch', 'rock', 'pine straw' to trigger relevant checks
      const materialsToCheck = [];
      if (suggestion.toLowerCase().includes("mulch"))
        materialsToCheck.push("Mulch");
      if (suggestion.toLowerCase().includes("rock"))
        materialsToCheck.push("River Rock");
      if (suggestion.toLowerCase().includes("pine straw"))
        materialsToCheck.push("Pine Straw");
      if (
        suggestion.toLowerCase().includes("holly") ||
        suggestion.toLowerCase().includes("azalea")
      )
        materialsToCheck.push("Shrubs");

      if (materialsToCheck.length > 0) {
        const checkRes = await fetchApi("/api/inventory/check-and-alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: materialsToCheck }),
        });
        const checkData = await checkRes.json();
        if (checkData.lowStockItems?.length > 0) {
          setLowStockAlert(checkData.lowStockItems);
          setShowLowStockModal(true);
        }
      }

      const res = await fetchApi("/api/crm/draft-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: selectedCustomer, suggestion }),
      });
      if (!res.ok) throw new Error(`Drafting failed: ${res.status}`);
      const data = await res.json();
      setProposalDraft(data.text);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDraftingProposal(false);
    }
  };

  const [isSyncingKeep, setIsSyncingKeep] = useState(false);

  const handleSaveToKeep = async () => {
    showToast("Google Calendar/Gmail sync is temporarily unavailable.", "info");
    return;
  };

  const [isFetchingEmails, setIsFetchingEmails] = useState(false);
  const [clientEmails, setClientEmails] = useState<any[]>([]);

  const handleFetchEmails = async () => {
    showToast("Google Calendar/Gmail sync is temporarily unavailable.", "info");
    return;
  };

  const handleDeleteSelectedCustomer = () => {
    if (!selectedCustomer?.id) return;
    setConfirmAction({
      title: `Delete ${selectedCustomer.firstName} ${selectedCustomer.lastName}?`,
      description: "This will permanently remove this client and cannot be undone.",
      onConfirm: performDeleteSelectedCustomer,
    });
  };

  const performDeleteSelectedCustomer = async () => {
    if (!selectedCustomer?.id) return;
    try {
      await customersRepo.remove(selectedCustomer.id);
      showToast("Client deleted successfully", "success");
      setSelectedCustomer(null);
    } catch (error) {
      console.error("Error deleting customer:", error);
      showToast("Failed to delete client", "error");
    }
  };

  const handleSendSms = async () => {
    if (!selectedCustomer?.phone || !smsMessage.trim()) {
      showToast("Please enter a message and ensure the client has a phone number.", "error");
      return;
    }
    
    setIsSendingSms(true);
    try {
      const res = await fetchApi("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedCustomer.phone,
          message: smsMessage
        })
      });
      
      if (!res.ok) throw new Error("Failed to send SMS");
      const data = await res.json().catch(() => ({}));

      // Honesty policy: the server tells us whether it actually sent via Twilio or
      // just simulated (Twilio not configured). Don't claim a secure send when it
      // was only simulated — mirror the client portal / Inbox branching.
      const wasSimulated = data?.simulated === true || data?.mock === true;
      if (wasSimulated) {
        showToast("Saved — SMS isn't configured yet (not actually sent).", "info");
      } else {
        showToast("SMS sent securely via Twilio.", "success");
      }
      setSmsMessage("");

      // Update local history for preview
      setSmsHistory(prev => [{
        id: Date.now().toString(),
        body: smsMessage,
        date: new Date().toISOString(),
        direction: "outbound"
      }, ...prev]);

      // Also log it
      await logSystemEvent(wasSimulated ? "TWILIO_SMS_SIMULATED" : "TWILIO_SMS_SENT", { customerId: selectedCustomer.id });
    } catch (err: any) {
      console.error(err);
      showToast("Failed to send SMS.", "error");
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleUpdateCustomerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomer?.id) return;
    setIsSaving(true);
    setFormErrors({});
    
    try {
      const validated = customerSchema.safeParse({
        firstName: editCustomer.firstName,
        lastName: editCustomer.lastName,
        email: editCustomer.email || "",
        phone: editCustomer.phone || "",
        address: editCustomer.address || "",
        notes: editCustomer.notes || "",
      });
      
      if (!validated.success) {
        const errors: Record<string, string> = {};
        validated.error.issues.forEach(err => {
          errors[err.path[0] as string] = err.message;
        });
        setFormErrors(errors);
        return;
      }
      
      // Merge HOA fields into the existing `data` jsonb so we never clobber other keys.
      const existingData = (editCustomer as any).data || {};
      const hoaRules = (editCustomer.hoaRulesText ?? "")
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean);

      await customersRepo.update(editCustomer.id, {
        firstName: validated.data.firstName,
        lastName: validated.data.lastName,
        email: validated.data.email,
        phone: validated.data.phone,
        address: validated.data.address,
        notes: validated.data.notes,
        // snake_case real boolean column (camelCase isHOA would be mangled by the repo).
        is_hoa: !!editCustomer.isHOA,
        data: {
          ...existingData,
          hoaRules,
          gateCode: editCustomer.gateCode ?? "",
        },
      });

      showToast("Client profile updated securely.", "success");
      setShowEditModal(false);
      setSelectedCustomer({
        ...selectedCustomer,
        ...validated.data,
        isHOA: !!editCustomer.isHOA,
        gateCode: editCustomer.gateCode ?? "",
        hoaRules,
      } as Customer);
    } catch (err: any) {
      console.error(err);
      setFormErrors({ _form: "Failed to update profile due to an unexpected error." });
    } finally {
      setIsSaving(false);
    }
  };

  // Open the inline "Edit Bylaws" editor on the Community Rules card, seeded from the
  // currently-selected customer's HOA data.
  const openBylawsEditor = () => {
    if (!selectedCustomer) return;
    setBylawsForm({
      isHOA: !!selectedCustomer.isHOA,
      hoaRulesText: (selectedCustomer.hoaRules || []).join("\n"),
      gateCode: (selectedCustomer as any).gateCode ?? "",
    });
    setIsEditingBylaws(true);
  };

  // Persist HOA bylaws / gate code. HOA fields live in customers.data jsonb; is_hoa is a
  // real boolean column. We merge into the existing data so other keys survive.
  const handleSaveBylaws = async () => {
    if (!selectedCustomer?.id) return;
    setIsSavingBylaws(true);
    try {
      const existingData = (selectedCustomer as any).data || {};
      const hoaRules = bylawsForm.hoaRulesText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      await customersRepo.update(selectedCustomer.id, {
        is_hoa: !!bylawsForm.isHOA,
        data: {
          ...existingData,
          hoaRules,
          gateCode: bylawsForm.gateCode,
        },
      });

      // Reflect the saved values immediately (the repo subscription also refreshes the list).
      setSelectedCustomer({
        ...selectedCustomer,
        isHOA: !!bylawsForm.isHOA,
        gateCode: bylawsForm.gateCode,
        hoaRules,
      } as Customer);
      setIsEditingBylaws(false);
      showToast("Community rules updated.", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to update community rules.", "error");
    } finally {
      setIsSavingBylaws(false);
    }
  };

  useEffect(() => {
    // Only attempt Firestore connection if we have a real Firebase auth session
    // This prevents "Permission Denied" errors if Anonymous Auth is disabled in console

    // Supabase repos scope to the caller's tenant via RLS; subscribe() fires immediately
    // and on realtime changes, returning an unsubscribe fn (the onSnapshot equivalent).
    const unsubCust = customersRepo.subscribe((rows) => {
      setCustomers((rows || []).map(adaptCustomer));
      setLoaded(true);
    });

    const unsubKnow = knowledgeRepo.subscribe((rows) => {
      setKnowledge(rows || []);
    });

    return () => {
      unsubCust();
      unsubKnow();
    };
  }, []);

  // Load the selected customer's open estimates (draft invoices) for the Estimates tab.
  useEffect(() => {
    let alive = true;
    if (!selectedCustomer?.id) {
      setCustomerEstimates([]);
      return;
    }
    setLoadingEstimates(true);
    const cid = selectedCustomer.id;
    const fullName = `${selectedCustomer.firstName || ""} ${selectedCustomer.lastName || ""}`.trim().toLowerCase();
    invoicesRepo
      .list()
      .then((rows: any[]) => {
        if (!alive) return;
        const estimates = (rows || []).filter((inv: any) => {
          const isDraft = (inv.status || "").toLowerCase() === "draft" && !inv.isArchived;
          if (!isDraft) return false;
          // Primary link: customer_id; fall back to client-name match for older rows.
          if (inv.customerId) return inv.customerId === cid;
          return fullName && (inv.client || "").toLowerCase().trim() === fullName;
        });
        setCustomerEstimates(estimates);
      })
      .catch(() => alive && setCustomerEstimates([]))
      .finally(() => alive && setLoadingEstimates(false));
    return () => {
      alive = false;
    };
  }, [selectedCustomer?.id]);

  useEffect(() => {
    // Post-execution notification from the voice/text agent (see LiveEar). The
    // action already ran through executeAgentAction — the lead was created, the
    // note was saved. We only REFLECT it here by selecting the affected customer
    // so the owner watches the change land. No writes, no create modal (either
    // would double-write / double-create the record the agent just made).
    const handleVoiceAction = (e: CustomEvent) => {
      const { name, args } = (e.detail || {}) as { name?: string; args?: any };
      const clientName = String(args?.clientName || "").toLowerCase();
      if (!clientName) return;

      if (
        name === "load_client_data" ||
        name === "schedule_job" ||
        name === "create_invoice" ||
        name === "add_client_note"
      ) {
        const found = customers.find(
          (c) =>
            `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().includes(clientName) ||
            c.firstName?.toLowerCase().includes(clientName) ||
            c.lastName?.toLowerCase().includes(clientName),
        );
        if (found) handleSelectCustomer(found);
      }
    };

    window.addEventListener("cutty-action", handleVoiceAction as EventListener);
    return () =>
      window.removeEventListener(
        "cutty-action",
        handleVoiceAction as EventListener,
      );
  }, [customers]);

  const handleUpdateNotes = async (id: string, notes: string) => {
    setIsSavingNotes(true);
    try {
      await customersRepo.update(id, { notes });
      await logSystemEvent("CUSTOMER_NOTES_UPDATED", { customerId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customers/${id}`);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSendMagicLink = async (customer: Customer) => {
    try {
      // Generate magic link first via our API
      const res = await fetchApi('/api/auth/magic-link/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: customer.id, email: customer.email })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to generate link');

      await customersRepo.update(customer.id, {
        data: {
          ...(customer.data || {}),
          magicLinkSentAt: new Date().toISOString(),
          magicLinkSentCount: (customer.magicLinkSentCount || 0) + 1,
        },
      });
      setCustomers(
        customers.map((c) =>
          c.id === customer.id
            ? { ...c, magicLinkSentAt: new Date().toISOString(), magicLinkSentCount: (c.magicLinkSentCount || 0) + 1 }
            : c
        )
      );
      if (selectedCustomer?.id === customer.id) {
        setSelectedCustomer({
          ...customer,
          magicLinkSentAt: new Date().toISOString(),
          magicLinkSentCount: (customer.magicLinkSentCount || 0) + 1,
        });
      }
      
      // In a real application, the backend would email this link.
      // For this demo, we expose it so the user can copy it.
      addLog({ type: "magic-link", recipient: "Client", subject: "Secure Magic Link", content: data.magicLink });
      
    } catch (err) {
      console.error("Error sending magic link:", err);
      addLog({ type: "magic-link", recipient: "Client", subject: "Secure Magic Link", content: "Failed to generate" }, "failed");
    }
  };

  const generateBriefing = async (customer: Customer) => {
    if (customer.semanticBriefing) {
      setBriefing(customer.semanticBriefing);
      return;
    }
    setIsGeneratingBriefing(true);
    try {
      const memory = await fetchRelevantMemory(
        customer.firstName + " " + customer.lastName,
      );
      const res = await fetchApi("/api/crm/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          interactions: [], // In real app, fetch these
          memory,
        }),
      });
      const data = await res.json();
      setBriefing(data);

      // Store the score and reasoning in Firestore for analytics/persistence
      if (customer.id) {
        await customersRepo.update(customer.id, {
          aiScore: data.aiScore,
          aiScoreLabel: data.aiScoreLabel,
          aiScoreReasoning: data.aiScoreReasoning,
          data: { ...(customer.data || {}), semanticBriefing: data },
        });
        await logSystemEvent("AI_BRIEFER_SCORE_UPDATED", {
          customerId: customer.id,
          score: data.aiScore,
        });
      }
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `customers/${customer.id}/briefing`,
      );
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerNotes(customer.notes || "");
    setBriefing(null);
    setPropertyInsights([]);
    setProposalDraft("");
    setEnrichedData(null);
    generateBriefing(customer);

    logSystemEvent("CUSTOMER_PROFILE_VIEWED", {
      customerId: customer.id,
    }).catch(() => {});
  };

  // NOTE: this used to seed a fabricated "Mrs. Gable" note into the tenant's real
  // knowledge base, which polluted a paying user's data. Knowledge is now captured
  // for real via the AI assistant / dictation (which call ingestKnowledge with the
  // user's own content), so the empty state just guides them there instead of injecting
  // sample data.

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormErrors({});

    try {
      const validated = customerSchema.safeParse(newCustomer);
      if (!validated.success) {
        const errors: Record<string, string> = {};
        validated.error.issues.forEach((err) => {
          errors[err.path[0] as string] = err.message;
        });
        setFormErrors(errors);
        setIsSaving(false);
        return;
      }

      // HOA fields aren't part of customerSchema, so pull them straight from the form.
      // toRow writes isHOA -> isHoa column and merges anything in `data` into the jsonb.
      const newHoaRules = (newCustomer.hoaRulesText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      // Deterministic lead score from the new client's real fields (same as CSV import).
      // Segment filters / AI-rating badges key off aiScore, so set it on create.
      const aiScore = computeLeadScore({
        ...validated.data,
        isHOA: !!newCustomer.isHOA,
      });

      const addPromise = customersRepo
        .create({
          ...toRow({
            ...validated.data,
            status: "lead",
            isHOA: !!newCustomer.isHOA,
            data: {
              hoaRules: newHoaRules,
              gateCode: newCustomer.gateCode || "",
            },
          }),
          aiScore,
          aiScoreLabel: "Evaluating",
        })
        .then(async (row) => {
          await logSystemEvent("CUSTOMER_CREATED", {
            customerId: row?.id,
            name: `${newCustomer.firstName} ${newCustomer.lastName}`,
            tenantId: tenant?.id,
          });
          return row;
        });

      const createdRow: any = await Promise.race([
        addPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Network timeout saving client")), 8000))
      ]);

      // Fire the automation engine for the "new client created" trigger. Fire-and-forget:
      // it must never block or break the UI flow.
      runAutomations("client_created", {
        clientName: `${validated.data.firstName} ${validated.data.lastName}`.trim(),
        customerId: createdRow?.id,
      }).catch(() => {});

      setShowAddModal(false);
      setNewCustomer({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
        isHOA: false,
        gateCode: "",
        hoaRulesText: "",
      });
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, "customers");
      setFormErrors({ _form: err.message || "Failed to add client due to an unexpected error." });
    } finally {
      setIsSaving(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (userRole !== "admin" && userRole !== "owner") {
      showToast("Only admins or owners can import CSV data.", "error");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const imports = results.data.map((row: any) => {
            const record = {
              firstName: row.firstName || row.first_name || row["First Name"] || "Unknown",
              lastName: row.lastName || row.last_name || row["Last Name"] || "Unknown",
              email: row.email || row.Email || "",
              phone: row.phone || row.Phone || "",
              address: row.address || row.Address || "",
              notes: row.notes || row.Notes || "",
              status: "imported",
              tenantId: tenant?.id || "genesis-1",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            // Deterministic score from the lead's real fields (stable across reloads).
            return {
              ...record,
              aiScore: computeLeadScore(record),
              aiScoreLabel: "Evaluating",
            };
          });

          for (const item of imports) {
            await customersRepo.create({
              ...toRow(item),
              aiScore: item.aiScore,
              aiScoreLabel: item.aiScoreLabel,
            });
          }

          showToast(`Successfully imported ${imports.length} past customers`, "success");
          await logSystemEvent("CSV_CUSTOMERS_IMPORTED", { count: imports.length });
        } catch (error) {
          console.error("Import error:", error);
          showToast("Failed to import customers", "error");
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        console.error("Parse error:", error);
        showToast("Failed to parse CSV file", "error");
        setIsImporting(false);
      }
    });
  };

  const handleGoogleContactsImport = async () => {
    showToast("Google Calendar/Gmail sync is temporarily unavailable.", "info");
    return;
  };

  const pendingLeads = customers.filter((c) => c.status === "PENDING_VERIFICATION");
  const verifiedCustomers = customers.filter((c) => c.status !== "PENDING_VERIFICATION");

  const filteredCustomers = verifiedCustomers.filter((c) => {
    const matchesSearch =
      `${c.firstName} ${c.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address?.toLowerCase().includes(searchTerm.toLowerCase());

    if (selectedSegment === "all") return matchesSearch;
    if (selectedSegment === "enterprise")
      return matchesSearch && c.segment === "enterprise";
    if (selectedSegment === "legacy")
      return matchesSearch && c.segment === "legacy";
    if (selectedSegment === "priority") return matchesSearch && c.priority;
    if (selectedSegment === "hoa") return matchesSearch && c.isHOA;
    if (selectedSegment === "government")
      return matchesSearch && c.segment === "government";
    if (selectedSegment === "hospitality")
      return matchesSearch && c.segment === "hospitality";
    if (selectedSegment === "luxury_retail")
      return matchesSearch && c.segment === "luxury_retail";
    return matchesSearch;
  });

  const filteredKnowledge = knowledge.filter(
    (k) =>
      !k.isArchived &&
      (k.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (k.tags &&
        k.tags.some((t: string) =>
          t.toLowerCase().includes(searchTerm.toLowerCase()),
        )))
  );

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 min-h-[1000px] flex flex-col">
        {tenant?.settings?.features?.cockpit_buttons && (
          <div className="mb-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => setShowAddModal(true)} className="flex flex-col items-center justify-center gap-2 p-6 bg-forest-500/10 border border-forest-500/20 rounded-[20px] text-forest-400 hover:bg-forest-500/20 transition-all group shadow-sm">
              <UserPlus size={24} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm">Add Client</span>
            </button>
            <button onClick={handleGoogleContactsImport} className="flex flex-col items-center justify-center gap-2 p-6 bg-celtic-500/10 border border-celtic-500/20 rounded-[20px] text-celtic-400 hover:bg-celtic-500/20 transition-all group shadow-sm">
              <Users size={24} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm">Sync Workspace</span>
            </button>
            <button onClick={() => { if(fileInputRef.current) fileInputRef.current.click() }} className="flex flex-col items-center justify-center gap-2 p-6 bg-ember-500/10 border border-ember-500/20 rounded-[20px] text-ember-400 hover:bg-ember-500/20 transition-all group shadow-sm">
              <Upload size={24} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm">Import CSV</span>
            </button>
            <div className="flex flex-col items-center justify-center gap-2 p-6 bg-zinc-900 border border-white/5 molten-edge rounded-[20px] text-zinc-400 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
               <Zap size={24} className="text-yellow-400 animate-pulse" />
               <span className="font-bold text-sm text-yellow-400/80">Easy Mode Active</span>
            </div>
          </div>
        )}
        <header
          id="client-header"
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-8 mb-10 pb-8 border-b-4 border-white/10 relative z-10"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-celtic-500/10 rounded-full border border-celtic-500 text-xs font-black uppercase tracking-widest text-celtic-500">
              <Users size={16} />
              Customer Ops
            </div>
            <h1 className="text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
              Clients
            </h1>
            <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
              Customer Directory
            </p>
          </div>
          <div className="flex items-center gap-6 flex-1 max-w-xl mx-0 md:mx-6 shrink-0 mt-6 md:mt-0">
            <div className="relative w-full group">
              <label htmlFor="crm-search" className="sr-only">
                Search clients, notes, or vectors
              </label>
              <Search
                className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-forest-400 transition-colors"
                size={24}
                aria-hidden="true"
              />
              <input
                id="crm-search"
                type="text"
                placeholder="Search registries..."
                className="w-full min-w-0 pl-16 pr-8 py-5 bg-black border border-white/5 rounded-3xl text-xl uppercase font-black tracking-widest focus:bg-zinc-900 focus:border-forest-500/50 focus:outline-none placeholder:text-zinc-600 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <div
              id="registry-tabs"
              className="bg-black rounded-2xl p-2 border border-white/5 flex shadow-inner overflow-x-auto max-w-full" role="tablist"
              aria-label="Client Registry Tabs"
            >
              <button
                id="registry-tab"
                role="tab"
                aria-selected={activeTab === "logs"}
                onClick={() => setActiveTab("logs")}
                className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform flex items-center gap-3 border-4 ${activeTab === "logs" ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                <Users size={20} aria-hidden="true" />
                Registry
              </button>
              <button
                id="dashboard-tab"
                role="tab"
                aria-selected={activeTab === "dashboard"}
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform flex items-center gap-3 border-4 ${activeTab === "dashboard" ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                <Activity size={20} aria-hidden="true" />
                Dashboard
              </button>
              <button
                id="tasks-tab"
                role="tab"
                aria-selected={activeTab === "tasks"}
                onClick={() => setActiveTab("tasks")}
                className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform flex items-center gap-3 border-4 ${activeTab === "tasks" ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                <CheckSquare size={20} aria-hidden="true" />
                Tasks
              </button>
              <button
                id="documents-tab"
                role="tab"
                aria-selected={activeTab === "documents"}
                onClick={() => setActiveTab("documents")}
                className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform flex items-center gap-3 border-4 ${activeTab === "documents" ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                <FileText size={20} aria-hidden="true" />
                Documents
              </button>
              <button
                id="pipeline-tab"
                role="tab"
                aria-selected={activeTab === "pipeline"}
                onClick={() => setActiveTab("pipeline")}
                className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform flex items-center gap-3 border-4 ${activeTab === "pipeline" ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                <LayoutGrid size={20} aria-hidden="true" />
                Pipeline
              </button>
              <button
                id="map-tab"
                role="tab"
                aria-selected={activeTab === "map"}
                onClick={() => setActiveTab("map")}
                className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform flex items-center gap-3 border-4 ${activeTab === "map" ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                <MapPin size={20} aria-hidden="true" />
                Map
              </button>
              <button
                id="saved-notes-tab"
                role="tab"
                aria-selected={activeTab === "brain"}
                onClick={() => setActiveTab("brain")}
                className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform flex items-center gap-3 border-4 ${activeTab === "brain" ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                <BookOpen size={20} aria-hidden="true" />
                Notes
              </button>
              <button
                id="campaigns-tab"
                role="tab"
                aria-selected={activeTab === "campaigns"}
                onClick={() => setActiveTab("campaigns")}
                className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform flex items-center gap-3 border-4 ${activeTab === "campaigns" ? "bg-forest-500 text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-forest-500/60 hover:text-forest-500 hover:bg-forest-500/5"}`}
              >
                <Mail size={20} aria-hidden="true" />
                Campaigns
              </button>
            </div>
          </div>
        </header>

        {(userRole === "admin" || userRole === "owner") && pendingLeads.length > 0 && activeTab === "logs" && (
          <LeadVerificationPanel leads={pendingLeads} />
        )}

        <div className="structural-border bg-black/20 flex-1 flex flex-col min-h-[800px] overflow-hidden rounded-2xl">
          {activeTab === "campaigns" ? (
             <AutonomousCampaigns customers={customers} />
          ) : activeTab === "dashboard" ? (
             <CRMDashboard customers={customers} />
          ) : activeTab === "tasks" ? (
             <CRMTasks customers={customers} />
          ) : activeTab === "documents" ? (
             <CRMDocuments customers={customers} />
          ) : activeTab === "pipeline" ? (
             <Pipeline customers={filteredCustomers} onSelectCustomer={setSelectedCustomer} />
          ) : activeTab === "map" ? (
             <CustomerMap customers={filteredCustomers} onSelectCustomer={setSelectedCustomer} />
          ) : activeTab === "logs" ? (
            <>
              <div className="px-8 py-6 border-b flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-zinc-900">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="relative group w-full md:min-w-[300px]">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-forest-400 transition-colors"
                      aria-hidden="true"
                    />
                    <label htmlFor="crm-search-input" className="sr-only">
                      Search clients
                    </label>
                    <input
                      id="crm-search-input"
                      type="text"
                      placeholder="Search clients hub..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-6 py-3 bg-white/5 border border-white/5 rounded-2xl text-sm font-bold focus:bg-white/10 focus:border-forest-500/30 focus:outline-none placeholder:text-zinc-600 transition-all"
                    />
                  </div>
                  <div className="h-6 w-px bg-white/5 hidden md:block" />
                  <div
                    className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar"
                    role="tablist"
                    aria-label="Customer segments"
                  >
                    {(
                      [
                        "all",
                        "priority",
                        "enterprise",
                        "hoa",
                        "government",
                        "hospitality",
                        "legacy",
                        "luxury_retail",
                      ] as const
                    ).map((seg) => (
                      <button
                        key={seg}
                        role="tab"
                        aria-selected={selectedSegment === seg}
                        onClick={() => setSelectedSegment(seg)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedSegment === seg ? "bg-forest-500 text-black shadow-glow" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
                      >
                        {seg.replace("_", " ").replace("hoa", "HOA")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-zinc-300">
                    {filteredCustomers.length} Active Customers
                  </span>
                  <button
                    onClick={handleGoogleContactsImport}
                    disabled={isImporting}
                    className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/5 text-forest-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white/10 hover:border-forest-500/30 transition-all shadow-lg hidden md:flex disabled:opacity-50"
                  >
                    <UserPlus size={16} />
                    {isImporting ? "Syncing Workspace..." : "Workspace Sync"}
                  </button>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleCSVUpload}
                    id="csv-upload"
                  />
                  <button
                    id="add-client-button"
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-3 px-6 py-4 bg-forest-600 text-white rounded-xl font-bold text-sm tracking-wide hover:bg-forest-500 transition-all shadow-lg"
                  >
                    <UserPlus size={18} />
                    New Client
                  </button>
                  {(userRole === "admin" || userRole === "owner") && (
                    <>
                      <label
                        htmlFor="csv-upload"
                        className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/5 text-white rounded-xl font-bold text-sm tracking-wide hover:bg-white/10 transition-all cursor-pointer"
                      >
                        <Upload size={18} />
                        {isImporting ? "Importing..." : "Import"}
                      </label>
                      <button
                        onClick={() => {
                            const csvContent = "data:text/csv;charset=utf-8," 
                                + "First Name,Last Name,Email,Phone,Address,Notes\n"
                                + customers.map((c: any) => `${c.firstName || ''},${c.lastName || ''},${c.email || ''},${c.phone || ''},"${c.address || ''}","${c.notes || ''}"`).join("\n");
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", "cutty_clients_export.csv");
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/5 text-white rounded-xl font-bold text-sm tracking-wide hover:bg-white/10 transition-all shadow-lg"
                      >
                        <Download size={18} />
                        Export
                      </button>
                    </>
                  )}
                </div>
              </div>

              {selectedClients.length > 0 && (
                <div className="bg-forest-500/10 border-y border-forest-500/20 px-10 py-3 flex items-center justify-between z-10 transition-all">
                  <div className="text-xs font-bold text-forest-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-forest-500 animate-pulse border-forest-500" />
                    {selectedClients.length} clients selected
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowBulkTagModal(true)}
                      className="px-4 py-2 bg-black/40 hover:bg-black/60 border border-white/10 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest transition-all"
                    >
                      Add Tag
                    </button>
                    {(userRole === "admin" || userRole === "owner") && (
                      <button
                        onClick={handleBulkDelete}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[10px] font-bold text-red-400 uppercase tracking-widest transition-all flex items-center gap-2"
                      >
                        <Trash2 size={12} />
                        Delete Selected
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar relative max-w-[100vw]">
                <table id="client-registry-table" className="block sm:table w-full whitespace-nowrap min-w-[800px]">
                  <thead className="sticky top-0 bg-black/90 z-20 border-b border-white/10">
                    <tr className="text-left bg-zinc-950/50">
                      <th className="sticky left-0 bg-zinc-950/90 shadow-[4px_0_12px_rgba(0,0,0,0.5)] z-30 pl-8 pr-6 py-5 text-sm font-bold tracking-wider uppercase text-zinc-300">
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedClients.length === filteredCustomers.length && filteredCustomers.length > 0}
                            onChange={handleToggleSelectAll}
                            className="w-4 h-4 rounded border-white/20 bg-black/50 text-forest-500 focus:ring-forest-500/20 focus:ring-offset-0 cursor-pointer"
                          />
                          <span>Name & Contact</span>
                        </div>
                      </th>
                      <th className="px-6 py-5 text-sm font-bold tracking-wider uppercase text-zinc-300 text-center">
                        AI Rating
                      </th>
                      <th className="px-6 py-5 text-sm font-bold tracking-wider uppercase text-zinc-300 text-center">
                        Status
                      </th>
                      <th className="pr-10 py-5 text-sm font-bold tracking-wider uppercase text-zinc-300 text-right">
                        Settings
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/20">
                    {!loaded ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={`sk-${i}`}>
                          <td className="sticky left-0 bg-[#121214] z-10 pl-8 pr-6 py-8 border-r border-white/5">
                            <div className="flex items-center gap-4">
                              <Skeleton className="w-4 h-4 shrink-0" />
                              <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-8">
                            <div className="flex justify-center">
                              <Skeleton className="w-14 h-14 rounded-full" />
                            </div>
                          </td>
                          <td className="px-6 py-8">
                            <div className="flex justify-center">
                              <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                          </td>
                          <td className="pr-10 py-8">
                            <div className="flex justify-end">
                              <Skeleton className="w-12 h-12 rounded-xl" />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : verifiedCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8">
                          <EmptyState
                            icon={Users}
                            title="No clients yet"
                            description="Add your first client to start managing jobs, invoices, and notes."
                            action={{ label: "Add Client", onClick: () => setShowAddModal(true) }}
                          />
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((client) => (
                      <tr
                        key={client.id}
                        className="hover:bg-zinc-900 transition-all group cursor-pointer border-l-4 border-transparent hover:border-forest-500"
                        onClick={() => handleSelectCustomer(client)}
                      >
                        <td className="sticky left-0 bg-[#121214] group-hover:bg-[#18181b] z-10 pl-8 pr-6 py-8 border-r border-white/5 shadow-[4px_0_12px_rgba(0,0,0,0.2)]">
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={!!client.id && selectedClients.includes(client.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleToggleSelectClient(client.id as string, e as any)}
                              className="w-4 h-4 rounded border-white/20 bg-black/50 text-forest-500 focus:ring-forest-500/20 focus:ring-offset-0 cursor-pointer shrink-0"
                            />
                            <div className="flex items-center gap-5 min-w-0">
                              <div
                                className="w-14 h-14 bg-zinc-900 border border-white/5 molten-edge rounded-2xl flex items-center justify-center text-zinc-400 font-black text-xl group-hover:bg-forest-500 group-hover:text-black transition-all duration-500 shadow-2xl shrink-0"
                                aria-hidden="true"
                              >
                                {getInitials(client)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xl font-black italic tracking-normal md:tracking-tighter flex items-center gap-3 lowercase mb-1 leading-none truncate">
                                  {client.firstName} {client.lastName}
                                  {client.priority && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-forest-500 shadow-[0_0_10px_#10b981]" />
                                  )}
                                </div>
                                <div className="text-xs md:text-[10px] text-zinc-600 font-black uppercase tracking-widest leading-none">
                                  {client.phone}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-8">
                          <div className="flex flex-col items-center group/score">
                            <div className="relative w-14 h-14 flex items-center justify-center">
                              <svg className="w-full h-full -rotate-90">
                                <circle
                                  cx="28"
                                  cy="28"
                                  r="26"
                                  fill="none"
                                  stroke="rgba(255,255,255,0.05)"
                                  strokeWidth="3"
                                />
                                <circle
                                  cx="28"
                                  cy="28"
                                  r="26"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  strokeDasharray={163.3}
                                  strokeDashoffset={
                                    163.3 -
                                    (163.3 * (client.aiScore || 0)) / 100
                                  }
                                  strokeLinecap="round"
                                  className={`${
                                    client.aiScore > 80
                                      ? "text-forest-500"
                                      : client.aiScore > 50
                                        ? "text-celtic-500"
                                        : "text-zinc-500"
                                  } transition-all duration-1000 shadow-glow`}
                                />
                              </svg>
                              <span className="absolute text-[12px] font-black italic">
                                {client.aiScore || "--"}
                              </span>
                            </div>
                            <span
                              className={`text-[8px] font-black uppercase tracking-widest mt-3 px-2 py-0.5 rounded-full border border-white/5 ${
                                client.aiScoreLabel === "Growth Potential"
                                  ? "text-forest-400 bg-forest-500/5"
                                  : client.aiScoreLabel === "High Promise"
                                    ? "text-celtic-400 bg-celtic-500/5"
                                    : "text-white/20"
                              }`}
                            >
                              {client.aiScoreLabel || "Evaluating"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-8">
                          <div className="flex flex-col items-center">
                            <span className="text-xs md:text-[10px] font-black text-zinc-400 uppercase tracking-normal md:tracking-tighter px-3 py-1 rounded-full border border-white/5 bg-zinc-900 inline-block">
                              {client.status}
                            </span>
                          </div>
                        </td>
                        <td className="pr-10 py-8 text-right">
                          <div className="flex justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSelectCustomer(client); }}
                              className="w-12 h-12 bg-white/5 border border-white/5 rounded-xl text-zinc-600 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                              aria-label="Open customer"
                              title="Open customer"
                            >
                              <MoreVertical size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-zinc-900">
              <div className="px-6 sm:px-10 py-6 border-b border-white/10 flex items-center justify-between bg-zinc-900">
                <div className="flex items-center gap-6">
                  <span className="text-xs md:text-[10px] text-zinc-400 font-bold uppercase">
                    Saved Notes • Business History
                  </span>
                  <div className="h-6 w-px bg-white/5" />
                  <span className="text-xs md:text-[10px] text-forest-400 font-bold uppercase">
                    {filteredKnowledge.length} Total Memories
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-10 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence>
                    {filteredKnowledge.map((node) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={node.id}
                        className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-6 hover:border-forest-500/30 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-forest-500/10 rounded-xl flex items-center justify-center text-forest-400 border border-forest-500/20">
                              <BookOpen size={16} />
                            </div>
                            <span className="text-xs font-black text-white uppercase tracking-wider">
                              {node.topic}
                            </span>
                          </div>
                          <span className="micro-label opacity-40 flex items-center gap-2">
                            <Clock size={12} />
                            {new Date(node.lastUpdated).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed italic mb-6">
                          "{node.content}"
                        </p>
                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                          <div className="flex gap-2 flex-wrap">
                            {node.tags?.map((tag: string) => (
                              <span
                                key={tag}
                                className="micro-label bg-white/5 px-2 py-0.5 rounded-lg text-zinc-500 border border-white/5 uppercase"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              setConfirmAction({
                                title: "Delete this note?",
                                description: `"${node.topic}" will be removed from your saved notes.`,
                                onConfirm: async () => {
                                  try {
                                    if (navigator.onLine) {
                                      await knowledgeRepo.update(node.id, {
                                        isArchived: true,
                                        deletedAt: new Date().toISOString(),
                                      });
                                    }
                                    await logSystemEvent(
                                      "KNOWLEDGE_NODE_DELETED",
                                      { nodeId: node.id },
                                    );
                                  } catch (err) {
                                    handleFirestoreError(
                                      err,
                                      OperationType.DELETE,
                                      `knowledge/${node.id}`,
                                    );
                                  }
                                },
                              });
                            }}
                            aria-label={`Delete note about ${node.topic}`}
                            className="text-zinc-600 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {knowledge.length === 0 && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center text-white/20 gap-6">
                      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                        <Brain size={48} className="opacity-20" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-xl font-black italic uppercase tracking-widest leading-none">
                          List Empty.
                        </p>
                        <p className="text-sm font-medium text-white/40 max-w-xs mx-auto">
                          No saved notes yet. Ask the assistant to "add a note for
                          [client]" — anything you or the AI save shows up here.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Customer Details Modal / Slide-over */}
        <AnimatePresence>
          {selectedCustomer && (
            <div ref={detailModalRef} className="fixed inset-0 z-50 flex items-center justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60"
                onClick={() => setSelectedCustomer(null)}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-black/90 h-full w-full max-w-2xl relative shadow-2xl overflow-hidden flex flex-col border-l border-white/10"
              >
                <header className="px-6 sm:px-10 py-6 sm:py-10 border-b border-white/10 flex flex-col xl:flex-row xl:items-center justify-between bg-zinc-900 gap-6">
                  <div className="flex items-center gap-6 min-w-0">
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-forest-500 text-black rounded-3xl flex items-center justify-center text-xl sm:text-2xl sm:text-3xl font-black italic shadow-2xl"
                      aria-hidden="true"
                    >
                      {getInitials(selectedCustomer)}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2
                          id="modal-client-name"
                          className="text-2xl sm:text-3xl sm:text-4xl font-black tracking-normal md:tracking-tighter uppercase leading-none truncate"
                        >
                          {selectedCustomer.firstName}{" "}
                          {selectedCustomer.lastName}
                        </h2>
                        {selectedCustomer.isHOA && (
                          <div className="micro-label bg-ember-500/10 text-ember-400 border border-ember-500/20 px-2 py-1 rounded-lg">
                            Community Partner
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-white/40 font-bold tracking-tight text-lg truncate">
                          {selectedCustomer.address}
                        </p>
                        <div className="flex items-center gap-2 border border-white/10 rounded-lg pl-2 pr-1 py-1 bg-black/40">
                          <span className="text-[10px] uppercase font-black text-white/40 tracking-widest">Status:</span>
                          <select 
                            value={selectedCustomer.status || "lead"}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              try {
                                await customersRepo.update(selectedCustomer.id!, { status: newStatus });
                                setSelectedCustomer({...selectedCustomer, status: newStatus});
                                showToast(`Disposition updated to ${newStatus}`, "success");
                              } catch(err) {
                                showToast("Failed to update status", "error");
                              }
                            }}
                            className="bg-transparent text-xs font-bold text-white uppercase focus:outline-none cursor-pointer appearance-none"
                          >
                            <option value="lead">Lead</option>
                            <option value="contacted">Contacted</option>
                            <option value="estimate">Estimate Sent</option>
                            <option value="active">Active Client</option>
                            <option value="inactive">Inactive</option>
                            <option value="lost">Lost</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 shrink-0">
                    {(userRole === "admin" || userRole === "owner") && (
                      <button
                        onClick={() => handleDeleteSelectedCustomer()}
                        className="px-4 py-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all micro-label font-black uppercase tracking-widest flex items-center gap-2 border-4 border-red-500/20"
                        aria-label="Delete Client"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditCustomer({
                          ...selectedCustomer,
                          isHOA: !!selectedCustomer.isHOA,
                          gateCode: (selectedCustomer as any).gateCode ?? "",
                          hoaRulesText: (selectedCustomer.hoaRules || []).join("\n"),
                        });
                        setShowEditModal(true);
                      }}
                      className="px-6 py-4 bg-white/5 text-white hover:bg-white hover:text-black rounded-2xl transition-all micro-label font-black uppercase tracking-widest flex items-center gap-2 border-4 border-white/10"
                      aria-label="Edit Profile"
                    >
                      <UserPlus size={16} aria-hidden="true" />
                      Edit Profile
                    </button>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/portal/${selectedCustomer.id}`;
                        navigator.clipboard.writeText(url);
                        showToast("Client Portal Link copied to clipboard", "success");
                      }}
                      className="px-6 py-4 bg-forest-500/20 text-forest-400 hover:bg-forest-500 hover:text-black rounded-2xl transition-all micro-label font-black uppercase tracking-widest flex items-center gap-2 border-4 border-forest-500/20"
                      aria-label="Copy portal link"
                      title="Copy this client's portal link to the clipboard"
                    >
                      <Share size={16} aria-hidden="true" />
                      Copy Portal Link
                    </button>
                    <button
                      id="crm-back-button"
                      onClick={() => setSelectedCustomer(null)}
                      className="px-6 py-4 bg-white/5 hover:bg-white text-white hover:text-black rounded-2xl transition-all micro-label font-black uppercase tracking-widest flex items-center gap-2 border border-white/5"
                      aria-label="Back to registry"
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                      Clients
                    </button>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="p-4 text-white/20 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
                      aria-label="Close details"
                    >
                      <X size={28} />
                    </button>
                  </div>
                </header>
                
                <div className="bg-zinc-950 border-b border-white/10 px-6 sm:px-10 flex overflow-x-auto custom-scrollbar">
                  {[
                    { id: "overview", label: "Overview", icon: User },
                    { id: "timeline", label: "Timeline", icon: History },
                    { id: "estimates", label: "Estimates", icon: FileText },
                    { id: "jobs", label: "Jobs", icon: Briefcase },
                    { id: "sms", label: "Twilio SMS", icon: MessageSquare },
                    { id: "tasks", label: "Tasks", icon: CheckSquare },
                    { id: "documents", label: "Documents", icon: Folder }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setCustomerViewTab(tab.id as any)}
                      className={`px-6 py-4 border-b-2 text-xs md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2 transition-all ${customerViewTab === tab.id ? "border-forest-500 text-forest-500 bg-forest-500/5" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
                    >
                      <tab.icon size={14} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div
                  className="flex-1 overflow-auto p-10 space-y-6 lg:space-y-10 custom-scrollbar"
                  aria-labelledby="modal-client-name"
                >
                  {customerViewTab === "overview" && (
                    <>
                      {/* Agent Intelligence Section */}
                  <section className="bg-forest-500 rounded-2xl p-8 text-black relative overflow-hidden shadow-2xl shadow-forest-500/20">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full -mr-24 -mt-24 opacity-50 blur-3xl animate-pulse" />
                    <div className="flex items-center gap-4 mb-8 relative">
                      <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center">
                        <Brain size={28} className="text-black" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl uppercase tracking-tight leading-none">
                          Client Brief
                        </h3>
                        <p className="text-xs md:text-[10px] font-bold tracking-[0.2em] text-black/40 mt-1 uppercase">
                          {isGeneratingBriefing ? "Updating..." : "Quick Info"}
                        </p>
                      </div>
                    </div>

                    {isGeneratingBriefing ? (
                      <div className="space-y-4 animate-pulse">
                        <div className="h-5 bg-black/5 rounded-xl w-3/4" />
                        <div className="h-5 bg-black/5 rounded-xl w-1/2" />
                      </div>
                    ) : briefing ? (
                      <div className="space-y-6 sm:space-y-8 relative">
                        <p className="text-xl font-medium text-black leading-tight">
                          "{briefing.summary}"
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                          <div className="space-y-3">
                            <p className="text-xs md:text-[10px] font-bold text-black/40 uppercase">
                              Details
                            </p>
                            <ul className="space-y-2">
                              {briefing.keyInsights?.map(
                                (insight: string, i: number) => (
                                  <li
                                    key={i}
                                    className="text-sm font-bold flex gap-3 text-black/80"
                                  >
                                    <span className="text-black/20 mt-1">
                                      ●
                                    </span>{" "}
                                    {insight}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                          <div className="space-y-3">
                            <p className="text-xs md:text-[10px] font-bold text-rose-950 uppercase">
                              Alerts
                            </p>
                            <ul className="space-y-2">
                              {briefing.redFlags?.map(
                                (flag: string, i: number) => (
                                  <li
                                    key={i}
                                    className="text-sm font-bold flex gap-3 text-rose-900 bg-rose-900/5 px-3 py-1.5 rounded-xl border border-rose-900/10"
                                  >
                                    <ShieldAlert
                                      size={16}
                                      className="text-rose-900 shrink-0"
                                    />{" "}
                                    {flag}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        </div>

                        <div className="pt-6 border-t border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <Zap size={18} className="text-black shrink-0" />
                            <span className="text-sm font-bold uppercase tracking-tight">
                              Upsell: {briefing.suggestedUpsell}
                            </span>
                            <span className="bg-black/10 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-black/40">
                              Potential: +$1,200/yr
                            </span>
                          </div>
                          <button
                            disabled={isDraftingProposal}
                            onClick={() =>
                              draftProposal(briefing.suggestedUpsell)
                            }
                            className="w-full sm:w-auto text-xs md:text-[10px] bg-black text-white px-6 py-3 md:py-4 rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 font-bold uppercase tracking-widest shadow-xl flex items-center justify-center shrink-0"
                          >
                            {isDraftingProposal
                              ? "Working..."
                              : "Draft Proposal"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateBriefing(selectedCustomer)}
                        className="text-sm font-black italic underline uppercase"
                      >
                        Retry Help
                      </button>
                    )}
                  </section>

                  {/* AI Dispatch Section removed */}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
                    {/* Left Column: Vision Analysis */}
                    <div className="space-y-6 sm:space-y-8">
                      <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-8">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <Eye size={22} className="text-celtic-400" />
                            <h4 className="text-xs md:text-[10px] text-white/40 uppercase">
                              Site Analysis
                            </h4>
                          </div>
                          <div className="flex items-center gap-4">
                            <Link
                              to="../design-studio"
                              state={{ customer: selectedCustomer }}
                              className="text-xs md:text-[10px] text-forest-400 hover:text-forest-300 transition-colors uppercase font-black tracking-widest"
                            >
                              Design Grid
                            </Link>
                            <button
                              onClick={() => enrichData(selectedCustomer)}
                              disabled={isEnriching}
                              className="text-xs md:text-[10px] text-white/40 hover:text-white disabled:opacity-50 transition-colors underline decoration-white/10 underline-offset-8 uppercase font-black tracking-widest"
                            >
                              {isEnriching ? "Enriching..." : "Enrich"}
                            </button>
                            <button
                              onClick={() => analyzeProperty(selectedCustomer)}
                              disabled={isAnalyzing}
                              className="text-xs md:text-[10px] text-white/40 hover:text-white disabled:opacity-50 transition-colors underline decoration-white/10 underline-offset-8 uppercase font-black tracking-widest"
                            >
                              {isAnalyzing ? "Checking..." : "Run Analysis"}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {propertyInsights.map(
                            (insight: Insight, i: number) => (
                              <div
                                key={i}
                                className="group cursor-pointer p-6 rounded-[28px] bg-white/5 border border-white/5 hover:border-celtic-500/30 hover:bg-white/[0.08] transition-all"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="text-sm font-black text-white">
                                    {insight.title}
                                  </h5>
                                  <span className="micro-label text-celtic-400 bg-celtic-500/10 px-2 py-0.5 rounded-lg border border-celtic-500/20">
                                    +{insight.roi} ROI
                                  </span>
                                </div>
                                <p className="text-xs text-white/40 leading-relaxed font-medium">
                                  {insight.description}
                                </p>
                                <button
                                  onClick={() => draftProposal(insight.title)}
                                  disabled={isDraftingProposal}
                                  className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 micro-label text-forest-400"
                                >
                                  <FileText size={14} />
                                  {isDraftingProposal
                                    ? "Drafting..."
                                    : "Automate Proposal"}
                                </button>
                              </div>
                            ),
                          )}
                          {propertyInsights.length === 0 && !isAnalyzing && (
                            <div className="text-center py-6 sm:py-10 space-y-4">
                              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto opacity-20">
                                <Eye size={24} />
                              </div>
                              <p className="text-xs text-white/20 italic font-medium">
                                Visual metrics pending execution.
                              </p>
                            </div>
                          )}

                          {enrichedData && (
                            <div className="mt-2 p-5 rounded-[24px] bg-celtic-500/5 border border-celtic-500/20 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="micro-label text-celtic-400 uppercase tracking-widest font-black">
                                  Property Intelligence
                                </span>
                                {enrichedData.simulated && (
                                  <span className="text-[8px] uppercase tracking-widest font-black text-white/30 border border-white/10 rounded px-1.5 py-0.5">
                                    Estimate
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(enrichedData)
                                  .filter(([k, v]) => k !== "simulated" && v !== null && v !== "" && typeof v !== "object")
                                  .map(([k, v]) => (
                                    <div key={k} className="bg-black/30 rounded-xl px-3 py-2">
                                      <p className="text-[8px] uppercase tracking-widest font-black text-white/30">
                                        {k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()}
                                      </p>
                                      <p className="text-xs font-bold text-white/80 mt-0.5">
                                        {k === "estimatedPropertyValue" && typeof v === "number"
                                          ? `$${Number(v).toLocaleString()}`
                                          : k === "upsellProbability" && typeof v === "number"
                                            ? `${v}%`
                                            : String(v)}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Property Profile */}
                    <div className="space-y-6 sm:space-y-8">
                      {selectedCustomer.isHOA && (
                        <div className="bg-ember-500/5 rounded-2xl p-8 border border-ember-500/20 shadow-2xl relative overflow-hidden group/hoa">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-ember-500/10 blur-3xl -mr-16 -mt-16" />
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <ShieldAlert
                                size={20}
                                className="text-ember-400"
                              />
                              <h4 className="text-xs md:text-[10px] text-ember-400 font-black uppercase tracking-widest">
                                Community Rules
                              </h4>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                isEditingBylaws
                                  ? setIsEditingBylaws(false)
                                  : openBylawsEditor()
                              }
                              className="text-[9px] font-black text-ember-400/40 hover:text-ember-400 uppercase tracking-widest transition-colors decoration-ember-500/20 underline underline-offset-4"
                            >
                              {isEditingBylaws ? "Cancel" : "Edit Bylaws"}
                            </button>
                          </div>

                          {isEditingBylaws ? (
                            <div className="space-y-4">
                              <label className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={bylawsForm.isHOA}
                                  onChange={(e) =>
                                    setBylawsForm({
                                      ...bylawsForm,
                                      isHOA: e.target.checked,
                                    })
                                  }
                                  className="w-4 h-4 accent-ember-500"
                                />
                                <span className="text-xs font-black text-white/70 uppercase tracking-widest">
                                  Is HOA Property
                                </span>
                              </label>

                              <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-ember-400/60 ml-1">
                                  Community Rules (one per line)
                                </label>
                                <textarea
                                  value={bylawsForm.hoaRulesText}
                                  onChange={(e) =>
                                    setBylawsForm({
                                      ...bylawsForm,
                                      hoaRulesText: e.target.value,
                                    })
                                  }
                                  placeholder={"No gas mowers before 8am\nBag all clippings\nNo signage on lawn"}
                                  className="w-full min-h-[120px] bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs font-bold text-white/80 focus:bg-white/10 focus:border-ember-500/30 focus:outline-none transition-all resize-none custom-scrollbar"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-ember-400/60 ml-1">
                                  Gate Code
                                </label>
                                <input
                                  type="text"
                                  value={bylawsForm.gateCode}
                                  onChange={(e) =>
                                    setBylawsForm({
                                      ...bylawsForm,
                                      gateCode: e.target.value,
                                    })
                                  }
                                  placeholder="#1234"
                                  className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs font-bold text-white/80 focus:bg-white/10 focus:border-ember-500/30 focus:outline-none transition-all"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={handleSaveBylaws}
                                disabled={isSavingBylaws}
                                className="w-full bg-ember-500/20 text-ember-300 hover:bg-ember-500 hover:text-black transition-all text-[9px] px-4 py-3 font-black uppercase tracking-widest rounded-2xl border-2 border-ember-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                <Save size={14} />
                                {isSavingBylaws ? "Saving..." : "Save Bylaws"}
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {(selectedCustomer as any).gateCode && (
                                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 group-hover/hoa:border-ember-500/20 transition-all">
                                  <div className="w-1.5 h-1.5 rounded-full bg-ember-500 shadow-[0_0_10px_#a855f7]" />
                                  <span className="text-xs font-bold text-white/70 uppercase tracking-tight">
                                    Gate Code: {(selectedCustomer as any).gateCode}
                                  </span>
                                </div>
                              )}
                              {selectedCustomer.hoaRules?.map(
                                (rule: string, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 group-hover/hoa:border-ember-500/20 transition-all"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-ember-500 shadow-[0_0_10px_#a855f7]" />
                                    <span className="text-xs font-bold text-white/70 uppercase tracking-tight">
                                      {rule}
                                    </span>
                                  </div>
                                ),
                              )}
                              {(!selectedCustomer.hoaRules ||
                                selectedCustomer.hoaRules.length === 0) && (
                                <p className="text-xs text-white/20 italic p-4">
                                  No specific ordinances synced for this location.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="bg-white/5 rounded-2xl p-10 border border-white/5 shadow-2xl">
                        <h4 className="text-xs md:text-[10px] text-white/40 uppercase tracking-[0.2em] mb-10">
                          Property Details
                        </h4>
                        <div className="grid grid-cols-2 gap-y-10">
                          <div className="space-y-1">
                            <p className="text-xs md:text-[10px] opacity-40 uppercase">
                              Size
                            </p>
                            <p className="text-lg font-bold tracking-tight">
                              {selectedCustomer.propertyDetails?.size || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs md:text-[10px] opacity-40 uppercase">
                              Grass Type
                            </p>
                            <p className="text-lg font-bold tracking-tight">
                              {selectedCustomer.propertyDetails?.grassType ||
                                "N/A"}
                            </p>
                          </div>
                          <div className="col-span-2 space-y-3">
                            <p className="text-xs md:text-[10px] opacity-40 uppercase">
                              Features
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {selectedCustomer.propertyDetails?.features?.map(
                                (f: string, i: number) => (
                                  <span
                                    key={i}
                                    className="text-xs md:text-[10px] bg-white/10 px-3 py-1.5 rounded-xl border border-white/5 text-white/60 font-bold uppercase transition-all hover:bg-white hover:text-black cursor-default"
                                  >
                                    {f}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <CustomerPortalCard customer={selectedCustomer} />
                      <CRMCustomFields customer={selectedCustomer} onUpdate={() => {}} />

                      {/* Property Value Growth chart removed: it rendered fabricated,
                          hard-coded growth numbers (generatePropertyGrowthData) presented
                          as real "Estimated Value Growth" for HOA board presentations.
                          Real, labeled property numbers live in the enrichmentbacked
                          "Property Intelligence" card above. */}

                      <AnimatePresence>
                        {proposalDraft && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-10 border-forest-500/20 relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-forest-500/5 blur-3xl -mr-16 -mt-16" />
                            <div className="flex items-center justify-between mb-8">
                              <h3
                                id="proposal-draft-label"
                                className="text-xs md:text-[10px] text-forest-400 font-bold uppercase"
                              >
                                Draft Quote
                              </h3>
                              <button
                                onClick={() => setProposalDraft("")}
                                className="text-white/20 hover:text-white transition-colors"
                                aria-label="Discard draft"
                              >
                                <X size={18} />
                              </button>
                            </div>
                            <label
                              htmlFor="proposal-draft-text"
                              className="sr-only"
                            >
                              Proposal Draft Content
                            </label>
                            <textarea
                              id="proposal-draft-text"
                              aria-labelledby="proposal-draft-label"
                              className="w-full min-w-0 h-80 text-base sm:text-sm text-white/80 font-medium leading-relaxed custom-scrollbar pr-4 mb-8 bg-black/40 p-6 rounded-3xl border border-white/5 focus:border-forest-500/30 focus:outline-none transition-all resize-none shadow-inner"
                              value={proposalDraft}
                              onChange={(e) => setProposalDraft(e.target.value)}
                            />
                            <button
                              onClick={() => {
                                addLog({
                                  type: "email",
                                  recipient: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim(),
                                  subject: "Proposal / Quote",
                                  content: proposalDraft,
                                });
                                showToast(
                                  `Proposal queued to ${selectedCustomer.firstName}.`,
                                  "success",
                                );
                                setProposalDraft("");
                              }}
                              className="w-full bg-forest-500 text-black rounded-3xl py-5 font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-forest-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                              <Send size={18} /> Send to{" "}
                              {selectedCustomer.firstName}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Persistent Job Notes Section */}
                  <section className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <BookOpen
                          size={20}
                          className="text-white/20"
                          aria-hidden="true"
                        />
                        <h3
                          id="site-notes-label"
                          className="text-xs md:text-[10px] text-white/40 uppercase tracking-widest"
                        >
                          Site Notes
                        </h3>
                      </div>
                      <div className="flex items-center gap-3" role="status">
                        <button
                          onClick={handleSaveToKeep}
                          disabled={isSyncingKeep}
                          className="px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500/20 transition-all shadow-[0_0_20px_rgba(234,179,8,0.1)] flex items-center gap-2"
                        >
                          {isSyncingKeep ? (
                            <div className="w-3 h-3 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
                          ) : (
                            <Star size={12} />
                          )}
                          Sync to Keep
                        </button>
                        {isSavingNotes && (
                          <div
                            className="w-4 h-4 border-2 border-forest-500/20 border-t-forest-500 rounded-full animate-spin"
                            aria-label="Saving notes"
                          />
                        )}
                        <span className="text-xs md:text-[10px] opacity-20 font-bold italic">
                          Auto-saving
                        </span>
                      </div>
                    </div>
                    <div className="relative group">
                      <label htmlFor="client-site-notes" className="sr-only">
                        Client Site Notes
                      </label>
                      <textarea
                        id="client-site-notes"
                        aria-labelledby="site-notes-label"
                        className="w-full min-w-0 min-h-[220px] bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-10 text-lg text-white font-medium focus:border-forest-500/30 focus:outline-none transition-all leading-relaxed placeholder:text-white/10"
                        placeholder="Special instructions, gate codes, pet info..."
                        value={customerNotes}
                        onChange={(e) => {
                          setCustomerNotes(e.target.value);
                          handleUpdateNotes(
                            selectedCustomer.id,
                            e.target.value,
                          );
                        }}
                      />
                      <div className="absolute bottom-6 right-6 flex gap-3 text-xs md:text-[10px] bg-black/60 px-4 py-2 rounded-2xl border border-white/5 text-amber-400 tracking-widest uppercase font-black">
                        <Sparkles size={14} className="shrink-0" />
                        <span>Always saved to the cloud</span>
                      </div>
                    </div>
                  </section>

                  {/* Integration History */}
                  <section className="space-y-6 pb-20">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <History size={20} className="text-white/20" />
                        <h4 className="micro-label text-white/40 uppercase">
                          Interaction History
                        </h4>
                      </div>
                      <button
                        onClick={handleFetchEmails}
                        disabled={isFetchingEmails}
                        className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-2"
                      >
                        {isFetchingEmails ? (
                          <div className="w-3 h-3 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                        ) : (
                          <Mail size={12} />
                        )}
                        Sync Gmail
                      </button>
                    </div>

                    <div className="space-y-4">
                      {clientEmails.length > 0 && clientEmails.map((email: any, idx: number) => {
                         const headerSubject = email.payload.headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
                         const headerDate = email.payload.headers.find((h: any) => h.name === 'Date')?.value || '';
                         let bodySnippet = email.snippet || '';
                         return (
                           <div key={email.id || idx} className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-8">
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-red-500/10 border-4 border-red-500/20 flex items-center justify-center">
                                  <Mail size={14} className="text-red-400" />
                                </div>
                                <span className="text-sm font-black italic uppercase tracking-tight">
                                  Gmail
                                </span>
                              </div>
                              <span className="micro-label opacity-40">
                                {new Date(headerDate).toLocaleDateString()}
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-white mb-2">{headerSubject}</h5>
                            <p className="text-sm text-white/60 font-medium leading-relaxed italic border-l-4 border-red-500/20 pl-6 py-2">{bodySnippet}</p>
                          </div>
                         )
                      })}

                      {smsHistory.length > 0 && (
                        <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-8">
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                                <MessageSquare
                                  size={14}
                                  className="text-forest-400"
                                />
                              </div>
                              <span className="text-sm font-black italic uppercase tracking-tight">
                                SMS Messages
                              </span>
                            </div>
                            <span className="micro-label opacity-40">
                              {new Date(smsHistory[0].date).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-white/60 font-medium leading-relaxed italic border-l-4 border-forest-500/20 pl-6 py-2">
                            "{smsHistory[0].body}"
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                  </>
                  )}

                  {customerViewTab === "timeline" && (
                    <div className="space-y-6">
                      <div className="bg-zinc-900 border border-white/5 molten-edge p-8 shadow-2xl relative">
                        <div className="absolute left-[39px] top-12 bottom-12 w-px bg-white/10 z-0 hidden sm:block"></div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-white mb-8 flex items-center gap-2">
                          <History size={16} className="text-forest-400" /> Activity History
                        </h4>
                        
                        <div className="space-y-8 relative z-10">
                          {/* Event 1 */}
                          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 group">
                            <div className="w-10 h-10 rounded-full bg-forest-500/20 border border-forest-500/50 flex items-center justify-center shrink-0 z-10 group-hover:scale-110 transition-transform hidden sm:flex">
                              <Star size={14} className="text-forest-400" />
                            </div>
                            <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-6 group-hover:border-white/10 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="text-sm font-bold text-white">Client Created</h5>
                                <span className="text-[10px] text-white/40 uppercase font-black tracking-widest bg-black/40 px-2 py-1 rounded">Just Now</span>
                              </div>
                              <p className="text-xs text-white/60">Profile was added to the unified registry.</p>
                            </div>
                          </div>
                          
                          {/* Event 2 */}
                          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 group">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center shrink-0 z-10 group-hover:scale-110 transition-transform hidden sm:flex">
                              <Brain size={14} className="text-blue-400" />
                            </div>
                            <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-6 group-hover:border-white/10 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="text-sm font-bold text-white">Property Evaluated</h5>
                                <span className="text-[10px] text-white/40 uppercase font-black tracking-widest bg-black/40 px-2 py-1 rounded">2 hours ago</span>
                              </div>
                              <p className="text-xs text-white/60">Automatic AI property analysis completed for ({selectedCustomer.address}).</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {customerViewTab === "sms" && (
                    <div className="space-y-6">
                      <div className="bg-zinc-900 border border-white/5 molten-edge p-8 shadow-2xl flex flex-col h-[500px]">
                        <h4 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                          <MessageSquare size={16} className="text-forest-400" /> Twilio SMS Hub
                        </h4>
                        
                        <div className="flex-1 overflow-y-auto space-y-4 mb-6 custom-scrollbar pr-2">
                          {smsHistory.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-2xl p-4 ${msg.direction === 'outbound' ? 'bg-forest-500/20 border border-forest-500/30 text-white' : 'bg-white/5 border border-white/5 text-white/80'}`}>
                                <p className="text-sm font-medium">{msg.body}</p>
                                <span className="text-[9px] opacity-40 mt-2 block">{new Date(msg.date).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          ))}
                          {smsHistory.length === 0 && (
                            <div className="text-center py-20 text-white/20 italic text-sm font-medium">
                              No recent messages. Start a conversation above.
                            </div>
                          )}
                        </div>

                        <div className="mt-auto relative">
                          <textarea
                            value={smsMessage}
                            onChange={(e) => setSmsMessage(e.target.value)}
                            placeholder="Type an SMS message to send via Twilio..."
                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pr-16 text-sm text-white resize-none h-24 focus:border-forest-500/50 focus:outline-none transition-all custom-scrollbar"
                          />
                          <button
                            onClick={handleSendSms}
                            disabled={isSendingSms || !smsMessage.trim()}
                            className="absolute bottom-4 right-4 w-10 h-10 bg-forest-500 text-black rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {customerViewTab === "estimates" && (
                     <div className="space-y-6">
                       {loadingEstimates ? (
                         <div className="bg-zinc-900 border border-white/5 molten-edge p-8 shadow-2xl flex items-center justify-center py-20 text-center text-sm text-white/40">
                           Loading estimates…
                         </div>
                       ) : customerEstimates.length > 0 ? (
                         <div className="bg-zinc-900 border border-white/5 molten-edge p-6 shadow-2xl space-y-3">
                           <div className="flex items-center justify-between mb-2">
                             <h4 className="text-sm font-black tracking-tight text-white uppercase">
                               Open Estimates ({customerEstimates.length})
                             </h4>
                             <button
                               onClick={() =>
                                 navigate("../invoices", {
                                   state: {
                                     client: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim(),
                                     customer: selectedCustomer,
                                   },
                                 })
                               }
                               className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all"
                             >
                               New Quote
                             </button>
                           </div>
                           {customerEstimates.map((est: any) => (
                             <button
                               key={est.id}
                               onClick={() =>
                                 navigate("../invoices", {
                                   state: {
                                     client: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim(),
                                     customer: selectedCustomer,
                                   },
                                 })
                               }
                               className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all text-left"
                             >
                               <div className="flex items-center gap-3 min-w-0">
                                 <FileText size={18} className="text-forest-400 shrink-0" />
                                 <div className="min-w-0">
                                   <div className="text-sm font-black text-white truncate">
                                     Estimate #{est.number ?? est.data?.number ?? String(est.id).slice(0, 6)}
                                   </div>
                                   <div className="text-[11px] text-white/40">
                                     {est.date || est.dueDate || "Draft"} · Draft
                                   </div>
                                 </div>
                               </div>
                               <div className="text-sm font-black text-white shrink-0">
                                 ${(Number(est.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                               </div>
                             </button>
                           ))}
                         </div>
                       ) : (
                         <div className="bg-zinc-900 border border-white/5 molten-edge p-8 shadow-2xl flex flex-col items-center justify-center py-20 text-center">
                           <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                             <FileText size={24} className="text-white/40" />
                           </div>
                           <h4 className="text-lg font-black tracking-tight text-white uppercase mb-2">No Open Estimates</h4>
                           <p className="text-sm text-white/40 mb-8 max-w-sm">Use the AI Property analyzer or Design Studio to easily generate a new proposal to sync to QuickBooks/Stripe.</p>
                           <button
                             onClick={() =>
                               navigate("../invoices", {
                                 state: {
                                   client: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim(),
                                   customer: selectedCustomer,
                                 },
                               })
                             }
                             className="px-6 py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all"
                           >
                             Create Blank Quote
                           </button>
                         </div>
                       )}
                     </div>
                  )}

                  {customerViewTab === "tasks" && (
                    <CRMTasks customers={selectedCustomer ? [selectedCustomer] : []} />
                  )}

                  {customerViewTab === "jobs" && (
                    <CRMJobs customer={selectedCustomer} />
                  )}

                  {customerViewTab === "documents" && (
                    <CRMDocuments customers={selectedCustomer ? [selectedCustomer] : []} />
                  )}

                </div>

                <footer className="px-6 sm:px-10 py-6 sm:py-10 border-t border-white/10 bg-black/40 flex gap-6">
                  <Link
                    to="../scheduler"
                    state={{
                      clientName:
                        selectedCustomer.firstName +
                        " " +
                        selectedCustomer.lastName,
                      address: selectedCustomer.address,
                    }}
                    className="flex-1 py-5 bg-white text-black rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    <Calendar size={18} />
                    Initialize Visit
                  </Link>
                  <Link
                    to="../invoices"
                    state={{
                      client:
                        selectedCustomer.firstName +
                        " " +
                        selectedCustomer.lastName,
                    }}
                    className="flex-1 py-5 bg-zinc-900 border border-white/5 molten-edge shadow-2xl text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3"
                  >
                    <FileText size={18} />
                    Generate Invoice
                  </Link>
                  <button
                    onClick={() => handleSendMagicLink(selectedCustomer)}
                    className="flex-1 py-5 bg-forest-500/10 border-4 border-forest-500/20 shadow-2xl text-forest-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-forest-500 hover:text-black transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <div className="flex items-center gap-2">
                       <Share size={18} />
                       {selectedCustomer.magicLinkSentCount ? "Resend Portal Link" : "Send Portal Link"}
                    </div>
                    {selectedCustomer.magicLinkSentAt && (
                       <span className="text-[9px] opacity-70 normal-case font-medium tracking-normal">
                          Sent {new Date(selectedCustomer.magicLinkSentAt).toLocaleDateString()} (x{selectedCustomer.magicLinkSentCount})
                       </span>
                    )}
                  </button>
                </footer>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {showLowStockModal && (
          <div ref={lowStockModalRef} className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80"
              onClick={() => setShowLowStockModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-900 border border-white/5 molten-edge w-full max-w-lg rounded-2xl overflow-hidden relative shadow-2xl p-10"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white leading-none">
                    Inventory Critical
                  </h2>
                  <p className="text-xs md:text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1">
                    Supply Shortage Detected
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                {lowStockAlert.map((item, i) => (
                  <div
                    key={i}
                    className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="text-lg font-bold text-white uppercase italic tracking-tight">
                        {item.name}
                      </h3>
                      <p className="text-xs text-white/40">
                        Current: {item.current} {item.unit} (Min: {item.min})
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const supplier = item.supplierEmail || "Supplier";
                        addLog({
                          type: "email",
                          recipient: supplier,
                          subject: `Restock Request: ${item.name}`,
                          content: `Low stock alert for ${item.name}. Current: ${item.current ?? "?"} ${item.unit ?? ""} (Min: ${item.min ?? "?"}). Please send a replenishment quote.`,
                        });
                        showToast(`Restock request drafted to ${supplier}.`, "success");
                        setShowLowStockModal(false);
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-black text-xs md:text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                    >
                      <Mail size={14} />
                      Notify Supplier
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-white/40 mb-8 italic">
                Continuing with this proposal may lead to resource conflicts.
                Would you like to proceed with the draft while replenishing
                stock?
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowLowStockModal(false)}
                  className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-bold text-xs md:text-[10px] uppercase tracking-widest border border-white/5 hover:bg-white/10"
                >
                  Cancel Draft
                </button>
                <button
                  onClick={() => setShowLowStockModal(false)}
                  className="flex-1 py-4 bg-forest-500 text-black rounded-2xl font-black text-xs md:text-[10px] uppercase tracking-widest hover:scale-105 shadow-xl shadow-forest-500/20"
                >
                  Proceed with Draft
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddModal && (
          <div ref={addModalRef} className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-900 border border-white/5 molten-edge w-full max-w-xl rounded-2xl overflow-hidden relative shadow-2xl flex flex-col"
            >
              <div className="p-10 border-b border-white/10 bg-zinc-900">
                <div className="flex items-center justify-between mb-2">
                  <h2
                    id="onboard-client-title"
                    className="text-xl sm:text-2xl font-black uppercase tracking-tight"
                  >
                    Onboard Client
                  </h2>
                </div>
                <p className="text-xs font-bold text-white/30 uppercase tracking-widest">
                  Client List Entry
                </p>
              </div>

              <form
                onSubmit={handleAddCustomer}
                className="p-10 space-y-6 overflow-auto max-h-[70vh] custom-scrollbar"
                aria-labelledby="onboard-client-title"
              >
                {formErrors._form && (
                  <div className="bg-rose-500/10 border border-rose-500/50 rounded-2xl p-4 text-rose-500 font-bold text-sm">
                    {formErrors._form}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="first-name"
                      className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
                    >
                      First Name
                    </label>
                    <input
                      id="first-name"
                      type="text"
                      required
                      className={`w-full bg-white/5 border ${formErrors.firstName ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                      value={newCustomer.firstName}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          firstName: e.target.value,
                        })
                      }
                    />
                    {formErrors.firstName && (
                      <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.firstName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="last-name"
                      className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
                    >
                      Last Name
                    </label>
                    <input
                      id="last-name"
                      type="text"
                      className={`w-full bg-white/5 border ${formErrors.lastName ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                      value={newCustomer.lastName}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          lastName: e.target.value,
                        })
                      }
                    />
                    {formErrors.lastName && (
                      <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="client-email"
                    className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/60 ml-2"
                  >
                    Email Address <span className="text-white/30">(optional)</span>
                  </label>
                  <input
                    id="client-email"
                    type="email"
                    className={`w-full bg-white/5 border ${formErrors.email ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                  />
                  {formErrors.email && (
                    <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="client-phone"
                      className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
                    >
                      Phone
                    </label>
                    <input
                      id="client-phone"
                      type="tel"
                      required
                      className={`w-full bg-white/5 border ${formErrors.phone ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          phone: e.target.value,
                        })
                      }
                    />
                    {formErrors.phone && (
                      <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.phone}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="service-address"
                      className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
                    >
                      Service Address <span className="text-white/30">(optional)</span>
                    </label>
                    <input
                      id="service-address"
                      type="text"
                      className={`w-full bg-white/5 border ${formErrors.address ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                      value={newCustomer.address}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          address: e.target.value,
                        })
                      }
                    />
                    {formErrors.address && (
                      <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.address}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="intake-notes"
                    className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
                  >
                    Initial Intake Notes
                  </label>
                  <textarea
                    id="intake-notes"
                    className="w-full min-w-0 bg-white/5 border border-white/5 rounded-3xl px-6 py-4 text-base sm:text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all min-h-[120px]"
                    value={newCustomer.notes}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, notes: e.target.value })
                    }
                  />
                </div>

                {/* HOA / Community details */}
                <div className="space-y-4 rounded-3xl border border-ember-500/10 bg-ember-500/5 p-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCustomer.isHOA}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, isHOA: e.target.checked })
                      }
                      className="w-4 h-4 accent-ember-500"
                    />
                    <span className="text-xs md:text-[10px] font-black uppercase tracking-widest text-ember-400">
                      HOA / Managed Community
                    </span>
                  </label>

                  {newCustomer.isHOA && (
                    <>
                      <div className="space-y-2">
                        <label
                          htmlFor="new-hoa-rules"
                          className="text-xs md:text-[10px] font-black uppercase tracking-widest text-ember-400/60 ml-2"
                        >
                          Community Rules (one per line)
                        </label>
                        <textarea
                          id="new-hoa-rules"
                          className="w-full min-w-0 bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-base sm:text-sm font-bold focus:bg-white/10 focus:border-ember-500/30 transition-all min-h-[100px] resize-none custom-scrollbar"
                          placeholder={"No gas mowers before 8am\nBag all clippings"}
                          value={newCustomer.hoaRulesText}
                          onChange={(e) =>
                            setNewCustomer({
                              ...newCustomer,
                              hoaRulesText: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="new-gate-code"
                          className="text-xs md:text-[10px] font-black uppercase tracking-widest text-ember-400/60 ml-2"
                        >
                          Gate Code
                        </label>
                        <input
                          id="new-gate-code"
                          type="text"
                          placeholder="#1234"
                          className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-ember-500/30 transition-all"
                          value={newCustomer.gateCode}
                          onChange={(e) =>
                            setNewCustomer({
                              ...newCustomer,
                              gateCode: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-forest-500 text-black py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-forest-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    {isSaving ? (
                      <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <UserPlus size={18} />
                    )}
                    Confirm Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="w-full py-6 bg-white/5 border border-white/5 text-white/60 hover:text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Client Modal */}
      <AnimatePresence>
        {showEditModal && editCustomer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:pl-64">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowEditModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-zinc-950 border border-white/5 molten-edge rounded-[32px] p-8 sm:p-12 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">
                Edit Client Profile
              </h3>

              <form onSubmit={handleUpdateCustomerProfile} className="space-y-6">
                {formErrors._form && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-bold mb-6">
                    {formErrors._form}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/60 ml-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      className={`w-full bg-white/5 border ${formErrors.firstName ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                      value={editCustomer.firstName}
                      onChange={(e) =>
                        setEditCustomer({ ...editCustomer, firstName: e.target.value })
                      }
                    />
                    {formErrors.firstName && (
                      <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.firstName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/60 ml-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      className={`w-full bg-white/5 border ${formErrors.lastName ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                      value={editCustomer.lastName}
                      onChange={(e) =>
                        setEditCustomer({ ...editCustomer, lastName: e.target.value })
                      }
                    />
                    {formErrors.lastName && (
                      <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/60 ml-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    className={`w-full bg-white/5 border ${formErrors.email ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                    value={editCustomer.email || ""}
                    onChange={(e) =>
                      setEditCustomer({ ...editCustomer, email: e.target.value })
                    }
                  />
                  {formErrors.email && (
                    <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      required
                      className={`w-full bg-white/5 border ${formErrors.phone ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                      value={editCustomer.phone || ""}
                      onChange={(e) =>
                        setEditCustomer({
                          ...editCustomer,
                          phone: e.target.value,
                        })
                      }
                    />
                    {formErrors.phone && (
                      <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.phone}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">
                      Service Address
                    </label>
                    <input
                      type="text"
                      required
                      className={`w-full bg-white/5 border ${formErrors.address ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                      value={editCustomer.address || ""}
                      onChange={(e) =>
                        setEditCustomer({
                          ...editCustomer,
                          address: e.target.value,
                        })
                      }
                    />
                    {formErrors.address && (
                      <p className="text-xs md:text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* HOA / Community details */}
                <div className="space-y-4 rounded-2xl border border-ember-500/10 bg-ember-500/5 p-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editCustomer.isHOA}
                      onChange={(e) =>
                        setEditCustomer({
                          ...editCustomer,
                          isHOA: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-ember-500"
                    />
                    <span className="text-xs md:text-[10px] font-black uppercase tracking-widest text-ember-400">
                      HOA / Managed Community
                    </span>
                  </label>

                  {editCustomer.isHOA && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs md:text-[10px] font-black uppercase tracking-widest text-ember-400/60 ml-2">
                          Community Rules (one per line)
                        </label>
                        <textarea
                          className="w-full min-w-0 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-ember-500/30 transition-all min-h-[100px] resize-none custom-scrollbar"
                          placeholder={"No gas mowers before 8am\nBag all clippings"}
                          value={editCustomer.hoaRulesText ?? ""}
                          onChange={(e) =>
                            setEditCustomer({
                              ...editCustomer,
                              hoaRulesText: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs md:text-[10px] font-black uppercase tracking-widest text-ember-400/60 ml-2">
                          Gate Code
                        </label>
                        <input
                          type="text"
                          placeholder="#1234"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-ember-500/30 transition-all"
                          value={editCustomer.gateCode ?? ""}
                          onChange={(e) =>
                            setEditCustomer({
                              ...editCustomer,
                              gateCode: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-forest-500 text-black py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="w-full py-6 bg-white/5 border border-white/5 text-white/60 hover:text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulkTagModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:pl-64">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowBulkTagModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4">Bulk Tag Clients</h3>
              <p className="text-xs text-white/50 mb-6 font-medium">
                Add comma-separated tags to the {selectedClients.length} selected clients.
              </p>
              
              <input
                type="text"
                autoFocus
                placeholder="e.g. VIP, Fall Cleanup, HOA"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:bg-white/10 focus:border-white/20 focus:outline-none transition-all mb-6"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
              />
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleBulkTag}
                  disabled={isSaving || !bulkTagInput.trim()}
                  className="w-full bg-forest-500 hover:bg-forest-400 text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  {isSaving ? "Saving..." : "Apply Tags"}
                </button>
                <button
                  onClick={() => setShowBulkTagModal(false)}
                  className="w-full py-4 bg-white/5 border border-white/5 text-white/60 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
        title={confirmAction?.title || ""}
        description={confirmAction?.description || ""}
        confirmText="Delete"
        danger
      />
    </>
  );
}
