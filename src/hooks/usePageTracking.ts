import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logEvent } from "firebase/analytics";
import { analytics } from "../lib/firebase";

export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    if (analytics) {
      logEvent(analytics, "page_view", {
        page_path: location.pathname,
        page_title: document.title || location.pathname,
        page_location: window.location.href,
        page_hash: location.hash,
      });
    }
  }, [location]);
}
