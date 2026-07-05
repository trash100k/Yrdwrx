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

// Accessibility auditing (a11y L1) — dev only. Guarded by import.meta.env.DEV and
// loaded via dynamic import so the whole block is dead-code-eliminated from the
// production bundle. Logs axe-core violations to the console while developing.
if (import.meta.env.DEV) {
  Promise.all([import("react"), import("react-dom"), import("@axe-core/react")])
    .then(([React, ReactDOM, axe]) => {
      const reactAxe = (axe as any).default || axe;
      reactAxe((React as any).default || React, (ReactDOM as any).default || ReactDOM, 1000);
    })
    .catch((e) => console.warn("axe-core (dev a11y) init skipped:", e));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
