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

interface GuideFocus {
  id: string;
  label: string;
  description?: string;
  rect?: DOMRect;
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

      // Try multiple times to find the element (handles lazy loading/navigation)
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds at 100ms interval

      const tryFocus = () => {
        const element = document.getElementById(id);
        if (element) {
          const rect = element.getBoundingClientRect();
          // If the element has no size yet, it might still be rendering
          if (rect.width === 0 && rect.height === 0 && attempts < maxAttempts) {
            attempts++;
            requestAnimationFrame(tryFocus);
            return;
          }

          setActiveFocus({
            id,
            label: label || "Target identified",
            description,
            rect,
          });

          if (duration > 0) {
            setTimeout(
              () => setActiveFocus((prev) => (prev?.id === id ? null : prev)),
              duration,
            );
          }
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryFocus, 100);
        }
      };

      tryFocus();
    },
    [],
  );

  const startTour = (steps: TourStep[]) => {
    setTourSteps(steps);
    setCurrentTourStep(0);
    setIsTourActive(true);

    if (steps[0].path && location.pathname !== steps[0].path) {
      navigate(steps[0].path);
    }

    setFocus(steps[0].targetId, steps[0].title, steps[0].content, 0);
  };

  const nextTourStep = () => {
    if (currentTourStep < tourSteps.length - 1) {
      const nextIndex = currentTourStep + 1;
      const nextStep = tourSteps[nextIndex];
      setCurrentTourStep(nextIndex);

      if (nextStep.path && location.pathname !== nextStep.path) {
        navigate(nextStep.path);
      }

      setFocus(nextStep.targetId, nextStep.title, nextStep.content, 0);
    } else {
      endTour();
    }
  };

  const endTour = () => {
    setIsTourActive(false);
    setActiveFocus(null);
  };

  // Continuous tracking for smooth anchoring
  useEffect(() => {
    if (!activeFocus?.id) return;

    let rafId: number;

    const updateRect = () => {
      const el = document.getElementById(activeFocus.id);
      if (el) {
        const newRect = el.getBoundingClientRect();
        setActiveFocus((prev) => {
          if (!prev || prev.id !== activeFocus.id) return prev;
          // Only update if shifted significantly to prevent react thrashing
          const hasMoved =
            !prev.rect ||
            Math.abs(prev.rect.top - newRect.top) > 0.5 ||
            Math.abs(prev.rect.left - newRect.left) > 0.5 ||
            prev.rect.width !== newRect.width ||
            prev.rect.height !== newRect.height;

          return hasMoved ? { ...prev, rect: newRect } : prev;
        });
      }
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
          setActiveFocus((prev) => (prev ? { ...prev, rect } : null));
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
              className="absolute border-2 border-emerald-500/30 rounded-2xl"
            >
              <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-2xl" />
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
