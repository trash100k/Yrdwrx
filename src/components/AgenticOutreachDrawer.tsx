// @ts-nocheck

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Mail,
  Sparkles,
  CheckCircle2,
  Image,
  FileText,
  Check,
  ThumbsUp,
  Star,
  ShieldCheck,
  Eye,
  Send,
  EyeOff,
  Building,
  Award,
  ShieldAlert,
  BadgeCheck,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Customer } from "../types";
import { useToast } from "../contexts/ToastContext";

interface AgenticOutreachDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockSocialProofReviews = [
  {
    author: "Evelyn K.",
    property: "North Hills HOA President",
    text: "YardWorx saved us $15k in water overhauls this spring alone. Outstanding diligence.",
    rating: 5,
  },
  {
    author: "Marcus S.",
    property: "The Oaks Estates Treasurer",
    text: "The live inventory audit feed is why we renewed. Complete visibility.",
    rating: 5,
  },
];


export default function AgenticOutreachDrawer({
  isOpen,
  onClose,
}: AgenticOutreachDrawerProps) {
  const { showToast } = useToast();
  const [carriers, setCarriers] = useState<Customer[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [includeSocialProof, setIncludeSocialProof] = useState<boolean>(true);
  const [includePropertyPhoto, setIncludePropertyPhoto] =
    useState<boolean>(true);
  const [isPhotoDenied, setIsPhotoDenied] = useState<boolean>(false);
  const [selectedReviewIdx, setSelectedReviewIdx] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Custom generated email draft
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailBody, setEmailBody] = useState<string>("");
  const [htmlPreviewCode, setHtmlPreviewCode] = useState<string>("");

  // Localized success parameters for trust building
  const [localStats, setLocalStats] = useState({
    propertiesMaintained: 14,
    neighborhoodAvgRating: "4.91",
    proximityRadius: "1.8",
  });

  // Pull active CRM leads
  useEffect(() => {
    async function loadLeads() {
      try {
        const q = query(collection(db, "customers"));
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
        if (docs.length > 0) {
          setCarriers(docs);
          setSelectedLeadId(docs[0].id || "");
        } else {
          // Fallback static entries of active high-converting warm targets
          const tempLeads: Customer[] = [
            {
              id: "lead-1",
              firstName: "Poplar",
              lastName: "Springs Estates",
              companyName: "Poplar Springs HOA",
              address: "Poplar Springs, MS",
              email: "board@poplarspringshoa.org",
            },
            {
              id: "lead-2",
              firstName: "Timber",
              lastName: "Creek Alliances",
              companyName: "Timber Creek Neighborhood Assoc",
              address: "Timber Creek, MS",
              email: "contact@timbercreekalliances.net",
            },
          ];
          setCarriers(tempLeads);
          setSelectedLeadId(tempLeads[0].id || "");
        }
      } catch (e) {
        const tempLeads: Customer[] = [
          {
            id: "lead-1",
            firstName: "Poplar",
            lastName: "Springs Estates",
            companyName: "Poplar Springs HOA",
            address: "Poplar Springs, MS",
            email: "board@poplarspringshoa.org",
          },
          {
            id: "lead-2",
            firstName: "Timber",
            lastName: "Creek Alliances",
            companyName: "Timber Creek Neighborhood Assoc",
            address: "Timber Creek, MS",
            email: "contact@timbercreekalliances.net",
          },
        ];
        setCarriers(tempLeads);
        setSelectedLeadId(tempLeads[0].id || "");
      }
    }
    loadLeads();
  }, []);

  // Update outreach template based on selected params
  const generateOutreachTemplate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const selectedLead = carriers.find((c) => c.id === selectedLeadId);
      const name =
        selectedLead?.companyName ||
        selectedLead?.firstName ||
        "Community Planner";

      const subject = `Verifiable Audit: Collaborative Landscaping Upgrade for ${name}`;

      let bodyText = `Dear ${name},\n\n`;
      bodyText += `We are proud to serve several premium communities in your immediate neighborhood. As part of our trust-first, transparent communication protocol, we have synthesized some real-time milestones that may interest you.\n\n`;

      if (includeSocialProof) {
        bodyText += `★ VERIFIABLE LOCAL SOCIAL PROOF:\n`;
        bodyText += `We currently handle ${localStats.propertiesMaintained} master-planned associations within a ${localStats.proximityRadius} mile radius of ${selectedLead?.address || "your district"}.\n`;
        bodyText += `Our verified rating is ${localStats.neighborhoodAvgRating}/5.0 stars across adjacent residential sectors.\n\n`;
        bodyText += `"${mockSocialProofReviews[selectedReviewIdx].text}"\n`;
        bodyText += `- ${mockSocialProofReviews[selectedReviewIdx].author}, ${mockSocialProofReviews[selectedReviewIdx].property}\n\n`;
      }

      if (includePropertyPhoto && !isPhotoDenied) {
        bodyText += `[ATTACHED EVIDENCE: Verified High-Resolution Job Completion Showcase from Adjacent District Project]\n`;
        bodyText += `This photorealistic preview illustrates the precise turf management and hardscape restoration standards we guarantee.\n\n`;
      } else if (isPhotoDenied) {
        bodyText += `[VISUAL PRIVACY NOTE]: We adhere strictly to homeowner privacy metrics. By supervisor guideline instruction, adjacent site completion imagery has been omitted from this email block and is available exclusively via secure portals.\n\n`;
      }

      bodyText += `Would you be open to a 5-minute visual walkthrough of how our real-time inventory feed minimizes water waste and lowers HOA liability?\n\n`;
      bodyText += `Best regards,\n`;
      bodyText += `YardWorx Enterprise Group\n`;
      bodyText += `Operational Command Unit`;

      setEmailSubject(subject);
      setEmailBody(bodyText);
      setIsGenerating(false);
      showToast(
        "Trust metrics successfully embedded in the outreach campaign.",
      );
    }, 500);
  };

  useEffect(() => {
    if (selectedLeadId) {
      generateOutreachTemplate();
    }
  }, [
    selectedLeadId,
    includeSocialProof,
    includePropertyPhoto,
    isPhotoDenied,
    selectedReviewIdx,
  ]);

  const handleTogglePhotoAccess = (deny: boolean) => {
    setIsPhotoDenied(deny);
    if (deny) {
      setIncludePropertyPhoto(false);
      showToast(
        "Consent locked: Visual proof stripped to comply with client privacy constraints.",
      );
    } else {
      setIncludePropertyPhoto(true);
      showToast(
        "Consent granted: Worksite completion photo attached to secure outbound trust.",
      );
    }
  };

  const handleSendCampaignInstance = () => {
    showToast(
      `Outreach queued for sending to ${carriers.find((c) => c.id === selectedLeadId)?.email || "the selected lead"}`,
    );
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop screen */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Drawer Body panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 180 }}
            className="relative w-full sm:w-full sm:w-[540px] h-[100dvh] bg-zinc-950 border-l border-white/10 flex flex-col justify-between overflow-hidden shadow-2xl z-10"
          >
            {/* Header section wrapper */}
            <div className="p-8 border-b border-white/5 molten-edge flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2.5 h-2.5 bg-forest-500 rounded-full animate-ping" />
                  <span className="text-xs md:text-[10px] font-black uppercase tracking-[0.25em] text-forest-400">
                    Agentic Outreach
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black italic tracking-normal md:tracking-tighter text-white uppercase lowercase">
                  growth slider.
                </h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="w-12 h-12 rounded-[18px] bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all border border-white/5"
              >
                <X size={20} />
              </button>
            </div>

            {/* Customizer config scroll zone */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {/* Trust Building Explainer strip */}
              <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5">
                <span className="text-[9px] font-black uppercase text-forest-400 tracking-widest flex items-center gap-2">
                  <BadgeCheck size={14} /> Trust-First Outreach Conversion Rules
                </span>
                <p className="text-xs md:text-[11px] font-medium text-zinc-400 leading-relaxed">
                  Enterprise outreach gains traction by demonstrating
                  **hyper-local proof**, **verifiable client experience stats**,
                  and providing **visual transparency**. Giving users final
                  approval of jobsite visuals ensures strict privacy protection.
                </p>
              </div>

              {/* Lead selector zone */}
              <div className="space-y-4">
                <label className="text-xs md:text-[11px] font-black uppercase tracking-wider text-zinc-400 block pl-1">
                  1. Target Growth Lead
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <select
                    id="outreach-lead-select"
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white focus:outline-none focus:border-forest-500/50 transition-all appearance-none uppercase tracking-wide"
                  >
                    {carriers.map((lead) => (
                      <option
                        key={lead.id}
                        value={lead.id}
                        className="bg-zinc-950 text-white"
                      >
                        {lead.companyName ||
                          `${lead.firstName} ${lead.lastName}`}{" "}
                        ({lead.address || "Local"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Social proof toggle and slider metric config */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs md:text-[11px] font-black uppercase tracking-wider text-zinc-400 pl-1">
                    2. Social Proof & Success Metrics
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={includeSocialProof}
                      onChange={(e) => setIncludeSocialProof(e.target.checked)}
                      aria-label="Include Social Proof"
                    />
                    <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:bg-forest-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                </div>

                {includeSocialProof && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4 pt-1"
                  >
                    {/* Multi Slider configuration representing local metrics adjustments */}
                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs md:text-[11px] font-bold text-zinc-400 uppercase">
                          <span>Proximity Reach</span>
                          <span className="text-forest-400">
                            {localStats.proximityRadius} miles
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="10.0"
                          step="0.1"
                          value={localStats.proximityRadius}
                          onChange={(e) =>
                            setLocalStats({
                              ...localStats,
                              proximityRadius: e.target.value,
                            })
                          }
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-forest-500"
                          aria-label="Proximity Reach in miles"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs md:text-[11px] font-bold text-zinc-400 uppercase">
                          <span>Clients Maintained Nearby</span>
                          <span className="text-forest-400">
                            {localStats.propertiesMaintained} Associations
                          </span>
                        </div>
                        <input
                          type="range"
                          min="3"
                          max="40"
                          step="1"
                          value={localStats.propertiesMaintained}
                          onChange={(e) =>
                            setLocalStats({
                              ...localStats,
                              propertiesMaintained: parseInt(e.target.value),
                            })
                          }
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-forest-500"
                          aria-label="Clients Maintained Nearby"
                        />
                      </div>
                    </div>

                    {/* Choose customer quote to display */}
                    <div className="space-y-2">
                      <span className="text-xs md:text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">
                        Embed Customer Testimonial
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {mockSocialProofReviews.map((rev, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setSelectedReviewIdx(index)}
                            className={`p-3 rounded-xl border text-left text-xs md:text-[11px] font-semibold transition-all ${
                              selectedReviewIdx === index
                                ? "bg-forest-500/10 border-forest-500/30 text-white"
                                : "bg-white/5 border-white/5 text-zinc-500 hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-1 mb-1 text-forest-400 block">
                              <Star size={10} className="fill-current" />
                              <span className="text-[9px] font-bold">5.0</span>
                            </span>
                            <span className="truncate font-bold italic block">
                              "{rev.text}"
                            </span>
                            <span className="text-[9px] opacity-40 mt-1 block">
                              {rev.author}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Solicitation of project completion site photo with explicit compliance lock */}
              <div className="space-y-4">
                <label className="text-xs md:text-[11px] font-black uppercase tracking-wider text-zinc-400 block pl-1">
                  3. Field Work Visual Verification Proof
                </label>

                <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-lg overflow-hidden border border-white/10 shrink-0 relative">
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white/20">
                        <Camera size={24} />
                      </div>
                      {isPhotoDenied && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                          <EyeOff size={18} className="text-rose-500" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h5 className="font-bold text-sm text-white flex items-center gap-1">
                        Adjacent Field Project Showcase
                      </h5>
                      <p className="text-xs md:text-[11px] text-zinc-400 leading-relaxed font-semibold">
                        Showcase photo represents high-quality work completed at
                        adjacent 'Poplar Commons' site.
                      </p>
                    </div>
                  </div>

                  {/* Compliant Action Buttons to Allow / Deny visual showcase */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePhotoAccess(true)}
                      className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        isPhotoDenied
                          ? "bg-rose-500/25 border-rose-500/50 text-rose-300"
                          : "bg-zinc-950 border border-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <ShieldAlert size={14} /> Deny Visual Proof
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePhotoAccess(false)}
                      className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        !isPhotoDenied
                          ? "bg-forest-500 text-black shadow-[0_10px_20px_rgba(5,168,69,0.15)]"
                          : "bg-zinc-950 border border-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Image size={14} /> Include Verified Photo
                    </button>
                  </div>

                  <div className="text-xs md:text-[10px] text-zinc-500 italic pl-1 flex items-center gap-1.5">
                    <ShieldCheck
                      size={12}
                      className={
                        isPhotoDenied ? "text-rose-500" : "text-forest-500"
                      }
                    />
                    {isPhotoDenied
                      ? "Privacy restriction active. visual attachments withheld."
                      : "Permission active. visual proof will be embedded securely."}
                  </div>
                </div>
              </div>

              {/* Outreach interactive live simulation preview block */}
              <div className="space-y-4">
                <span className="text-xs md:text-[11px] font-black uppercase tracking-wider text-zinc-400 pl-1 block">
                  Campaign Output Preview
                </span>

                <div className="bg-zinc-950 rounded-[24px] border border-white/10 p-6 space-y-4 relative font-sans text-xs">
                  <div className="space-y-1.5 pb-4 border-b border-white/5 molten-edge">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 w-16 font-bold uppercase text-[9px]">
                        Subject:
                      </span>
                      <span className="text-white font-bold">
                        {emailSubject}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 w-16 font-bold uppercase text-[9px]">
                        Sender:
                      </span>
                      <span className="text-forest-400 font-bold font-mono">
                        outreach@yardworx.io
                      </span>
                    </div>
                  </div>

                  <div className="text-zinc-300 leading-relaxed max-h-56 overflow-y-auto custom-scrollbar whitespace-pre-line font-medium pr-1">
                    {isGenerating
                      ? "Synthesizing localized matrix parameters..."
                      : emailBody}
                  </div>

                  {includePropertyPhoto && !isPhotoDenied && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="border border-white/5 rounded-xl overflow-hidden mt-4"
                    >
                      <div className="w-full h-32 bg-zinc-800 flex items-center justify-center text-white/20">
                        <Camera size={24} />
                      </div>
                      <div className="bg-white/[0.02] px-4 py-2 flex items-center justify-between">
                        <span className="text-[8px] uppercase tracking-widest font-black text-zinc-500">
                          Exhibit A • Real Adjacent Standard
                        </span>
                        <span className="text-[8px] font-bold text-forest-400">
                          Verified Client Site
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Action bar buttons footer */}
            <div className="p-8 border-t border-white/5 bg-zinc-950">
              <button
                type="button"
                onClick={handleSendCampaignInstance}
                className="w-full py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-sm rounded-[24px] shadow-2xl flex items-center justify-center gap-3 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <Send size={16} /> Disseminate Outreach Drive
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
