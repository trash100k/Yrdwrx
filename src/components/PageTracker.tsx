import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // page-view analytics removed with Firebase (no-op for now)
  }, [location]);

  return null;
}
