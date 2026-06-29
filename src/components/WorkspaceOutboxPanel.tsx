// @ts-nocheck
import React, { useState } from "react";
import { Mail, MessageSquare, Link as LinkIcon, Database, X, CheckCircle2, AlertCircle, Send, Loader2, Clock } from "lucide-react";
import { useWorkspaceOutbox } from "../contexts/WorkspaceOutboxContext";
import { useToast } from "../contexts/ToastContext";
import { fetchApi } from "../lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (v: string) => EMAIL_RE.test(String(v || "").trim());

export function WorkspaceOutboxPanel({ onClose }: { onClose: () => void }) {
  const { outbox, clearOutbox, setStatus, markSent } = useWorkspaceOutbox();
  const { showToast } = useToast();
  const [sendingAll, setSendingAll] = useState(false);

  const getIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail size={16} className="text-blue-400" />;
      case "chat": return <MessageSquare size={16} className="text-green-400" />;
      case "magic-link": return <LinkIcon size={16} className="text-purple-400" />;
      case "backup": return <Database size={16} className="text-amber-400" />;
      default: return <Mail size={16} />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle2 size={12} className="text-forest-400" />;
      case "failed": return <AlertCircle size={12} className="text-rose-400" />;
      case "sending": return <Loader2 size={12} className="text-blue-400 animate-spin" />;
      case "draft": return <Clock size={12} className="text-amber-400" />;
      default: return <CheckCircle2 size={12} className="text-forest-400" />;
    }
  };

  // Returns true if the email was actually delivered (sent:true).
  const sendOne = async (item: any): Promise<boolean> => {
    if (item.type !== "email" || !isEmail(item.recipient)) return false;
    setStatus(item.id, "sending");
    try {
      const res = await fetchApi("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: item.recipient.trim(),
          subject: item.subject,
          text: item.content,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(item.id, "failed");
        showToast(data?.error || "Email send failed", "error");
        return false;
      }
      if (data?.sent === true) {
        markSent(item.id);
        showToast("Email sent", "success");
        return true;
      }
      if (data?.simulated === true) {
        // Email isn't wired up — keep it as a draft, don't fake success.
        setStatus(item.id, "draft");
        showToast("Email isn't configured yet — saved as draft", "info");
        return false;
      }
      // Unexpected shape — treat conservatively as a draft, surface a hint.
      setStatus(item.id, "draft");
      showToast(data?.reason || "Email not sent", "warning");
      return false;
    } catch (e: any) {
      setStatus(item.id, "failed");
      showToast(e?.message || "Email send failed", "error");
      return false;
    }
  };

  // Sendable = email draft (not yet sent) with a real address on file.
  const sendableItems = outbox.filter(
    (it) => it.type === "email" && it.status !== "sent" && it.status !== "sending" && isEmail(it.recipient)
  );

  const sendAll = async () => {
    if (sendingAll || sendableItems.length === 0) return;
    setSendingAll(true);
    try {
      for (const it of sendableItems) {
        // eslint-disable-next-line no-await-in-loop
        await sendOne(it);
      }
    } finally {
      setSendingAll(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-[200] overflow-hidden flex flex-col max-h-[600px]">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Google Workspace Logs</h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-1">Outbox</p>
        </div>
        <div className="flex items-center gap-2">
          {sendableItems.length > 0 && (
            <button
              onClick={sendAll}
              disabled={sendingAll}
              className="flex items-center gap-1 text-[10px] text-forest-400 hover:text-forest-300 disabled:opacity-50 font-bold uppercase tracking-widest px-2"
            >
              {sendingAll ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              Send All
            </button>
          )}
          {outbox.length > 0 && (
            <button onClick={clearOutbox} className="text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-widest px-2">Clear</button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-3">
        {outbox.length === 0 ? (
          <div className="text-center py-10">
            <Mail size={32} className="mx-auto text-zinc-700 mb-3 opacity-50" />
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Outbox is empty</p>
          </div>
        ) : (
          outbox.map((item) => {
            const isEmailType = item.type === "email";
            const recipientHasEmail = isEmail(item.recipient);
            const isSent = item.status === "sent";
            const isSending = item.status === "sending";
            const canSend = isEmailType && !isSent && !isSending && recipientHasEmail;
            return (
              <div
                key={item.id}
                className={`bg-black/40 border rounded-xl p-3 transition-colors ${isSent ? "border-forest-500/30 opacity-70" : "border-white/5"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getIcon(item.type)}
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.type}</span>
                    {isSent && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-forest-400 bg-forest-500/10 px-1.5 py-0.5 rounded">Sent</span>
                    )}
                  </div>
                  {getStatusIcon(item.status)}
                </div>
                <div className="text-xs font-semibold text-white/80 mb-1">To: {item.recipient}</div>
                <div className="text-sm font-bold text-white mb-2">{item.subject}</div>
                <div className="text-xs text-zinc-400 whitespace-pre-wrap font-mono bg-white/5 p-2 rounded-lg">{item.content}</div>

                <div className="flex items-center justify-between mt-2">
                  {isEmailType && !isSent ? (
                    canSend ? (
                      <button
                        onClick={() => sendOne(item)}
                        disabled={isSending}
                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-forest-300 hover:text-white bg-forest-500/10 hover:bg-forest-500/20 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {isSending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                        {isSending ? "Sending" : "Send"}
                      </button>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">No email on file</span>
                    )
                  ) : (
                    <span />
                  )}
                  <div className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase text-right">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
