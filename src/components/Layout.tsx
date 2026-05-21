
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  Bell,
  MessageSquare,
  Menu,
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
  Brain,
  WifiOff,
  CloudAlert,
  Sparkles,
  ChevronRight,
  PieChart,
  Zap,
  Truck,
  Palette,
  Terminal,
} from "lucide-react";
import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import CuttyChat from "./CuttyChat";
import LiveEar from "./LiveEar";
import WalkthroughOverlay from "./WalkthroughOverlay";
import FieldModeInterface from "./FieldModeInterface";
import AgenticOutreachDrawer from "./AgenticOutreachDrawer";
import { useEnterpriseTheme } from "../contexts/EnterpriseThemeContext";
import { useCuttyGuide } from "../contexts/CuttyGuideContext";
import { useFieldMode } from "../contexts/FieldModeContext";
import { useOfflineStatus } from "../hooks/useOfflineStatus";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { syncService } from "../services/syncService";
import { auth } from "../lib/firebase";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showFABActions, setShowFABActions] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const location = useLocation();
  const isOffline = useOfflineStatus();
  const [isBrainOpen, setIsBrainOpen] = useState(false);
  const [isOutreachOpen, setIsOutreachOpen] = useState(false);
  const { getSpacingClasses } = useEnterpriseTheme();
  const { activeFocus, jobStatus } = useCuttyGuide();
  const {
    isFieldMode,
    toggleFieldMode,
    isPreloading,
    leavingSiteAlert,
    dismissAlert,
  } = useFieldMode();

  // Auto-open brain chat for new users
  useEffect(() => {
    const userKey = auth.currentUser?.email || "anonymous";
    const hasSeen = localStorage.getItem(`has-seen-walkthrough-${userKey}`);
    if (!hasSeen) {
      const timer = setTimeout(() => setIsBrainOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

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

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Home", path: "/", group: "BUSINESS" },
    { icon: Users, label: "Clients", path: "/clients", group: "BUSINESS" },
    { icon: Truck, label: "Crews", path: "/crew-suite", group: "BUSINESS" },
    {
      icon: Palette,
      label: "Planner",
      path: "/design-studio",
      group: "CREATIVE",
    },
    {
      icon: Package,
      label: "Supplies",
      path: "/asset-hub",
      group: "OPERATIONS",
    },
    { icon: Activity, label: "Shop", path: "/operations", group: "OPERATIONS" },
    { icon: Terminal, label: "QA Check", path: "/qa", group: "OPERATIONS" },
    { icon: BarChart3, label: "Money", path: "/capital", group: "FINANCE" },
    { icon: Rocket, label: "Sales", path: "/growth", group: "FINANCE" },
  ];

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
    <div
      className={cn(
        "flex h-[100dvh] w-full text-white font-sans overflow-hidden bg-black",
        isFieldMode && "performance-shield-active",
      )}
    >
      {!isFieldMode && <div className="atmosphere" aria-hidden="true" />}

      {isFieldMode && <FieldModeInterface />}

      {/* Desktop Sidebar Navigation */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "relative z-40 hidden lg:flex flex-col transition-all duration-300 border-r border-white/5 bg-zinc-950",
          isSidebarOpen ? "w-96 p-10" : "w-32 p-6",
        )}
      >
        <div className="flex-1 flex flex-col">
          <div className="mb-12 px-4">
            <div
              id="cutty-logo"
              className="flex items-center gap-5 overflow-hidden"
            >
              <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl">
                <Leaf size={32} className="text-white" />
              </div>
              {isSidebarOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h1 className="text-3xl font-black tracking-tight text-white uppercase">
                    Cutty
                  </h1>
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">
                    Management
                  </p>
                </motion.div>
              )}
            </div>
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
                    className="w-full flex items-center justify-between px-6 py-4 text-[15px] font-bold text-zinc-300 uppercase tracking-wider hover:text-white transition-colors"
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
                      {items.map((item) => (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-5 px-6 py-5 rounded-3xl transition-all duration-200",
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
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </nav>

          <div className="mt-auto pt-8 border-t border-white/5 space-y-4">
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
              <p className="text-[10px] font-black uppercase tracking-widest text-center">
                Connection Suspended • Field Mode Active
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <header className="h-32 flex items-center justify-between px-16 shrink-0 sticky top-0 z-30 border-b border-white/5 bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xl">
              <Leaf size={28} />
            </div>
            <span className="font-bold tracking-tight text-3xl text-white">
              CUTTY
            </span>
          </div>

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
                className="w-full pl-16 pr-8 py-4 bg-white/5 border border-white/5 rounded-2xl text-lg font-bold focus:bg-white/10 focus:border-emerald-500/30 focus:outline-none placeholder:text-zinc-500 transition-all text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-8">
            <LiveEar />

            <div className="flex items-center gap-4 border-l border-white/10 pl-8">
              <button
                id="outreach-trigger"
                onClick={() => setIsOutreachOpen(true)}
                className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl text-emerald-400 hover:text-white flex items-center justify-center transition-all relative"
                aria-label="Agentic Outreach"
                title="Launch Agentic Outreach Slider"
              >
                <Rocket size={22} className="text-emerald-400" />
                <span className="absolute top-2 right-2 w-3 h-3 bg-emerald-400 rounded-full border border-black animate-pulse" />
              </button>

              <button
                id="brain-trigger"
                onClick={() => setIsBrainOpen(true)}
                className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl text-zinc-300 hover:text-white flex items-center justify-center transition-all relative"
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
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/10">
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
          className={cn(
            "flex-1 overflow-y-auto px-8 lg:px-16 pb-32 lg:pb-16 custom-scrollbar overscroll-none transition-all duration-700",
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
                  <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">
                    Loading Job Info...
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">
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
                    className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-[32px] text-zinc-400 hover:text-white"
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
                className="mt-12 w-full p-6 bg-white text-black rounded-[32px] font-black uppercase tracking-widest text-xs"
              >
                Close Menu
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <nav
          className="fixed bottom-8 left-4 right-4 h-20 tactical-dock lg:hidden flex items-center justify-between z-[110]"
          aria-label="Tactical Dock"
        >
          <div className="flex-1 flex items-center justify-between px-2">
            {navItems.slice(0, 4).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
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
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
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
            ))}
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
        </nav>

        <CuttyChat isOpen={isBrainOpen} setIsOpen={setIsBrainOpen} />
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
                className="max-w-md w-full bg-amber-500 text-black p-12 rounded-[56px] shadow-2xl border-4 border-black text-center space-y-8"
              >
                <div className="w-24 h-24 bg-black rounded-[32px] flex items-center justify-center mx-auto shadow-2xl">
                  <ShieldCheck
                    size={48}
                    className="text-amber-500 animate-pulse"
                  />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
                    Boundary Alert
                  </h2>
                  <p className="text-sm font-bold uppercase tracking-widest text-black/60">
                    You've left the job site. Ready to switch back to full mode?
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
                    className="w-full py-5 bg-black/10 border-2 border-black/20 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-black/20 transition-all"
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
  );
}
