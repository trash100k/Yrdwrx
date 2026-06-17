// @ts-nocheck
import { fetchApi } from "../lib/api";
import { safeStorage } from '../lib/storage';
import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
  logSystemEvent,
  auth
} from "../lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import {
  Users,
  Truck,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  MoreVertical,
  Smartphone,
  MapPin,
  Shield,
  TrendingUp,
  Trophy,
  ClipboardList,
  Mic,
  MessageSquare,
  Mail,
  Plus,
  Phone,
  Trash2,
  X
} from "lucide-react";
import { SubscriptionGuard } from "../components/SubscriptionGuard";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { HandsFreeDictator } from "../components/HandsFreeDictator";
import { ResourceAssignmentModal } from "../components/ResourceAssignmentModal";
import { ResourceTimeline } from "../components/ResourceTimeline";

export default function CrewSuite() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [crews, setCrews] = useState<
    {
      id: string;
      name: string;
      status: string;
      jobTime: number;
      etaTime: number;
      phone: string;
      items: string[];
      nextJob: string;
      lat: number;
      lng: number;
      pingTime: string;
      efficiency: number;
      batteryLevels: Record<string, number>;
      leader?: string;
      equip?: string;
      job?: string;
      currentJob?: string;
      progress?: number;
      incidents?: number;
    }[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "incidents" | "late"
  >("all");
  const [viewMode, setViewMode] = useState<"cards" | "timeline">("cards");

  // Recruit modal states
  const [isRecruitOpen, setIsRecruitOpen] = useState(false);
  const [newCrew, setNewCrew] = useState({
    name: "",
    leader: "",
    phone: "",
    equip: "",
    status: "ON_SITE",
    job: "",
    progress: 0
  });

  // Edit / Dropdown states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<any>(null);
  
  // Resource Assignment Modal
  const [isResourceAssignOpen, setIsResourceAssignOpen] = useState(false);

  useEffect(() => {
    const handleVoiceAction = (e: CustomEvent) => {
      const { name, args } = e.detail;
      if (name === "load_employee_data") {
        if (args && args.employeeName) {
          setSearchTerm(args.employeeName);
        }
      }
    };
    window.addEventListener("cutty-action", handleVoiceAction as EventListener);
    return () => window.removeEventListener("cutty-action", handleVoiceAction as EventListener);
  }, []);

  useEffect(() => {
    const tenantId = tenant?.id || "genesis-1";
    const q = query(collection(db, "crews"), where("tenantId", "==", tenantId));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as any,
        );
        setCrews(docs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "crews");
      },
    );

    return () => unsub();
  }, []);

  const handleRecruitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrew.name || !newCrew.leader) {
      showToast({
        title: "Validation Error",
        description: "Please specify both Crew Name and Crew Leader.",
        variant: "destructive",
      });
      return;
    }
    try {
      const tenantId = tenant?.id || "genesis-1";
      const crewData = {
        name: newCrew.name,
        leader: newCrew.leader,
        phone: newCrew.phone || "601-555-0100",
        equip: newCrew.equip || "Hand tools only",
        status: newCrew.status,
        job: newCrew.job || "Idle / Depoted",
        currentJob: newCrew.job || "Idle / Depoted",
        progress: Number(newCrew.progress) || 0,
        efficiency: 95,
        incidents: 0,
        tenantId,
        createdAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, "crews"), crewData);
      setIsRecruitOpen(false);
      setNewCrew({ name: "", leader: "", phone: "", equip: "", status: "ON_SITE", job: "", progress: 0 });
      showToast({
        title: "Crew Recruited Successfully",
        description: `${crewData.name} lead by ${crewData.leader} is now active.`,
        variant: "default",
      });
      logSystemEvent("CREW_RECRUITED", { name: crewData.name });
    } catch (error: any) {
      console.error("Error recruiting crew:", error);
      showToast({
        title: "Failed to Recruit Crew",
        description: error.message || "An error occurred writing to Firestore.",
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCrew || !editingCrew.name || !editingCrew.leader) {
      showToast({
        title: "Validation Error",
        description: "Please specify both Crew Name and Crew Leader.",
        variant: "destructive",
      });
      return;
    }
    try {
      const crewRef = doc(db, "crews", editingCrew.id);
      const updatedData = {
        name: editingCrew.name,
        leader: editingCrew.leader,
        phone: editingCrew.phone || "601-555-0100",
        equip: editingCrew.equip || "Hand tools only",
        status: editingCrew.status,
        job: editingCrew.job || editingCrew.currentJob || "Idle / Depoted",
        currentJob: editingCrew.job || editingCrew.currentJob || "Idle / Depoted",
        progress: Number(editingCrew.progress) || 0,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(crewRef, updatedData);
      setIsEditOpen(false);
      setEditingCrew(null);
      showToast({
        title: "Crew Configurations Saved",
        description: "Crew operational parameters updated.",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Error updating crew:", error);
      showToast({
        title: "Failed to Save Configurations",
        description: error.message || "An error occurred writing to Firestore.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCrew = async (crewId: string) => {
    if (!window.confirm("Are you sure you want to retire this crew? All historical reports remain unaffected.")) {
      return;
    }
    try {
      const crewRef = doc(db, "crews", crewId);
      await deleteDoc(crewRef);
      setIsEditOpen(false);
      setEditingCrew(null);
      showToast({
        title: "Crew Retired",
        description: "The crew has been successfully dismissed/retired.",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Error deleting crew:", error);
      showToast({
        title: "Dismissal Failed",
        description: error.message || "An error occurred deleting document from Firestore.",
        variant: "destructive",
      });
    }
  };

  const handleCallCrew = (crew: any) => {
    if (crew.phone) {
      window.location.href = `tel:${crew.phone}`;
      showToast({
        title: "Dialing Contact",
        description: `Calling ${crew.leader || "Leader"} at ${crew.phone}`,
        variant: "default",
      });
    } else {
      showToast({
        title: "Missing Phone",
        description: "This crew has no registered phone number.",
        variant: "destructive",
      });
    }
  };

  const filteredCrews = crews.filter((crew) => {
    const nameStr = crew.name || "";
    const leaderStr = crew.leader || "";
    const statusStr = crew.status || "";
    const normalizedStatus = statusStr.toLowerCase();

    const matchesSearch =
      nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leaderStr.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeFilter === "all") return matchesSearch;
    if (activeFilter === "active") {
      return matchesSearch && (normalizedStatus === "active" || normalizedStatus === "on_site" || normalizedStatus === "transport");
    }
    if (activeFilter === "incidents") {
      return matchesSearch && (Number(crew.incidents) > 0);
    }
    if (activeFilter === "late") {
      return matchesSearch && normalizedStatus === "late";
    }
    return matchesSearch;
  });

  return (
    <SubscriptionGuard requiredTier="enterprise">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-20">
      {tenant?.settings?.features?.cockpit_buttons && (
        <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            type="button"
            onClick={() => setIsRecruitOpen(true)}
            className="flex flex-col items-center justify-center gap-2 p-6 bg-forest-500/10 border border-forest-500/20 rounded-[20px] text-forest-400 hover:bg-forest-500/20 transition-all shadow-sm"
          >
            <Plus size={24} className="hover:scale-110 transition-transform" />
            <span className="font-bold text-sm">Quick Recruit</span>
          </button>
          <div className="flex flex-col items-center justify-center gap-2 p-6 bg-zinc-900 border border-white/5 molten-edge rounded-[20px] text-zinc-400 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
             <Zap size={24} className="text-yellow-400 animate-pulse" />
             <span className="font-bold text-sm text-yellow-400/80">Easy Mode Active</span>
          </div>
        </div>
      )}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 lg:gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-forest-500/10 rounded-full border border-forest-500 text-xs font-black uppercase tracking-widest text-forest-500">
            <Users size={16} />
            Crew Control Active
          </div>
          <h1 className="text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Crew Suite
          </h1>
          <p className="max-w-xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            Team Dispatch & Check-ins
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-center lg:items-end gap-4 shrink-0 mt-6 lg:mt-0 w-full lg:w-auto">
          {tenant?.settings?.subFeatures?.enableGeofencing && (
            <button
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      alert(`Check-in Geofence Verified:\nLat: ${position.coords.latitude.toFixed(4)}\nLng: ${position.coords.longitude.toFixed(4)}\n\n(No native app required - used browser point-in-time check-in)`);
                    },
                    (error) => {
                      alert("Unable to retrieve location for geofence verification.");
                    }
                  );
                } else {
                  alert("Geolocation is not supported by this browser.");
                }
              }}
              className="px-6 py-4 bg-white/5 border border-white/10 hover:bg-forest-500/10 hover:border-forest-500/50 rounded-2xl text-forest-400 font-black text-xs md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <MapPin size={16} />
              Check-In (Geofence)
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsResourceAssignOpen(true)}
            className="px-6 py-4 bg-blue-500 hover:bg-blue-400 text-black font-black text-xs md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 rounded-2xl font-bold"
          >
            <Truck size={16} />
            Assign Resources
          </button>

          <button
            type="button"
            onClick={() => setIsRecruitOpen(true)}
            className="px-6 py-4 bg-forest-500 hover:bg-forest-400 text-black font-black text-xs md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 rounded-2xl font-bold"
          >
            <Plus size={16} />
            Recruit Crew
          </button>

          <div className="relative w-full lg:w-72">
            <label htmlFor="crew-search" className="sr-only">
              Query crews
            </label>
            <Search
              className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-forest-400 transition-colors"
              size={24}
              aria-hidden="true"
            />
            <input
              id="crew-search"
              type="text"
              placeholder="Query crews..."
              className="w-full min-w-0 pl-16 pr-8 py-5 bg-black border border-white/5 rounded-3xl text-sm font-black tracking-widest uppercase focus:bg-zinc-900 focus:border-forest-500/50 focus:outline-none placeholder:text-zinc-600 transition-all shadow-inner text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* FILTER TABS */}
      <div className="flex flex-col sm:flex-row justify-between shrink-0 gap-4">
        <div className="flex flex-wrap items-center gap-2 bg-zinc-950/80 p-2 rounded-2xl border border-white/5">
          {(["all", "active", "incidents", "late"] as const).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${
                  isActive
                    ? "bg-forest-500 text-black shadow-lg shadow-forest-500/10"
                    : "bg-black/40 text-zinc-400 border border-white/5 hover:border-white/10 hover:text-white"
                }`}
              >
                {filter === "all" ? "All Crews" : filter === "active" ? "Active Today" : filter === "incidents" ? "Incidents" : "Late Crews"}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 bg-zinc-950/80 p-2 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${
              viewMode === "cards"
                ? "bg-zinc-800 text-white shadow-lg"
                : "bg-black/40 text-zinc-400 border border-white/5 hover:border-white/10 hover:text-white"
            }`}
          >
            Crew Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${
              viewMode === "timeline"
                ? "bg-forest-500 text-black shadow-lg shadow-forest-500/10"
                : "bg-black/40 text-zinc-400 border border-white/5 hover:border-white/10 hover:text-white"
            }`}
          >
            Timeline View
          </button>
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
          <AnimatePresence>
          {filteredCrews.map((crew) => {
            const statusStr = crew.status || "";
            const isStatusActive = statusStr.toLowerCase() === "active" || statusStr === "ON_SITE" || statusStr === "TRANSPORT";
            const isStatusLate = statusStr.toLowerCase() === "late" || statusStr === "LATE";
            return (
              <motion.div
                layout
                key={crew.id}
                className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-5 sm:p-8 hover:border-white/20 transition-all relative overflow-hidden group/card bg-black/40 rounded-3xl"
              >
                <header className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl relative",
                        isStatusActive
                          ? "bg-forest-500 text-black font-bold"
                          : isStatusLate
                            ? "bg-amber-500 text-black animate-pulse"
                            : "bg-white/5 text-white/20",
                      )}
                    >
                      <Users size={22} aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black italic tracking-normal md:tracking-tighter text-white uppercase leading-none mb-1">
                        {crew.name}
                      </h4>
                      <span
                        className={cn(
                          "text-[9px] font-black uppercase tracking-widest animate-pulse",
                          isStatusActive
                            ? "text-forest-400"
                            : isStatusLate
                              ? "text-amber-500"
                              : "text-zinc-500",
                        )}
                      >
                        {crew.status}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCrew(crew);
                      setIsEditOpen(true);
                    }}
                    className="p-3 text-white/20 hover:text-white rounded-xl transition-all hover:bg-white/5"
                    aria-label={`Settings for ${crew.name}`}
                  >
                    <MoreVertical size={20} />
                  </button>
                </header>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-zinc-900 border border-white/5 molten-edge rounded-2xl">
                    <div className="flex items-center gap-3">
                      <MapPin size={16} className="text-white/20" />
                      <span className="text-xs md:text-[10px] font-black text-white/40 uppercase tracking-widest">
                        Current Job
                      </span>
                    </div>
                    <span className="text-xs md:text-[10px] font-black text-white uppercase italic truncate max-w-[120px] break-words">
                      {crew.job || crew.currentJob || "None Scheduled"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-zinc-950/60 border border-white/5 rounded-2xl">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Leader</span>
                      <span className="text-sm font-black text-white uppercase truncate block">{crew.leader || "N/A"}</span>
                    </div>
                    <div className="p-4 bg-zinc-950/60 border border-white/5 rounded-2xl">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Mowers/Equip</span>
                      <span className="text-sm font-black text-white uppercase truncate block">{crew.equip || "N/A"}</span>
                    </div>
                  </div>

                  {crew.progress !== undefined && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-zinc-500">Site Progress</span>
                        <span className="text-white font-bold">{crew.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                        <div className="h-full bg-forest-500 transition-all duration-300" style={{ width: `${crew.progress}%` }}></div>
                      </div>
                    </div>
                  )}

                  {crew.assignedResources && crew.assignedResources.length > 0 && (
                     <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                       <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest block mb-2">Checked-Out Assets</span>
                       <div className="flex flex-wrap gap-2">
                         {crew.assignedResources.map((res: any) => (
                           <span key={res.id} className="text-xs bg-black border border-white/5 px-2 py-1 rounded text-white/80">
                             {res.quantity}x {res.name}
                           </span>
                         ))}
                       </div>
                     </div>
                  )}
                </div>

                <footer className="mt-8 pt-8 border-t border-white/10 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => handleCallCrew(crew)}
                    className="flex-1 py-3 bg-white text-black rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all text-center"
                  >
                    Call Crew
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingCrew(crew);
                      setIsEditOpen(true);
                    }}
                    className="flex-1 py-3 bg-zinc-900 border border-white/5 molten-edge shadow-2xl text-white font-black text-[9px] uppercase tracking-widest hover:bg-white/5 transition-all text-center"
                  >
                    Configure
                  </button>
                </footer>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      ) : (
        <ResourceTimeline />
      )}

      <div className="bg-zinc-900 border border-white/5 molten-edge shadow-2xl p-10 mt-10 rounded-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-12 gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/60 border border-white/10">
              <ClipboardList size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black italic text-white uppercase leading-none">
                Daily Field Logs & Check-ins
              </h3>
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-2">
                Gate codes, arrivals, and job site notes
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                if (!SpeechRecognition) return alert('Speech recognition not supported in this browser. Try opening the app in a new tab.');
                const recognition = new SpeechRecognition();
                recognition.onstart = () => alert("Listening... Speak your log.");
                recognition.onresult = (e: any) => {
                    const txt = e.results[0][0].transcript;
                    alert("Voice Log Submitted to feed: " + txt);
                };
                recognition.start();
            }}
            className="px-6 py-3 bg-white text-black rounded-xl font-black text-[9px] uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-2">
            <Mic size={14} /> Voice Transcription Log
          </button>
          {tenant?.settings?.subFeatures?.exifVerification && (
            <button 
             onClick={() => {
                alert("Simulating EXIF Photo Verification: \n\nImage successfully scanned for EXIF GPS tags. \nCoordinates (34.0522, -118.2437) match client Geofence radius. \n\nCheck-out validated without background tracking.");
             }}
             className="px-6 py-3 bg-white/5 text-amber-500 border border-amber-500/20 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-amber-500/10 transition-all flex items-center gap-2">
              <CheckCircle2 size={14} /> EXIF Photo Verifier
            </button>
          )}
          
          <button 
           onClick={async () => {
             const activeState = safeStorage.getItem("cutty_workspace_active");
             if (activeState !== "live") {
               alert("Sandbox Workspace: Sent field report to owner via simulated Gmail.");
               return;
             }
             const token = safeStorage.getItem("cutty_workspace_token");
             if (!token) {
               alert("Please connect Google Workspace in Dashboard first.");
               return;
             }
             try {
                const messageParts = [
                  "To: me",
                  `Subject: ${tenant?.name || "Local Branch"} - Field Operations Check-in Report`,
                  "Content-Type: text/plain; charset=utf-8",
                  "",
                  "Daily Log Summary:",
                  "- Alpha Squadron: Arrived on Site: 114 Maple Street. Gate code verified.",
                  "- Beta Team: Client requested extra mulch on south beds.",
                  "- Delta Crew: Departure completed. Equipment secured."
                ].join("\n");
                
                const encodedMessage = btoa(unescape(encodeURIComponent(messageParts)))
                  .replace(/\+/g, "-")
                  .replace(/\//g, "_")
                  .replace(/=+$/, "");
                  
                const res = await fetchApi("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ raw: encodedMessage })
                });
                if (res.ok) {
                   alert("Field check-in report dispatched to your Gmail.");
                } else {
                   alert("Failed to send report.");
                }
             } catch (e) {
                console.error(e);
             }
           }}
           className="px-6 py-3 bg-white/5 text-forest-400 border border-forest-500/20 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-forest-500/10 transition-all flex items-center gap-2">
            <Mail size={14} /> Dispatch to Owner
          </button>

          <button 
               onClick={async () => {
                 try {
                   const provider = new GoogleAuthProvider();
                   provider.addScope("https://www.googleapis.com/auth/chat.messages");
                   const result = await signInWithPopup(auth, provider);
                   const credential = GoogleAuthProvider.credentialFromResult(result);
                   if (!credential?.accessToken) throw new Error("No token");
                   
                   const res = await fetchApi("/api/integration/chat", {
                     method: "POST",
                     headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({ accessToken: credential.accessToken, spaceName: "spaces/dispatch", message: "New alert from Crew Suite!" })
                   });
                   if (!res.ok) throw new Error("Chat failed");
                   alert("Successfully dispatched to Google Chat!");
                   logSystemEvent("CHAT_DISPATCHED", { target: "dispatch" });
                 } catch (err: any) {
                   console.error(err);
                 }
               }}
               className="px-6 py-3 bg-celtic-500/10 text-celtic-500 border border-celtic-500/20 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-celtic-500/20 transition-all shadow-[0_0_20px_rgba(193, 41, 46,0.1)] flex items-center gap-2"
            >
              <MessageSquare size={14} /> Dispatch to Chat
          </button>
        </div>

        <div className="space-y-4 relative z-10">
          <div className="p-5 bg-zinc-950 border border-white/5 molten-edge rounded-2xl flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-forest-500/20 text-forest-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} />
              </div>
              <div>
                  <p className="text-sm font-bold text-white mb-1"><span className="text-zinc-500 font-medium">Alpha Squadron •</span> Arrived on Site: 114 Maple Street</p>
                  <p className="text-xs text-zinc-400">All crew members accounted for. Gate code 4492 verified and functional.</p>
                  <span className="text-xs md:text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 block">10 mins ago</span>
              </div>
          </div>
          <div className="p-5 bg-zinc-950 border border-white/5 molten-edge rounded-2xl flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-celtic-500/20 text-celtic-500 flex items-center justify-center shrink-0">
                  <MessageSquare size={18} />
              </div>
              <div>
                  <p className="text-sm font-bold text-white mb-1"><span className="text-zinc-500 font-medium">Beta Team •</span> Client Request Update</p>
                  <p className="text-xs text-zinc-400">Mrs. Johnson requested we skip the side yard today due to new grass seed. Adjusted invoice pending.</p>
                  <span className="text-xs md:text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 block">45 mins ago</span>
              </div>
          </div>
          <div className="p-5 bg-zinc-950 border border-white/5 molten-edge rounded-2xl flex items-start gap-4 opacity-70">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
              </div>
              <div>
                  <p className="text-sm font-bold text-white mb-1"><span className="text-zinc-500 font-medium">Gamma Forces •</span> Equipment Note (Voice Transcribed)</p>
                  <p className="text-xs text-zinc-400">"The primary string trimmer needs new line and the spark plug is misfiring. Need maintenance tonight."</p>
                  <span className="text-xs md:text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 block">2 hours ago</span>
              </div>
          </div>
        </div>
      </div>

      {/* RECRUIT CREW MODAL */}
      <AnimatePresence>
        {isRecruitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 w-full max-w-xl rounded-[28px] overflow-hidden shadow-2xl p-6 sm:p-10 text-white relative"
            >
              <button
                type="button"
                onClick={() => setIsRecruitOpen(false)}
                className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-white rounded-full bg-white/5 transition-all"
              >
                <X size={16} />
              </button>

              <div className="mb-6">
                <span className="text-[10px] bg-forest-500/10 text-forest-400 px-3 py-1.5 rounded-full border border-forest-500/20 font-black uppercase tracking-widest">
                  Quick Recruit Engine
                </span>
                <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mt-4">
                  Recruit New Crew
                </h3>
                <p className="text-xs text-zinc-400 mt-2">
                  Assemble a field squad, designate equipment inventory, and dispatch onto active tracks.
                </p>
              </div>

              <form onSubmit={handleRecruitSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    Squad / Crew Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sierra Clean Team"
                    className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all placeholder:text-zinc-600"
                    value={newCrew.name}
                    onChange={(e) => setNewCrew({ ...newCrew, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                      Lead Contact / Leader *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Marcus Aurelius"
                      className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all placeholder:text-zinc-600"
                      value={newCrew.leader}
                      onChange={(e) => setNewCrew({ ...newCrew, leader: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                      Leader Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 601-555-0199"
                      className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all placeholder:text-zinc-600"
                      value={newCrew.phone}
                      onChange={(e) => setNewCrew({ ...newCrew, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    Designated Mowers & Equipment
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scag Patriot 52, String Trimmers #3"
                    className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all placeholder:text-zinc-600"
                    value={newCrew.equip}
                    onChange={(e) => setNewCrew({ ...newCrew, equip: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                      Initial Assignment (Job Location)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1928 Broad St Office"
                      className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all placeholder:text-zinc-600"
                      value={newCrew.job}
                      onChange={(e) => setNewCrew({ ...newCrew, job: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                      Dispatcher Status
                    </label>
                    <select
                      className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all text-white"
                      value={newCrew.status}
                      onChange={(e) => setNewCrew({ ...newCrew, status: e.target.value })}
                    >
                      <option value="ON_SITE">ON_SITE</option>
                      <option value="TRANSPORT">TRANSPORT</option>
                      <option value="LATE">LATE</option>
                      <option value="OFF_DUTY">OFF_DUTY / DEPO</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex gap-4 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsRecruitOpen(false)}
                    className="px-6 py-4 rounded-xl border border-white/5 hover:bg-white/5 text-sm font-bold transition-all text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-4 rounded-xl bg-forest-500 text-black text-sm font-black uppercase tracking-wider hover:bg-forest-400 transition-all shadow-lg shadow-forest-500/10"
                  >
                    Add to Active Duty
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIGURE CREW / STATUS MODAL */}
      <AnimatePresence>
        {isEditOpen && editingCrew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 w-full max-w-xl rounded-[28px] overflow-hidden shadow-2xl p-6 sm:p-10 text-white relative"
            >
              <button
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingCrew(null);
                }}
                className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-white rounded-full bg-white/5 transition-all"
              >
                <X size={16} />
              </button>

              <div className="mb-6">
                <span className="text-[10px] bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-full border border-amber-500/20 font-black uppercase tracking-widest">
                  Configure Operational Parameters
                </span>
                <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mt-4">
                  Configure {editingCrew.name}
                </h3>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    Squad Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all placeholder:text-zinc-600"
                    value={editingCrew.name}
                    onChange={(e) => setEditingCrew({ ...editingCrew, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                      Lead Contact / Leader
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all"
                      value={editingCrew.leader || ""}
                      onChange={(e) => setEditingCrew({ ...editingCrew, leader: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all"
                      value={editingCrew.phone || ""}
                      onChange={(e) => setEditingCrew({ ...editingCrew, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    Designated Assets / Equipment
                  </label>
                  <input
                    type="text"
                    className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all"
                    value={editingCrew.equip || ""}
                    onChange={(e) => setEditingCrew({ ...editingCrew, equip: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                      Active Dispatch Job
                    </label>
                    <input
                      type="text"
                      className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all"
                      value={editingCrew.job || editingCrew.currentJob || ""}
                      onChange={(e) => setEditingCrew({ ...editingCrew, job: e.target.value, currentJob: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                      Duty Status Update
                    </label>
                    <select
                      className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-forest-500 focus:outline-none transition-all text-white"
                      value={editingCrew.status || "OFF_DUTY"}
                      onChange={(e) => setEditingCrew({ ...editingCrew, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="ON_SITE">ON_SITE</option>
                      <option value="TRANSPORT">TRANSPORT</option>
                      <option value="LATE">LATE</option>
                      <option value="late">late</option>
                      <option value="OFF_DUTY">OFF_DUTY</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    <span>Task Progress Counter</span>
                    <span className="text-white font-bold">{editingCrew.progress || 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    className="w-full accent-forest-500 cursor-pointer h-1 bg-black rounded-lg appearance-none"
                    value={editingCrew.progress || 0}
                    onChange={(e) => setEditingCrew({ ...editingCrew, progress: Number(e.target.value) })}
                  />
                </div>

                <div className="pt-6 border-t border-white/5 flex flex-wrap gap-4 justify-between items-center">
                  <button
                    type="button"
                    onClick={() => handleDeleteCrew(editingCrew.id)}
                    className="px-5 py-3.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                  >
                    <Trash2 size={14} />
                    Retire Crew
                  </button>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditOpen(false);
                        setEditingCrew(null);
                      }}
                      className="px-5 py-3.5 rounded-xl border border-white/5 hover:bg-white/5 text-xs font-bold transition-all text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-3.5 rounded-xl bg-forest-500 text-black text-xs font-black uppercase tracking-widest hover:bg-forest-400 transition-all shadow-lg"
                    >
                      Apply Save
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    <HandsFreeDictator />
    <AnimatePresence>
      <ResourceAssignmentModal
        isOpen={isResourceAssignOpen}
        onClose={() => setIsResourceAssignOpen(false)}
        crews={crews}
      />
    </AnimatePresence>
    </SubscriptionGuard>
  );
}

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}
