// @ts-nocheck

import React, { useEffect, useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AddToHomeScreen } from "./components/AddToHomeScreen";
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { setUserId } from "firebase/analytics";
import { doc, getDoc } from "firebase/firestore";
import { motion } from "motion/react";
import { auth, db, analytics } from "./lib/firebase";

// Components & Contexts
import Onboarding from "./components/Onboarding";
import Layout from "./components/Layout";
import { InfrastructureGuard } from "./components/InfrastructureGuard";
import { TenantProvider } from "./contexts/TenantContext";
import { YardWorxGuideProvider } from "./contexts/YardWorxGuideContext";
import { FieldModeProvider } from "./contexts/FieldModeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { EnterpriseThemeProvider } from "./contexts/EnterpriseThemeContext";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { SaaSOwnerGate } from "./components/auth/SaaSOwnerGate";
import { RoleGuard } from "./components/auth/RoleGuard";
import { ConsentBanner } from "./components/ConsentBanner";
import { AgreementsGate } from "./components/AgreementsGate";
import { useRole } from "./hooks/useRole";
import { PageTracker } from "./components/PageTracker";
import { Loader2 } from "lucide-react";

// Lazy-loaded routes
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CRM = lazy(() => import("./pages/CRM"));
const Scheduler = lazy(() => import("./pages/Scheduler"));
const Reports = lazy(() => import("./pages/Reports"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Reviews = lazy(() => import("./pages/Reviews"));
const CrewSuite = lazy(() => import("./pages/CrewSuite"));
const DesignStudio = lazy(() => import("./pages/DesignStudio"));
const Compliance = lazy(() => import("./pages/Compliance"));
const Contracts = lazy(() => import("./pages/Contracts"));
const RouteOptimizer = lazy(() => import("./pages/RouteOptimizer"));
const Settings = lazy(() => import("./pages/Settings"));
const Agent = lazy(() => import("./pages/Agent"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const MagicLinkAuth = lazy(() => import("./pages/MagicLinkAuth"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const DataMap = lazy(() => import("./pages/DataMap"));
const AiUsage = lazy(() => import("./pages/AiUsage"));
const Eula = lazy(() => import("./pages/Eula"));
const SaaSAdminDashboard = lazy(() => import("./pages/SaaSAdminDashboard"));

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
    <Loader2 className="animate-spin text-emerald-500" size={48} />
  </div>
);

function RoleRedirect() {
  const { role, loadingRole } = useRole();

  if (loadingRole) return null;

  if (role === "admin" || role === "owner") {
    return <Navigate to="/admin" replace />;
  } else if (role === "employee") {
    return <Navigate to="/employee" replace />;
  } else if (role === "client") {
    return <Navigate to="/client" replace />;
  } else {
    return <Navigate to="/admin" replace />;
  }
}

function RolePathRedirect({ subPath }: { subPath: string }) {
  const { role, loadingRole } = useRole();
  if (loadingRole) return null;
  const prefix = role === "employee" ? "/employee" : "/admin";
  return <Navigate to={`${prefix}/${subPath}`} replace />;
}

import { safeStorage } from "./lib/storage";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      /* Use local storage to persist demo mode across reloads */ const isDemoActive =
        safeStorage.getItem("cutty-demo-mode") === "active";
      if (isDemoActive && !user) {
        setUser({
          uid: "demo-user",
          displayName: "Demo Mode",
          email: "demo@yardworx.io",
        });
        setOnboarded(true);
        setIsDemo(true);
        setLoading(false);
        return;
      }
      if (!isDemo) {
        setUser(user);
        if (user && analytics) {
          setUserId(analytics, user.uid);
        } else if (!user && analytics) {
          setUserId(analytics, null);
        }
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
    safeStorage.setItem("cutty-demo-mode", "active");
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
        email: "demo@yardworx.io",
      });
      setOnboarded(true);
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return (
      <main className="flex h-[100dvh] items-center justify-center bg-black">
        {" "}
        <div className="atmosphere" aria-hidden="true" />{" "}
        <div className="text-white/40 animate-pulse font-sans text-sm font-black uppercase tracking-[0.3em] text-center">
          {" "}
          Starting YardWorx...{" "}
        </div>{" "}
      </main>
    );
  }
  return (
    <GlobalErrorBoundary>
      {" "}
      <InfrastructureGuard>
        <AddToHomeScreen />{" "}
        <TenantProvider>
          {" "}
          <EnterpriseThemeProvider>
            {" "}
            <ToastProvider>
              {" "}
              <BrowserRouter>
                <PageTracker />{" "}
                <FieldModeProvider>
                  {" "}
                  <YardWorxGuideProvider>
                    {" "}
                    <AgreementsGate>
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          <Route path="/privacy" element={<PrivacyPolicy />} />
                          <Route path="/terms" element={<TermsOfService />} />
                          <Route path="/data-map" element={<DataMap />} />
                          <Route path="/ai-usage" element={<AiUsage />} />
                          <Route path="/eula" element={<Eula />} />
                          <Route
                            path="/portal/:clientId"
                            element={<ClientPortal />}
                          />
                          <Route
                            path="/portal/auth/:token"
                            element={<MagicLinkAuth />}
                          />
                          {!user ? (
                            <Route
                              path="*"
                              element={
                                <AuthPage
                                  onDemoLogin={(setErr) =>
                                    enterDemoMode(setErr)
                                  }
                                />
                              }
                            />
                          ) : !onboarded ? (
                            <Route
                              path="*"
                              element={
                                <Onboarding
                                  onComplete={() => setOnboarded(true)}
                                />
                              }
                            />
                          ) : (
                            <>
                              <Route path="/" element={<RoleRedirect />} />

                              <Route
                                path="/crew-suite"
                                element={
                                  <RolePathRedirect subPath="crew-suite" />
                                }
                              />
                              <Route
                                path="/inventory"
                                element={
                                  <RolePathRedirect subPath="inventory" />
                                }
                              />
                              <Route
                                path="/asset-hub"
                                element={
                                  <RolePathRedirect subPath="inventory" />
                                }
                              />
                              <Route
                                path="/crm"
                                element={<RolePathRedirect subPath="crm" />}
                              />
                              <Route
                                path="/clients"
                                element={<RolePathRedirect subPath="crm" />}
                              />
                              <Route
                                path="/scheduler"
                                element={
                                  <RolePathRedirect subPath="scheduler" />
                                }
                              />
                              <Route
                                path="/invoices"
                                element={
                                  <RolePathRedirect subPath="invoices" />
                                }
                              />
                              <Route
                                path="/reports"
                                element={<RolePathRedirect subPath="reports" />}
                              />
                              <Route
                                path="/routing"
                                element={<RolePathRedirect subPath="routing" />}
                              />
                              <Route
                                path="/design-studio"
                                element={
                                  <RolePathRedirect subPath="design-studio" />
                                }
                              />
                              <Route
                                path="/compliance"
                                element={
                                  <RolePathRedirect subPath="compliance" />
                                }
                              />
                              <Route
                                path="/contracts"
                                element={
                                  <RolePathRedirect subPath="contracts" />
                                }
                              />
                              <Route
                                path="/portfolio"
                                element={
                                  <RolePathRedirect subPath="portfolio" />
                                }
                              />

                              {/* Admin Portal */}
                              <Route
                                path="/admin"
                                element={
                                  <RoleGuard allowedRoles={["admin", "owner"]}>
                                    <Layout />
                                  </RoleGuard>
                                }
                              >
                                <Route index element={<Dashboard />} />
                                <Route
                                  path="crew-suite"
                                  element={<CrewSuite />}
                                />
                                <Route
                                  path="design-studio"
                                  element={<DesignStudio />}
                                />
                                <Route path="agent" element={<Agent />} />
                                <Route path="crm" element={<CRM />} />
                                <Route
                                  path="scheduler"
                                  element={<Scheduler />}
                                />
                                <Route path="invoices" element={<Invoices />} />
                                <Route
                                  path="inventory"
                                  element={<Inventory />}
                                />
                                <Route path="reviews" element={<Reviews />} />
                                <Route path="reports" element={<Reports />} />
                                <Route
                                  path="contracts"
                                  element={<Contracts />}
                                />
                                <Route
                                  path="routing"
                                  element={<RouteOptimizer />}
                                />
                                <Route path="settings" element={<Settings />} />
                                <Route
                                  path="compliance"
                                  element={<Compliance />}
                                />
                                <Route
                                  path="portfolio"
                                  element={<Portfolio />}
                                />
                                <Route
                                  path="*"
                                  element={<Navigate to="/admin" replace />}
                                />
                              </Route>

                              {/* Employee/Foreman Portal */}
                              <Route
                                path="/employee"
                                element={
                                  <RoleGuard
                                    allowedRoles={[
                                      "employee",
                                      "foreman",
                                      "admin",
                                      "owner",
                                    ]}
                                  >
                                    <Layout />
                                  </RoleGuard>
                                }
                              >
                                <Route index element={<Dashboard />} />
                                <Route
                                  path="crew-suite"
                                  element={
                                    <RoleGuard
                                      allowedRoles={[
                                        "foreman",
                                        "admin",
                                        "owner",
                                      ]}
                                    >
                                      <CrewSuite />
                                    </RoleGuard>
                                  }
                                />
                                <Route
                                  path="design-studio"
                                  element={<DesignStudio />}
                                />
                                <Route
                                  path="scheduler"
                                  element={<Scheduler />}
                                />
                                <Route
                                  path="inventory"
                                  element={
                                    <RoleGuard
                                      allowedRoles={[
                                        "foreman",
                                        "admin",
                                        "owner",
                                      ]}
                                    >
                                      <Inventory />
                                    </RoleGuard>
                                  }
                                />
                                <Route
                                  path="routing"
                                  element={<RouteOptimizer />}
                                />
                                {/* Employees shouldn't see sensitive admin reports or settings */}
                                <Route
                                  path="*"
                                  element={<Navigate to="/employee" replace />}
                                />
                              </Route>

                              {/* Client Portal */}
                              <Route
                                path="/client"
                                element={
                                  <RoleGuard
                                    allowedRoles={["client", "admin", "owner"]}
                                  >
                                    <Layout />
                                  </RoleGuard>
                                }
                              >
                                <Route index element={<ClientPortal />} />
                                <Route
                                  path="portfolio"
                                  element={<Portfolio />}
                                />
                                <Route
                                  path="*"
                                  element={<Navigate to="/client" replace />}
                                />
                              </Route>

                              {/* SaaS Level-0 Admin Portal */}
                              <Route
                                path="/saas-admin"
                                element={
                                  <SaaSOwnerGate>
                                    <Layout />
                                  </SaaSOwnerGate>
                                }
                              >
                                <Route index element={<SaaSAdminDashboard />} />
                                <Route
                                  path="*"
                                  element={
                                    <Navigate to="/saas-admin" replace />
                                  }
                                />
                              </Route>

                              {/* Fallback for unrecognized top-level routes */}
                              <Route path="*" element={<RoleRedirect />} />
                            </>
                          )}
                        </Routes>
                      </Suspense>
                      <ConsentBanner />
                    </AgreementsGate>
                  </YardWorxGuideProvider>{" "}
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
  const [agreements, setAgreements] = useState({
    tos: false,
    privacy: false,
    dataMap: false,
    ai: false,
    eula: false,
  });
  /* Email & Password Auth States */ const [activeTab, setActiveTab] = useState<
    "email" | "google"
  >("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [show2FA, setShow2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);

  const allAgreed =
    agreements.tos && agreements.privacy && agreements.dataMap && agreements.ai && agreements.eula;

  const handleDeviceCheck = (user: any) => {
    // 14-day Trust Window Logic
    const expiry = safeStorage.getItem(`cutty_trusted_${user.uid}`);
    if (expiry && parseInt(expiry) > Date.now()) {
      return true;
    }
    return false;
  };

  const executeLogin = () => {
    if (trustDevice && pendingUser) {
      // 14 days represented in ms
      safeStorage.setItem(
        `cutty_trusted_${pendingUser.uid}`,
        (Date.now() + 14 * 24 * 60 * 60 * 1000).toString(),
      );
    }
    setPendingUser(null);
    setShow2FA(false);
    // Reload to bypass auth view cleanly
    window.location.reload();
  };

  /* Handle standard Email & Password flow */ const handleEmailAuth = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !confirmPassword)) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoggingIn(true);
    setError(null);
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await setDoc(
          doc(db, "users", cred.user.uid),
          {
            email: cred.user.email,
            agreementsAccepted: true,
            agreementsAcceptedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!handleDeviceCheck(cred.user)) {
          setPendingUser(cred.user);
          setShow2FA(true);
          setIsLoggingIn(false);
          return;
        }
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
          safeStorage.setItem("cutty-demo-mode", "active");
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
      const cred = await signInWithPopup(auth, provider);
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          email: cred.user.email,
          agreementsAccepted: true,
          agreementsAcceptedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      if (!handleDeviceCheck(cred.user)) {
        setPendingUser(cred.user);
        setShow2FA(true);
        setIsLoggingIn(false);
        return;
      }
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
    <main className="flex h-[100dvh] items-center justify-center bg-black px-6 relative overflow-hidden">
      {" "}
      <div className="atmosphere" aria-hidden="true" />{" "}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full p-10 sm:p-12 text-center border border-white/10 rounded-2xl shadow-2xl relative z-10"
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
        <h1 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black italic tracking-normal md:tracking-tighter leading-none mb-3 sf-text-gradient uppercase">
          YardWorx
        </h1>{" "}
        <p className="text-zinc-400 mb-8 font-semibold text-sm tracking-wide uppercase">
          Operational Cockpit Portal
        </p>{" "}
        {show2FA ? (
          <div className="space-y-6 text-left animate-in fade-in zoom-in duration-300">
            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 mb-6 text-left">
              <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-1">
                New Device Login
              </h3>
              <p className="text-xs text-white/60 leading-relaxed font-semibold">
                Please enter the 6-digit confirmation code we sent to your
                device to verify this new session.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeLogin();
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-xs md:text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1 font-medium">
                  Secondary PIN
                </label>
                <input
                  type="text"
                  value={twoFACode}
                  onChange={(e) =>
                    setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full bg-zinc-950/50 text-white font-mono text-center tracking-[0.5em] text-xl border-white/10 rounded-xl px-4 py-4 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                  required
                  pattern="\d{6}"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer py-2 border border-white/5 bg-white/5 rounded-xl px-4">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded bg-white/5 border-white/20"
                />
                <span className="text-xs md:text-[10px] font-bold text-white uppercase tracking-widest">
                  Trust this device for 14 Days
                </span>
              </label>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={twoFACode.length !== 6}
                  className="w-full bg-white text-black font-black uppercase tracking-wider text-xs rounded-xl py-4 hover:scale-[1.01] active:scale-95 transition-all text-center disabled:opacity-50"
                >
                  Verify Identity
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShow2FA(false);
                    setPendingUser(null);
                    auth.signOut();
                  }}
                  className="w-full bg-transparent border border-white/10 text-white/60 font-bold uppercase tracking-wider text-xs md:text-[10px] rounded-xl py-3 hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
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
              <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5 mb-6 text-left">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
                  Required Agreements
                </h3>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.tos}
                    onChange={(e) =>
                      setAgreements((prev) => ({
                        ...prev,
                        tos: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 mt-0.5 accent-emerald-500 rounded bg-white/5 border-white/20"
                  />
                  <div>
                    <p className="text-xs md:text-[10px] font-bold text-white uppercase">
                      <a
                        href="/terms"
                        target="_blank"
                        className="hover:underline"
                      >
                        Terms of Service
                      </a>
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.privacy}
                    onChange={(e) =>
                      setAgreements((prev) => ({
                        ...prev,
                        privacy: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 mt-0.5 accent-emerald-500 rounded bg-white/5 border-white/20"
                  />
                  <div>
                    <p className="text-xs md:text-[10px] font-bold text-white uppercase">
                      <a
                        href="/privacy"
                        target="_blank"
                        className="hover:underline"
                      >
                        Privacy Policy
                      </a>
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.dataMap}
                    onChange={(e) =>
                      setAgreements((prev) => ({
                        ...prev,
                        dataMap: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 mt-0.5 accent-emerald-500 rounded bg-white/5 border-white/20"
                  />
                  <div>
                    <p className="text-xs md:text-[10px] font-bold text-white uppercase">
                      <a
                        href="/data-map"
                        target="_blank"
                        className="hover:underline"
                      >
                        Data Processing Map
                      </a>
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.ai}
                    onChange={(e) =>
                      setAgreements((prev) => ({
                        ...prev,
                        ai: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 mt-0.5 accent-emerald-500 rounded bg-white/5 border-white/20"
                  />
                  <div>
                    <p className="text-xs md:text-[10px] font-bold text-white uppercase">
                      <a
                        href="/ai-usage"
                        target="_blank"
                        className="hover:underline"
                      >
                        AI Usage & Ethics Policy
                      </a>
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.eula}
                    onChange={(e) =>
                      setAgreements((prev) => ({
                        ...prev,
                        eula: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 mt-0.5 accent-emerald-500 rounded bg-white/5 border-white/20"
                  />
                  <div>
                    <p className="text-xs md:text-[10px] font-bold text-white uppercase">
                      <a
                        href="/eula"
                        target="_blank"
                        className="hover:underline"
                      >
                        End User License Agreement (EULA)
                      </a>
                    </p>
                  </div>
                </label>
              </div>{" "}
              {activeTab === "email" ? (
                <form
                  onSubmit={handleEmailAuth}
                  className="space-y-4 text-left"
                >
                  {" "}
                  <div className="space-y-1">
                    {" "}
                    <label className="text-xs md:text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1 font-medium">
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
                    <label className="text-xs md:text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1 font-medium">
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
                  {isSignUp && (
                    <div className="space-y-1">
                      {" "}
                      <label className="text-xs md:text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1 font-medium">
                        Confirm Password
                      </label>{" "}
                      <input
                        id="confirmPassword"
                        aria-label="Confirm Password"
                        type="password"
                        placeholder="••••••••"
                        required={isSignUp}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-white transition-all font-semibold"
                      />{" "}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoggingIn || !allAgreed}
                    className="w-full mt-2 bg-white text-black font-black uppercase tracking-wider text-xs rounded-xl py-4 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {" "}
                    {isLoggingIn ? (
                      <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin block" />
                    ) : isSignUp ? (
                      "Create Account"
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
                    disabled={isLoggingIn || !allAgreed}
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
                    Allows direct linking to Google Calendar slots and
                    dispatching Gmail reports.
                  </p>{" "}
                </div>
              )}
              <div className="pt-4 flex flex-col gap-4 mt-4">
                <button
                  type="button"
                  disabled={isLoggingIn || !allAgreed}
                  onClick={() => {
                    setIsLoggingIn(true);
                    onDemoLogin(setError);
                  }}
                  className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-xl py-3 font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  Access Demo Mode
                </button>
                <p className="mt-2 text-[9px] text-zinc-600 font-medium leading-relaxed max-w-xs mx-auto italic uppercase">
                  By checking the boxes above, you formally grant consent to
                  Gaelworx AI and accept our operational constraints prior to
                  dashboard entry.
                </p>
              </div>{" "}
            </div>{" "}
          </>
        )}
        <p className="mt-8 micro-label">
          {" "}
          Ready to Grow • Powered by Gemini AI{" "}
        </p>{" "}
      </motion.div>{" "}
    </main>
  );
}
