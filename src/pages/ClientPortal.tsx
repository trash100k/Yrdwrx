// @ts-nocheck
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, collection, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { safeAddDoc as addDoc } from "../lib/firebase";;
import { auth, db } from "../lib/firebase";
import { ApiClient } from "../lib/apiClient";
import { MapPin, Calendar, CreditCard, Droplet, Leaf, CheckCircle2, Lock, Send, AlertCircle, Globe } from "lucide-react";
import { useTenant } from "../contexts/TenantContext";

export default function ClientPortal() {
  
  
  const { clientId } = useParams();
  const { tenant } = useTenant();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Check if the current user is an admin or if the portal is accessed cleanly via Magic Link
    const sessionAuthId = sessionStorage.getItem("authenticatedClientId");
    if (clientId && sessionAuthId === clientId) {
      setIsAuthorized(true);
      return;
    }
    
    // Listen for auth state if not magic linked
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsAuthorized(true);
      } else {
        if (!isAuthorized) {
           setIsAuthorized(false);
           setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [clientId]);



  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadPortal() {
      const activeClientId = clientId || auth.currentUser?.uid;
      if (!activeClientId) {
          setLoading(false);
          return;
      }
      try {
        const clientRef = doc(db, "customers", activeClientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
          setClient({ id: clientSnap.id, ...clientSnap.data() });
        }
      } catch (err) {
        console.error("Error loading portal", err);
      } finally {
        setLoading(false);
      }
    }
    loadPortal();
  }, [clientId]);

  useEffect(() => {
    const activeClientId = clientId || auth.currentUser?.uid;
    if (!activeClientId) return;

    const q = query(
      collection(db, "customers", activeClientId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [clientId]);

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handlePayment = async () => {
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const res = await ApiClient.post<any>("/api/stripe/checkout", { 
        amount: 145, 
        description: "Cutty Landscapes Invoice: INV-2026-104", 
        successUrl: window.location.href, 
        cancelUrl: window.location.href,
        tenantStripeAccountId: tenant?.stripeAccountId
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setPaymentError(err.message || "Payment declined or failed. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDepositPayment = async () => {
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const res = await ApiClient.post<any>("/api/stripe/checkout", { 
        amount: 250, 
        description: "Blueprint Unlock Deposit", 
        successUrl: window.location.href, 
        cancelUrl: window.location.href,
        tenantStripeAccountId: tenant?.stripeAccountId
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setPaymentError(err.message || "Payment declined or failed. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const activeClientId = clientId || auth.currentUser?.uid;
    if (!activeClientId) return;

    try {
      await addDoc(collection(db, "customers", activeClientId, "messages"), {
        text: messageText,
        sender: "client",
        createdAt: serverTimestamp()
      });
      setMessageText("");
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  
  if (!isAuthorized && !loading) {
     return (
       <div className="min-h-[100dvh] bg-zinc-950 font-sans text-white p-4 sm:p-8 flex items-center justify-center">
          <div className="max-w-md w-full bg-zinc-900 border border-white/5 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
             <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
                <Lock size={32} />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">Secure Portal Locked</h2>
             <p className="text-zinc-400 text-sm mb-6">You need a secure Magic Link to access this client workspace. Check your email or request a new one.</p>
          </div>
       </div>
     );
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black">
        <div className="text-white/40 animate-pulse font-sans text-sm font-black uppercase tracking-[0.3em]">
          Loading Your Portal...
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black uppercase mb-4 text-rose-500">Link Expired or Invalid</h1>
          <p className="text-white/50">Please contact your landscape provider for a new access link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 font-sans text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl sm:text-4xl font-black uppercase tracking-normal md:tracking-tighter italic">
                Your Property
              </h1>
              {tenant?.settings?.features?.aiOmnilingual && (
                  <div className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[9px] uppercase tracking-widest font-black flex items-center gap-1.5 self-start mt-1">
                     <Globe size={10} /> Auto-Translated (AI)
                  </div>
              )}
            </div>
            <p className="text-emerald-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <MapPin size={16} /> {client.address || "Service Location"}
            </p>
          </div>
          <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-4 sm:text-right">
            <p className="text-xs md:text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Serviced By</p>
            <p className="font-bold text-lg leading-none">Cutty Landscapes</p>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex bg-black p-2 border border-white/5 rounded-3xl mb-8 overflow-x-auto">
          {["overview", "jobs", "invoices", "design", "messages"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 px-6 rounded-2xl font-black text-xs md:text-[11px] uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "bg-white text-black shadow-lg"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <main>
          {activeTab === "overview" && (
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-8">
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-5 sm:p-8 opacity-10">
                  <Leaf size={120} />
                </div>
                <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-6">Property Profile</h2>
                <div className="space-y-6 relative z-10">
                  <div>
                    <p className="text-xs md:text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Owner</p>
                    <p className="font-medium text-lg">{client.name}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Contact Details</p>
                    <p className="font-medium">{client.email || "No email on file"}</p>
                    <p className="font-medium">{client.phone || "No phone on file"}</p>
                  </div>
                  {client.notes && (
                    <div>
                      <p className="text-xs md:text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-2">Gate Code / Instructions</p>
                      <div className="bg-black/50 p-4 rounded-2xl border-2 border-emerald-500/20 text-sm">
                        {client.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl">
                  <h2 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Droplet size={16} /> Upcoming Service
                  </h2>
                  <div className="bg-black/40 rounded-2xl p-6 border-2 border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-black italic tracking-tight text-xl">Lawn & Edge</p>
                      <span className="bg-blue-500/20 text-blue-400 text-xs md:text-[10px] uppercase font-black px-3 py-1 rounded-full">Next Week</span>
                    </div>
                    <p className="text-white/60 text-sm mb-4">Standard bi-weekly maintenance and debris removal.</p>
                  </div>
                </div>

                <div className="bg-emerald-900/20 border-4 border-emerald-500/20 rounded-2xl p-5 sm:p-8">
                  <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">Quick Action</h2>
                  <p className="text-white/60 text-sm mb-6">Need an extra service or have a special request for the crew?</p>
                  <button className="w-full bg-emerald-500 text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:bg-emerald-400 transition-colors">
                    Request Additional Service
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "jobs" && (
            <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl">
              <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-8">Service History</h2>
              
              <div className="space-y-4">
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/40 p-6 rounded-2xl border-2 border-white/5 gap-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-emerald-500/20 p-3 rounded-full text-emerald-400 shrink-0">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <p className="font-black uppercase tracking-widest text-sm mb-1">Standard Maintenance</p>
                        <p className="text-white/50 text-xs">Mow, trim, edge, and blow debris. Checked irrigation heads.</p>
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <p className="text-xs md:text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Completed On</p>
                      <p className="font-medium text-sm text-emerald-400 flex items-center justify-end gap-2"><Calendar size={14} /> Oct {15 - i * 7}, 2026</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl">
              <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-8">Billing & Invoices</h2>
              
              <div className="bg-rose-500/10 border-2 border-rose-500/20 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-rose-400 font-black uppercase tracking-widest text-xs mb-1">Outstanding Balance</h3>
                  <p className="text-2xl sm:text-3xl sm:text-4xl font-black italic tracking-normal md:tracking-tighter text-white">$145.00</p>
                </div>
                <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                  {paymentError && (
                    <div className="bg-rose-500/20 text-rose-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2 max-w-sm">
                       <AlertCircle size={14} />
                       {paymentError}
                    </div>
                  )}
                  <button 
                    onClick={handlePayment}
                    disabled={paymentLoading}
                    className="w-full md:w-auto bg-white text-black font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <CreditCard size={16} /> {paymentLoading ? "Processing..." : paymentError ? "Retry Payment" : "Pay Securely Now"}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between bg-black/40 p-4 sm:p-6 rounded-2xl border-2 border-white/5">
                  <div>
                    <h4 className="font-bold text-sm">October Maintenance</h4>
                    <p className="text-white/50 text-xs">INV-2026-104</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">$145.00</p>
                    <p className="text-rose-400 text-xs md:text-[10px] font-black uppercase tracking-widest">Unpaid</p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-4 sm:p-6 rounded-2xl border-2 border-white/5 opacity-50 grayscale">
                  <div>
                    <h4 className="font-bold text-sm">September Maintenance</h4>
                    <p className="text-white/50 text-xs">INV-2026-092</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">$145.00</p>
                    <p className="text-emerald-400 text-xs md:text-[10px] font-black uppercase tracking-widest">Paid</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "design" && (
            <div className="space-y-8">
              {/* Studio Header */}
              <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">Visualizer</h2>
                    <h3 className="text-xl sm:text-2xl font-black italic tracking-tight text-white">Capture Your Vision</h3>
                  </div>
                  <button className="bg-emerald-500 text-black py-3 px-6 rounded-xl font-black uppercase tracking-widest text-xs md:text-[10px] hover:scale-[1.02] transition-transform shadow-xl flex items-center gap-2">
                    <Leaf size={14} /> Start New Design
                  </button>
                </div>
              </div>

              {/* Generated Proposal Example with Blueprint Guard */}
              <div className="bg-zinc-900 border-4 border-emerald-500/10 rounded-2xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
                {/* Branding Watermark */}
                <div className="absolute -top-10 -right-10 text-[120px] font-black italic text-white/[0.02] uppercase select-none pointer-events-none">
                  CUTTY
                </div>

                <div className="flex flex-col xl:flex-row gap-4 sm:gap-8 relative z-10">
                  {/* Left: The Visual / Vibe */}
                  <div className="flex-1 space-y-6">
                    <div>
                      <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-widest text-xs md:text-[10px] rounded-lg mb-4">
                        AI Generated Proposal
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white mb-2">Modern Xeriscape Front Yard</h3>
                      <p className="text-white/60 text-sm leading-relaxed">
                        Based on your uploaded photo, our AI designer has proposed a drought-resistant layout featuring native perennial grasses, crushed granite pathways, and strategic low-voltage accent lighting. 
                      </p>
                    </div>
                    
                    {/* Mock Image Placeholder */}
                    <div className="w-full h-64 bg-black/40 rounded-3xl border-4 border-white/5 flex items-center justify-center relative overflow-hidden group">
                      {/* Generative Mockup Visualization */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-blue-500/10 mix-blend-overlay" />
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
                      <p className="text-white/20 font-black uppercase tracking-[0.2em] text-sm relative z-10 select-none">Watermarked AI Rendering</p>
                    </div>
                  </div>

                  {/* Right: The Blueprint Guard */}
                  <div className="flex-1 bg-black/40 rounded-[24px] border border-white/5 p-6 relative">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="font-black text-white text-lg tracking-tight">Project Estimate</h4>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Accuracy: ±5%</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-black text-emerald-400">$4,250</span>
                        <p className="text-white/40 text-xs md:text-[10px] font-bold uppercase tracking-widest">Turnkey Price</p>
                      </div>
                    </div>

                    <div className="space-y-4 relative">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-white/50 border-b border-white/10 pb-2">Material Blueprint</h5>
                      
                      {/* Blurred Items List */}
                      <div className={`space-y-3 select-none ${tenant?.settings?.subFeatures?.requireBlueprintDeposit ? "blur-sm opacity-50" : "opacity-100"}`}>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white">35x Native Ornamental Grasses</span>
                          <span className="text-white/50">$450</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white">4 Tons Crushed Decomposed Granite</span>
                          <span className="text-white/50">$850</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white">12x Brass Low-Voltage Path Lights</span>
                          <span className="text-white/50">$1,200</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white">Labor & Installation (3 Days)</span>
                          <span className="text-white/50">$1,750</span>
                        </div>
                      </div>

                      {/* Obfuscation Overlay */}
                      {tenant?.settings?.subFeatures?.requireBlueprintDeposit && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/40 backdrop-blur-[2px] rounded-xl border border-white/5 z-20">
                          <div className="text-center p-4">
                            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 text-white">
                              <Lock size={20} />
                            </div>
                            <p className="text-xs md:text-[11px] font-bold uppercase tracking-widest text-white/80 max-w-[200px] break-words">
                              Detailed material species & measurements hidden
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Deposit Action */}
                    {tenant?.settings?.subFeatures?.requireBlueprintDeposit && (
                      <div className="mt-8 flex flex-col items-center">
                        {paymentError && (
                          <div className="bg-rose-500/20 text-rose-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2 mb-2 w-full justify-center">
                            <AlertCircle size={14} />
                            {paymentError}
                          </div>
                        )}
                        <button 
                          onClick={handleDepositPayment} 
                          disabled={paymentLoading}
                          className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-xs md:text-[11px] rounded-xl hover:scale-[1.02] transition-transform shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CreditCard size={14} /> {paymentLoading ? "Processing..." : paymentError ? "Retry Deposit" : "Pay $250 Deposit to Unlock Blueprint"}
                        </button>
                        <p className="text-center text-xs md:text-[10px] font-bold uppercase tracking-widest text-white/40 mt-4">
                          100% applied to project cost
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "messages" && (
            <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-5 sm:p-8 shadow-2xl flex flex-col h-[500px]">
              <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Team Communications & Notifications</h2>
              
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-4 self-start max-w-[85%]">
                    <p className="text-xs md:text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-2">Automated Notification</p>
                    <p className="text-sm">Cutty crew has finished their weekly maintenance. Check your overview tab for details!</p>
                 </div>
                 <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 self-start max-w-[85%]">
                    <p className="text-xs md:text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-2">Cutty Dispatch</p>
                    <p className="text-sm">Hi there! We are pushing your mow back by one day due to the forecasted rain tomorrow.</p>
                 </div>
                 
                 {messages.map((m) => (
                    <div 
                      key={m.id} 
                      className={`rounded-2xl p-4 max-w-[85%] ${m.sender === 'client' ? 'bg-blue-500/10 border border-blue-500/20 self-end ml-auto' : 'bg-emerald-500/10 border border-emerald-500/20 self-start'}`}
                    >
                      <p className={`text-xs md:text-[10px] font-bold uppercase tracking-widest mb-2 ${m.sender === 'client' ? 'text-blue-400' : 'text-emerald-400'}`}>
                        {m.sender === 'client' ? 'You' : 'Cutty Dispatch'}
                      </p>
                      <p className="text-sm">{m.text}</p>
                    </div>
                 ))}
                 <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="relative mt-auto pt-4 border-t border-white/10 flex gap-2">
                <label htmlFor="portal-message-input" className="sr-only">Message Cutty Dispatch</label>
                <input 
                  id="portal-message-input"
                  type="text" 
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Reply to Cutty team..." 
                  aria-label="Reply to Cutty team"
                  className="w-full bg-black/50 border-2 border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors" 
                />
                <button 
                  type="submit" 
                  disabled={!messageText.trim()} 
                  aria-label="Send Message"
                  className="px-6 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black rounded-xl font-black uppercase tracking-widest transition-colors flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
