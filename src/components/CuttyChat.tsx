import { fetchApi } from "../lib/api";
import { safeStorage } from '../lib/storage';
// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Brain,
  X,
  Send,
  Sparkles,
  User,
  Bot,
  Loader2,
  Mic,
  MicOff,
  Globe,
  Shield,
  ShieldCheck
} from "lucide-react";
import { useCuttyGuide } from "../contexts/CuttyGuideContext";
import { getCurrentUser, supabase } from "../lib/supabase";
import { useTenant } from "../contexts/TenantContext";
import { TranslatedMessageBubble } from "./TranslatedMessageBubble";
import { playVoice } from "../lib/playVoice";
import { useRole } from "../hooks/useRole";
import { executeAgentAction } from "../lib/agentActions";


import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

// Lightweight intent detection for the TEXT agent. High-confidence verbs map to the SAME
// tool-calls the voice agent uses (executeAgentAction); anything else falls through to Q&A.
function detectAgentIntent(text: string): { name: string; args: any } | null {
  const t = (text || "").trim();
  const low = t.toLowerCase();
  if (!t) return null;
  const amount = () => {
    const m = t.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
    return m ? Number(m[1].replace(/,/g, "")) : undefined;
  };
  const grab = (re: RegExp) => {
    const m = t.match(re);
    return m && m[1] ? m[1].trim().replace(/[.,]$/, "") : undefined;
  };

  if (/\bgate code|lock\s?box code|access code\b/.test(low)) {
    return { name: "set_gate_code", args: { clientName: grab(/for ([A-Za-z .'-]+?)(?: is|,|\.|$)/i), gateCode: grab(/code(?: for .+?)?(?: is| =|:)?\s*([A-Za-z0-9#*]{2,})\b/i) } };
  }
  if (/\b(log (an )?expense|spent|receipt|bought|paid for)\b/.test(low) && amount() !== undefined) {
    return { name: "log_expense", args: { amount: amount(), merchant: grab(/(?:at|from|on) ([A-Za-z0-9 .&'-]+?)(?: for|,|\.|$)/i) } };
  }
  if (/\b(invoice|bill|charge)\b/.test(low) && amount() !== undefined) {
    return { name: "create_invoice", args: { clientName: grab(/(?:invoice|bill|charge)\s+([A-Za-z .'-]+?)(?: for| \$|\d|,|\.|$)/i), amount: amount(), serviceDescription: grab(/for ([A-Za-z0-9 .'-]+?)(?:,|\.|$)/i) } };
  }
  if (/\b(quote|estimate)\b/.test(low) && amount() !== undefined) {
    return { name: "create_quote", args: { clientName: grab(/(?:quote|estimate)\s+(?:for\s+)?([A-Za-z .'-]+?)(?: for| \$|\d|,|\.|$)/i), amount: amount(), serviceDescription: grab(/for ([A-Za-z0-9 .'-]+?)(?:,|\.|$)/i) } };
  }
  if (/\b(schedule|book|set up)\b/.test(low) || /\bput .+ down\b/.test(low)) {
    const date = (t.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i) || [])[0];
    const svc = (t.match(/\b(mow\w*|clean\s?up|trim\w*|mulch\w*|aerat\w*|fertiliz\w*|leaf removal|snow\w*|irrigation|install\w*|landscap\w*)\b/i) || [])[0];
    return { name: "schedule_job", args: { clientName: grab(/(?:for|put|book|schedule) ([A-Za-z .'-]+?)(?: down| for| on| next| tomorrow|,|\.|$)/i), serviceType: svc, date } };
  }
  if (/\b(used|using|took|take|grab\w*|pulled)\b/.test(low) && /\b(mulch|fertiliz\w*|fuel|gas|seed|sod|stone|gravel|bag\w*|gallon\w*|pallet\w*|unit\w*)\b/.test(low)) {
    const qty = (t.match(/\b(\d+)\b/) || [])[1];
    return { name: "log_inventory_usage", args: { itemName: (t.match(/\b(mulch|fertilizer|fuel|gas|seed|sod|stone|gravel)\b/i) || [])[1], quantity: qty ? Number(qty) : 1, clientName: grab(/for ([A-Za-z .'-]+?)(?:'s|,|\.|$)/i) } };
  }
  if (/\bcheck (the )?(stock|inventory)\b/.test(low) || /\bin stock\b/.test(low) || /how (much|many) .+ (do we have|left)/.test(low)) {
    return { name: "check_inventory", args: { itemName: (t.match(/\b(mulch|fertilizer|fuel|gas|seed|sod|stone|gravel)\b/i) || [])[1] } };
  }
  if (/\breview\b/.test(low) && /\b(request|ask|get|remind|send)\b/.test(low)) {
    return { name: "request_review", args: { clientName: grab(/from ([A-Za-z .'-]+?)(?:,|\.|$)/i) } };
  }
  if (/\b(design|redesign|render|mock\s?up|landscape (?:plan|design))\b/.test(low) || /show .+ ideas/.test(low)) {
    return { name: "build_design_vision", args: { clientName: grab(/for ([A-Za-z .'-]+?)(?:,|\.|$)/i) } };
  }
  if (/\b(field mode|start (the )?route|heading out|start my day|on my way)\b/.test(low)) {
    return { name: "enter_field_mode", args: {} };
  }
  if (/\b(add|create|new)\b/.test(low) && /\b(lead|contact|customer|client|prospect)\b/.test(low)) {
    const nm = grab(/(?:named|called|:) ([A-Za-z .'-]+?)(?:,|\.| at | on |$)/i) || grab(/\b(?:lead|contact|customer|client|prospect)\s+(?:named |called )?([A-Za-z]+(?: [A-Za-z]+)?)/i);
    const parts = (nm || "").split(/\s+/);
    return { name: "create_contact", args: { firstName: parts[0] || nm, lastName: parts.slice(1).join(" "), phone: (t.match(/(\+?\d[\d\-() ]{6,}\d)/) || [])[1], email: (t.match(/[\w.+-]+@[\w.-]+\.\w+/) || [])[0] } };
  }
  if (/\b(pull up|look up|open|find|show me)\b/.test(low) && /\b(client|customer|account|profile|file|history)\b/.test(low)) {
    return { name: "load_client_data", args: { clientName: grab(/(?:client|customer|account|profile|file|history)(?: for| named| called| of)? ([A-Za-z .'-]+?)(?:'s|,|\.|$)/i) || grab(/(?:pull up|look up|open|find|show me)(?: the)? ([A-Za-z .'-]+?)(?:'s|,|\.|$)/i) } };
  }
  return null;
}

export default function BrainChat({
  isOpen = true,
  setIsOpen = () => {},
  mode = "overlay",
  hideHeader = false,
}: {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  mode?: "overlay" | "full";
  hideHeader?: boolean;
}) {
  const { transcript: hookTranscript, isListening, startListening, stopListening, setTranscript: setHookTranscript } = useSpeechRecognition();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<
    { id: string; text: string; sender: "user" | "agent" }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedCustomerRef = useRef<any>(null);
  const { startTour, setFocus } = useCuttyGuide();
  const { tenant } = useTenant();
  const { role } = useRole();
  const rolePrefix = role === "employee" || role === "foreman" ? "/employee" : "/admin";

  const loadingMessages = [
    "Initializing secure sandbox...",
    "Verifying tenant boundaries...",
    "Querying encrypted vectors...",
    "Filtering PII patterns...",
    "Generating safe output..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Sync hook transcript to query
  useEffect(() => {
      if (hookTranscript) {
          setQuery(prev => prev + (prev ? " " : "") + hookTranscript);
          setHookTranscript("");
      }
  }, [hookTranscript]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const walkthroughSteps = [
    {
      targetId: "dashboard-header",
      title: "Dashboard Overview",
      content:
        "This is your main control panel. View daily jobs, crew summaries, and quick stats here.",
      placement: "bottom" as const,
      path: rolePrefix,
    },
    {
      targetId: "nav-dashboard",
      title: "Job Board",
      content:
        "Access your schedule to view all active jobs and the daily service summary.",
      placement: "right" as const,
      path: rolePrefix,
    },
    {
      targetId: "nav-crm",
      title: "Client Book",
      content:
        "Manage all your customers here. Check property details and historical job notes.",
      placement: "right" as const,
      path: `${rolePrefix}/crm`,
    },
    {
      targetId: "nav-crew-suite",
      title: "Field Teams",
      content:
        "View crew locations and job progress as it happens in the field.",
      placement: "right" as const,
      path: `${rolePrefix}/crew-suite`,
    },
    {
      targetId: "nav-inventory",
      title: "Asset Hub & Inventory",
      content: "Track your mulch, fertilizer, vehicles, and equipment here so you never run out.",
      placement: "right" as const,
      path: `${rolePrefix}/inventory`,
    },
    {
      targetId: "nav-invoices",
      title: "Finances & Billing",
      content: "Invoice clients, track unpaid bills, and monitor your monthly recurring revenue.",
      placement: "right" as const,
      path: `${rolePrefix}/invoices`,
    },
    {
      targetId: "nav-routing",
      title: "Route Optimizer",
      content: "Let AI build the most efficient driving routes for your crews to save gas and time.",
      placement: "right" as const,
      path: `${rolePrefix}/routing`,
    },
    {
      targetId: "nav-contracts",
      title: "Recurring Contracts",
      content: "Manage HOA agreements, commercial contracts, and automatically renewing subscriptions.",
      placement: "right" as const,
      path: `${rolePrefix}/contracts`,
    },
    {
      targetId: "nav-design-studio",
      title: "Design Matrix",
      content:
        "Plan property projects. Use photos and drawings to design the perfect landscape.",
      placement: "right" as const,
      path: `${rolePrefix}/design-studio`,
    },
    {
      targetId: "brain-trigger",
      title: "Your Copilot",
      content:
        "I am always right here. Ask me to draft proposals, track down gate codes, or optimize routing any time.",
      placement: "left" as const,
      path: rolePrefix,
    },
  ];

  const [activeWorkflow, setActiveWorkflow] = useState<"idle" | "disclaimer" | "tour_prompt" | "onboarding_prop" | "onboarding_bottle">("idle");
  const [onboardingAnswers, setOnboardingAnswers] = useState<{ propertyType: string, bottleneck: string } | null>(null);

  useEffect(() => {
    const handleOpenChat = (e: any) => {
      setIsOpen(true);
      if (e.detail?.initiateOnboarding) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            sender: "agent",
            text: "Let's personalize your dashboard! First, what is your primary landscape property type? (e.g., Commercial, HOA, Private Residential)",
          },
        ]);
        setActiveWorkflow("onboarding_prop");
        setOnboardingAnswers({ propertyType: "", bottleneck: "" });
      }
    };
    document.addEventListener("open-cutty-chat", handleOpenChat);
    return () => document.removeEventListener("open-cutty-chat", handleOpenChat);
  }, [setIsOpen]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const userKey = getCurrentUser()?.email || "anonymous";
      const hasSeen = safeStorage.getItem(`has-seen-walkthrough-${userKey}`);
      const hasAcceptedDisclaimer = tenant?.legal?.aiDisclaimerAccepted === true || tenant?.id.startsWith("demo-");

      if (!hasAcceptedDisclaimer) {
        setActiveWorkflow("disclaimer");
        setMessages([
          {
            id: String(Date.now()),
            sender: "agent",
            text: "Welcome to YardWorx! Before we dive in, please note: our AI provides intelligent suggestions (like routes, estimates, and safety checks), but your field expertise always has the final say. Do you understand and accept this responsibility?",
          },
        ]);
      } else if (!hasSeen) {
        setActiveWorkflow("tour_prompt");
        setMessages([
          {
            id: String(Date.now()),
            sender: "agent",
            text: "Welcome to YardWorx. I see you're new here. Would you like a quick tour of your new dashboard and tools? I can walk you through everything right now.",
          },
        ]);
      } else {
        setActiveWorkflow("idle");
        setMessages([
          {
            id: String(Date.now()),
            sender: "agent",
            text: "Welcome back. How can I help you manage your landscaping crews today?",
          },
        ]);
      }
    }
  }, [isOpen, tenant]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleVoiceAction = (e: CustomEvent) => {
      const { name, args, _result } = e.detail || {};
      // Prefer the executor's real confirmation; fall back to a generic line.
      let text = _result?.message || "";
      if (!text) {
        if (name === "log_inventory_usage") {
          text = `Logged inventory use: ${args.quantity}x ${args.itemName}`;
          if (args.clientName) text += ` for ${args.clientName}`;
          text += ".";
        } else if (name === "check_inventory") {
          text = `Checking inventory for ${args.itemName || "items"}.`;
        } else if (name === "schedule_job") {
          text = `Opened the scheduler to book ${args.clientName || "the client"}.`;
        } else if (name === "load_client_data") {
          text = `Pulled up the profile for ${args.clientName}.`;
        } else if (name === "add_client_note") {
          text = `Added note to ${args.clientName}'s profile.`;
        } else if (name === "create_invoice") {
          text = `Prepared an invoice for ${args.clientName} for $${args.amount}.`;
        } else if (name === "create_lead" || name === "create_contact") {
          text = `Created a new contact for ${args.firstName} ${args.lastName || ""}.`;
        } else if (name === "log_expense") {
          text = `Logged an expense for $${args.amount}.`;
        } else if (name === "enter_field_mode") {
          text = `Entering Field Mode.`;
        } else if (name === "load_employee_data") {
          text = `Looking up crew member ${args.employeeName}.`;
        }
      }

      if (text) {
        setMessages((prev) => [
          ...prev,
          { id: String(Date.now()), sender: "agent", text },
        ]);
        if (!isOpen) setIsOpen(true);
      }
    };

    window.addEventListener("cutty-action", handleVoiceAction as EventListener);
    return () =>
      window.removeEventListener(
        "cutty-action",
        handleVoiceAction as EventListener,
      );
  }, [isOpen, setIsOpen]);

  const handleQuery = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    // overrideText lets tappable quick-reply chips drive the conversation without
    // the user having to type (the whole point: a contractor with muddy hands on a
    // phone taps "Yes" instead of typing it).
    const submitted = (overrideText ?? query).trim();
    if (!submitted || isLoading) return;

    const userMessage = {
      id: String(Date.now()),
      sender: "user" as const,
      text: submitted,
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentQuery = submitted.toLowerCase();
    setQuery("");

    if (activeWorkflow === "disclaimer") {
      if (
        currentQuery.includes("yes") ||
        currentQuery.includes("agree") ||
        currentQuery.includes("accept") ||
        currentQuery.includes("understand") ||
        currentQuery.includes("ok")
      ) {
         if (tenant && !tenant.id.startsWith("demo-")) {
            supabase
              .from("tenants")
              .update({ legal: { aiDisclaimerAccepted: true, acceptedAt: new Date().toISOString() } })
              .eq("id", tenant.id)
              .then(() => {}, (err) => console.error(err));
         }
         
         const userKey = getCurrentUser()?.email || "anonymous";
         const hasSeen = safeStorage.getItem(`has-seen-walkthrough-${userKey}`);
         
         if (!hasSeen) {
           setActiveWorkflow("tour_prompt");
           setMessages((prev) => [
             ...prev,
             {
               id: String(Date.now()),
               sender: "agent",
               text: "Perfect, thank you! I see you're new here. Would you like a quick tour of your new dashboard and tools? I can walk you through everything right now.",
             },
           ]);
         } else {
           setActiveWorkflow("idle");
           setMessages((prev) => [
             ...prev,
             {
               id: String(Date.now()),
               sender: "agent",
               text: "Perfect, thank you! How can I help you manage your landscaping crews today?",
             },
           ]);
         }
         return;
      } else {
         setMessages((prev) => [
           ...prev,
           {
             id: String(Date.now()),
             sender: "agent",
             text: "I understand. Please note that to use the AI features of the platform, you must accept that you are ultimately responsible for verifying field compliance and estimates.",
           },
         ]);
         return;
      }
    }

    if (activeWorkflow === "tour_prompt") {
      if (
        currentQuery.includes("yes") ||
        currentQuery.includes("sure") ||
        currentQuery.includes("ok") ||
        currentQuery.includes("start")
      ) {
        setActiveWorkflow("onboarding_prop");
        setOnboardingAnswers({ propertyType: "", bottleneck: "" });
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            sender: "agent",
            text: "Got it! Let's personalize your dashboard first. What is your primary landscape property type? (e.g., Commercial, HOA, Private Residential)",
          },
        ]);
        return;
      } else {
        setActiveWorkflow("idle");
        const userKey = getCurrentUser()?.email || "anonymous";
        safeStorage.setItem(`has-seen-walkthrough-${userKey}`, "true");
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            sender: "agent",
            text: "No problem. I'll be right here in the corner if you need to run a routing check, draft client updates, or quickly pull inventory counts.",
          },
        ]);
        return;
      }
    }

    if (activeWorkflow === "onboarding_prop") {
      setOnboardingAnswers(prev => prev ? { ...prev, propertyType: currentQuery } : null);
      setActiveWorkflow("onboarding_bottle");
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: "agent",
          text: "Great! And what is your biggest administrative bottleneck? (e.g., Routing/Dispatch, Sales/Outreach, Inventory)",
        },
      ]);
      return;
    }

    if (activeWorkflow === "onboarding_bottle") {
      const bottleneckStr = currentQuery.includes("rout") || currentQuery.includes("dispatch") ? "Routing/Crew Dispatch" : 
                           currentQuery.includes("sale") || currentQuery.includes("outreach") ? "Sales & Client outreach" : "Supply inventory checks";
      const propertyTypeStr = onboardingAnswers?.propertyType || "";
      
      setOnboardingAnswers(null);
      setActiveWorkflow("idle");
      window.dispatchEvent(new CustomEvent("configure-dashboard-widgets", { detail: { propertyType: propertyTypeStr, bottleneck: bottleneckStr, viewStyle: "easy" } }));
      
      const userKey = getCurrentUser()?.email || "anonymous";
      safeStorage.setItem(`has-seen-walkthrough-${userKey}`, "true");

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: "agent",
          text: `Perfect! I've automatically highlighted ${bottleneckStr} widgets on your dashboard. Now, let's start the tour...`,
        },
      ]);
      setTimeout(() => {
        setIsOpen(false);
        startTour(walkthroughSteps);
      }, 3000);
      return;
    }

    // Checking explicit triggers outside of strict workflows
    const isWalkthroughQuery =
      currentQuery.includes("walkthrough") ||
      currentQuery.includes("tour") ||
      currentQuery.includes("show me around") ||
      currentQuery.includes("demo") ||
      currentQuery.includes("how do i use") ||
      currentQuery.includes("onboarding");

    if (isWalkthroughQuery) {
      setActiveWorkflow("tour_prompt");
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: "agent",
          text: "I can show you around the new dashboard and tools. Would you like to start the walkthrough?",
        },
      ]);
      return;
    }

    if (currentQuery.includes("generate a new widget") || currentQuery.includes("make widget") || currentQuery.includes("make a widget")) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            sender: "agent",
            text: "Ok, I've compiled a dynamic AI widget for top-selling services and injected it into your workspace schema. Please check your Dashboard.",
          },
        ]);
        window.dispatchEvent(new CustomEvent("add-dynamic-widget", { detail: { id: "top_services", type: "services" }}));
        return;
    }

    // Real agentic action? Route it through the shared executor so the text agent DOES
    // things (create contact / job / invoice / expense / etc.), not just answer questions.
    const intent = detectAgentIntent(userMessage.text);
    if (intent) {
      setIsLoading(true);
      try {
        const result = await executeAgentAction(intent, {
          navigate,
          rolePrefix,
          getLoadedCustomer: () => loadedCustomerRef.current,
          setLoadedCustomer: (c) => {
            loadedCustomerRef.current = c;
          },
        });
        setMessages((prev) => [
          ...prev,
          { id: String(Date.now()), sender: "agent", text: result.message },
        ]);
        if (result.navigateTo && location.pathname !== result.navigateTo) {
          navigate(result.navigateTo);
        }
        if ((tenant?.settings as any)?.voiceEnabled !== false) playVoice(result.message);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetchApi("/api/brain/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage.text,
          context: "landscaping business operator",
        }),
      });
      const data = await res.json();

      // Parse for [FOCUS:id] tags
      let botText = data.text || (data.error ? `Server Error: ${data.error}` : "Sorry, I am unable to process that right now.");
      const focusMatch = typeof botText === "string" ? botText.match(/\[FOCUS:([\w-]+)\]/) : null;

      if (focusMatch) {
        const targetId = focusMatch[1];
        const idLabels: Record<string, string> = {
          "dashboard-header": "Dashboard",
          "nav-dashboard": "Scheduler",
          "nav-crm": "CRM",
          "nav-crew-suite": "Crew Suite",
          "nav-design-studio": "Design Studio",
          "nav-inventory": "Inventory",
          "nav-invoices": "Invoices",
          "nav-routing": "Routing",
          "nav-contracts": "Estimates & Contracts",
          "nav-compliance": "Compliance",
          "nav-saas-admin": "SaaS Admin",
          "nav-reports": "Reports",
          "nav-agent": "Copilot",
          "nav-settings": "Settings",
          "brain-trigger": "Chat Assistant",
        };

        const idPaths: Record<string, string> = {
          "dashboard-header": rolePrefix,
          "nav-dashboard": rolePrefix,
          "nav-crm": `${rolePrefix}/crm`,
          "nav-crew-suite": `${rolePrefix}/crew-suite`,
          "nav-design-studio": `${rolePrefix}/design-studio`,
          "nav-inventory": `${rolePrefix}/inventory`,
          "nav-invoices": `${rolePrefix}/invoices`,
          "nav-routing": `${rolePrefix}/routing`,
          "nav-contracts": `${rolePrefix}/contracts`,
          "nav-compliance": `${rolePrefix}/compliance`,
          "nav-saas-admin": "/saas-admin",
          "nav-reports": `${rolePrefix}/reports`,
          "nav-agent": `${rolePrefix}/agent`,
          "nav-settings": `${rolePrefix}/settings`,
        };

        if (idPaths[targetId] && location.pathname !== idPaths[targetId]) {
          navigate(idPaths[targetId]);
        }

        // Remove the tag from visible text
        botText = botText.replace(/\[FOCUS:[\w-]+\]/, "").trim();

        // Trigger focus highlight
        setTimeout(() => {
          setFocus(
            targetId,
            idLabels[targetId] || "Feature",
            "I've highlighted this area for you.",
          );
          setIsOpen(false);
        }, 800);
      }

      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), sender: "agent", text: botText },
      ]);
      if ((tenant?.settings as any)?.voiceEnabled !== false) {
        playVoice(botText);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: "agent",
          text: "I had trouble finding that information. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Tappable answers for the guided first-run conversation. A tech-illiterate
  // contractor should never have to type during onboarding — they tap a big chip.
  // Empty array → no chips (free-form chat), so this only shows during a workflow.
  const quickReplies: string[] = (() => {
    if (isLoading) return [];
    switch (activeWorkflow) {
      case "disclaimer":
        return ["Yes, I understand", "Tell me more"];
      case "tour_prompt":
        return ["Yes, show me around", "Skip for now"];
      case "onboarding_prop":
        return ["Residential", "HOA", "Commercial"];
      case "onboarding_bottle":
        return ["Routing & Dispatch", "Sales & Outreach", "Inventory"];
      default:
        return [];
    }
  })();

  const content = (
    <div className={`w-full flex flex-col relative overflow-hidden ${mode === 'overlay' ? 'max-w-2xl h-[min(800px,85vh)] bg-slate-900 rounded-2xl shadow-2xl border border-white/5' : 'h-full bg-transparent'}`}>
      {!hideHeader && (
        <header className="px-6 sm:px-10 py-6 sm:py-8 border-b border-white/5 molten-edge flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-forest-600 rounded-2xl flex items-center justify-center text-white">
              <Brain size={24} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black italic text-white leading-none uppercase">
                YardPilot
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[9px] sm:text-xs md:text-[10px] uppercase tracking-widest font-black text-forest-400">
                  Enterprise Agent
                </p>
                {tenant?.settings?.features?.aiOmnilingual && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-celtic-500/20 text-celtic-400 rounded border border-celtic-500/30 text-[8px] uppercase tracking-widest font-black" title="AI Omnilingual Real-Rime Translation Active">
                    <Globe size={10} /> Omni-Translating
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close dialog"
            className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </header>
      )}

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-8">
                  <div className="relative">
                    <Shield size={64} className="text-forest-500/20 absolute -inset-2 blur-xl" />
                    <Shield size={64} className="text-forest-500/40 relative z-10" />
                  </div>
                  <div className="max-w-md">
                    <h4 className="text-xl font-black italic text-white uppercase tracking-normal md:tracking-tighter mb-2">
                      Secure Agentic Environment
                    </h4>
                    <p className="text-sm font-medium text-white/40 leading-relaxed italic">
                      I am your bounded enterprise copilot. Actions are strictly confined to permitted workflows to ensure data protection and deterministic results.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {/* Honest example prompts — they pre-fill the composer; you edit + send,
                        and the agent actually performs the action. */}
                    <button
                      onClick={() => setQuery("Add a lead named ")}
                      className="px-4 py-2 bg-forest-500/10 border border-forest-500/20 rounded-full text-xs md:text-[10px] font-black uppercase tracking-widest text-forest-400 hover:bg-forest-500 hover:text-black transition-all"
                    >
                      Add a lead
                    </button>
                    <button
                      onClick={() => setQuery("Schedule a mowing for ")}
                      className="px-4 py-2 bg-forest-500/10 border border-forest-500/20 rounded-full text-xs md:text-[10px] font-black uppercase tracking-widest text-forest-400 hover:bg-forest-500 hover:text-black transition-all"
                    >
                      Schedule a job
                    </button>
                    <button
                      onClick={() => setQuery("Draft an invoice for  for $")}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs md:text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white hover:text-black transition-all"
                    >
                      Draft an invoice
                    </button>
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-4 ${m.sender === "user" ? "flex-row-reverse text-right" : ""}`}
                >
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                      m.sender === "user"
                        ? "bg-white border-white text-black"
                        : "bg-white/5 border-white/10 text-forest-400"
                    }`}
                  >
                    {m.sender === "user" ? (
                      <User size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                  </div>
                  <TranslatedMessageBubble text={m.text} sender={m.sender as "user" | "bot"} targetLanguage="es" />
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-forest-500/30 flex items-center justify-center text-forest-400 relative overflow-hidden">
                    <div className="absolute inset-0 bg-forest-500/10 animate-pulse"></div>
                    <Shield size={18} className="relative z-10" />
                  </div>
                  <div className="bg-forest-500/5 border border-forest-500/10 px-6 py-4 rounded-[28px] pr-8">
                    <div className="flex items-center gap-3">
                      <Loader2 size={16} className="animate-spin text-forest-500" />
                      <span className="text-xs font-mono text-forest-400 font-bold uppercase tracking-widest">{loadingMessages[loadingStep]}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-white/5 flex flex-col gap-4">
              {quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {quickReplies.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleQuery(undefined, label)}
                      className="px-5 py-3 rounded-2xl bg-forest-600 hover:bg-forest-500 active:scale-95 text-white text-base font-black transition-all shadow-lg"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-4">
              <button
                type="button"
                onClick={toggleListening}
                aria-label={isListening ? "Stop listening" : "Start listening"}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                }`}
              >
                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              <form onSubmit={handleQuery} className="flex-1 relative">
                <input
                  type="text"
                  aria-label="Search or ask a question"
                  placeholder={
                    isListening ? "Listening..." : "Search for something..."
                  }
                  className="w-full min-w-0 pl-8 pr-16 py-6 bg-white/[0.03] border border-white/5 rounded-3xl text-base sm:text-sm font-black italic focus:outline-none focus:border-forest-500/30 transition-all text-white placeholder:text-white/50"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  disabled={!query.trim() || isLoading}
                  aria-label="Send message"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-2xl"
                >
                  <Send size={24} />
                </button>
              </form>
              </div>
            </div>
          </div>
  );

  if (mode === "full") {
    return content;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full flex justify-center items-center h-full relative max-w-2xl"
          >
            {content}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
