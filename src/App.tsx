// @ts-nocheck

import React, { useEffect, useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AddToHomeScreen } from "./components/AddToHomeScreen";
import { motion } from "motion/react";
import {
  onAuthChange,
  signInWithEmail,
  signUpWithEmail,
  signInWithMagicLink,
} from "./lib/supabase";
import { getCurrentProfile, clearProfileCache } from "./lib/repos/profile";

const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === "true";

// Components & Contexts
import Onboarding from "./components/Onboarding";
import Layout from "./components/Layout";
import { InfrastructureGuard } from "./components/InfrastructureGuard";
import { TenantProvider } from "./contexts/TenantContext";
import { CuttyGuideProvider } from "./contexts/CuttyGuideContext";
import { FieldModeProvider } from "./contexts/FieldModeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { WorkspaceOutboxProvider } from "./contexts/WorkspaceOutboxContext";
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
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const RouteOptimizer = lazy(() => import("./pages/RouteOptimizer"));
const Settings = lazy(() => import("./pages/Settings"));
const Agent = lazy(() => import("./pages/Agent"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const MagicLinkAuth = lazy(() => import("./pages/MagicLinkAuth"));
const BookingIntake = lazy(() => import("./pages/BookingIntake"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const DataMap = lazy(() => import("./pages/DataMap"));
const AiUsage = lazy(() => import("./pages/AiUsage"));
const SaaSAdminDashboard = lazy(() => import("./pages/SaaSAdminDashboard"));
const AiPlayground = lazy(() => import("./pages/AiPlayground"));

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
    <Loader2 className="animate-spin text-forest-500" size={48} />
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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
useEffect(() => {
    // DEMO / INTERNAL TESTING BYPASS — when auth is NOT required, inject the mock admin
    // exactly as before so the demo path is unchanged.
    if (!REQUIRE_AUTH) {
      const mockAdmin = {
          uid: "admin-user-001",
          email: "admin@yardworx.io",
          displayName: "Internal Admin",
          emailVerified: true
      } as any;

      setUser(mockAdmin);
      setOnboarded(true);
      setLoading(false);
      setIsDemo(true);
      return;
    }

    // REAL AUTH — subscribe to Supabase auth state and resolve onboarding from the
    // user's profile (tenant_id + agreements_accepted), provisioned by the signup trigger.
    let active = true;

    const unsubscribe = onAuthChange(async (currentUser) => {
      if (!active) return;
      setUser(currentUser);

      if (!currentUser) {
        // Signed out — drop any cached identity and reset onboarding state.
        clearProfileCache();
        setOnboarded(false);
        setLoading(false);
        return;
      }

      try {
        clearProfileCache();
        const profile = await getCurrentProfile(true);
        if (!active) return;
        setOnboarded(
          !!(profile && profile.tenant_id && profile.agreements_accepted),
        );
      } catch (e) {
        if (active) setOnboarded(false);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const enterDemoMode = async (setAuthError: (err: string | null) => void) => {
    // Local-only demo: no network auth. Repos stay inert and demo pages render with
    // mock state. Real persistence requires VITE_REQUIRE_AUTH=true + a Supabase login.
    setIsDemo(true);
    safeStorage.setItem("cutty-demo-mode", "active");
    setUser({
      uid: "demo-user",
      displayName: "Demo Mode",
      email: "demo@yardworx.io",
    });
    setOnboarded(true);
    setLoading(false);
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
              <WorkspaceOutboxProvider>
              {" "}
              <BrowserRouter>
                <PageTracker />{" "}
                <FieldModeProvider>
                  {" "}
                  <CuttyGuideProvider>
                    {" "}
                    <AgreementsGate>
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          <Route path="/privacy" element={<PrivacyPolicy />} />
                          <Route path="/terms" element={<TermsOfService />} />
                          <Route path="/data-map" element={<DataMap />} />
                          <Route path="/ai-usage" element={<AiUsage />} />
                          <Route
                            path="/portal/:clientId"
                            element={<ClientPortal />}
                          />
                          <Route
                            path="/portal/auth/:token"
                            element={<MagicLinkAuth />}
                          />
                          {/* Public online booking / instant-quote intake (no auth). */}
                          <Route
                            path="/book/:tenantId"
                            element={<BookingIntake />}
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
                                <Route
                                  path="forms"
                                  element={<FormBuilder />}
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
                                  path="ai-playground"
                                  element={<AiPlayground />}
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
                  </CuttyGuideProvider>{" "}
                </FieldModeProvider>{" "}
              </BrowserRouter>{" "}
            </WorkspaceOutboxProvider>
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
  });
  const [activeTab, setActiveTab] = useState<"email" | "magic">("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [company, setCompany] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Agreements are captured once, in plain language, during onboarding (which sets
  // agreements_accepted). The sign-in screen no longer gates on checkboxes — that blocked
  // returning users every login and overwhelmed first-time contractors.
  const allAgreed = true;

  /* Email & password via Supabase Auth. Signup metadata (company/display name) is read
     by the handle_new_user DB trigger to provision the tenant + owner profile. */
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
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
    try {
      if (isSignUp) {
        const data = await signUpWithEmail(email, password, {
          company_name: company.trim() || undefined,
          display_name: email.split("@")[0],
        });
        // If email confirmation is required, no session is returned yet.
        if (!data?.session) {
          setInfo("Account created. Check your email to confirm, then sign in.");
          setIsSignUp(false);
        }
        // Otherwise onAuthChange routes the user straight in.
      } else {
        await signInWithEmail(email, password);
        // onAuthChange handles routing once the session is established.
      }
    } catch (error) {
      const msg = String((error as any)?.message || "");
      console.error("Email authentication failure:", error);
      if (/invalid login credentials/i.test(msg)) {
        setError("Invalid email or password.");
      } else if (/already registered|already been registered/i.test(msg)) {
        setError("This email is already registered. Try signing in.");
      } else if (/email not confirmed/i.test(msg)) {
        setInfo("Please confirm your email first — check your inbox.");
      } else {
        setError(msg || "Authentication failed. Check your connection and try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  /* Passwordless magic-link via Supabase Auth. */
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Enter your email to receive a magic link.");
      return;
    }
    setIsLoggingIn(true);
    try {
      await signInWithMagicLink(email, window.location.origin);
      setInfo("Magic link sent. Check your email to finish signing in.");
    } catch (error) {
      setError(String((error as any)?.message || "Couldn't send the magic link. Try again."));
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
        <p className="text-zinc-400 mb-8 font-semibold text-sm tracking-wide">
          Run your whole business from your phone.
        </p>{" "}
        {(
          <>
            <div className="mb-6">
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={() => {
                  setIsLoggingIn(true);
                  onDemoLogin(setError);
                }}
                className="w-full bg-forest-500 hover:bg-forest-400 text-black rounded-xl py-4 font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-forest-500/20"
              >
                Quick Demo Access
              </button>
            </div>

            <div className="relative flex items-center py-4 mb-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-zinc-500 text-xs font-bold uppercase tracking-widest">Or sign in</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

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
                Password{" "}
              </button>{" "}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("magic");
                  setError(null);
                }}
                className={`flex-1 py-3 text-xs uppercase tracking-wider font-bold rounded-xl transition-all ${activeTab === "magic" ? "bg-white text-black shadow-md" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                {" "}
                Email Link · No Password{" "}
              </button>{" "}
            </div>{" "}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 text-red-400 rounded-2xl text-xs font-bold border border-red-500/20 text-left leading-relaxed">
                {" "}
                {error}{" "}
              </div>
            )}{" "}
            {info && (
              <div className="mb-6 p-4 bg-forest-500/10 text-forest-400 rounded-2xl text-xs font-bold border border-forest-500/20 text-left leading-relaxed">
                {" "}
                {info}{" "}
              </div>
            )}{" "}
            <div className="space-y-6">
              <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5 mb-6 text-left">
                <p className="text-[11px] text-zinc-400 leading-relaxed normal-case">
                  By continuing you agree to our{" "}
                  <a href="/terms" target="_blank" className="text-forest-400 hover:underline">Terms</a>{" "}
                  and{" "}
                  <a href="/privacy" target="_blank" className="text-forest-400 hover:underline">Privacy Policy</a>.
                </p>
                {/* <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.ai}
                    onChange={(e) =>
                      setAgreements((prev) => ({
                        ...prev,
                        ai: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 mt-0.5 accent-forest-500 rounded bg-white/5 border-white/20"
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
                </label> */}
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
                  {isSignUp && (
                    <div className="space-y-1">
                      <label className="text-xs md:text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1 font-medium">
                        Company Name
                      </label>
                      <input
                        aria-label="Company Name"
                        type="text"
                        placeholder="Evergreen Lawn & Landscape"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-white transition-all font-semibold"
                      />
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
                <form onSubmit={handleMagicLink} className="space-y-4 text-left">
                  <div className="space-y-1">
                    <label className="text-xs md:text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1 font-medium">
                      Email Address
                    </label>
                    <input
                      type="email"
                      aria-label="Email Address"
                      placeholder="supervisor@landscapes.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-white transition-all font-semibold"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoggingIn || !allAgreed}
                    className="w-full mt-2 bg-white text-black font-black uppercase tracking-wider text-xs rounded-xl py-4 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoggingIn ? (
                      <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin block" />
                    ) : (
                      "Email Me a Magic Link"
                    )}
                  </button>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-normal text-center">
                    We'll email you a secure one-tap sign-in link — no password needed.
                  </p>
                </form>
              )}
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
