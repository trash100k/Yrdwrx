// @ts-nocheck

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Navigation2, Target } from "lucide-react";
import { safeStorage } from "../lib/storage";

interface GuideFocus {
  id: string;
  label: string;
  description?: string;
  rect?: DOMRect | null;
}

interface TourStep {
  targetId: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  path?: string;
}

interface CuttyGuideContextType {
  activeFocus: GuideFocus | null;
  setFocus: (id: string | null, label?: string, description?: string) => void;
  jobStatus: string;
  setJobStatus: (status: string) => void;
  isTourActive: boolean;
  currentTourStep: number;
  tourSteps: TourStep[];
  startTour: (steps: TourStep[]) => void;
  nextTourStep: () => void;
  endTour: () => void;
}

const CuttyGuideContext = createContext<CuttyGuideContextType | undefined>(
  undefined,
);

// Persisted while a tour is running so a page refresh resumes where the user left
// off. Cleared on finish/dismiss. Steps are plain serializable strings, so the
// whole tour survives a reload intact.
const TOUR_STORAGE_KEY = "cutty-tour-state";

function persistTourState(steps: TourStep[], stepIndex: number) {
  try {
    safeStorage.setItem(
      TOUR_STORAGE_KEY,
      JSON.stringify({ active: true, stepIndex, steps }),
    );
  } catch {
    /* storage unavailable — tour still works, just won't survive refresh */
  }
}

function clearTourState() {
  safeStorage.removeItem(TOUR_STORAGE_KEY);
}

// Canonical product walkthrough. Kept here (next to the tour engine) so any
// surface — Cutty chat, Settings "Replay the walkthrough" — can restart the
// same tour without owning its own step list.
export function buildDefaultTourSteps(rolePrefix: string = "/admin"): TourStep[] {
  return [
    {
      targetId: "dashboard-header",
      title: "Dashboard Overview",
      content:
        "This is your main control panel. View daily jobs, crew summaries, and quick stats here.",
      placement: "bottom",
      path: rolePrefix,
    },
    {
      targetId: "nav-dashboard",
      title: "Job Board",
      content:
        "Access your schedule to view all active jobs and the daily service summary.",
      placement: "right",
      path: rolePrefix,
    },
    {
      targetId: "nav-crm",
      title: "Client Book",
      content:
        "Manage all your customers here. Check property details and historical job notes.",
      placement: "right",
      path: `${rolePrefix}/crm`,
    },
    {
      targetId: "nav-crew-suite",
      title: "Field Teams",
      content:
        "View crew locations and job progress as it happens in the field.",
      placement: "right",
      path: `${rolePrefix}/crew-suite`,
    },
    {
      targetId: "nav-inventory",
      title: "Asset Hub & Inventory",
      content:
        "Track your mulch, fertilizer, vehicles, and equipment here so you never run out.",
      placement: "right",
      path: `${rolePrefix}/inventory`,
    },
    {
      targetId: "nav-invoices",
      title: "Finances & Billing",
      content:
        "Invoice clients, track unpaid bills, and monitor your monthly recurring revenue.",
      placement: "right",
      path: `${rolePrefix}/invoices`,
    },
    {
      targetId: "nav-routing",
      title: "Route Optimizer",
      content:
        "Let AI build the most efficient driving routes for your crews to save gas and time.",
      placement: "right",
      path: `${rolePrefix}/routing`,
    },
    {
      targetId: "nav-contracts",
      title: "Recurring Contracts",
      content:
        "Manage HOA agreements, commercial contracts, and automatically renewing subscriptions.",
      placement: "right",
      path: `${rolePrefix}/contracts`,
    },
    {
      targetId: "nav-design-studio",
      title: "Design Matrix",
      content:
        "Plan property projects. Use photos and drawings to design the perfect landscape.",
      placement: "right",
      path: `${rolePrefix}/design-studio`,
    },
    {
      targetId: "brain-trigger",
      title: "Your Copilot",
      content:
        "I am always right here. Ask me to draft proposals, track down gate codes, or optimize routing any time.",
      placement: "left",
      path: rolePrefix,
    },
  ];
}

export function CuttyGuideProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeFocus, setActiveFocus] = useState<GuideFocus | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("Ready to help");
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [tourSteps, setTourSteps] = useState<TourStep[]>([]);

  const setFocus = useCallback(
    (
      id: string | null,
      label?: string,
      description?: string,
      duration = 5000,
    ) => {
      if (!id) {
        setActiveFocus(null);
        return;
      }

      // Set the focus immediately, even when the target element isn't in the DOM
      // yet (lazy route, navigation in flight) or is hidden (zero-size rect). The
      // overlay renders a centered fallback card for rect: null instead of
      // anchoring at 0,0 or showing the previous step's content. The continuous
      // rAF tracker below anchors the rect as soon as the element appears.
      const element = document.getElementById(id);
      const rect = element ? element.getBoundingClientRect() : null;
      const usable = rect && (rect.width > 0 || rect.height > 0);

      // Bring off-screen targets into view so the spotlight lands in the viewport.
      if (element && usable && (rect.top < 0 || rect.bottom > window.innerHeight)) {
        try {
          element.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          /* older browsers: fall through, tooltip clamps into viewport anyway */
        }
      }

      setActiveFocus({
        id,
        label: label || "Target identified",
        description,
        rect: usable ? rect : null,
      });

      if (duration > 0) {
        setTimeout(
          () => setActiveFocus((prev) => (prev?.id === id ? null : prev)),
          duration,
        );
      }
    },
    [],
  );

  // Shared activation used by startTour, nextTourStep, and refresh-resume so the
  // three paths can't drift: set state, persist, navigate, focus.
  const activateStep = (steps: TourStep[], index: number) => {
    const step = steps[index];
    if (!step) return;

    setTourSteps(steps);
    setCurrentTourStep(index);
    setIsTourActive(true);
    persistTourState(steps, index);

    if (step.path && location.pathname !== step.path) {
      navigate(step.path);
    }

    setFocus(step.targetId, step.title, step.content, 0);
  };

  const startTour = (steps: TourStep[]) => {
    if (!steps || steps.length === 0) return;
    activateStep(steps, 0);
  };

  const nextTourStep = () => {
    if (currentTourStep < tourSteps.length - 1) {
      activateStep(tourSteps, currentTourStep + 1);
    } else {
      endTour();
    }
  };

  const endTour = () => {
    setIsTourActive(false);
    setActiveFocus(null);
    clearTourState();
  };

  // Survive refresh: if a tour was mid-flight when the page reloaded, resume at
  // the persisted step (navigating back to its screen). Invalid/stale state is
  // discarded rather than resumed blind.
  useEffect(() => {
    let saved: any = null;
    try {
      const raw = safeStorage.getItem(TOUR_STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    if (!saved) return;

    const valid =
      saved.active === true &&
      Array.isArray(saved.steps) &&
      saved.steps.length > 0 &&
      Number.isInteger(saved.stepIndex) &&
      saved.stepIndex >= 0 &&
      saved.stepIndex < saved.steps.length &&
      saved.steps.every((s: any) => s && typeof s.targetId === "string");

    if (valid) {
      activateStep(saved.steps, saved.stepIndex);
    } else {
      clearTourState();
    }
    // Mount-only: resume once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Continuous tracking for smooth anchoring
  useEffect(() => {
    if (!activeFocus?.id) return;

    let rafId: number;

    const updateRect = () => {
      const el = document.getElementById(activeFocus.id);
      const newRect = el ? el.getBoundingClientRect() : null;
      // A missing or zero-size (hidden) element has no usable anchor — drop the
      // rect so the overlay shows its centered fallback instead of pinning to 0,0.
      const usable = newRect && (newRect.width > 0 || newRect.height > 0);
      setActiveFocus((prev) => {
        if (!prev || prev.id !== activeFocus.id) return prev;
        if (!usable) return prev.rect ? { ...prev, rect: null } : prev;
        // Only update if shifted significantly to prevent react thrashing
        const hasMoved =
          !prev.rect ||
          Math.abs(prev.rect.top - newRect.top) > 0.5 ||
          Math.abs(prev.rect.left - newRect.left) > 0.5 ||
          prev.rect.width !== newRect.width ||
          prev.rect.height !== newRect.height;

        return hasMoved ? { ...prev, rect: newRect } : prev;
      });
      rafId = requestAnimationFrame(updateRect);
    };

    rafId = requestAnimationFrame(updateRect);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [activeFocus?.id]);

  useEffect(() => {
    const handleUpdateRect = () => {
      if (activeFocus && activeFocus.id) {
        const el = document.getElementById(activeFocus.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          const usable = rect.width > 0 || rect.height > 0;
          setActiveFocus((prev) =>
            prev ? { ...prev, rect: usable ? rect : null } : null,
          );
        }
      }
    };

    window.addEventListener("resize", handleUpdateRect);
    window.addEventListener("scroll", handleUpdateRect, true);
    return () => {
      window.removeEventListener("resize", handleUpdateRect);
      window.removeEventListener("scroll", handleUpdateRect, true);
    };
  }, [activeFocus]);

  return (
    <CuttyGuideContext.Provider
      value={{
        activeFocus,
        setFocus,
        jobStatus,
        setJobStatus,
        isTourActive,
        currentTourStep,
        tourSteps,
        startTour,
        nextTourStep,
        endTour,
      }}
    >
      {children}

      {/* Target Highlight Ring */}
      <AnimatePresence>
        {activeFocus?.rect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-[190] pointer-events-none inset-0"
          >
            <motion.div
              initial={{
                top: activeFocus.rect.top - 12,
                left: activeFocus.rect.left - 12,
                width: activeFocus.rect.width + 24,
                height: activeFocus.rect.height + 24,
              }}
              animate={{
                top: activeFocus.rect.top - 12,
                left: activeFocus.rect.left - 12,
                width: activeFocus.rect.width + 24,
                height: activeFocus.rect.height + 24,
              }}
              className="absolute border-2 border-forest-500/30 rounded-2xl"
            >
              <div className="absolute inset-0 bg-forest-500/5 blur-xl rounded-2xl" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CuttyGuideContext.Provider>
  );
}

export function useCuttyGuide() {
  const context = useContext(CuttyGuideContext);
  if (context === undefined) {
    throw new Error("useCuttyGuide must be used within a CuttyGuideProvider");
  }
  return context;
}
