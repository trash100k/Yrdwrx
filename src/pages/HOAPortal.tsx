
import React, { useState } from "react";
import {
  Home,
  ShieldCheck,
  MapPin,
  FileText,
  Plus,
  CheckCircle,
  Zap,
  ShieldAlert,
  Users,
  Trash2,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, logSystemEvent } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { syncService } from "../services/syncService";

export default function HOAPortal() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [step, setStep] = useState<"onboarding" | "dashboard">("onboarding");
  const [formData, setFormData] = useState({
    associationName: "",
    pocName: "",
    pocEmail: "",
    geofenceRadius: 200,
    rules: [
      "No mowing before 9:00 AM",
      "Crew must wear identifying vests at all times",
      "All gates must be verified closed via photo",
      "Electric equipment only for interior common areas",
    ],
    territoryCoords: { lat: 32.3522, lng: -88.7041 },
  });

  const [newRule, setNewRule] = useState("");

  const addRule = () => {
    if (!newRule) return;
    setFormData((prev) => ({ ...prev, rules: [...prev.rules, newRule] }));
    setNewRule("");
  };

  const removeRule = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== idx),
    }));
  };

  const handleOnboard = async () => {
    const tenantId = tenant?.id || "genesis-1";
    try {
      if (navigator.onLine) {
        await addDoc(collection(db, "hoa_associations"), {
          ...formData,
          tenantId,
          createdAt: serverTimestamp(),
          status: "pending_verification",
        });
        await logSystemEvent("HOA_ONBOARDED", {
          associationName: formData.associationName,
          tenantId,
        });
      } else {
        await syncService.queueAction(
          "CREATE",
          "hoa_associations",
          {
            ...formData,
            createdAt: new Date().toISOString(),
            status: "pending_verification",
          },
          tenantId,
        );
        await logSystemEvent("HOA_ONBOARDED_OFFLINE", {
          associationName: formData.associationName,
          tenantId,
        });
      }
      setStep("dashboard");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-40 space-y-20">
      {step === "onboarding" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center min-h-[70vh]">
          <header className="space-y-10 relative z-10">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-purple-500 text-white rounded-full text-xs font-black uppercase tracking-widest border-2 border-purple-400/50 shadow-2xl">
              <ShieldCheck size={16} />
              Compliance Command
            </div>
            <h1 className="text-7xl lg:text-[7rem] font-black italic tracking-tighter leading-[0.85] text-white uppercase">
              Community <br /> Rules
            </h1>
            <p className="text-white/60 font-bold text-2xl leading-snug max-w-lg italic uppercase tracking-widest">
              Live Geofenced Enforcement
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-10">
              {[
                {
                  icon: Zap,
                  label: "Real-time Compliance",
                  sub: "Rules enforced by GPS",
                },
                {
                  icon: ShieldAlert,
                  label: "Resident Portal",
                  sub: "Live status for homeowners",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-zinc-900 border-4 border-white/10 p-8 rounded-[32px] hover:border-purple-500/50 hover:bg-zinc-800 transition-all group"
                >
                  <div className="w-16 h-16 bg-white rounded-2xl text-black flex items-center justify-center mb-6 shadow-2xl group-hover:scale-110 transition-transform">
                    <item.icon size={32} />
                  </div>
                  <p className="text-2xl font-black text-white italic tracking-tight uppercase leading-none mb-2">
                    {item.label}
                  </p>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-tight">
                    {item.sub}
                  </p>
                </div>
              ))}
            </div>
          </header>

          <section className="bg-zinc-900 rounded-[32px] p-12 lg:p-16 border-4 border-white/10 relative overflow-hidden group shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full -mr-40 -mt-40 blur-[120px] animate-pulse" />

            <div className="space-y-10 relative z-10">
              <div className="space-y-8">
                <div>
                  <label className="micro-label font-black uppercase text-white/20 tracking-[0.3em] block mb-4 italic">
                    Association Name
                  </label>
                  <div className="relative group">
                    <Home
                      className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-purple-400 transition-colors"
                      size={20}
                    />
                    <input
                      type="text"
                      aria-label="Community Name"
                      placeholder="e.g. Poplar Springs Estates"
                      className="w-full pl-16 pr-8 py-6 bg-white/5 border-4 border-white/10 rounded-[28px] text-lg font-black text-white italic focus:bg-white/10 focus:outline-none transition-all placeholder:text-white/5"
                      value={formData.associationName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          associationName: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="micro-label font-black uppercase text-white/20 tracking-[0.3em] block mb-4 italic">
                    Center Location (Lat/Lng Override)
                  </label>
                  <div className="relative group">
                    <MapPin
                      className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-purple-400 transition-colors"
                      size={20}
                    />
                    <input
                      type="text"
                      aria-label="Location coordinates"
                      placeholder="32.3522, -88.7041"
                      className="w-full pl-16 pr-8 py-6 bg-white/5 border-4 border-white/10 rounded-[28px] text-lg font-black text-white italic focus:bg-white/10 focus:outline-none transition-all placeholder:text-white/5 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="micro-label font-black uppercase text-white/20 tracking-[0.3em] block italic">
                    Community Rules
                  </label>
                  <div className="space-y-3">
                    {formData.rules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-5 bg-zinc-900 border-4 border-white/10 rounded-2xl group/rule hover:bg-white/10 transition-all"
                      >
                        <span className="text-sm font-black italic text-white/60 group-hover/rule:text-white transition-colors">
                          {rule}
                        </span>
                        <button
                          onClick={() => removeRule(idx)}
                          className="text-white/10 hover:text-red-400 opacity-0 group-hover/rule:opacity-100 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      aria-label="Add community rule"
                      placeholder="Add community rule..."
                      className="flex-1 px-8 py-4 bg-white/5 border-4 border-white/10 rounded-[24px] text-sm font-black italic text-white focus:outline-none focus:bg-white/10 transition-all placeholder:text-white/5"
                      value={newRule}
                      onChange={(e) => setNewRule(e.target.value)}
                    />
                    <button
                      onClick={addRule}
                      className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
                      aria-label="Add rule"
                    >
                      <Plus size={24} />
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleOnboard}
                className="w-full bg-white text-black py-8 rounded-[36px] font-black text-xs uppercase tracking-[0.4em] shadow-[0_40px_80px_rgba(255,255,255,0.1)] active:scale-95 transition-all flex items-center justify-center gap-4 mt-6"
              >
                Save Neighborhood
                <CheckCircle size={20} />
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-20">
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500 text-xs font-black uppercase tracking-widest text-emerald-500">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                Rules Enforcement Active
              </div>
              <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
                {formData.associationName}
              </h1>
              <p className="max-w-xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
                Active Community Geofence
              </p>
            </div>
            <div className="flex gap-4 sm:gap-6 relative z-10 w-full lg:w-auto shrink-0 overflow-x-auto pb-4 lg:pb-0">
              <div className="bg-black border-4 border-white/10 p-6 sm:p-8 rounded-[32px] text-center min-w-[160px] shadow-inner group/stat flex flex-col justify-center">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                  Active Crews
                </p>
                <p className="text-5xl font-black text-white italic tracking-tighter leading-none">
                  03
                </p>
              </div>
              <div className="bg-black border-4 border-emerald-500/50 p-6 sm:p-8 rounded-[32px] text-center min-w-[160px] shadow-inner group/stat flex flex-col justify-center">
                <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest mb-2">
                  Rule Followed
                </p>
                <p className="text-5xl font-black text-emerald-400 italic tracking-tighter leading-none shadow-glow">
                  100%
                </p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl rounded-[40px] p-16 h-full relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-16 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-[24px] text-black flex items-center justify-center shadow-2xl">
                      <Users size={32} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white italic tracking-tighter leading-none mb-1 lowercase">
                        Homeowner Notes.
                      </h2>
                      <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em]">
                        What neighbors are saying
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const csv =
                        "Unit,Message,Type\n" +
                        [
                          {
                            name: "Unit 42",
                            msg: "The edges look incredible today. Thank you!",
                            type: "Kudos",
                          },
                          {
                            name: "Unit 12",
                            msg: "Please remind crew about the south gate lock.",
                            type: "Suggestion",
                          },
                          {
                            name: "Unit 7",
                            msg: "Zero noise morning! Love the electric mowers.",
                            type: "Kudos",
                          },
                        ]
                          .map((i) => `${i.name},${i.msg},${i.type}`)
                          .join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.setAttribute("hidden", "");
                      a.setAttribute("href", url);
                      a.setAttribute(
                        "download",
                        `feedback_report_${formData.associationName}.csv`,
                      );
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="micro-label font-black uppercase text-blue-400 border-b border-blue-400/20 pb-1 hover:text-blue-300 transition-colors"
                  >
                    Export Report
                  </button>
                </div>

                <div className="space-y-4 relative z-10">
                  {[
                    {
                      name: "Unit 42",
                      msg: "The edges look incredible today. Thank you!",
                      type: "Kudos",
                    },
                    {
                      name: "Unit 12",
                      msg: "Please remind crew about the south gate lock.",
                      type: "Suggestion",
                    },
                    {
                      name: "Unit 7",
                      msg: "Zero noise morning! Love the electric mowers.",
                      type: "Kudos",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex gap-8 p-10 hover:bg-zinc-900 rounded-[32px] transition-all border border-transparent hover:border-white/10 group/item"
                    >
                      <div className="w-3 h-3 rounded-full bg-emerald-500 mt-3 shadow-glow animate-pulse" />
                      <div>
                        <p className="text-xl font-black text-white italic mb-2 leading-none">
                          {item.name}
                        </p>
                        <p className="text-lg text-white/40 font-bold italic leading-relaxed">
                          "{item.msg}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-12">
              <section className="border-4 border-white/10 shadow-2xl bg-black rounded-[40px] p-16 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600 rounded-full blur-[120px] opacity-10 -mr-40 -mt-40 animate-pulse" />
                <h3 className="micro-label font-black uppercase tracking-[0.4em] text-white/20 mb-10 flex items-center gap-4">
                  <ShieldCheck
                    size={20}
                    className="text-purple-400 shadow-glow"
                  />
                  Current Rules
                </h3>
                <div className="space-y-6">
                  {formData.rules.map((rule, i) => (
                    <div key={i} className="flex items-start gap-4 group/line">
                      <CheckCircle
                        size={20}
                        className="text-emerald-400 mt-1 shrink-0 group-hover:scale-110 transition-transform"
                      />
                      <span className="text-lg font-black italic text-white/60 group-hover:text-white transition-colors leading-tight">
                        {rule}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    showToast(
                      "Rule change request dispatched to HOA Board. Status: PENDING_APPROVAL",
                    )
                  }
                  className="w-full mt-14 py-6 bg-white/5 border-4 border-white/10 rounded-[28px] micro-label font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all text-white/40 hover:text-white italic"
                >
                  Request Rule Change
                </button>
              </section>

              <div className="bg-white text-black rounded-[40px] p-16 shadow-[0_40px_100px_rgba(255,255,255,0.1)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <h4 className="text-4xl font-black italic mb-4 tracking-tighter leading-none lowercase">
                  Safe Crew.
                </h4>
                <p className="text-black/40 font-bold text-lg mb-10 italic leading-relaxed">
                  Every crew member assigned to your neighborhood has a
                  background check.
                </p>
                <div className="flex -space-x-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-20 h-20 bg-black rounded-[28px] border-8 border-white flex items-center justify-center overflow-hidden relative shadow-2xl transition-transform hover:translate-y-[-10px] hover:z-20"
                    >
                      <img
                        src={`https://i.pravatar.cc/100?u=${i}`}
                        alt="user avatar"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                      />
                      <div
                        className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-white shadow-glow"
                        title="Verified"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
