
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
} from "lucide-react";
import { useCuttyGuide } from "../contexts/CuttyGuideContext";
import { auth } from "../lib/firebase";

interface SpeechRecognitionType {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionType;
}

export default function BrainChat({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<
    { id: string; text: string; sender: "user" | "agent" }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const { startTour, setFocus } = useCuttyGuide();

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (
        window as unknown as {
          SpeechRecognition: SpeechRecognitionConstructor;
          webkitSpeechRecognition: SpeechRecognitionConstructor;
        }
      ).SpeechRecognition ||
      (
        window as unknown as {
          SpeechRecognition: SpeechRecognitionConstructor;
          webkitSpeechRecognition: SpeechRecognitionConstructor;
        }
      ).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: {
        results: { transcript: string }[][];
      }) => {
        const transcript = event.results[0][0].transcript;
        setQuery((prev) => prev + (prev ? " " : "") + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setQuery("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const walkthroughSteps = [
    {
      targetId: "dashboard-header",
      title: "Dashboard Overview",
      content:
        "This is your main control panel. View daily jobs, crew summaries, and quick stats here.",
      placement: "bottom" as const,
      path: "/",
    },
    {
      targetId: "nav-dashboard",
      title: "Job Board",
      content:
        "Access your schedule to view all active jobs and the daily service summary.",
      placement: "right" as const,
      path: "/",
    },
    {
      targetId: "nav-client-book",
      title: "Client Book",
      content:
        "Manage all your customers here. Check property details and historical job notes.",
      placement: "right" as const,
      path: "/clients",
    },
    {
      targetId: "nav-teams",
      title: "Field Teams",
      content:
        "View crew locations and job progress as it happens in the field.",
      placement: "right" as const,
      path: "/crew-suite",
    },
    {
      targetId: "nav-design-studio",
      title: "Design Matrix",
      content:
        "Plan property projects. Use photos and drawings to design the perfect landscape.",
      placement: "right" as const,
      path: "/design-studio",
    },
    {
      targetId: "nav-inventory",
      title: "Inventory Center",
      content:
        "Track mulch, plants, and tools. Use the scanner for quick material intake.",
      placement: "right" as const,
      path: "/asset-hub",
    },
    {
      targetId: "nav-finances",
      title: "Business Pulse",
      content:
        "Keep an eye on billing and finances. The audit tool helps find missing invoices.",
      placement: "right" as const,
      path: "/capital",
    },
    {
      targetId: "field-mode-toggle",
      title: "Field Mode",
      content:
        "Entering the field? Switch to this high-contrast view made for mobile users in the sun.",
      placement: "right" as const,
      path: "/",
    },
    {
      targetId: "brain-trigger",
      title: "Cutty Help",
      content:
        "I am always here to help you find something or show you the ropes. Just ask.",
      placement: "left" as const,
      path: "/",
    },
  ];

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const userKey = auth.currentUser?.email || "anonymous";
      const hasSeen = localStorage.getItem(`has-seen-walkthrough-${userKey}`);

      if (!hasSeen) {
        setMessages([
          {
            id: String(Date.now()),
            sender: "agent",
            text: "Welcome to Cutty. I see you're new here. Would you like a quick tour of your new dashboard and tools? I can walk you through everything right now.",
          },
        ]);
      } else {
        setMessages([
          {
            id: String(Date.now()),
            sender: "agent",
            text: "Welcome back. How can I help you manage your landscaping crews today?",
          },
        ]);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage = {
      id: String(Date.now()),
      sender: "user" as const,
      text: query,
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentQuery = query.toLowerCase();
    setQuery("");

    // Check for walkthrough request keywords
    const isWalkthroughQuery =
      currentQuery.includes("walkthrough") ||
      currentQuery.includes("tour") ||
      currentQuery.includes("show me around") ||
      currentQuery.includes("demo") ||
      currentQuery.includes("how do i use") ||
      currentQuery.includes("onboarding");

    // If it's a direct 'yes' to an existing prompt
    const isConfirmation =
      messages.length > 0 &&
      messages[messages.length - 1].sender === "agent" &&
      messages[messages.length - 1].text.includes("walkthrough") &&
      (currentQuery.includes("yes") ||
        currentQuery.includes("sure") ||
        currentQuery.includes("ok") ||
        currentQuery.includes("start"));

    if (isConfirmation) {
      const userKey = auth.currentUser?.email || "anonymous";
      localStorage.setItem(`has-seen-walkthrough-${userKey}`, "true");
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: "agent",
          text: "Got it! Starting your tour now...",
        },
      ]);
      setTimeout(() => {
        setIsOpen(false);
        startTour(walkthroughSteps);
      }, 1500);
      return;
    }

    if (isWalkthroughQuery) {
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

    setIsLoading(true);

    try {
      const res = await fetch("/api/brain/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage.text,
          context: "landscaping business Meridian MS",
        }),
      });
      const data = await res.json();

      // Parse for [FOCUS:id] tags
      let botText = data.text;
      const focusMatch = botText.match(/\[FOCUS:([\w-]+)\]/);

      if (focusMatch) {
        const targetId = focusMatch[1];
        const idLabels: Record<string, string> = {
          "dashboard-header": "Dashboard",
          "nav-dashboard": "Scheduler",
          "nav-client-book": "Client Book",
          "nav-teams": "Crew Teams",
          "nav-design-studio": "Design Studio",
          "nav-inventory": "Inventory",
          "nav-finances": "Finances",
          "field-mode-toggle": "Field Mode",
          "brain-trigger": "Chat Assistant",
        };

        const idPaths: Record<string, string> = {
          "dashboard-header": "/",
          "nav-dashboard": "/",
          "nav-client-book": "/clients",
          "nav-teams": "/crew-suite",
          "nav-design-studio": "/design-studio",
          "nav-inventory": "/asset-hub",
          "nav-finances": "/capital",
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-2xl h-[min(800px,85vh)] bg-slate-900 rounded-[40px] shadow-2xl border border-white/5 flex flex-col overflow-hidden relative"
          >
            <header className="px-6 sm:px-10 py-6 sm:py-8 border-b border-white/5 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white">
                  <Brain size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black italic text-white leading-none uppercase">
                    Cutty Help
                  </h3>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-emerald-400 mt-1">
                    Smart Assistant
                  </p>
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

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-8">
                  <Sparkles size={64} className="text-emerald-500/20" />
                  <div className="max-w-md">
                    <h4 className="text-xl font-black italic text-white uppercase tracking-tighter mb-2">
                      Search Assistants
                    </h4>
                    <p className="text-sm font-medium text-white/40 leading-relaxed italic">
                      Ask Cutty anything about your clients, upcoming jobs, or
                      current inventory levels.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => {
                        setQuery("Start the tour");
                        setTimeout(() => handleQuery(), 100);
                      }}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-white hover:text-black transition-all"
                    >
                      Take the Tour
                    </button>
                    <button
                      onClick={() => {
                        setQuery("Help with Job Rules");
                        setTimeout(() => handleQuery(), 100);
                      }}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-400 hover:bg-white hover:text-black transition-all"
                    >
                      Learn: Job Rules
                    </button>
                    <button
                      onClick={() => {
                        setQuery("How to calculate volume?");
                        setTimeout(() => handleQuery(), 100);
                      }}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-400 hover:bg-white hover:text-black transition-all"
                    >
                      Learn: Calculations
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
                        : "bg-white/5 border-white/10 text-emerald-400"
                    }`}
                  >
                    {m.sender === "user" ? (
                      <User size={18} />
                    ) : (
                      <Bot size={18} />
                    )}
                  </div>
                  <div
                    className={`max-w-[70%] px-6 py-4 rounded-[28px] text-sm leading-relaxed shadow-xl ${
                      m.sender === "user"
                        ? "bg-emerald-600 text-white"
                        : "bg-white/5 border border-white/5 text-white/80"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
                    <Bot size={18} />
                  </div>
                  <div className="bg-white/5 border border-white/5 px-6 py-4 rounded-[28px]">
                    <Loader2 size={20} className="animate-spin text-white/50" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-white/5 flex gap-4">
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
                  className="w-full pl-8 pr-16 py-6 bg-white/[0.03] border border-white/5 rounded-3xl text-sm font-black italic focus:outline-none focus:border-emerald-500/30 transition-all text-white placeholder:text-white/50"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
