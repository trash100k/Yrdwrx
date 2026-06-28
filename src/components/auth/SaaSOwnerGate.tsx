// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { getCurrentProfile, clearProfileCache } from '../../lib/repos/profile';

const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === 'true';

export function SaaSOwnerGate({ children }: { children: React.ReactNode }) {
  // DEMO / INTERNAL TESTING BYPASS — when auth is not required, allow access so the
  // demo can reach the Level-0 SaaS admin surface unchanged.
  if (!REQUIRE_AUTH) {
    return <>{children}</>;
  }

  // Authorization is backed by the platform-admin flag on the user's profile,
  // which is set server-side via the Supabase service role (not a client email literal).
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      setStatus('loading');
      if (!auth.currentUser) {
        if (active) {
          setEmail(null);
          setStatus('denied');
        }
        return;
      }
      const profile = await getCurrentProfile();
      if (active) {
        setEmail(auth.currentUser?.email ?? null);
        setStatus(profile?.is_platform_admin ? 'allowed' : 'denied');
      }
    };

    const unsubscribe = onAuthStateChanged(auth, () => {
      clearProfileCache();
      resolve();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-black p-6">
        <Loader2 className="animate-spin text-forest-500" size={48} />
      </div>
    );
  }

  if (status === 'denied') {
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
             You are attempting to access a Level-0 Backend Infrastructure route. Your current identity ({email || "Unauthenticated"}) does not hold Gaelworx SaaS Owner privileges.
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
