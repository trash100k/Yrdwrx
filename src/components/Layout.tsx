import { safeStorage } from "../lib/storage";
// @ts-nocheck

import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  Bell,
  MessageSquare,
  Menu,
  FileText,
  X,
  Leaf,
  ReceiptText,
  Package,
  Star,
  Rocket,
  Plus,
  Search,
  Map,
  Activity,
  ShieldCheck,
  Shield,
  Brain,
  WifiOff,
  CloudAlert,
  Sparkles,
  ChevronRight,
  PieChart,
  Zap,
  Truck,
  Palette,
  Paintbrush,
  Terminal,
  Workflow,
  Bot,
  Presentation,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import YardChat from "./YardChat";
import LiveEar from "./LiveEar";
import WalkthroughOverlay from "./WalkthroughOverlay";
import FieldModeInterface from "./FieldModeInterface";
import { BiometricGuard } from "./auth/BiometricGuard";
import AgenticOutreachDrawer from "./AgenticOutreachDrawer";
import { useEnterpriseTheme } from "../contexts/EnterpriseThemeContext";
import { useYardWorxGuide } from "../contexts/YardWorxGuideContext";
import { useFieldMode } from "../contexts/FieldModeContext";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import { useTenant } from "../contexts/TenantContext";
import { useRole } from "../hooks/useRole";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { syncService } from "../services/syncService";
import { auth } from "../lib/firebase";
import DisclaimerModal from "./DisclaimerModal";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showFABActions, setShowFABActions] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const location = useLocation();
  const isOffline = useOfflineStatus();
  const { tenant } = useTenant();
  const { role } = useRole();
  const [isBrainOpen, setIsBrainOpen] = useState(false);
  const [isOutreachOpen, setIsOutreachOpen] = useState(false);
  const { getSpacingClasses } = useEnterpriseTheme();
  const { activeFocus, jobStatus } = useYardWorxGuide();

  const {
    isFieldMode,
    toggleFieldMode,
    isPreloading,
    leavingSiteAlert,
    dismissAlert,
  } = useFieldMode();

  const [hiddenMobileNav, setHiddenMobileNav] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest > previous && latest > 150) {
      setHiddenMobileNav(true);
    } else {
      setHiddenMobileNav(false);
    }
  });

  // Auto-open brain chat for new users
  useEffect(() => {
    const userKey = auth.currentUser?.email || "anonymous";
    const hasSeen = safeStorage.getItem(`has-seen-walkthrough-${userKey}`);
    const hasAcceptedDisclaimer =
      tenant?.legal?.aiDisclaimerAccepted === true ||
      tenant?.id.startsWith("demo-");

    if (!hasSeen || !hasAcceptedDisclaimer) {
      const timer = setTimeout(() => setIsBrainOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [tenant]);

  useEffect(() => {
    const updateQueue = () => setPendingSyncs(syncService.getQueueLength());
    updateQueue();
    const interval = setInterval(updateQueue, 3000);
    return () => clearInterval(interval);
  }, []);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {
      BUSINESS: true,
      OPERATIONS: false,
      FINANCE: false,
      CREATIVE: false,
    },
  );

  const rolePrefix =
    role === "employee" || role === "foreman" ? "/employee" : "/admin";

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const allNavItems = [
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      path: `${rolePrefix}`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin", "foreman", "employee"],
    },
    {
      id: "crm",
      icon: Users,
      label: "CRM",
      path: `${rolePrefix}/crm`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "scheduler",
      icon: Calendar,
      label: "Scheduler",
      path: `${rolePrefix}/scheduler`,
      group: "OPERATIONS",
      allowedRoles: ["owner", "admin", "foreman", "employee"],
    },
    {
      id: "crewTracking",
      icon: Truck,
      label: "Field & Crew",
      path: `${rolePrefix}/crew-suite`,
      group: "OPERATIONS",
      allowedRoles: ["owner", "admin", "foreman"],
    },
    {
      id: "agent",
      icon: Bot,
      label: "YardWorx Copilot",
      path: `${rolePrefix}/agent`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "designStudio",
      icon: Palette,
      label: "Design Studio",
      path: `${rolePrefix}/design-studio`,
      group: "OPERATIONS",
      allowedRoles: ["owner", "admin", "foreman", "employee"],
    },
    {
      id: "portfolio",
      icon: Presentation,
      label: "Portfolio",
      path: `${rolePrefix}/portfolio`,
      group: "MARKETING",
      allowedRoles: ["owner", "admin", "client"],
    },
    {
      id: "invoices",
      icon: ReceiptText,
      label: "Invoices",
      path: `${rolePrefix}/invoices`,
      group: "FINANCE",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "reports",
      icon: BarChart3,
      label: "Reports",
      path: `${rolePrefix}/reports`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "settings",
      icon: Activity,
      label: "Settings",
      path: `${rolePrefix}/settings`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    ...(auth.currentUser?.email === "isaacsonzach13@gmail.com"
      ? [
          {
            id: "saas-admin",
            icon: Shield,
            label: "SaaS Core (Level-0)",
            path: "/saas-admin",
            group: "BUSINESS",
            allowedRoles: ["owner"],
          },
        ]
      : []),
  ];

  const navItems = allNavItems.filter((item) => {
    // Check Role
    if (role && item.allowedRoles && !item.allowedRoles.includes(role))
      return false;

    if (!tenant || !tenant.settings?.features) return true;
    const features = tenant.settings.features as Record<string, boolean>;
    if (item.id && features[item.id] !== undefined) {
      return features[item.id];
    }
    return true;
  });

  const groupedNav = navItems.reduce(
    (acc, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    },
    {} as Record<string, typeof navItems>,
  );

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  return (
    <>
      <DisclaimerModal />
      <div
        className={cn(
          "flex h-[100dvh] w-full text-white font-sans overflow-hidden bg-black",
          isFieldMode && "performance-shield-active",
        )}
      >
        {!isFieldMode && <div className="atmosphere" aria-hidden="true" />}

        {isFieldMode && (
          <BiometricGuard>
            <FieldModeInterface />
          </BiometricGuard>
        )}

        {/* Desktop Sidebar Navigation */}
        <aside
          role="navigation"
          aria-label="Main navigation"
          className={cn(
            "relative z-40 hidden lg:flex flex-col transition-all duration-300 border-r border-white/5 bg-zinc-950",
            isSidebarOpen ? "w-64 p-6" : "w-24 p-4",
          )}
        >
          <div className="flex-1 flex flex-col">
            <div className="mb-12">
              <Link
                to={rolePrefix}
                id="cutty-logo"
                className="flex items-center gap-5 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-3xl"
              >
                <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl">
                  <Leaf size={32} className="text-white" />
                </div>
                {isSidebarOpen && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                      YardWorx
                    </h1>
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">
                      Management
                    </p>
                  </motion.div>
                )}
              </Link>
            </div>

            <nav
              className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2"
              aria-label="Main menu"
            >
              {Object.entries(groupedNav).map(([group, items]) => (
                <div key={group} className="space-y-2">
                  {isSidebarOpen ? (
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center justify-between px-4 py-4 text-[15px] font-bold text-zinc-300 uppercase tracking-wider hover:text-white transition-colors"
                    >
                      <span>{group}</span>
                      <motion.span
                        className="inline-block"
                        animate={{ rotate: expandedGroups[group] ? 180 : 0 }}
                      >
                        <Plus size={18} />
                      </motion.span>
                    </button>
                  ) : (
                    <div className="h-px bg-white/5 mx-6 my-4" />
                  )}

                  <AnimatePresence initial={false}>
                    {(expandedGroups[group] || !isSidebarOpen) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-1"
                      >
                        {items.map((item) => {
                          let navPathSuffix = item.path.replace(rolePrefix, "");
                          if (navPathSuffix === "") navPathSuffix = "/";
                          let navId = `nav-${navPathSuffix.replace("/", "")}`;
                          if (navPathSuffix === "/") navId = "nav-dashboard";
                          if (navPathSuffix === "/clients")
                            navId = "nav-client-book";
                          if (navPathSuffix === "/crew-suite")
                            navId = "nav-teams";
                          if (navPathSuffix === "/asset-hub")
                            navId = "nav-inventory";
                          if (navPathSuffix === "/capital")
                            navId = "nav-finances";

                          return (
                            <NavLink
                              key={item.path}
                              to={item.path}
                              id={navId}
                              className={({ isActive }) =>
                                cn(
                                  "flex items-center gap-5 px-4 py-4 rounded-3xl transition-all duration-200",
                                  isActive
                                    ? "bg-white text-black shadow-2xl font-bold"
                                    : "text-zinc-300 hover:text-white hover:bg-white/5 font-medium",
                                )
                              }
                            >
                              <item.icon size={26} className="shrink-0" />
                              {isSidebarOpen && (
                                <span className="text-[18px] tracking-tight">
                                  {item.label}
                                </span>
                              )}
                            </NavLink>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </nav>

            <div className="mt-auto pt-8 border-t border-white/5 space-y-4">
              {tenant && (
                <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl flex flex-col gap-1 items-center justify-center">
                  <span className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/50">
                    {tenant.name}
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-widest ${tenant.tier === "enterprise" ? "text-blue-400" : tenant.tier === "pro" ? "text-emerald-400" : "text-zinc-400"}`}
                  >
                    {tenant.tier} tier
                  </span>
                  {role && (
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] mt-1 bg-white/5 px-2 py-0.5 rounded-full">
                      {role}
                    </span>
                  )}
                </div>
              )}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Toggle sidebar"
                className="w-full flex items-center justify-center p-6 rounded-3xl bg-white/5 text-zinc-400 hover:text-white transition-all border border-white/5"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <AnimatePresence>
            {isOffline && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-amber-500 text-black px-6 py-2 flex items-center justify-center gap-3 overflow-hidden z-50 shrink-0"
              >
                <WifiOff size={14} />
                <p className="text-xs md:text-[10px] font-black uppercase tracking-widest text-center">
                  Connection Suspended • Field Mode Active
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <header className="h-24 lg:h-32 flex items-center justify-between px-6 lg:px-16 shrink-0 sticky top-0 z-30 border-b border-white/5 bg-black/40 backdrop-blur-xl">
            <Link
              to={rolePrefix}
              className="flex items-center gap-2 sm:gap-3 lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
            >
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xl">
                <Leaf size={24} className="sm:w-7 sm:h-7" />
              </div>
              <span className="font-bold tracking-tight text-xl sm:text-3xl text-white">
                CUTTY
              </span>
            </Link>

            <div className="flex-1 max-w-2xl hidden lg:block">
              <div className="relative group">
                <Search
                  size={22}
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors"
                />
                <label htmlFor="system-search" className="sr-only">
                  Search
                </label>
                <input
                  id="system-search"
                  type="text"
                  placeholder="Search for customers, equipment, or jobs..."
                  className="w-full min-w-0 pl-16 pr-8 py-4 bg-white/5 border border-white/5 rounded-2xl text-lg font-bold focus:bg-white/10 focus:border-emerald-500/30 focus:outline-none placeholder:text-zinc-500 transition-all text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-8">
              {tenant?.settings?.features?.reports !== false &&
                tenant?.settings?.subFeatures?.liveEarAlwaysOn !== false && (
                  <LiveEar />
                )}

              <div className="flex items-center gap-2 sm:gap-4 border-l border-white/10 pl-4 sm:pl-8">
                <button
                  id="outreach-trigger"
                  onClick={() => setIsOutreachOpen(true)}
                  className="w-10 h-10 lg:w-14 lg:h-14 bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl text-emerald-400 hover:text-white flex items-center justify-center transition-all relative"
                  aria-label="Agentic Outreach"
                  title="Launch Agentic Outreach Slider"
                >
                  <Rocket size={22} className="text-emerald-400" />
                  <span className="absolute top-2 right-2 w-3 h-3 bg-emerald-400 rounded-full border border-black animate-pulse" />
                </button>

                <button
                  id="brain-trigger"
                  onClick={() => setIsBrainOpen(true)}
                  className="w-10 h-10 lg:w-14 lg:h-14 bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl text-zinc-300 hover:text-white flex items-center justify-center transition-all relative"
                  aria-label="Get Help"
                >
                  <Brain size={24} />
                  <span className="absolute top-2 right-2 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
                </button>

                <div className="hidden xl:block text-right mr-4">
                  <p className="text-[12px] font-bold text-zinc-300 uppercase tracking-wide leading-none mb-1">
                    Logged in as
                  </p>
                  <p className="text-[16px] font-bold text-white">Supervisor</p>
                </div>
                <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl overflow-hidden border-2 border-white/10 hidden sm:block">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=100"
                    alt="User"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div
            ref={scrollRef}
            className={cn(
              "flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 lg:px-16 pb-40 lg:pb-16 custom-scrollbar overscroll-none transition-all duration-700",

              getSpacingClasses(),
              isFieldMode ? "bg-black grayscale-[0.8] contrast-[1.2]" : "",
            )}
          >
            {isPreloading && (
              <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl">
                <div className="atmosphere opacity-50" />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-8"
                >
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                    <Zap
                      size={32}
                      className="absolute inset-x-0 inset-y-0 m-auto text-amber-500 animate-pulse"
                    />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-normal md:tracking-tighter mb-2">
                      Loading Job Info...
                    </h2>
                    <p className="text-xs md:text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">
                      Customizing your experience
                    </p>
                  </div>
                </motion.div>
              </div>
            )}
            <Outlet />
          </div>

          {/* MOBILE NAVIGATION */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl overflow-y-auto p-8 pt-32 lg:hidden"
              >
                <div className="grid grid-cols-1 gap-4">
                  <p className="micro-label mb-4">App Menu</p>
                  {navItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                          <item.icon size={22} />
                        </div>
                        <span className="text-sm font-black uppercase tracking-widest italic">
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight size={18} className="text-zinc-600" />
                    </NavLink>
                  ))}
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-12 w-full p-6 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs"
                >
                  Close Menu
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.nav
            initial={{ y: 0 }}
            animate={{ y: hiddenMobileNav ? "100%" : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed bottom-0 left-0 right-0 h-20 pb-safe bg-zinc-950 border-t border-white/5 lg:hidden flex items-center justify-between z-[110] px-4"
            aria-label="Mobile Navigation"
          >
            <div className="flex-1 flex items-center justify-between px-2">
              {navItems.slice(0, 4).map((item) => {
                let navPathSuffix = item.path.replace(rolePrefix, "");
                if (navPathSuffix === "") navPathSuffix = "/";
                let navId = `mobile-nav-${navPathSuffix.replace("/", "")}`;
                if (navPathSuffix === "/") navId = "mobile-nav-dashboard";
                if (navPathSuffix === "/clients")
                  navId = "mobile-nav-client-book";
                if (navPathSuffix === "/crew-suite") navId = "mobile-nav-teams";
                if (navPathSuffix === "/asset-hub")
                  navId = "mobile-nav-inventory";
                if (navPathSuffix === "/capital") navId = "mobile-nav-finances";

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    id={navId}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      cn(
                        "flex-1 flex flex-col items-center justify-center h-16 rounded-2xl transition-all duration-300 relative",
                        isActive ? "text-white" : "text-zinc-400",
                      )
                    }
                  >
                    {location.pathname === item.path && (
                      <motion.div
                        layoutId="mobile-nav-pill"
                        className="absolute inset-0 bg-white shadow-[0_10px_30px_rgba(255,255,255,0.2)] rounded-2xl"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <item.icon
                      size={22}
                      className={cn(
                        "relative z-10",
                        location.pathname === item.path ? "text-black" : "",
                      )}
                    />
                  </NavLink>
                );
              })}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center h-16 rounded-2xl transition-all",
                  isMobileMenuOpen ? "text-emerald-400" : "text-zinc-400",
                )}
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </motion.nav>

          <YardChat isOpen={isBrainOpen} setIsOpen={setIsBrainOpen} />
          <WalkthroughOverlay />
          <AgenticOutreachDrawer
            isOpen={isOutreachOpen}
            onClose={() => setIsOutreachOpen(false)}
          />

          <AnimatePresence>
            {leavingSiteAlert && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xl flex items-center justify-center p-8"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="max-w-md w-full bg-amber-500 text-black p-12 rounded-[56px] shadow-2xl border border-zinc-900 text-center space-y-8"
                >
                  <div className="w-24 h-24 bg-black rounded-2xl flex items-center justify-center mx-auto shadow-2xl">
                    <ShieldCheck
                      size={48}
                      className="text-amber-500 animate-pulse"
                    />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-3xl sm:text-4xl font-black italic tracking-normal md:tracking-tighter uppercase leading-none">
                      Boundary Alert
                    </h2>
                    <p className="text-sm font-bold uppercase tracking-widest text-black/60">
                      You've left the job site. Ready to switch back to full
                      mode?
                    </p>
                  </div>
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={toggleFieldMode}
                      className="w-full py-5 bg-black text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
                    >
                      Restore Full Power
                    </button>
                    <button
                      onClick={dismissAlert}
                      className="w-full py-5 bg-black/10 border-2 border-black/20 rounded-[24px] font-black text-xs md:text-[10px] uppercase tracking-widest hover:bg-black/20 transition-all"
                    >
                      Stay in Field Mode
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}
