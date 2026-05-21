
import { useState } from "react";
import { setDoc, doc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
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
export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    companyName: "",
    ownerName: "",
    ownerPhone: "",
    serviceArea: "",
    services: [] as string[],
    telemetryAgreed: false,
  });
  const availableServices = [
    "Lawn Mowing",
    "Irrigation Repair",
    "Landscape Design",
    "Hardscaping",
    "Seasonal Cleanup",
    "Pest Control",
    "Fertilization",
  ];
  const handleNext = async () => {
    if (step === 4 && !formData.telemetryAgreed) return;
    if (step < 4) {
      setStep(step + 1);
    } else {
      /* Save to Firebase */ if (auth.currentUser) {
        await setDoc(doc(db, "settings", auth.currentUser.uid), {
          ...formData,
          onboardingComplete: true,
          updatedAt: new Date().toISOString(),
        });
        
        try {
          const { seedDatabaseIfEmpty } = await import("../lib/seedDatabase");
          await seedDatabaseIfEmpty();
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
    <main className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
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
                {" "}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full micro-label text-emerald-400">
                  {" "}
                  <Building2 size={12} /> Business Profile{" "}
                </div>{" "}
                <h1 className="text-5xl font-bold tracking-tight leading-none sf-text-gradient">
                  Company <br /> Details.
                </h1>{" "}
                <p className="text-white/40 font-medium text-lg leading-relaxed">
                  Let's get your landscaping business set up in Cutty.
                </p>{" "}
              </header>{" "}
              <div className="space-y-6">
                {" "}
                <div className="relative group">
                  {" "}
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors">
                    {" "}
                    <Building2 size={24} />{" "}
                  </div>{" "}
                  <input
                    type="text"
                    aria-label="Business Name"
                    placeholder="Business Name"
                    className="w-full bg-white/5 border border-white/5 rounded-3xl py-6 pl-16 pr-8 focus:bg-white/10 focus:border-white/20 focus:outline-none placeholder:text-white/20 transition-all font-bold text-lg"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                  />{" "}
                </div>{" "}
                <div className="relative group">
                  {" "}
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors">
                    {" "}
                    <Phone size={24} />{" "}
                  </div>{" "}
                  <input
                    type="tel"
                    aria-label="Contact Frequency or Phone"
                    placeholder="Contact Frequency"
                    className="w-full bg-white/5 border border-white/5 rounded-3xl py-6 pl-16 pr-8 focus:bg-white/10 focus:border-white/20 focus:outline-none placeholder:text-white/20 transition-all font-bold text-lg"
                    value={formData.ownerPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, ownerPhone: e.target.value })
                    }
                  />{" "}
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
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full micro-label text-blue-400">
                  {" "}
                  <MapPin size={12} /> Service Areas{" "}
                </div>{" "}
                <h1 className="text-5xl font-black italic tracking-tighter leading-none sf-text-gradient">
                  Local <br /> Focus.
                </h1>{" "}
                <p className="text-white/40 font-medium text-lg leading-relaxed">
                  Which neighborhoods do you currently cover?
                </p>{" "}
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
                    placeholder="e.g. North Hills, Poplar Springs"
                    className="w-full bg-white/5 border border-white/5 rounded-3xl py-6 pl-16 pr-8 focus:bg-white/10 focus:border-white/20 focus:outline-none placeholder:text-white/20 transition-all font-bold text-lg"
                    value={formData.serviceArea}
                    onChange={(e) =>
                      setFormData({ ...formData, serviceArea: e.target.value })
                    }
                  />{" "}
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
                <h1 className="text-5xl font-black italic tracking-tighter leading-none sf-text-gradient">
                  What You <br /> Offer.
                </h1>{" "}
                <p className="text-white/40 font-medium text-lg leading-relaxed">
                  Select the primary services your teams provide.
                </p>{" "}
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
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full micro-label text-emerald-400">
                  {" "}
                  <Sparkles size={12} /> All Set{" "}
                </div>{" "}
                <h1 className="text-5xl font-black italic tracking-tighter leading-none sf-text-gradient">
                  Ready to <br /> Grow.
                </h1>{" "}
                <p className="text-white/40 font-medium text-lg leading-relaxed">
                  Your account is ready. Cutty is now active and ready for your
                  first job.
                </p>{" "}
              </header>{" "}
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-6 bg-white/5 border border-white/5 rounded-3xl group">
                  <Zap size={24} className="text-emerald-400 mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-white mb-1">
                      Cutty Help Active
                    </p>
                    <p className="text-[11px] text-white/40 font-medium leading-relaxed italic uppercase">
                      Ask for client details or site info anytime.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-6 bg-white/5 border border-white/5 rounded-3xl group">
                  <Zap size={24} className="text-amber-400 mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-white mb-1">
                      Field Mode Ready
                    </p>
                    <p className="text-[11px] text-white/40 font-medium leading-relaxed italic uppercase">
                      Switch to field mode when you're out on the job.
                    </p>
                  </div>
                </div>
                <label className="flex items-start gap-4 p-6 bg-white/5 border border-white/10 rounded-3xl cursor-pointer hover:bg-white/10 transition-colors">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={formData.telemetryAgreed}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          telemetryAgreed: e.target.checked,
                        }))
                      }
                      className="w-5 h-5 accent-emerald-500 rounded bg-white/5 border-white/20 cursor-pointer"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-white mb-1">
                      System & Telemetry Agreement
                    </p>
                    <p className="text-[10px] text-white/40 font-medium leading-relaxed italic uppercase">
                      I agree to the Cutty standard terms of service. Cutty
                      securely processes operational metrics, anonymized
                      aggregate reporting, and routing telemetry to improve
                      algorithms and platform performance.
                    </p>
                  </div>
                </label>
              </div>{" "}
            </motion.div>
          )}{" "}
        </AnimatePresence>{" "}
        <button
          onClick={handleNext}
          disabled={step === 4 && !formData.telemetryAgreed}
          className="w-full mt-16 bg-white text-black rounded-[28px] py-6 font-black text-lg italic tracking-tight hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
