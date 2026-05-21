
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Battery, ShieldAlert, Zap, Box, MapPin } from "lucide-react";

interface FieldModeContextType {
  isFieldMode: boolean;
  toggleFieldMode: () => void;
  performanceMode: boolean;
  missionPackage: Record<string, unknown> | null;
  isPreloading: boolean;
  leavingSiteAlert: boolean;
  dismissAlert: () => void;
}

const FieldModeContext = createContext<FieldModeContextType | undefined>(
  undefined,
);

export function FieldModeProvider({ children }: { children: React.ReactNode }) {
  const [isFieldMode, setIsFieldMode] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [missionPackage, setMissionPackage] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const [leavingSiteAlert, setLeavingSiteAlert] = useState(false);

  // Sync performance mode with field mode
  useEffect(() => {
    setPerformanceMode(isFieldMode);
    if (isFieldMode) {
      document.body.classList.add("field-mode-active");
    } else {
      document.body.classList.remove("field-mode-active");
    }
  }, [isFieldMode]);

  // Simulated "Preload" protocol
  const preloadMissionData = useCallback(async () => {
    setIsPreloading(true);
    // Simulate Gemini aggregating today's job data, equipment lists, and safety docs
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setMissionPackage({
      timestamp: new Date().toISOString(),
      priorityJobs: [
        "Site Alpha: Hardscape Install",
        "Site Delta: Irrigation Audit",
      ],
      equipmentChecklist: ["Toro Dingo", "Excavation Kit", "Neural Scanner"],
      safetyProtocols: [
        "High Heat Index Warning",
        "Underground Utility Verified",
      ],
    });

    setIsPreloading(false);
  }, []);

  const toggleFieldMode = () => {
    if (!isFieldMode) {
      preloadMissionData();
    } else {
      setMissionPackage(null);
      setLeavingSiteAlert(false);
    }
    setIsFieldMode((prev) => !prev);
  };

  const dismissAlert = () => setLeavingSiteAlert(false);

  // Simulated Geofence Alert
  useEffect(() => {
    if (isFieldMode) {
      if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            // In a real app, compare pos with active job site coords
            // For demo, we simulate "moving away" if we haven't seen an update in a while or a simple toggle
          },
          () => {
            // Silently handle geofence tracking failure
          },
          { enableHighAccuracy: true },
        );

        // Keep the demo timer as a fallback/simulation of leaving
        const timer = setTimeout(() => {
          setLeavingSiteAlert(true);
        }, 45000); // Trigger after 45s for demo

        return () => {
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(timer);
        };
      }
    }
  }, [isFieldMode]);

  return (
    <FieldModeContext.Provider
      value={{
        isFieldMode,
        toggleFieldMode,
        performanceMode,
        missionPackage,
        isPreloading,
        leavingSiteAlert,
        dismissAlert,
      }}
    >
      {children}

      {/* Global Field Mode Indicators */}
      {isFieldMode && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-amber-500 z-[999] shadow-[0_0_15px_#f59e0b] animate-pulse" />
      )}
    </FieldModeContext.Provider>
  );
}

export const useFieldMode = () => {
  const context = useContext(FieldModeContext);
  if (!context)
    throw new Error("useFieldMode must be used within FieldModeProvider");
  return context;
};
