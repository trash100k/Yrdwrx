import { safeStorage } from "../lib/storage";
import { fetchApi } from "../lib/api";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Shield, Loader2, AlertTriangle, ArrowRight } from "lucide-react";

export default function MagicLinkAuth() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetchApi("/api/auth/magic-link/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        
        if (data.valid) {
          // Store token/clientId in session so the portal knows who they are
          safeStorage.setItem("customerAuthToken", token as string);
          safeStorage.setItem("authenticatedClientId", data.clientId);
          
          setStatus("success");
          setTimeout(() => {
             navigate(`/portal/${data.clientId}`);
          }, 1500);
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Invalid token");
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMsg("Network error validating magic link.");
      }
    };
    
    if (token) validateToken();
  }, [token, navigate]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-950 p-6 relative overflow-hidden font-sans">
       <div className="max-w-md w-full bg-zinc-900 border border-white/5 molten-edge rounded-2xl p-8 relative z-10 shadow-2xl text-center">
            
          {status === 'loading' && (
             <div className="animate-in fade-in duration-500">
               <div className="w-16 h-16 bg-celtic-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-celtic-400">
                  <Loader2 className="animate-spin" size={32} />
               </div>
               <h2 className="text-2xl font-bold text-white mb-2">Authenticating</h2>
               <p className="text-zinc-400 text-sm">Validating your secure portal link...</p>
             </div>
          )}

          {status === 'success' && (
             <div className="animate-in fade-in duration-500 zoom-in-95">
               <div className="w-16 h-16 bg-forest-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-forest-400">
                  <Shield size={32} />
               </div>
               <h2 className="text-2xl font-bold text-white mb-2">Secure Connection Established</h2>
               <p className="text-zinc-400 text-sm mb-6">Redirecting to your isolated workspace ecosystem...</p>
               <div className="flex justify-center">
                 <Loader2 className="animate-spin text-forest-500" size={20} />
               </div>
             </div>
          )}

          {status === 'error' && (
             <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">
               <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
                  <AlertTriangle size={32} />
               </div>
               <h2 className="text-2xl font-bold text-white mb-2">Expired or Invalid Link</h2>
               <p className="text-zinc-400 text-sm mb-8">{errorMsg}</p>
               <button 
                 onClick={() => navigate('/')}
                 className="flex items-center justify-center gap-2 w-full py-4 bg-white text-black font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-zinc-200 transition-colors">
                  Return Flow <ArrowRight size={16} />
               </button>
             </div>
          )}

       </div>
    </div>
  );
}
