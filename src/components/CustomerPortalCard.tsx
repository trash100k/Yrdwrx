import React, { useState } from "react";
import { Customer } from "../types";
import { Link2, Send, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";
import { fetchApi } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

export const CustomerPortalCard = ({ customer }: { customer: Customer }) => {
  const { showToast } = useToast();
  const [isWorking, setIsWorking] = useState(false);

  // Mint a FRESH, scoped capability link from the server (owner-authenticated; the server
  // verifies this client belongs to your tenant and signs a token scoped to it). Never share
  // the raw /portal/<id> URL — under the secure portal that grants no access on its own.
  const mintLink = async (): Promise<string | null> => {
    if (!customer.id) {
      showToast("Save the client first to create a portal link.", "error");
      return null;
    }
    const res = await fetchApi("/api/auth/magic-link/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: customer.id, email: customer.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.magicLink) {
      showToast(data.error || "Couldn't create the portal link", "error");
      return null;
    }
    return data.magicLink as string;
  };

  const withWork = (fn: (link: string) => void | Promise<void>) => async () => {
    setIsWorking(true);
    try {
      const link = await mintLink();
      if (link) await fn(link);
    } catch (e: any) {
      showToast(e?.message || "Something went wrong", "error");
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopyLink = withWork(async (link) => {
    await navigator.clipboard.writeText(link);
    showToast("Secure portal link copied", "success");
  });

  // No email backend is wired yet, so we mint + copy the link for the owner to send.
  const handleSendInvite = withWork(async (link) => {
    await navigator.clipboard.writeText(link);
    showToast("Portal link created & copied — paste it to your client", "success");
  });

  const handleViewAs = withWork((link) => {
    window.open(link, "_blank", "noreferrer");
  });

  return (
    <div className="bg-white/5 rounded-2xl p-10 border border-white/5 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors" />

      <div className="flex items-center gap-3 mb-8 relative z-10">
        <ShieldCheck size={20} className="text-blue-400" />
        <h4 className="text-xs md:text-[10px] text-blue-400 font-black uppercase tracking-widest">
          Client Portal
        </h4>
      </div>

      <p className="text-sm font-medium text-white/60 mb-6 relative z-10 leading-relaxed">
        Give your client a secure link to view their jobs, designs, and invoices, pay online, and
        message you. Each link is scoped to this client and expires in 7 days.
      </p>

      <div className="flex flex-col gap-3 relative z-10">
        <button
          onClick={handleSendInvite}
          disabled={!customer.email || isWorking}
          className="w-full bg-blue-500 text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isWorking ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {customer.email ? "Create Portal Invite" : "No Email on File"}
        </button>

        <div className="flex gap-3">
          <button
            onClick={handleCopyLink}
            disabled={isWorking}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Link2 size={14} /> Copy Link
          </button>

          <button
            onClick={handleViewAs}
            disabled={isWorking}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ExternalLink size={14} /> View As
          </button>
        </div>
      </div>
    </div>
  );
};
