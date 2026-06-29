import { fetchApi } from "../lib/api";
import React, { useState } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { CreditCard, CheckCircle, ExternalLink } from 'lucide-react';
import { tenantsRepo } from '../lib/repos';
import { useToast } from '../contexts/ToastContext';

export function StripeConnectSection() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const isConnected = !!tenant?.stripeAccountId;

  const handleConnect = async () => {
    if (!tenant) return;
    setIsConnecting(true);
    
    try {
      // Create a Stripe Connect onboarding link
      const res = await fetchApi('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to generate connect link.");
      }
    } catch (err) {
      // Surface the real failure and stay disconnected — never fabricate a fake
      // acct_demo_ account, which made the UI claim a working Stripe connection.
      console.error(err);
      const message = err instanceof Error ? err.message : "Could not start Stripe Connect onboarding.";
      showToast(message, "error");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!tenant) return;
    try {
       await tenantsRepo.updateFields({ stripe_account_id: null });
       showToast("Stripe Account Disconnected.");
    } catch (err) {
      console.error(err);
      showToast("Failed to disconnect.");
    }
  };

  return (
    <section className="mt-12 pt-12 border-t border-white/10">
      <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 mb-6 text-white">
        <CreditCard className="text-forest-500" /> Billing & Payments
      </h2>
      
      <div className="bg-zinc-950 border border-white/5 molten-edge rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
        {isConnected && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-forest-500/10 blur-[50px] pointer-events-none" />
        )}
        <div className="flex-1 relative z-10">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-lg text-white">Stripe Connect Integration</h3>
            {isConnected ? (
              <span className="px-2 py-1 bg-forest-500/20 text-forest-400 border border-forest-500/30 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <CheckCircle size={10} /> Connected
              </span>
            ) : (
              <span className="px-2 py-1 bg-white/10 text-white/50 border border-white/10 rounded text-[9px] font-black uppercase tracking-widest">
                Not Connected
              </span>
            )}
          </div>
          {isConnected && (
             <div className="pt-2">
                 <p className="text-xs md:text-[10px] font-mono text-forest-400/80 bg-forest-500/5 px-3 py-2 rounded-lg border border-forest-500/10 inline-block">
                    Connected Account ID: {tenant.stripeAccountId}
                 </p>
             </div>
          )}
        </div>
        
        <div className="relative z-10 shrink-0">
          {isConnected ? (
             <div className="flex flex-col gap-2 relative">
                <button
                  type="button"
                  className="px-6 py-4 bg-white hover:bg-zinc-200 text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2"
                  onClick={() => window.open("https://dashboard.stripe.com/test", "_blank")}
                >
                  Stripe Dashboard <ExternalLink size={14} />
                </button>
                <button
                  onClick={handleDisconnect}
                  className="text-xs md:text-[10px] text-zinc-500 hover:text-red-400 uppercase font-bold tracking-widest py-2 transition-colors"
                >
                  Disconnect Account
                </button>
             </div>
          ) : (
             <button
               onClick={handleConnect}
               disabled={isConnecting}
               className="px-6 py-4 bg-[#635BFF] hover:bg-[#524ac9] text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-celtic-500/20 flex items-center justify-center gap-2 min-w-[200px]"
             >
               {isConnecting ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin block" />
               ) : (
                  <>Connect Stripe <ExternalLink size={14} /></>
               )}
             </button>
          )}
        </div>
      </div>
    </section>
  );
}
