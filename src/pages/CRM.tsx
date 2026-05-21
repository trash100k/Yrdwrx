import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
  logSystemEvent,
} from "../lib/firebase";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { ingestKnowledge, fetchRelevantMemory } from "../services/brainService";
import { z } from "zod";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { Customer, Insight } from "../types";

const customerSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  address: z.string().min(5),
  notes: z.string().optional(),
});

export default function CRM() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [knowledge, setKnowledge] = useState<Record<string, any>[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "brain">("logs");
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
  });

  const [lowStockAlert, setLowStockAlert] = useState<
    { id: string; name: string; currentStock: number }[]
  >([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  const enrichData = async (customer: Customer) => {
    setIsEnriching(true);
    try {
      const res = await fetch("/api/crm/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer }),
      });
      if (!res.ok) throw new Error(`Data Enrichment Failed: ${res.statusText}`);
      const data = await res.json();
      setEnrichedData(data);
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
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/crm/analyze-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer }),
      });
      if (!res.ok) throw new Error(`Property Analysis failed: ${res.status}`);
      const data = await res.json();
      setPropertyInsights(data);
    } catch (err) {
      console.error(err);
      logSystemEvent("ANALYSIS_ERROR", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsAnalyzing(false);
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
        const checkRes = await fetch("/api/inventory/check-and-alert", {
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

      const res = await fetch("/api/crm/draft-proposal", {
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

  useEffect(() => {
    // Only attempt Firestore connection if we have a real Firebase auth session
    // This prevents "Permission Denied" errors if Anonymous Auth is disabled in console

    let unsubCust = () => {};
    let unsubKnow = () => {};

    const tenantId = tenant?.id || "genesis-1";
    const qCust = query(collection(db, "customers"), where("tenantId", "==", tenantId));
    unsubCust = onSnapshot(
      qCust,
      (snapshot) => {
        const docs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as any,
        );
        setCustomers(docs);
      },
      (error) => {
        // Only log if it's not a standard permission error while in demo mode
        if (error.code !== "permission-denied") {
          handleFirestoreError(error, OperationType.LIST, "customers");
        } else {
          // Fallback to mock data silently if permissions are denied
          /* setCustomers(mockCustomers) removed for strict data model */
        }
      },
    );

    const qKnow = query(collection(db, "knowledge"));
    unsubKnow = onSnapshot(
      qKnow,
      (snapshot) => {
        setKnowledge(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as any),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "knowledge");
      },
    );

    return () => {
      unsubCust();
      unsubKnow();
    };
  }, []);

  useEffect(() => {
    const handleVoiceAction = (e: CustomEvent) => {
      const { name, args } = e.detail;
      console.debug("CRM Voice Action:", name, args);

      if (
        name === "load_client_data" ||
        name === "schedule_job" ||
        name === "create_invoice"
      ) {
        const clientName = args.clientName.toLowerCase();
        const found = customers.find(
          (c) =>
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientName) ||
            c.firstName.toLowerCase().includes(clientName) ||
            c.lastName.toLowerCase().includes(clientName),
        );

        if (found) {
          handleSelectCustomer(found);
        }
      }

      if (name === "create_lead") {
        setNewCustomer((prev) => ({
          ...prev,
          firstName: args.firstName || "",
          lastName: args.lastName || "",
          notes: args.notes || "",
        }));
        setShowAddModal(true);
      }
    };

    window.addEventListener("cutty-action", handleVoiceAction as EventListener);
    return () =>
      window.removeEventListener(
        "cutty-action",
        handleVoiceAction as EventListener,
      );
  }, [customers]);

  const [isSimulatingCall, setIsSimulatingCall] = useState(false);
  const [callSimulation, setCallSimulation] = useState<Record<
    string,
    any
  > | null>(null);

  const simulateCall = async (customer: Customer) => {
    setIsSimulatingCall(true);
    try {
      const res = await fetch("/api/outbound/simulate-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          context: `Following up on the recent ${briefing?.suggestedUpsell || "service"} discussion.`,
        }),
      });
      const data = await res.json();
      setCallSimulation(data);
      await logSystemEvent("AI_CALL_SIMULATED", {
        customerId: customer.id,
        status: data.sentiment,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulatingCall(false);
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    setIsSavingNotes(true);
    try {
      const docRef = doc(db, "customers", id);
      await updateDoc(docRef, {
        notes,
        updatedAt: serverTimestamp(),
      });
      await logSystemEvent("CUSTOMER_NOTES_UPDATED", { customerId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customers/${id}`);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const generateBriefing = async (customer: Customer) => {
    setIsGeneratingBriefing(true);
    try {
      const memory = await fetchRelevantMemory(
        customer.firstName + " " + customer.lastName,
      );
      const res = await fetch("/api/crm/briefing", {
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
      await updateDoc(doc(db, "customers", customer.id), {
        aiScore: data.aiScore,
        aiScoreLabel: data.aiScoreLabel,
        aiScoreReasoning: data.aiScoreReasoning,
        updatedAt: serverTimestamp(),
      });
      await logSystemEvent("AI_BRIEFER_SCORE_UPDATED", {
        customerId: customer.id,
        score: data.aiScore,
      });
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

  const handleIngest = async () => {
    setIsIngesting(true);
    // Simulate ingesting some logs
    const mockContent =
      "Mrs. Gable at 12 Poplar Springs hates it when the mowers come before 9 AM because of her poodles. She also mentioned she wants to swap her azaleas for heat-tolerant hollies next season.";
    const context = {
      location: "Meridian, MS",
      timestamp: new Date().toISOString(),
    };

    await ingestKnowledge(mockContent, context);
    setIsIngesting(false);
  };

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
        return;
      }

      const path = "customers";
      const docRef = await addDoc(collection(db, path), {
        ...validated.data,
        status: "lead",
        tenantId: tenant?.id || "genesis-1",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logSystemEvent("CUSTOMER_CREATED", {
        customerId: docRef.id,
        name: `${newCustomer.firstName} ${newCustomer.lastName}`,
        tenantId: tenant?.id,
      });

      setShowAddModal(false);
      setNewCustomer({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "customers");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      `${c.firstName} ${c.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase());

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
      k.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (k.tags &&
        k.tags.some((t: string) =>
          t.toLowerCase().includes(searchTerm.toLowerCase()),
        )),
  );

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 min-h-[1000px] flex flex-col">
        <header
          id="client-header"
          className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10 pb-8 border-b-4 border-white/10 relative z-10"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500 text-xs font-black uppercase tracking-widest text-blue-500">
              <Users size={16} />
              Customer Ops
            </div>
            <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
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
                className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-400 transition-colors"
                size={24}
                aria-hidden="true"
              />
              <input
                id="crm-search"
                type="text"
                placeholder="Search registries..."
                className="w-full pl-16 pr-8 py-5 bg-black border-4 border-white/10 rounded-3xl text-xl uppercase font-black tracking-widest focus:bg-zinc-900 focus:border-emerald-500/50 focus:outline-none placeholder:text-zinc-600 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <div
              id="registry-tabs"
              className="bg-black rounded-[32px] p-2 border-4 border-white/10 flex shadow-inner"
              role="tablist"
              aria-label="Client Registry Tabs"
            >
              <button
                id="registry-tab"
                role="tab"
                aria-selected={activeTab === "logs"}
                onClick={() => setActiveTab("logs")}
                className={`px-8 py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform border-4 ${activeTab === "logs" ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                Registry
              </button>
              <button
                id="saved-notes-tab"
                role="tab"
                aria-selected={activeTab === "brain"}
                onClick={() => setActiveTab("brain")}
                className={`px-8 py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-transform flex items-center gap-3 border-4 ${activeTab === "brain" ? "bg-white text-black border-black shadow-[4px_4px_0_0_#000] scale-105" : "border-transparent text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                <BookOpen size={20} aria-hidden="true" />
                Notes
              </button>
            </div>
          </div>
        </header>

        <div className="structural-border bg-black/20 flex-1 flex flex-col min-h-[800px] overflow-hidden rounded-[32px]">
          {activeTab === "logs" ? (
            <>
              <div className="px-8 py-6 border-b flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-zinc-900">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="relative group min-w-[300px]">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-400 transition-colors"
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
                      className="w-full pl-12 pr-6 py-3 bg-white/5 border-4 border-white/10 rounded-2xl text-sm font-bold focus:bg-white/10 focus:border-emerald-500/30 focus:outline-none placeholder:text-zinc-600 transition-all"
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
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedSegment === seg ? "bg-emerald-500 text-black shadow-glow" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
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
                    id="add-client-button"
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-xl font-bold text-sm tracking-wide hover:bg-emerald-500 transition-all shadow-lg"
                  >
                    <UserPlus size={18} />
                    New Client
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                <table id="client-registry-table" className="w-full">
                  <thead className="sticky top-0 bg-black/90 z-10 border-b border-white/10">
                    <tr className="text-left bg-zinc-950/50">
                      <th className="pl-10 py-5 text-sm font-bold tracking-wider uppercase text-zinc-300">
                        Name & Contact
                      </th>
                      <th className="px-6 py-5 text-sm font-bold tracking-wider uppercase text-zinc-300">
                        Latest Updates
                      </th>
                      <th className="px-6 py-5 text-sm font-bold tracking-wider uppercase text-zinc-300 text-center">
                        AI Rating
                      </th>
                      <th className="px-6 py-5 text-sm font-bold tracking-wider uppercase text-zinc-300 text-center">
                        Service Status
                      </th>
                      <th className="pr-10 py-5 text-sm font-bold tracking-wider uppercase text-zinc-300 text-right">
                        Settings
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/20">
                    {filteredCustomers.map((client) => (
                      <tr
                        key={client.id}
                        className="hover:bg-zinc-900 transition-all group cursor-pointer border-l-4 border-transparent hover:border-emerald-500"
                        onClick={() => handleSelectCustomer(client)}
                      >
                        <td className="pl-10 py-8">
                          <div className="flex items-center gap-5">
                            <div
                              className="w-14 h-14 bg-zinc-900 border-4 border-white/10 rounded-2xl flex items-center justify-center text-zinc-400 font-black text-xl group-hover:bg-emerald-500 group-hover:text-black transition-all duration-500 shadow-2xl"
                              aria-hidden="true"
                            >
                              {client.firstName[0]}
                              {client.lastName[0]}
                            </div>
                            <div>
                              <div className="text-xl font-black italic tracking-tighter flex items-center gap-3 lowercase mb-1 leading-none">
                                {client.firstName} {client.lastName}
                                {client.priority && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-600 font-black uppercase tracking-widest leading-none">
                                {client.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-8">
                          <div className="flex flex-col gap-1 max-w-[240px]">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 italic">
                              Latest Memory
                            </p>
                            <p className="text-xs text-zinc-400 group-hover:text-white/80 transition-colors line-clamp-2 italic leading-relaxed">
                              "Shared project brief for property development at{" "}
                              {client.address.split(",")[0]}."
                            </p>
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
                                      ? "text-emerald-500"
                                      : client.aiScore > 50
                                        ? "text-blue-500"
                                        : "text-zinc-500"
                                  } transition-all duration-1000 shadow-glow`}
                                />
                              </svg>
                              <span className="absolute text-[12px] font-black italic">
                                {client.aiScore || "--"}
                              </span>
                            </div>
                            <span
                              className={`text-[8px] font-black uppercase tracking-widest mt-3 px-2 py-0.5 rounded-full border-4 border-white/10 ${
                                client.aiScoreLabel === "Growth Potential"
                                  ? "text-emerald-400 bg-emerald-500/5"
                                  : client.aiScoreLabel === "High Promise"
                                    ? "text-blue-400 bg-blue-500/5"
                                    : "text-white/20"
                              }`}
                            >
                              {client.aiScoreLabel || "Evaluating"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-8">
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest mb-1 italic">
                              Channel
                            </span>
                            <span className="micro-label px-3 py-1 bg-white/5 rounded-lg border-4 border-white/10 uppercase">
                              {
                                ["Inbound SMS", "Direct Link", "Ref 12"][
                                  Math.floor(Math.random() * 3)
                                ]
                              }
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-8">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter px-3 py-1 rounded-full border-4 border-white/10 bg-zinc-900 inline-block">
                              {client.status}
                            </span>
                          </div>
                        </td>
                        <td className="pr-10 py-8 text-right">
                          <div className="flex justify-end">
                            <button
                              className="w-12 h-12 bg-white/5 border-4 border-white/10 rounded-xl text-zinc-600 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                              aria-label="Quick Actions"
                            >
                              <MoreVertical size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-zinc-900">
              <div className="px-10 py-6 border-b border-white/10 flex items-center justify-between bg-zinc-900">
                <div className="flex items-center gap-6">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">
                    Saved Notes • Business History
                  </span>
                  <div className="h-6 w-px bg-white/5" />
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">
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
                        className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-6 hover:border-emerald-500/30 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
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
                                className="micro-label bg-white/5 px-2 py-0.5 rounded-lg text-zinc-500 border-4 border-white/10 uppercase"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={async () => {
                              if (window.confirm("Delete this note?")) {
                                try {
                                  if (navigator.onLine) {
                                    await deleteDoc(
                                      doc(db, "knowledge", node.id),
                                    );
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
                              }
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
                      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border-4 border-white/10">
                        <Brain size={48} className="opacity-20" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-xl font-black italic uppercase tracking-widest leading-none">
                          List Empty.
                        </p>
                        <p className="text-sm font-medium text-white/40">
                          No saved notes yet.
                        </p>
                      </div>
                      <button
                        onClick={handleIngest}
                        className="micro-label text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        Start Learning
                      </button>
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
            <div className="fixed inset-0 z-50 flex items-center justify-end">
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
                <header className="px-10 py-10 border-b border-white/10 flex items-center justify-between bg-zinc-900">
                  <div className="flex items-center gap-6">
                    <div
                      className="w-20 h-20 bg-emerald-500 text-black rounded-3xl flex items-center justify-center text-3xl font-black italic shadow-2xl"
                      aria-hidden="true"
                    >
                      {selectedCustomer.firstName[0]}
                      {selectedCustomer.lastName[0]}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h2
                          id="modal-client-name"
                          className="text-4xl font-black tracking-tighter uppercase leading-none"
                        >
                          {selectedCustomer.firstName}{" "}
                          {selectedCustomer.lastName}
                        </h2>
                        {selectedCustomer.isHOA && (
                          <div className="micro-label bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-lg">
                            Community Partner
                          </div>
                        )}
                      </div>
                      <p className="text-white/40 font-bold tracking-tight text-lg">
                        {selectedCustomer.address}
                      </p>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 p-8 flex items-center gap-4">
                    <button
                      id="crm-back-button"
                      onClick={() => setSelectedCustomer(null)}
                      className="px-6 py-4 bg-white/5 hover:bg-white text-white hover:text-black rounded-2xl transition-all micro-label font-black uppercase tracking-widest flex items-center gap-2 border-4 border-white/10"
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

                <div
                  className="flex-1 overflow-auto p-10 space-y-10 custom-scrollbar"
                  aria-labelledby="modal-client-name"
                >
                  {/* Agent Intelligence Section */}
                  <section className="bg-emerald-500 rounded-[40px] p-8 text-black relative overflow-hidden shadow-2xl shadow-emerald-500/20">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full -mr-24 -mt-24 opacity-50 blur-3xl animate-pulse" />
                    <div className="flex items-center gap-4 mb-8 relative">
                      <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center">
                        <Brain size={28} className="text-black" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl uppercase tracking-tight leading-none">
                          Client Brief
                        </h3>
                        <p className="text-[10px] font-bold tracking-[0.2em] text-black/40 mt-1 uppercase">
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
                      <div className="space-y-8 relative">
                        <p className="text-xl font-medium text-black leading-tight">
                          "{briefing.summary}"
                        </p>

                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold text-black/40 uppercase">
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
                            <p className="text-[10px] font-bold text-rose-950 uppercase">
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

                        <div className="pt-6 border-t border-black/10 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Zap size={18} className="text-black" />
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
                            className="text-[10px] bg-black text-white px-6 py-3 rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 font-bold uppercase tracking-widest shadow-xl"
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

                  {/* AI Dispatch Section */}
                  <section className="bg-zinc-900/50 rounded-[40px] p-8 border-4 border-white/10 shadow-2xl relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <Phone size={20} className="text-emerald-400" />
                        <h4 className="text-[10px] text-white/40 font-black uppercase tracking-widest">
                          AI Outreach Dispatch
                        </h4>
                      </div>
                      <button
                        onClick={() => simulateCall(selectedCustomer)}
                        disabled={isSimulatingCall}
                        className="px-6 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/20 rounded-xl transition-all micro-label font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {isSimulatingCall
                          ? "Initializing Voice..."
                          : "Launch Meridian Call"}
                      </button>
                    </div>

                    {callSimulation ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-white uppercase italic">
                              Call Status: Complete
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border-4 border-white/10 ${
                              callSimulation.sentiment === "Interested"
                                ? "text-emerald-400 bg-emerald-500/10"
                                : callSimulation.sentiment === "Busy"
                                  ? "text-amber-400 bg-amber-500/10"
                                  : "text-blue-400 bg-blue-500/10"
                            }`}
                          >
                            {callSimulation.sentiment}
                          </span>
                        </div>

                        <div className="p-6 bg-black/40 rounded-3xl border-4 border-white/10 space-y-4">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            Outcome Summary
                          </p>
                          <p className="text-sm font-medium text-white/80 leading-relaxed italic">
                            "{callSimulation.summary}"
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                              Transcript Analysis
                            </p>
                            <button
                              onClick={() => setCallSimulation(null)}
                              className="text-[9px] font-black text-white/20 hover:text-white uppercase"
                            >
                              Reset
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar p-6 bg-zinc-900 border-4 border-white/10 rounded-3xl">
                            <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed">
                              {callSimulation.transcript}
                            </pre>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl">
                          <div className="flex items-center gap-3">
                            <Sparkles size={16} className="text-emerald-400" />
                            <span className="text-[11px] font-black text-white uppercase tracking-tight">
                              Next Logic: {callSimulation.nextStep}
                            </span>
                          </div>
                          <button className="text-[9px] font-black text-emerald-400 hover:underline uppercase">
                            Queue Action
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 gap-4">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border-4 border-white/10">
                          <MessageSquare size={24} className="text-white/20" />
                        </div>
                        <p className="text-xs text-white/20 font-bold uppercase tracking-widest text-center italic">
                          No outreach dispatched for this window.
                        </p>
                      </div>
                    )}
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Left Column: Vision Analysis */}
                    <div className="space-y-8">
                      <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-8">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <Eye size={22} className="text-blue-400" />
                            <h4 className="text-[10px] text-white/40 uppercase">
                              Site Analysis
                            </h4>
                          </div>
                          <div className="flex items-center gap-4">
                            <Link
                              to="/design-studio"
                              state={{ customer: selectedCustomer }}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors uppercase font-black tracking-widest"
                            >
                              Design Grid
                            </Link>
                            <button
                              onClick={() => analyzeProperty(selectedCustomer)}
                              disabled={isAnalyzing}
                              className="text-[10px] text-white/40 hover:text-white disabled:opacity-50 transition-colors underline decoration-white/10 underline-offset-8 uppercase font-black tracking-widest"
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
                                className="group cursor-pointer p-6 rounded-[28px] bg-white/5 border-4 border-white/10 hover:border-blue-500/30 hover:bg-white/[0.08] transition-all"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="text-sm font-black text-white">
                                    {insight.title}
                                  </h5>
                                  <span className="micro-label text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
                                    +{insight.roi} ROI
                                  </span>
                                </div>
                                <p className="text-xs text-white/40 leading-relaxed font-medium">
                                  {insight.description}
                                </p>
                                <button
                                  onClick={() => draftProposal(insight.title)}
                                  disabled={isDraftingProposal}
                                  className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 micro-label text-emerald-400"
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
                            <div className="text-center py-10 space-y-4">
                              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto opacity-20">
                                <Eye size={24} />
                              </div>
                              <p className="text-xs text-white/20 italic font-medium">
                                Visual metrics pending execution.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Property Profile */}
                    <div className="space-y-8">
                      {selectedCustomer.isHOA && (
                        <div className="bg-purple-500/5 rounded-[40px] p-8 border border-purple-500/20 shadow-2xl relative overflow-hidden group/hoa">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl -mr-16 -mt-16" />
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <ShieldAlert
                                size={20}
                                className="text-purple-400"
                              />
                              <h4 className="text-[10px] text-purple-400 font-black uppercase tracking-widest">
                                Community Rules
                              </h4>
                            </div>
                            <button className="text-[9px] font-black text-purple-400/40 hover:text-purple-400 uppercase tracking-widest transition-colors decoration-purple-500/20 underline underline-offset-4">
                              Edit Bylaws
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {selectedCustomer.hoaRules?.map(
                              (rule: string, i: number) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border-4 border-white/10 group-hover/hoa:border-purple-500/20 transition-all"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_10px_#a855f7]" />
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
                        </div>
                      )}

                      <div className="bg-white/5 rounded-[40px] p-10 border-4 border-white/10 shadow-2xl">
                        <h4 className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-10">
                          Property Details
                        </h4>
                        <div className="grid grid-cols-2 gap-y-10">
                          <div className="space-y-1">
                            <p className="text-[10px] opacity-40 uppercase">
                              Size
                            </p>
                            <p className="text-lg font-bold tracking-tight">
                              {selectedCustomer.propertyDetails?.size || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] opacity-40 uppercase">
                              Grass Type
                            </p>
                            <p className="text-lg font-bold tracking-tight">
                              {selectedCustomer.propertyDetails?.grassType ||
                                "N/A"}
                            </p>
                          </div>
                          <div className="col-span-2 space-y-3">
                            <p className="text-[10px] opacity-40 uppercase">
                              Features
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {selectedCustomer.propertyDetails?.features?.map(
                                (f: string, i: number) => (
                                  <span
                                    key={i}
                                    className="text-[10px] bg-white/10 px-3 py-1.5 rounded-xl border-4 border-white/10 text-white/60 font-bold uppercase transition-all hover:bg-white hover:text-black cursor-default"
                                  >
                                    {f}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {proposalDraft && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 border-emerald-500/20 relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16" />
                            <div className="flex items-center justify-between mb-8">
                              <h3
                                id="proposal-draft-label"
                                className="text-[10px] text-emerald-400 font-bold uppercase"
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
                              className="w-full h-80 text-sm text-white/80 font-medium leading-relaxed custom-scrollbar pr-4 mb-8 bg-black/40 p-6 rounded-3xl border-4 border-white/10 focus:border-emerald-500/30 focus:outline-none transition-all resize-none shadow-inner"
                              value={proposalDraft}
                              onChange={(e) => setProposalDraft(e.target.value)}
                            />
                            <button className="w-full bg-emerald-500 text-black rounded-3xl py-5 font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
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
                          className="text-[10px] text-white/40 uppercase tracking-widest"
                        >
                          Site Notes
                        </h3>
                      </div>
                      <div className="flex items-center gap-3" role="status">
                        {isSavingNotes && (
                          <div
                            className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"
                            aria-label="Saving notes"
                          />
                        )}
                        <span className="text-[10px] opacity-20 font-bold italic">
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
                        className="w-full min-h-[220px] bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 text-lg text-white font-medium focus:border-emerald-500/30 focus:outline-none transition-all leading-relaxed placeholder:text-white/10"
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
                      <div className="absolute bottom-6 right-6 flex gap-3 text-[10px] bg-black/60 px-4 py-2 rounded-2xl border-4 border-white/10 text-amber-400 tracking-widest uppercase font-black">
                        <Sparkles size={14} className="shrink-0" />
                        <span>Always saved to the cloud</span>
                      </div>
                    </div>
                  </section>

                  {/* Integration History */}
                  <section className="space-y-6 pb-20">
                    <div className="flex items-center gap-3 px-2">
                      <History size={20} className="text-white/20" />
                      <h4 className="micro-label text-white/40 uppercase">
                        Interaction History
                      </h4>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-8">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-white/5 border-4 border-white/10 flex items-center justify-center">
                              <MessageSquare
                                size={14}
                                className="text-emerald-400"
                              />
                            </div>
                            <span className="text-sm font-black italic uppercase tracking-tight">
                              SMS Messages
                            </span>
                          </div>
                          <span className="micro-label opacity-40">
                            24.0 hours ago
                          </span>
                        </div>
                        <p className="text-sm text-white/60 font-medium leading-relaxed italic border-l-4 border-emerald-500/20 pl-6 py-2">
                          "Discussed the upcoming fertilization schedule. Client
                          indicated high satisfaction with the precision hedge
                          trimming."
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                <footer className="px-10 py-10 border-t border-white/10 bg-black/40 flex gap-6">
                  <Link
                    to="/scheduler"
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
                    to="/invoices"
                    state={{
                      client:
                        selectedCustomer.firstName +
                        " " +
                        selectedCustomer.lastName,
                    }}
                    className="flex-1 py-5 bg-zinc-900 border-4 border-white/10 shadow-2xl text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3"
                  >
                    <FileText size={18} />
                    Generate Invoice
                  </Link>
                </footer>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {showLowStockModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
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
              className="bg-zinc-900 border-4 border-white/10 w-full max-w-lg rounded-[40px] overflow-hidden relative shadow-2xl p-10"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-none">
                    Inventory Critical
                  </h2>
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1">
                    Supply Shortage Detected
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                {lowStockAlert.map((item, i) => (
                  <div
                    key={i}
                    className="bg-white/5 p-6 rounded-3xl border-4 border-white/10 flex items-center justify-between"
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
                        showToast(`Drafting email to ${item.supplierEmail}...`);
                        setShowLowStockModal(false);
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
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
                  className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest border-4 border-white/10 hover:bg-white/10"
                >
                  Cancel Draft
                </button>
                <button
                  onClick={() => setShowLowStockModal(false)}
                  className="flex-1 py-4 bg-emerald-500 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 shadow-xl shadow-emerald-500/20"
                >
                  Proceed with Draft
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
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
              className="bg-zinc-900 border-4 border-white/10 w-full max-w-xl rounded-[40px] overflow-hidden relative shadow-2xl flex flex-col"
            >
              <div className="p-10 border-b border-white/10 bg-zinc-900">
                <div className="flex items-center justify-between mb-2">
                  <h2
                    id="onboard-client-title"
                    className="text-2xl font-black uppercase tracking-tight"
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
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="first-name"
                      className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
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
                      <p className="text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.firstName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="last-name"
                      className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
                    >
                      Last Name
                    </label>
                    <input
                      id="last-name"
                      type="text"
                      required
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
                      <p className="text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="client-email"
                    className="text-[10px] font-black uppercase tracking-widest text-white/60 ml-2"
                  >
                    Email Address
                  </label>
                  <input
                    id="client-email"
                    type="email"
                    required
                    className={`w-full bg-white/5 border ${formErrors.email ? "border-rose-500/50" : "border-white/10"} rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all`}
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                  />
                  {formErrors.email && (
                    <p className="text-[10px] text-rose-500 font-bold ml-2">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="client-phone"
                      className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
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
                      <p className="text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.phone}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="service-address"
                      className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
                    >
                      Service Address
                    </label>
                    <input
                      id="service-address"
                      type="text"
                      required
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
                      <p className="text-[10px] text-rose-500 font-bold ml-2">
                        {formErrors.address}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="intake-notes"
                    className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2"
                  >
                    Initial Intake Notes
                  </label>
                  <textarea
                    id="intake-notes"
                    className="w-full bg-white/5 border-4 border-white/10 rounded-3xl px-6 py-4 text-sm font-bold focus:bg-white/10 focus:border-white/20 transition-all min-h-[120px]"
                    value={newCustomer.notes}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, notes: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-emerald-500 text-black py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
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
                    className="w-full py-6 bg-white/5 border-4 border-white/10 text-white/60 hover:text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
