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
  Sword,
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
  User,
  ListChecks,
  Sun,
  Moon,
  Gift,
  Wrench,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import CuttyChat from "./CuttyChat";
import LiveEar from "./LiveEar";
import WalkthroughOverlay from "./WalkthroughOverlay";
import FieldModeInterface from "./FieldModeInterface";
import { BiometricGuard } from "./auth/BiometricGuard";
import AgenticOutreachDrawer from "./AgenticOutreachDrawer";
import { WorkspaceOutboxPanel } from "./WorkspaceOutboxPanel";
import { useWorkspaceOutbox } from "../contexts/WorkspaceOutboxContext";
import { useEnterpriseTheme } from "../contexts/EnterpriseThemeContext";
import { useCuttyGuide } from "../contexts/CuttyGuideContext";
import { useFieldMode } from "../contexts/FieldModeContext";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import { useTenant } from "../contexts/TenantContext";
import { useRole } from "../hooks/useRole";
import { CommandPalette } from "./CommandPalette";
import { NotificationsCenter } from "./NotificationsCenter";
import { UserProfileMenu } from "./UserProfileMenu";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { QuickCreateMenu } from "./QuickCreateMenu";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GrassSwordIcon = ({ className, size = 24 }: { className?: string; size?: number | string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ transform: "rotate(45deg)" }}
  >
    <defs>
      <linearGradient id="bladeGrad" x1="50" y1="5" x2="50" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--color-forest-300, #5aeb8c)" />
        <stop offset="50%" stopColor="var(--color-forest-500, #05a845)" />
        <stop offset="100%" stopColor="var(--color-forest-800, #065626)" />
      </linearGradient>
      <linearGradient id="hiltGrad" x1="20" y1="60" x2="80" y2="95" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--color-ash, #8d99ae)" />
        <stop offset="100%" stopColor="var(--color-coldsteel, #1f2833)" />
      </linearGradient>
    </defs>
    
    {/* Blade - Leaf shape */}
    <path
      d="M50 5 Q70 30 60 60 L40 60 Q30 30 50 5 Z"
      fill="url(#bladeGrad)"
      stroke="var(--color-forest-900, #064721)"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    
    {/* Blade central vein/spine */}
    <path
      d="M50 5 Q52 30 50 60"
      stroke="var(--color-forest-700, #046d2e)"
      strokeWidth="1.5"
      fill="none"
    />
    <path
      d="M50 20 Q55 25 57 23 M50 35 Q56 40 58 37 M50 45 Q44 49 42 45 M50 25 Q45 28 44 25"
      stroke="var(--color-forest-700, #046d2e)"
      strokeWidth="1"
      fill="none"
      strokeLinecap="round"
    />

    {/* Hilt - Twisted Vines / Roots */}
    {/* Base wrapping around blade base */}
    <path
      d="M35 60 Q50 55 65 60 Q70 65 65 70 Q50 65 35 70 Z"
      fill="url(#hiltGrad)"
    />
    {/* Left crossguard vine */}
    <path
      d="M40 65 Q25 60 20 50 Q18 45 23 48 Q28 55 45 65"
      fill="none"
      stroke="url(#hiltGrad)"
      strokeWidth="4"
      strokeLinecap="round"
    />
    {/* Right crossguard vine */}
    <path
      d="M60 65 Q75 60 80 50 Q82 45 77 48 Q72 55 55 65"
      fill="none"
      stroke="url(#hiltGrad)"
      strokeWidth="4"
      strokeLinecap="round"
    />
    {/* Handle twisted vines */}
    <path
      d="M45 65 C55 75 40 85 50 95 C60 85 45 75 55 65"
      fill="none"
      stroke="url(#hiltGrad)"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M52 68 C42 78 58 88 48 93"
      fill="none"
      stroke="var(--color-forged, #0b0c10)"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

import { syncService } from "../services/syncService";
import { getCurrentUser } from "../lib/supabase";
import DisclaimerModal from "./DisclaimerModal";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showFABActions, setShowFABActions] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const isOffline = useOfflineStatus();
  const { tenant } = useTenant();
  const { role } = useRole();
  const [isBrainOpen, setIsBrainOpen] = useState(false);
  const [isOutreachOpen, setIsOutreachOpen] = useState(false);
  const [isOutboxOpen, setIsOutboxOpen] = useState(false);
  const { outbox } = useWorkspaceOutbox();
  
  // QoL States
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  // Real unread count, reported up from NotificationsCenter, so the bell dot reflects
  // actual overdue invoices / low stock / new leads / upcoming jobs rather than being
  // hardcoded always-on.
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  
  const { getSpacingClasses, themeSettings, updateThemeSetting } = useEnterpriseTheme();
  const { activeFocus, jobStatus } = useCuttyGuide();

  const {
    isFieldMode,
    toggleFieldMode,
    isPreloading,
    leavingSiteAlert,
    dismissAlert,
  } = useFieldMode();

  const [hiddenMobileNav, setHiddenMobileNav] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gChordRef = useRef(0); // timestamp of the last "g" press for chord nav
  const { scrollY } = useScroll({ container: scrollRef });

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest < 50) {
      setHiddenMobileNav(false);
      return;
    }
    // Only toggle if scrolled more than 10px to avoid jitter
    if (Math.abs(latest - previous) > 10) {
      if (latest > previous) {
        setHiddenMobileNav(true);
      } else {
        setHiddenMobileNav(false);
      }
    }
  });

  // Auto-open brain chat for new users — but NEVER interrupt a focused workspace (Design
  // Studio, Field Mode, Live Ear, Route Optimizer), and only once per browser session so it
  // doesn't re-pop on every navigation/reload.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (/design-studio|field|live|route-optimizer/i.test(path)) return;
      try { if (window.sessionStorage.getItem("cutty-autoopened") === "1") return; } catch (e) {}
    }
    const userKey = getCurrentUser()?.email || "anonymous";
    const hasSeen = safeStorage.getItem(`has-seen-walkthrough-${userKey}`);
    const hasAcceptedDisclaimer =
      tenant?.legal?.aiDisclaimerAccepted === true ||
      tenant?.id.startsWith("demo-");

    if (!hasSeen || !hasAcceptedDisclaimer) {
      const timer = setTimeout(() => {
        try { window.sessionStorage.setItem("cutty-autoopened", "1"); } catch (e) {}
        setIsBrainOpen(true);
      }, 2500);
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

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && e.target instanceof HTMLElement && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        setIsShortcutsOpen(prev => !prev);
      }
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsBrainOpen(prev => !prev);
      }
      
      // "G then <key>" chord navigation (e.g. G then C -> CRM).
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          (e.target as HTMLElement).isContentEditable);
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
        const k = e.key.toLowerCase();
        if (k === "g") {
          gChordRef.current = Date.now();
          return;
        }
        if (Date.now() - gChordRef.current < 1200) {
          const dest: Record<string, string> = {
            d: "",
            c: "/crm",
            s: "/scheduler",
            i: "/invoices",
            r: "/routing",
          };
          if (k in dest) {
            gChordRef.current = 0;
            navigate(`${rolePrefix}${dest[k]}`);
          }
        }
      }
    };
    document.addEventListener("keydown", handleGlobalShortcuts);
    return () => document.removeEventListener("keydown", handleGlobalShortcuts);
  }, [rolePrefix, navigate]);

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
      id: "closeout",
      icon: ListChecks,
      label: "Closeout",
      path: `${rolePrefix}/closeout`,
      group: "OPERATIONS",
      allowedRoles: ["owner", "admin", "foreman", "employee"],
    },
    {
      id: "jobCosting",
      icon: PieChart,
      label: "Job Costing",
      path: `${rolePrefix}/job-costing`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "estimate",
      icon: Map,
      label: "Instant Estimate",
      path: `${rolePrefix}/estimate`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "customerIntel",
      icon: Activity,
      label: "Customer Intel",
      path: `${rolePrefix}/customer-intel`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "inbox",
      icon: MessageSquare,
      label: "Inbox",
      path: `${rolePrefix}/inbox`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "referrals",
      icon: Gift,
      label: "Referrals",
      path: `${rolePrefix}/referrals`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "equipment",
      icon: Wrench,
      label: "Equipment",
      path: `${rolePrefix}/equipment`,
      group: "OPERATIONS",
      allowedRoles: ["owner", "admin", "foreman"],
    },
    {
      id: "ownerDigest",
      icon: FileText,
      label: "Owner Digest",
      path: `${rolePrefix}/owner-digest`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "agent",
      icon: Bot,
      label: "YardPilot",
      path: `${rolePrefix}/agent`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin"],
    },
    {
      id: "aiPlayground",
      icon: Sparkles,
      label: "AI Features",
      path: `${rolePrefix}/ai-playground`,
      group: "BUSINESS",
      allowedRoles: ["owner", "admin", "foreman", "employee"],
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
      id: "forms",
      icon: ListChecks,
      label: "Forms",
      path: `${rolePrefix}/forms`,
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
    ...(getCurrentUser()?.email === "isaacsonzach13@gmail.com"
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
            <div className="mb-12 flex justify-center">
              <Link
                to={rolePrefix}
                id="cutty-logo"
                className="flex flex-col items-center gap-1 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 rounded-2xl"
              >
                {isSidebarOpen && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-1 min-w-0">
                    <h1 className="font-['Cinzel_Decorative'] text-lg lg:text-xl font-bold tracking-widest text-white uppercase leading-none truncate text-center">
                      YARDWORX
                    </h1>
                    <div className="flex flex-col pt-1 border-t border-white/10 items-center">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-sans mb-0.5">
                        Powered By
                      </p>
                      <div className="font-['Cinzel_Decorative'] text-base tracking-[0.15em] uppercase leading-none font-bold drop-shadow-xl flex items-center">
                        <span className="text-white">G</span>
                        <span className="text-[#E34A27]" style={{ textShadow: "0 0 8px rgba(227, 74, 39, 0.6), 0 0 16px rgba(227, 74, 39, 0.3)" }}>AE</span>
                        <span className="text-white">LWORX</span>
                      </div>
                    </div>
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
                <div className="p-4 bg-zinc-900 border border-white/5 molten-edge rounded-2xl flex flex-col gap-1 items-center justify-center">
                  <span className="text-xs md:text-[10px] font-black uppercase tracking-widest text-white/50">
                    {tenant.name}
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-widest ${tenant.tier === "enterprise" ? "text-celtic-400" : tenant.tier === "pro" ? "text-forest-400" : "text-zinc-400"}`}
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
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative pt-20 lg:pt-32">
          <AnimatePresence>
            {isOffline && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="fixed top-20 lg:top-32 left-0 right-0 bg-amber-500 text-black px-6 py-2 flex items-center justify-center gap-3 overflow-hidden z-50 shadow-md"
              >
                <WifiOff size={14} />
                <p className="text-xs md:text-[10px] font-black uppercase tracking-widest text-center">
                  Connection Suspended • Field Mode Active
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <header
            className={cn(
              "fixed top-0 left-0 right-0 h-20 lg:h-32 flex items-center justify-between px-4 sm:px-8 lg:px-16 z-[100] border-b border-white/10 molten-edge bg-zinc-950/95 backdrop-blur-3xl shadow-2xl transition-all duration-300",
              isSidebarOpen ? "lg:left-64" : "lg:left-24"
            )}
          >
            <Link
              to={rolePrefix}
              className="flex items-center gap-2 sm:gap-3 lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 rounded-xl"
            >
              <div className="flex flex-col pt-1 items-center">
                <span className="font-['Cinzel_Decorative'] font-bold tracking-tight text-xl sm:text-3xl text-white leading-none">
                  YARDWORX
                </span>
                <div className="flex items-center justify-center gap-1.5 mt-1 sm:mt-1.5 ml-2">
                  <span className="text-[8px] sm:text-[9px] text-zinc-400 tracking-widest font-sans uppercase">
                    Powered By
                  </span>
                  <div className="font-['Cinzel_Decorative'] text-[10px] sm:text-xs tracking-[0.15em] uppercase leading-none font-bold drop-shadow-xl flex items-center">
                    <span className="text-white">G</span>
                    <span className="text-[#E34A27]" style={{ textShadow: "0 0 8px rgba(227, 74, 39, 0.6), 0 0 16px rgba(227, 74, 39, 0.3)" }}>AE</span>
                    <span className="text-white">LWORX</span>
                  </div>
                </div>
              </div>
            </Link>

            <div className="flex-1 max-w-2xl hidden lg:flex justify-start mr-auto lg:pr-12">
              <div 
                className="relative group w-full cursor-pointer"
                onClick={() => setIsCommandPaletteOpen(true)}
              >
                <Search
                  size={22}
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-forest-500 transition-colors pointer-events-none"
                />
                <label htmlFor="system-search" className="sr-only">
                  Search
                </label>
                <div
                  className="w-full pl-16 pr-8 py-4 bg-white/5 border border-white/5 rounded-2xl text-lg font-bold hover:bg-white/10 hover:border-forest-500/30 transition-all text-zinc-500 flex items-center justify-between"
                >
                  <span>Search for customers, equipment, or jobs...</span>
                  <div className="flex items-center gap-1">
                    <kbd className="bg-black/50 border border-white/10 px-2 py-1 rounded-lg text-xs font-mono">⌘</kbd>
                    <kbd className="bg-black/50 border border-white/10 px-2 py-1 rounded-lg text-xs font-mono">K</kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              {tenant?.settings?.features?.reports !== false &&
                tenant?.settings?.subFeatures?.liveEarAlwaysOn !== false && (
                  <LiveEar />
                )}

              <div className="flex items-center gap-2 sm:gap-4 border-l border-white/10 pl-4 sm:pl-6">
                
                <button
                  onClick={() => {
                    if (themeSettings.visualContrast === 'outdoor-light') {
                      updateThemeSetting('visualContrast', 'classic-obsidian');
                    } else {
                      updateThemeSetting('visualContrast', 'outdoor-light');
                    }
                  }}
                  className="w-10 h-10 lg:w-12 lg:h-12 bg-white/5 border border-white/10 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-400"
                  aria-label="Toggle Field Theme"
                >
                  {themeSettings.visualContrast === 'outdoor-light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                <button
                  onClick={() => setIsQuickCreateOpen(true)}
                  className="w-10 h-10 lg:w-12 lg:h-12 bg-white/5 border border-white/10 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                  aria-label="Quick Create"
                >
                  <Plus size={20} />
                </button>

                <button
                  onClick={() => setIsShortcutsOpen(true)}
                  className="hidden sm:flex w-10 h-10 lg:w-12 lg:h-12 bg-white/5 border border-white/10 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 items-center justify-center transition-all"
                  aria-label="Keyboard shortcuts"
                  title="Keyboard shortcuts (?)"
                >
                  <span className="text-base font-black leading-none">?</span>
                </button>

                <button
                  onClick={() => setIsNotificationsOpen(true)}
                  className="w-10 h-10 lg:w-12 lg:h-12 bg-white/5 border border-white/10 rounded-xl text-zinc-300 hover:text-white flex items-center justify-center transition-all relative"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-black" />
                  )}
                </button>

                <button
                  id="brain-trigger"
                  onClick={() => setIsBrainOpen(true)}
                  className="w-10 h-10 lg:w-12 lg:h-12 bg-white/5 border border-white/10 rounded-xl text-zinc-300 hover:text-white flex items-center justify-center transition-all relative"
                  aria-label="Get Help"
                >
                  <Brain size={20} />
                </button>

                <div 
                  className="hidden xl:flex items-center gap-3 ml-4 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors"
                  onClick={() => setIsUserMenuOpen(true)}
                >
                  <div className="text-right">
                    <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-wide leading-none mb-1">
                      Logged in as
                    </p>
                    <p className="text-[14px] font-bold text-white">Supervisor</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-forest-500/20 border border-forest-500/30 flex items-center justify-center text-forest-400">
                    <User size={18} />
                  </div>
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
                    <p className="text-xs md:text-[10px] font-black uppercase tracking-[0.3em] text-forest-400">
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
                  isMobileMenuOpen ? "text-forest-400" : "text-zinc-400",
                )}
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </motion.nav>

          <CuttyChat isOpen={isBrainOpen} setIsOpen={setIsBrainOpen} />
          <WalkthroughOverlay />
          {isOutboxOpen && <WorkspaceOutboxPanel onClose={() => setIsOutboxOpen(false)} />}
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

          {/* QoL Features */}
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onOutreach={() => {
              setIsCommandPaletteOpen(false);
              setIsOutreachOpen(true);
            }}
          />
          <QuickCreateMenu isOpen={isQuickCreateOpen} onClose={() => setIsQuickCreateOpen(false)} />
          <NotificationsCenter isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} onUnreadCountChange={setUnreadNotifications} />
          <UserProfileMenu isOpen={isUserMenuOpen} onClose={() => setIsUserMenuOpen(false)} />
          <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
        </main>
      </div>
    </>
  );
}
