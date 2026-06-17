// @ts-nocheck
import "./init";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// @ts-ignore
import { registerSW } from "virtual:pwa-register";

// Register PWA service worker for offline shell
try {
  if ('serviceWorker' in navigator) {
    registerSW({ 
      immediate: true,
      onRegisterError: (err: any) => {
        console.warn("Service worker registration fallback:", err);
      }
    });
  }
} catch (e) {
  console.warn("Service worker registration failed or is blocked by iframe storage restrictions.");
}

import { auth } from "./lib/firebase";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
