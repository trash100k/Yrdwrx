
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { motion } from "motion/react";
import { auth, db } from "./lib/firebase";
import Dashboard from "./pages/Dashboard";
import RevenueHub from "./pages/RevenueHub";
import CRM from "./pages/CRM";
import Scheduler from "./pages/Scheduler";
import Reports from "./pages/Reports";
import Invoices from "./pages/Invoices";
import Inventory from "./pages/Inventory";
import Reviews from "./pages/Reviews";
import Outbound from "./pages/Outbound";
import MarketInsights from "./pages/MarketInsights";
import HOAPortal from "./pages/HOAPortal";
import GrowthHub from "./pages/GrowthHub";
import OperationsHub from "./pages/OperationsHub";
import CapitalHub from "./pages/CapitalHub";
import AssetHub from "./pages/AssetHub";
import ClientsHub from "./pages/ClientsHub";
import CrewSuite from "./pages/CrewSuite";
import DesignStudio from "./pages/DesignStudio";
import SystemQA from "./pages/SystemQA";
import Onboarding from "./components/Onboarding";
import Layout from "./components/Layout";
import { InfrastructureGuard } from "./components/InfrastructureGuard";
import { TenantProvider } from "./contexts/TenantContext";
import { CuttyGuideProvider } from "./contexts/CuttyGuideContext";
import { FieldModeProvider } from "./contexts/FieldModeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { EnterpriseThemeProvider } from "./contexts/EnterpriseThemeContext";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      /* Use local storage to persist demo mode across reloads */ const isDemoActive =
        localStorage.getItem("cutty-demo-mode") === "active";
      if (isDemoActive && !user) {
        setUser({
          uid: "demo-user",
          displayName: "Demo Mode",
          email: "demo@cutty.io",
        });
        setOnboarded(true);
        setIsDemo(true);
        setLoading(false);
        return;
      }
      if (!isDemo) {
        setUser(user);
      }
      if (user && !isDemo) {
        const settingsRef = doc(db, "settings", user.uid);
        try {
          const settingsSnap = await getDoc(settingsRef);
          if (settingsSnap.exists() && settingsSnap.data().onboardingComplete) {
            setOnboarded(true);
          } else {
            setOnboarded(false);
          }
        } catch (error) {
          console.error("Error fetching settings:", error);
          setOnboarded(false);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isDemo]);
  const enterDemoMode = async (setAuthError: (err: string | null) => void) => {
    setIsDemo(true);
    localStorage.setItem("cutty-demo-mode", "active");
    try {
      /* Attempt anonymous sign-in, but handle failure gracefully */ await signInAnonymously(
        auth,
      );
      setOnboarded(true);
    } catch (error) {
      const err = error as { code?: string };
      /* Check for admin-restricted-operation (provider disabled in console) */ if (
        err.code === "auth/admin-restricted-operation"
      ) {
        console.warn(
          "Anonymous Auth is disabled in Firebase Console. Demo mode will proceed with local state simulation.",
        );
        setAuthError("Demo mode optimized.");
      } else {
        console.error("Demo mode authentication error:", err);
      }
      setUser({
        uid: "demo-user",
        displayName: "Demo Mode",
        email: "demo@cutty.io",
      });
      setOnboarded(true);
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-black">
        {" "}
        <div className="atmosphere" aria-hidden="true" />{" "}
        <div className="text-white/40 animate-pulse font-sans text-sm font-black uppercase tracking-[0.3em] text-center">
          {" "}
          Starting Cutty...{" "}
        </div>{" "}
      </main>
    );
  }
  return (
    <GlobalErrorBoundary>
      {" "}
      <InfrastructureGuard>
        {" "}
        <TenantProvider>
          {" "}
          <EnterpriseThemeProvider>
            {" "}
            <ToastProvider>
              {" "}
              <BrowserRouter>
                {" "}
                <FieldModeProvider>
                  {" "}
                  <CuttyGuideProvider>
                    {" "}
                    <Routes>
                      {" "}
                      {!user ? (
                        <Route
                          path="*"
                          element={
                            <AuthPage
                              onDemoLogin={(setErr) => enterDemoMode(setErr)}
                            />
                          }
                        />
                      ) : !onboarded ? (
                        <Route
                          path="*"
                          element={
                            <Onboarding onComplete={() => setOnboarded(true)} />
                          }
                        />
                      ) : (
                        <Route element={<Layout />}>
                          {" "}
                          <Route path="/" element={<Dashboard />} />{" "}
                          <Route path="/capital" element={<CapitalHub />} />{" "}
                          <Route
                            path="/operations"
                            element={<OperationsHub />}
                          />{" "}
                          <Route path="/growth" element={<GrowthHub />} />{" "}
                          <Route path="/clients" element={<ClientsHub />} />{" "}
                          <Route path="/crew-suite" element={<CrewSuite />} />{" "}
                          <Route path="/asset-hub" element={<AssetHub />} />{" "}
                          <Route
                            path="/design-studio"
                            element={<DesignStudio />}
                          />{" "}
                          <Route
                            path="/revenue"
                            element={<Navigate to="/capital" replace />}
                          />{" "}
                          <Route
                            path="/crm"
                            element={<Navigate to="/clients" replace />}
                          />{" "}
                          <Route path="/scheduler" element={<Scheduler />} />{" "}
                          <Route path="/invoices" element={<Invoices />} />{" "}
                          <Route path="/inventory" element={<Inventory />} />{" "}
                          <Route path="/reviews" element={<Reviews />} />{" "}
                          <Route path="/reports" element={<Reports />} />{" "}
                          <Route
                            path="/insights"
                            element={<MarketInsights />}
                          />{" "}
                          <Route path="/alliances" element={<HOAPortal />} />{" "}
                          <Route path="/qa" element={<SystemQA />} />{" "}
                          <Route
                            path="*"
                            element={<Navigate to="/" replace />}
                          />{" "}
                        </Route>
                      )}{" "}
                    </Routes>{" "}
                  </CuttyGuideProvider>{" "}
                </FieldModeProvider>{" "}
              </BrowserRouter>{" "}
            </ToastProvider>{" "}
          </EnterpriseThemeProvider>{" "}
        </TenantProvider>{" "}
      </InfrastructureGuard>{" "}
    </GlobalErrorBoundary>
  );
}
function AuthPage({
  onDemoLogin,
}: {
  onDemoLogin: (setError: (err: string | null) => void) => void;
}) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Email & Password Auth States */ const [activeTab, setActiveTab] = useState<
    "email" | "google"
  >("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  /* Handle standard Email & Password flow */ const handleEmailAuth = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }
    setIsLoggingIn(true);
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error("Email authentication failure:", err);
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Invalid email or password associated with this profile.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("This email address is already registered. Try signing in.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/operation-not-allowed") {
        /* Fallback or explain gracefully */ console.warn(
          "Email/Password provider is disabled in Firebase console.",
        );
        setError(
          "Standard email/password was not fully configured online. Entering simulated safe local mode...",
        );
        setTimeout(() => {
          localStorage.setItem("cutty-demo-mode", "active");
          window.location.reload();
        }, 3000);
      } else {
        setError(
          err.message ||
            "An error occurred. Please verify your connection or try again.",
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const err = error as { code?: string };
      console.error("Login failed:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("The login popup was closed. Please try again.");
      } else if (err.code === "auth/cancelled-popup-request") {
        setError("Login was cancelled. Please try again.");
      } else {
        setError("Login failed. Make sure popups are enabled and try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };
  return (
    <main className="flex h-screen items-center justify-center bg-black px-6 relative overflow-hidden">
      {" "}
      <div className="atmosphere" aria-hidden="true" />{" "}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full p-10 sm:p-12 text-center border border-white/10 rounded-[40px] shadow-2xl relative z-10"
      >
        {" "}
        <div className="mb-8 flex justify-center">
          {" "}
          <div className="w-20 h-20 bg-white rounded-[28px] flex items-center justify-center text-black shadow-xl">
            {" "}
            <svg viewBox="0 0 24 24" className="w-12 h-12 fill-current">
              {" "}
              <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" />{" "}
            </svg>{" "}
          </div>{" "}
        </div>{" "}
        <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter leading-none mb-3 sf-text-gradient uppercase">
          Cutty
        </h1>{" "}
        <p className="text-zinc-400 mb-8 font-semibold text-sm tracking-wide uppercase">
          Operational Cockpit Portal
        </p>{" "}
        {/* Auth Mode Tabs Block */}{" "}
        <div
          className="flex bg-zinc-950/80 border border-white/5 p-1 rounded-2xl mb-8"
          role="tablist"
        >
          {" "}
          <button
            type="button"
            onClick={() => {
              setActiveTab("email");
              setError(null);
            }}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-bold rounded-xl transition-all ${activeTab === "email" ? "bg-white text-black shadow-md" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            {" "}
            Email Pin{" "}
          </button>{" "}
          <button
            type="button"
            onClick={() => {
              setActiveTab("google");
              setError(null);
            }}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-bold rounded-xl transition-all ${activeTab === "google" ? "bg-white text-black shadow-md" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            {" "}
            Google OAuth{" "}
          </button>{" "}
        </div>{" "}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 text-red-400 rounded-2xl text-xs font-bold border border-red-500/20 text-left leading-relaxed">
            {" "}
            {error}{" "}
          </div>
        )}{" "}
        <div className="space-y-6">
          {" "}
          {activeTab === "email" ? (
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              {" "}
              <div className="space-y-1">
                {" "}
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1 font-medium">
                  Email Address
                </label>{" "}
                <input
                  id="email"
                  aria-label="Email Address"
                  type="email"
                  placeholder="supervisor@landscapes.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-white transition-all font-semibold"
                />{" "}
              </div>{" "}
              <div className="space-y-1">
                {" "}
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1 font-medium">
                  Password Control
                </label>{" "}
                <input
                  id="password"
                  aria-label="Password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-white transition-all font-semibold"
                />{" "}
              </div>{" "}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-2 bg-white text-black font-black uppercase tracking-wider text-xs rounded-xl py-4 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {" "}
                {isLoggingIn ? (
                  <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin block" />
                ) : isSignUp ? (
                  "Create Account Account"
                ) : (
                  "Sign In Securely"
                )}{" "}
              </button>{" "}
              <div className="text-center pt-2">
                {" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 font-bold tracking-wider uppercase transition-colors"
                >
                  {" "}
                  {isSignUp
                    ? "Already registered? Sign In"
                    : "Need credentials? Tap to Sign Up"}{" "}
                </button>{" "}
              </div>{" "}
            </form>
          ) : (
            <div className="space-y-4">
              {" "}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full bg-white text-black rounded-xl py-4.5 font-bold text-sm tracking-tight hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-2xl cursor-pointer"
              >
                {" "}
                {isLoggingIn ? (
                  <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin block" />
                ) : (
                  <>
                    {" "}
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5 fill-current shrink-0"
                    >
                      {" "}
                      <path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5.05,16.25 5.05,12C5.05,7.74 8.36,4.73 12.19,4.73C15.31,4.73 17.09,6.74 17.09,6.74L19.09,4.74C19.09,4.74 16.4,2 12.18,2C6.47,2 2,6.48 2,12C2,17.52 6.47,22 12.18,22C17.55,22 21.5,18.33 21.5,12.63C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />{" "}
                    </svg>{" "}
                    Sign in with Google{" "}
                  </>
                )}{" "}
              </button>{" "}
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-normal">
                Allows direct linking to Google Calendar slots and dispatching
                Gmail reports.
              </p>{" "}
            </div>
          )}{" "}
          <div className="border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={() => onDemoLogin(setError)}
              className="w-full bg-white/5 text-white/50 border border-white/10 hover:border-white/20 rounded-xl py-4.5 font-bold tracking-tight hover:bg-white/10 active:scale-95 transition-all text-xs uppercase"
            >
              Try localized Offline Demo
            </button>
            <p className="mt-6 text-[9px] text-zinc-600 font-medium leading-relaxed max-w-xs mx-auto italic uppercase">
              By authenticating, you agree to the Cutty Privacy and Telemetry
              Policy. Cutty securely processes anonymized aggregate operational
              data to improve models and routing performance.
            </p>
          </div>{" "}
        </div>{" "}
        <p className="mt-8 micro-label">
          {" "}
          Ready to Grow • Powered by Gemini AI{" "}
        </p>{" "}
      </motion.div>{" "}
    </main>
  );
}
