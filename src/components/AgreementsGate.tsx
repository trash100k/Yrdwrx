import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Shield, Brain, Database, FileText } from "lucide-react";
import { safeStorage } from "../lib/storage";

export function AgreementsGate({ children }: { children: React.ReactNode }) {
  const [agreed, setAgreed] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [showGate, setShowGate] = useState(false);
  
  const [agreements, setAgreements] = useState({
    tos: false,
    privacy: false,
    dataMap: false,
    ai: false
  });
  
  const location = useLocation();
  const isPortal = location.pathname.startsWith('/portal/');
  // Need to extract the client ID if portal
  const clientId = isPortal ? location.pathname.split("/")[2] : null;

  useEffect(() => {
    async function checkAgreements() {
      // Allow public static pages
      if (['/terms', '/privacy', '/data-map', '/ai-usage'].includes(location.pathname)) {
        setAgreed(true);
        setLoading(false);
        return;
      }
      
      const user = auth.currentUser;
      
      if (user) {
         // Check user doc
         try {
           const userRef = doc(db, "users", user.uid);
           const snap = await getDoc(userRef);
           if (!snap.exists() || !snap.data().agreementsAccepted) {
              setAgreed(false);
              setShowGate(true);
           } else {
              setAgreed(true);
           }
           
           // DEBUG OVERRIDE for immediate viewing in Preview
           if (safeStorage.getItem("force_agreements_view") === "true") {
               setAgreed(false);
               setShowGate(true);
               safeStorage.removeItem("force_agreements_view");
           }
         } catch (err) {
            setAgreed(false);
            setShowGate(true);
         }
      } else if (isPortal && clientId) {
         // Check local storage for unauthenticated portal viewers
         const localKey = `cutty_agreed_${clientId}`;
         if (safeStorage.getItem(localKey) === 'true') {
            setAgreed(true);
         } else {
            setAgreed(false);
            setShowGate(true);
         }
      } else {
         // If no user and not portal, it will hit AuthPage anyway, but we'll say true to let it render AuthPage
         setAgreed(true);
      }
      setLoading(false);
    }
    
    // Slight delay to wait for auth state initialization if needed, or rely on auth state listener
    const unsub = auth.onAuthStateChanged((u) => {
        checkAgreements();
    });
    
    return () => unsub();
  }, [location.pathname, clientId, isPortal]);

  const handleAgree = async () => {
    if (!agreements.tos || !agreements.privacy || !agreements.dataMap /* || !agreements.ai */) return;
    
    const user = auth.currentUser;
    if (user) {
        try {
            await setDoc(doc(db, "users", user.uid), {
                agreementsAccepted: true,
                agreementsAcceptedAt: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.error("Failed to save agreement", err);
        }
    } else if (isPortal && clientId) {
        safeStorage.setItem(`cutty_agreed_${clientId}`, 'true');
    }
    
    setAgreed(true);
    setShowGate(false);
  };

  // Headless mode bypass
  if (true) return <>{children}</>;

  if (loading) return null;
  if (agreed && !showGate) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-zinc-950 z-[100] overflow-y-auto p-4 sm:p-6 pb-20">
      <div className="max-w-2xl mx-auto mt-4 sm:mt-12 bg-zinc-900 border border-white/10 p-6 sm:p-8 rounded-2xl shadow-2xl relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Shield size={200} />
        </div>
      
        <div className="relative z-10 block">
            <header className="mb-6">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="text-emerald-500" size={24} />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-normal md:tracking-tighter text-white">Required Agreements</h1>
                <p className="text-white/60 text-xs mt-2 leading-relaxed pb-4 border-b border-white/5">
                  To continue using YardWorx (operated by Gaelworx AI), you must review and accept our updated operational terms and data policies.
                </p>
            </header>

            <div className="space-y-3 mb-6">
              <label className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={agreements.tos}
                    onChange={(e) => setAgreements(prev => ({ ...prev, tos: e.target.checked }))}
                    className="w-5 h-5 accent-emerald-500 rounded bg-white/5 border-white/20 cursor-pointer"
                  />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white mb-1 flex items-center gap-2">
                    <FileText size={14} className="text-blue-400" /> Terms of Service
                  </p>
                  <p className="text-xs text-white/40 font-medium leading-relaxed italic">
                    I agree to the <a href="/terms" target="_blank" className="underline hover:text-white" onClick={(e) => e.stopPropagation()}>Terms of Service</a> governing liability, appropriate use, and system access constraints.
                  </p>
                </div>
              </label>
              
              <label className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={agreements.privacy}
                    onChange={(e) => setAgreements(prev => ({ ...prev, privacy: e.target.checked }))}
                    className="w-5 h-5 accent-emerald-500 rounded bg-white/5 border-white/20 cursor-pointer"
                  />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white mb-1 flex items-center gap-2">
                    <Shield size={14} className="text-emerald-400" /> Privacy Policy
                  </p>
                  <p className="text-xs text-white/40 font-medium leading-relaxed italic">
                    I agree to the <a href="/privacy" target="_blank" className="underline hover:text-white" onClick={(e) => e.stopPropagation()}>Privacy Policy</a> addressing the collection and use of personal and telemetry data.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={agreements.dataMap}
                    onChange={(e) => setAgreements(prev => ({ ...prev, dataMap: e.target.checked }))}
                    className="w-5 h-5 accent-emerald-500 rounded bg-white/5 border-white/20 cursor-pointer"
                  />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white mb-1 flex items-center gap-2">
                    <Database size={14} className="text-purple-400" /> Data Processing Map
                  </p>
                  <p className="text-xs text-white/40 font-medium leading-relaxed italic">
                    I acknowledge the <a href="/data-map" target="_blank" className="underline hover:text-white" onClick={(e) => e.stopPropagation()}>Data Processing Map</a> detailing the segregation of records within Gaelworx AI's architecture.
                  </p>
                </div>
              </label>

              {/* <label className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={agreements.ai}
                    onChange={(e) => setAgreements(prev => ({ ...prev, ai: e.target.checked }))}
                    className="w-5 h-5 accent-emerald-500 rounded bg-white/5 border-white/20 cursor-pointer"
                  />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white mb-1 flex items-center gap-2">
                    <Brain size={14} className="text-amber-400" /> AI Usage & Ethics Policy
                  </p>
                  <p className="text-xs text-white/40 font-medium leading-relaxed italic">
                     I accept the <a href="/ai-usage" target="_blank" className="underline hover:text-white" onClick={(e) => e.stopPropagation()}>AI Usage Policy</a> mandating human-in-the-loop verification for AI outputs and preventing malicious instructions.
                  </p>
                </div>
              </label> */}
            </div>

            <div className="shrink-0 mt-6 sticky bottom-0 bg-zinc-900 pt-4 border-t border-white/10 z-20 pb-4">
              <button
                disabled={!agreements.tos || !agreements.privacy || !agreements.dataMap /* || !agreements.ai */}
                onClick={handleAgree}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-xl font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                Accept All & Continue
               </button>
            </div>
        </div>
      </div>
    </div>
  );
}
