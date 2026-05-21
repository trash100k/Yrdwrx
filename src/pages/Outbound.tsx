
import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  getDocs,
  where,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  logSystemEvent,
  OperationType,
} from "../lib/firebase";
import {
  Rocket,
  Target,
  Zap,
  Mail,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Database,
  Users,
  MapPin,
  Loader2,
  Send,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";
import { Customer } from "../types";

export default function Outbound() {
  const { tenant } = useTenant();
  const [enrichmentQueue, setEnrichmentQueue] = useState<Customer[]>([]);
  const [isEnriching, setIsEnriching] = useState<string | null>(null);
  const [enrichedData, setEnrichedData] = useState<Record<string, any>>({});
  const [activeCampaign, setActiveCampaign] = useState<string | null>(null);
  const [campaignCopy, setCampaignCopy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const tenantId = tenant?.id || "genesis-1";
    const q = query(
      collection(db, "customers"),
      where("tenantId", "==", tenantId),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setEnrichmentQueue(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "customers");
      },
    );
    return () => unsubscribe();
  }, [tenant]);

  const enrichCustomer = async (customer: Customer) => {
    setIsEnriching(customer.id);
    const tenantId = tenant?.id || "genesis-1";
    try {
      const res = await fetch("/api/crm/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer }),
      });
      const data = await res.json();
      setEnrichedData((prev) => ({ ...prev, [customer.id]: data }));
      await logSystemEvent("CUSTOMER_ENRICHED", {
        customerId: customer.id,
        upsellProbability: data.upsellProbability,
        tenantId,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `crm/enrich/${customer.id}`);
    } finally {
      setIsEnriching(null);
    }
  };

  const generateCampaign = async (segment: string) => {
    setIsGenerating(true);
    setActiveCampaign(segment);
    try {
      const res = await fetch("/api/outbound/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment,
          targetService:
            segment === "High Promise"
              ? "Irrigation Overhaul"
              : "Seasonal Mulching",
        }),
      });
      const data = await res.json();
      setCampaignCopy(data.text);
      await logSystemEvent("CAMPAIGN_GENERATED", { segment });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.GET,
        "outbound/campaign-generation",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500 text-xs font-black uppercase tracking-widest text-emerald-500">
            <Rocket size={16} />
            Conversion Engine
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Growth Hub
          </h1>
          <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2">
            Data Enrichment & Precision Outbound
          </p>
        </div>

        <div className="flex bg-black p-4 rounded-[32px] border-4 border-white/10 shrink-0 shadow-inner">
          <div className="flex items-center gap-10 px-8 py-2">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 italic">
                Neural Credits
              </span>
              <span className="text-4xl font-black italic tracking-tighter text-emerald-400">
                999+
              </span>
            </div>
            <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center border-4 border-black text-black">
              <Database size={28} />
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: Enrichment List */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between mb-2 px-6">
            <h3 className="micro-label font-black text-white/20 uppercase tracking-[0.3em] italic">
              Cognitive Queue
            </h3>
            <span className="micro-label font-black text-emerald-400/40 italic uppercase tracking-[0.2em]">
              Sovereign Sync Active
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {enrichmentQueue.slice(0, 8).map((customer) => (
              <div
                key={customer.id}
                className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-8 group hover:border-blue-500/50 transition-all duration-700 flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center gap-6 relative z-10">
                  <div className="w-16 h-16 bg-zinc-900 rounded-[24px] flex items-center justify-center font-black text-white/20 border-4 border-white/10 group-hover:bg-white group-hover:text-black transition-all duration-700 text-xl">
                    {customer.firstName?.[0]}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white italic tracking-tight uppercase leading-none mb-2">
                      {customer.firstName} {customer.lastName}
                    </h4>
                    <div className="flex items-center gap-3">
                      <MapPin size={12} className="text-white/20 shadow-glow" />
                      <span className="micro-label font-black text-white/20 uppercase tracking-widest italic">
                        Meridian Vector
                      </span>
                    </div>
                  </div>
                </div>

                {enrichedData[customer.id] ? (
                  <div className="flex items-center gap-8 bg-zinc-900 px-8 py-5 rounded-[24px] border-4 border-white/10 relative z-10 group-hover:bg-zinc-900 transition-all">
                    <div className="text-center">
                      <p className="micro-label font-black text-emerald-400/40 uppercase tracking-[0.2em] mb-2">
                        Alpha Val
                      </p>
                      <p className="text-lg font-black text-white italic tracking-tighter">
                        $
                        {(
                          enrichedData[customer.id].estimatedPropertyValue /
                          1000
                        ).toFixed(0)}
                        k
                      </p>
                    </div>
                    <div className="text-center border-l border-white/10 pl-8">
                      <p className="micro-label font-black text-emerald-400/40 uppercase tracking-[0.2em] mb-2">
                        Matrix
                      </p>
                      <p className="text-lg font-black text-white italic tracking-tighter">
                        {enrichedData[customer.id].soilComposition}
                      </p>
                    </div>
                    <div className="text-center border-l border-white/10 pl-8">
                      <p className="micro-label font-black text-emerald-400/40 uppercase tracking-[0.2em] mb-2">
                        Probability
                      </p>
                      <p className="text-lg font-black text-white italic tracking-tighter shadow-glow text-emerald-400">
                        {enrichedData[customer.id].upsellProbability}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => enrichCustomer(customer)}
                    disabled={isEnriching === customer.id}
                    className="bg-white text-black px-10 py-4 rounded-[20px] micro-label font-black uppercase tracking-[0.3em] flex items-center gap-4 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-[0_15px_30px_rgba(255,255,255,0.1)] relative z-10"
                  >
                    {isEnriching === customer.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Zap size={18} />
                    )}
                    Synthesize Entity
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Outbound Strategy */}
        <aside className="space-y-10">
          <section className="border-4 border-white/10 shadow-2xl bg-black rounded-[32px] p-10 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -mr-32 -mt-32 group-hover:bg-emerald-500/10 transition-colors" />
            <div className="relative z-10 flex items-center gap-4 mb-10">
              <Rocket size={24} className="text-emerald-400 shadow-glow" />
              <h3 className="text-xl font-black italic tracking-tight uppercase">
                Segment AI
              </h3>
            </div>
            <div className="space-y-4 relative z-10">
              {["High Promise", "Churn Risk", "New Movers"].map((segment) => (
                <button
                  key={segment}
                  onClick={() => generateCampaign(segment)}
                  className={`w-full p-6 rounded-[32px] border transition-all duration-700 flex items-center justify-between group/seg ${
                    activeCampaign === segment
                      ? "bg-white text-black border-white shadow-2xl scale-105"
                      : "bg-zinc-900 border-white/10 hover:bg-zinc-900"
                  }`}
                >
                  <span className="text-left flex flex-col items-start block">
                    <span
                      className={`micro-label font-black uppercase tracking-[0.2em] mb-1 italic ${activeCampaign === segment ? "text-black/40" : "text-white/20"}`}
                    >
                      Vector
                    </span>
                    <span className="text-lg font-black italic tracking-tighter uppercase">
                      {segment}
                    </span>
                  </span>
                  <ChevronRight
                    size={24}
                    className={`group-hover/seg:translate-x-2 transition-transform ${activeCampaign === segment ? "text-black" : "text-white/10"}`}
                  />
                </button>
              ))}
            </div>
          </section>

          <AnimatePresence>
            {campaignCopy && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 border-4 border-white/10 shadow-2xl rounded-[32px] p-10 space-y-8 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-blue-500/5 blur-3xl pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="micro-label font-black text-white/20 uppercase tracking-[0.3em] italic">
                    Generated Logic
                  </h3>
                  <Sparkles size={20} className="text-blue-400 shadow-glow" />
                </div>
                <div className="max-h-[350px] overflow-y-auto text-sm text-white/60 leading-relaxed italic whitespace-pre-wrap pr-4 custom-scrollbar relative z-10 font-bold border-l-2 border-white/10 pl-6">
                  {campaignCopy}
                </div>
                <button className="w-full bg-white text-black py-5 rounded-[24px] micro-label font-black uppercase tracking-[0.4em] flex items-center justify-center gap-4 shadow-2xl hover:bg-emerald-400 transition-all relative z-10 group/send">
                  <Send
                    size={18}
                    className="group-hover/send:-translate-y-1 group-hover/send:translate-x-1 transition-transform"
                  />{" "}
                  Deploy Manifest
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 rounded-[32px] flex items-start gap-6">
            <TrendingUp
              size={32}
              className="text-emerald-400 shadow-glow shrink-0 mt-1"
            />
            <div>
              <h4 className="text-lg font-black text-white italic tracking-tight uppercase mb-2 leading-none">
                Growth Vector
              </h4>
              <p className="micro-label font-black text-white/20 leading-relaxed uppercase tracking-widest italic">
                Loamy soil property targets in Meridian indicate an{" "}
                <span className="text-emerald-400">18% delta</span> in
                probability.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
