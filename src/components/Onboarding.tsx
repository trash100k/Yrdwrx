// @ts-nocheck

import { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { MagicSetupNode } from "./MagicSetupNode";
import {
  ChevronRight,
  MapPin,
  Building2,
  Phone,
  Briefcase,
  Sparkles,
  Brain,
  Zap,
} from "lucide-react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const { transcript: hookTranscript, isListening: isRec, startListening, stopListening, setTranscript: setHookTranscript } = useSpeechRecognition();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    companyName: "",
    ownerName: "",
    ownerPhone: "",
    serviceArea: "",
    services: [] as string[],
    loadDemoData: true,
    agreements: {
      tos: false,
      privacy: false,
      dataMap: false,
      ai: false
    },
  });
  const [error, setError] = useState<string | null>(null);
  const [activeDictationField, setActiveDictationField] = useState<string | null>(null);

  const availableServices = [
    "Lawn Mowing",
    "Irrigation Repair",
    "Landscape Design",
    "Hardscaping",
    "Seasonal Cleanup",
    "Pest Control",
    "Fertilization",
  ];


      useEffect(() => {
          if (hookTranscript && activeDictationField) {
              setFormData(prev => ({ ...prev, [activeDictationField]: hookTranscript }));
              setHookTranscript("");
              stopListening();
              setActiveDictationField(null);
          }
      }, [hookTranscript]);

  const handleDictation = (field: "companyName" | "ownerPhone" | "serviceArea") => {
     setActiveDictationField(field);
     startListening();
  };

  const handleAutoDetectLocation = () => {
    if (!navigator.geolocation) {
       setError("Geolocation is not supported by your browser.");
       return;
    }
    navigator.geolocation.getCurrentPosition(
       async (position) => {
         try {
           const { latitude, longitude } = position.coords;
           const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
           const data = await res.json();
           const locationString = data.address.city || data.address.town || data.address.village || data.address.county || "Current Location";
           
           setFormData(prev => ({ 
             ...prev, 
             serviceArea: prev.serviceArea ? `${prev.serviceArea}, ${locationString}` : locationString 
           }));
         } catch (e) {
           setError("Could not automatically determine location name.");
         }
       },
       (err) => {
         setError("Could not get your location.");
       }
    );
  };

  const handleExtractedData = (data: any) => {
    setFormData(prev => ({
        ...prev,
        ...data,
        agreements: { tos: true, privacy: true, dataMap: true, ai: true }
    }));
    setStep(4);
  };

  const handleNext = async () => {
    setError(null);
    if (step === 1) {
      if (!formData.companyName.trim() || !formData.ownerPhone.trim()) {
        setError("Please provide your business name and contact info before proceeding.");
        return;
      }
    }
    if (step === 2) {
      if (!formData.serviceArea.trim()) {
        setError("Please define at least one service area.");
        return;
      }
    }
    if (step === 3) {
      if (formData.services.length === 0) {
        setError("Please select at least one primary service.");
        return;
      }
    }
    if (step === 4) {
      if (!formData.agreements.tos || !formData.agreements.privacy || !formData.agreements.dataMap || !formData.agreements.ai) {
        setError("You must agree to all operational terms, data policies, and AI guidelines to activate your YardWorx account.");
        return;
      }
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      /* Save to Firebase */ if (auth.currentUser) {
        const userDoc = await import("firebase/firestore").then(m => m.getDoc(m.doc(db, "users", auth.currentUser!.uid)));
        const tenantId = userDoc.exists() ? (userDoc.data().activeTenantId || "genesis-1") : "genesis-1";

        const formDataWithTenant = { ...formData, tenantId };

        await setDoc(doc(db, "tenants", tenantId), {
            name: formData.companyName,
            ownerName: formData.ownerName || "Business Owner", // Handled if empty
            ownerPhone: formData.ownerPhone,
            services: formData.services,
            serviceAreaPoints: formData.serviceArea.split(',').map(s => s.trim()),
            tier: "free",
            settings: {
                hoaProtocolEnabled: true,
                satelliteVisionEnabled: true,
                currency: "USD",
                neighborhoodMask: formData.serviceArea.split(',').map(s => s.trim()),
                voiceEnabled: true,
                chemicalLogEnabled: true
            }
        }, { merge: true });

        await setDoc(doc(db, "users", auth.currentUser.uid), {
           agreementsAccepted: true,
           agreementsAcceptedAt: new Date().toISOString()
        }, { merge: true });

        await setDoc(doc(db, "settings", auth.currentUser.uid), {
          ...formDataWithTenant,
          onboardingComplete: true,
          updatedAt: new Date().toISOString(),
        });
        
        try {
          if (formData.loadDemoData) {
            const { seedDatabaseIfEmpty } = await import("../lib/seedDatabase");
            await seedDatabaseIfEmpty(formDataWithTenant);
          }
        } catch (e) {
          console.error("Failed to execute DB initialization", e);
        }

        onComplete();
      }
    }
  };
  const toggleService = (service: string) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  };
  return (
    <main className="min-h-[100dvh] bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {" "}
      <div className="atmosphere" aria-hidden="true" />{" "}
      <div className="max-w-xl w-full p-12 lg:p-16">
        {" "}
        <div className="flex gap-3 mb-16">
          {" "}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${i <= step ? "bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "bg-white/10"}`}
            />
          ))}{" "}
        </div>{" "}
        <AnimatePresence mode="wait">
          {" "}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              {" "}
              <header className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full micro-label text-forest-400">
                  <Building2 size={12} /> Business Profile{" "}
                </div>{" "}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl break-words font-bold tracking-tight leading-none sf-text-gradient">
                  Company <br /> Details.
                </h1>{" "}
                <p className="text-white/40 font-medium text-lg leading-relaxed">
                  Let's get your landscaping business set up in YardWorx.
                </p>{" "}
              </header>{" "}
              <div className="space-y-6">
                <MagicSetupNode onExtract={handleExtractedData} />
                <div className="flex items-center gap-4 py-4">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-white/30 font-bold text-xs uppercase tracking-widest">OR ENTER MANUALLY</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                </div>
                <div className="relative group">
                  {" "}
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors">
                    {" "}
                    <Building2 size={24} />{" "}
                  </div>{" "}
                  <input
                    type="text"
                    aria-label="Business Name"
                    placeholder="Business Name (e.g., Smith & Sons Landscaping)"
                    className="w-full min-w-0 bg-white/5 border border-white/5 rounded-3xl py-6 pl-16 pr-16 focus:bg-white/10 focus:border-white/20 focus:outline-none placeholder:text-white/20 transition-all font-bold text-lg"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                  />
                  <div 
                    onClick={() => handleDictation("companyName")}
                    className={`absolute right-6 top-1/2 -translate-y-1/2 cursor-pointer transition-colors ${
                      isListening === "companyName" ? "text-red-500 animate-pulse" : "text-white/20 hover:text-forest-400"
                    }`} 
                    title={isListening === "companyName" ? "Listening..." : "Use Voice Dictation"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors">
                    <Building2 size={24} />
                  </div>
                  <input
                    type="text"
                    aria-label="Owner Name"
                    placeholder="Owner Name (e.g., John Smith)"
                    className="w-full min-w-0 bg-white/5 border border-white/5 rounded-3xl py-6 pl-16 pr-16 focus:bg-white/10 focus:border-white/20 focus:outline-none placeholder:text-white/20 transition-all font-bold text-lg"
                    value={formData.ownerName}
                    onChange={(e) =>
                      setFormData({ ...formData, ownerName: e.target.value })
                    }
                  />
                  <div 
                    onClick={() => handleDictation("ownerName" as any)}
                    className={`absolute right-6 top-1/2 -translate-y-1/2 cursor-pointer transition-colors ${
                      isListening === "ownerName" ? "text-red-500 animate-pulse" : "text-white/20 hover:text-forest-400"
                    }`} 
                    title={isListening === "ownerName" ? "Listening..." : "Use Voice Dictation"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                  </div>
                </div>
                <div className="relative group">
                  {" "}
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors">
                    {" "}
                    <Phone size={24} />{" "}
                  </div>{" "}
                  <input
                    type="tel"
                    aria-label="Owner Phone Number"
                    placeholder="Owner Phone Number (e.g., 555-123-4567)"
                    className="w-full min-w-0 bg-white/5 border border-white/5 rounded-3xl py-6 pl-16 pr-16 focus:bg-white/10 focus:border-white/20 focus:outline-none placeholder:text-white/20 transition-all font-bold text-lg"
                    value={formData.ownerPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, ownerPhone: e.target.value })
                    }
                  />
                  <div 
                    onClick={() => handleDictation("ownerPhone")}
                    className={`absolute right-6 top-1/2 -translate-y-1/2 cursor-pointer transition-colors ${
                      isListening === "ownerPhone" ? "text-red-500 animate-pulse" : "text-white/20 hover:text-forest-400"
                    }`} 
                    title={isListening === "ownerPhone" ? "Listening..." : "Use Voice Dictation"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                  </div>{" "}
                </div>{" "}
              </div>{" "}
            </motion.div>
          )}{" "}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              {" "}
              <header className="space-y-4">
                {" "}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full micro-label text-celtic-400">
                  {" "}
                  <MapPin size={12} /> Service Areas{" "}
                </div>{" "}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black italic tracking-normal md:tracking-tighter leading-none sf-text-gradient">
                  Local <br /> Focus.
                </h1>{" "}
                <p className="text-white/40 font-medium text-lg leading-relaxed">
                  Which neighborhoods or cities do you currently cover?
                </p>
                <p className="text-white/30 text-sm italic mb-2">
                  (Used to calculate travel times and suggest marketing targets)
                </p>
              </header>{" "}
              <div className="space-y-6">
                {" "}
                <div className="relative group">
                  {" "}
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors">
                    {" "}
                    <MapPin size={24} />{" "}
                  </div>{" "}
                  <input
                    type="text"
                    aria-label="Service Area"
                    placeholder="e.g., Northside, Riverdale, Zip 90210"
                    className="w-full min-w-0 bg-white/5 border border-white/5 rounded-3xl py-6 pl-16 pr-[120px] focus:bg-white/10 focus:border-white/20 focus:outline-none placeholder:text-white/20 transition-all font-bold text-lg"
                    value={formData.serviceArea}
                    onChange={(e) =>
                      setFormData({ ...formData, serviceArea: e.target.value })
                    }
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoDetectLocation}
                      className="px-3 py-1.5 bg-celtic-500/10 hover:bg-celtic-500/20 text-celtic-400 rounded-full font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1"
                    >
                      <MapPin size={12} />
                      Detect
                    </button>
                    <div 
                      onClick={() => handleDictation("serviceArea")}
                      className={`cursor-pointer transition-colors ${
                        isListening === "serviceArea" ? "text-red-500 animate-pulse" : "text-white/20 hover:text-forest-400"
                      }`} 
                      title={isListening === "serviceArea" ? "Listening..." : "Use Voice Dictation"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                    </div>
                  </div>{" "}
                </div>{" "}
              </div>{" "}
            </motion.div>
          )}{" "}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              {" "}
              <header className="space-y-4">
                {" "}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full micro-label text-amber-400">
                  {" "}
                  <Briefcase size={12} /> Service List{" "}
                </div>{" "}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black italic tracking-normal md:tracking-tighter leading-none sf-text-gradient">
                  What You <br /> Offer.
                </h1>{" "}
                <p className="text-white/40 font-medium text-lg leading-relaxed">
                  Select the primary services your teams provide.
                </p>{" "}
                <button
                  onClick={() => {
                    if (formData.services.length === availableServices.length) {
                      setFormData(prev => ({ ...prev, services: [] }));
                    } else {
                      setFormData(prev => ({ ...prev, services: [...availableServices] }));
                    }
                  }}
                  className="mt-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                  <Sparkles size={14} />
                  {formData.services.length === availableServices.length ? "Deselect All" : "Select All Services"}
                </button>
              </header>{" "}
              <div className="grid grid-cols-2 gap-4 h-[300px] overflow-y-auto no-scrollbar">
                {" "}
                {availableServices.map((service) => (
                  <button
                    key={service}
                    onClick={() => toggleService(service)}
                    className={`p-6 rounded-3xl text-left border transition-all duration-500 relative group overflow-hidden ${formData.services.includes(service) ? "border-white bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.2)]" : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"}`}
                  >
                    {" "}
                    <Briefcase size={20} className="mb-4 relative z-10" />{" "}
                    <span className="font-bold text-sm tracking-tight relative z-10">
                      {service}
                    </span>{" "}
                  </button>
                ))}{" "}
              </div>{" "}
            </motion.div>
          )}{" "}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
              {" "}
              <header className="space-y-4">
                {" "}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full micro-label text-forest-400">
                  {" "}
                  <Sparkles size={12} /> All Set{" "}
                </div>{" "}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black italic tracking-normal md:tracking-tighter leading-none sf-text-gradient">
                  Ready to <br /> Grow.
                </h1>{" "}
                <p className="text-white/40 font-medium text-lg leading-relaxed">
                  Your account is ready. YardWorx is now active and ready for your
                  first job.
                </p>{" "}
              </header>{" "}
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-6 bg-white/5 border border-white/5 rounded-3xl group">
                  <Zap size={24} className="text-forest-400 mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-white mb-1">
                      YardWorx Help Active
                    </p>
                    <p className="text-xs md:text-[11px] text-white/40 font-medium leading-relaxed italic uppercase">
                      Ask for client details or site info anytime.
                    </p>
                  </div>
                </div>


                <label className="flex items-start gap-4 p-6 bg-forest-500/10 border border-forest-500/20 rounded-3xl cursor-pointer hover:bg-forest-500/20 transition-colors mt-4">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={formData.loadDemoData}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          loadDemoData: e.target.checked
                        }))
                      }
                      className="w-6 h-6 accent-forest-500 rounded bg-white/5 border-white/20 cursor-pointer"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-forest-400 mb-1">
                      Load Practice Data
                    </p>
                    <p className="text-xs md:text-[11px] text-forest-400/70 font-medium leading-relaxed italic uppercase">
                      Pre-fill your account with example clients, jobs, and inventory so you can see how YardWorx works immediately.
                    </p>
                  </div>
                </label>
                
                <div className="space-y-3 mt-8 border-t border-white/10 pt-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white/60">Required Agreements</h3>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, agreements: { tos: true, privacy: true, dataMap: true, ai: true } }))}
                      className="px-5 py-2 bg-forest-500/10 hover:bg-forest-500/20 text-forest-400 border border-forest-500/20 rounded-full font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
                    >
                      <Sparkles size={12} />
                      Accept All Agreements
                    </button>
                  </div>
                  <label className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={formData.agreements.tos}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            agreements: { ...prev.agreements, tos: e.target.checked }
                          }))
                        }
                        className="w-5 h-5 accent-forest-500 rounded bg-white/5 border-white/20 cursor-pointer"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-white mb-1">
                        Terms of Service
                      </p>
                      <p className="text-xs md:text-[10px] text-white/40 font-medium leading-relaxed italic uppercase">
                        I agree to the <a href="/terms" target="_blank" className="underline hover:text-white" onClick={e => e.stopPropagation()}>YardWorx Terms of Service</a> governing system usage, liability, and contractor behavior under my tenant.
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={formData.agreements.privacy}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            agreements: { ...prev.agreements, privacy: e.target.checked }
                          }))
                        }
                        className="w-5 h-5 accent-forest-500 rounded bg-white/5 border-white/20 cursor-pointer"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-white mb-1">
                        Privacy Policy
                      </p>
                      <p className="text-xs md:text-[10px] text-white/40 font-medium leading-relaxed italic uppercase">
                        I agree to the <a href="/privacy" target="_blank" className="underline hover:text-white" onClick={e => e.stopPropagation()}>YardWorx Privacy Policy</a> regarding the collection and routing of owner, contractor, and client data.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={formData.agreements.dataMap}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            agreements: { ...prev.agreements, dataMap: e.target.checked }
                          }))
                        }
                        className="w-5 h-5 accent-forest-500 rounded bg-white/5 border-white/20 cursor-pointer"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-white mb-1">
                        Data Processing Map
                      </p>
                      <p className="text-xs md:text-[10px] text-white/40 font-medium leading-relaxed italic uppercase">
                        I acknowledge the <a href="/data-map" target="_blank" className="underline hover:text-white" onClick={e => e.stopPropagation()}>Data Processing Map</a> detailing how Gaelworx AI isolates tenant records and orchestrates third-party API transmissions.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={formData.agreements.ai}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            agreements: { ...prev.agreements, ai: e.target.checked }
                          }))
                        }
                        className="w-5 h-5 accent-forest-500 rounded bg-white/5 border-white/20 cursor-pointer"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-white mb-1">
                        AI Usage & Ethics
                      </p>
                      <p className="text-xs md:text-[10px] text-white/40 font-medium leading-relaxed italic uppercase">
                        I accept the <a href="/ai-usage" target="_blank" className="underline hover:text-white" onClick={e => e.stopPropagation()}>YardWorx AI Usage Policy</a>, stipulating human-in-the-loop review mandates for all AI-generated outputs and communications.
                      </p>
                    </div>
                  </label>
                </div>
              </div>{" "}
            </motion.div>
          )}{" "}
        </AnimatePresence>{" "}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-500 font-bold text-sm tracking-wide text-center uppercase"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={handleNext}
          className="w-full mt-8 bg-white text-black rounded-[28px] py-6 font-black text-lg italic tracking-tight hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {step === 4 ? "Finish Setup" : "Next Step"}
          <ChevronRight
            size={24}
            className="group-hover:translate-x-1 transition-transform"
          />{" "}
        </button>{" "}
      </div>{" "}
    </main>
  );
}
