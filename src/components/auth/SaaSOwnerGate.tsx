import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { auth } from '../../lib/firebase';

const SAAS_OWNER_EMAIL = "isaacsonzach13@gmail.com";

export function SaaSOwnerGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = auth.currentUser;

  // 1. Strict Email Verification
  // In production, this should ideally be backed by a Firebase Custom Claim (e.g. { saas_admin: true })
  // validated at the Express backend level. For this architecture, we enforce it aggressively here at the routing layer.
  if (!user || user.email !== SAAS_OWNER_EMAIL) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-black p-6">
        <div className="max-w-md w-full bg-zinc-950 border border-red-500/20 p-8 rounded-3xl text-center space-y-4">
           <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500 border border-red-500/20">
             <ShieldAlert size={32} />
           </div>
           <h2 className="text-xl font-black uppercase tracking-widest text-white">
             SaaS Admin Clearance Required
           </h2>
           <p className="text-sm text-white/50 leading-relaxed font-semibold">
             You are attempting to access a Level-0 Backend Infrastructure route. Your current identity ({user?.email || "Unauthenticated"}) does not hold Gaelworx SaaS Owner privileges.
           </p>
           <div className="pt-4">
             <button onClick={() => window.location.href = "/"} className="bg-white text-black text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:scale-105 active:scale-95 transition-all">
               Return to Tenant Space
             </button>
           </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
