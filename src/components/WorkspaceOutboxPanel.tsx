import React from "react";
import { Mail, MessageSquare, Link as LinkIcon, Database, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useWorkspaceOutbox } from "../contexts/WorkspaceOutboxContext";

export function WorkspaceOutboxPanel({ onClose }: { onClose: () => void }) {
  const { outbox, clearOutbox } = useWorkspaceOutbox();

  const getIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail size={16} className="text-blue-400" />;
      case "chat": return <MessageSquare size={16} className="text-green-400" />;
      case "magic-link": return <LinkIcon size={16} className="text-purple-400" />;
      case "backup": return <Database size={16} className="text-amber-400" />;
      default: return <Mail size={16} />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-[200] overflow-hidden flex flex-col max-h-[600px]">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Google Workspace Logs</h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-1">Simulated Outbox</p>
        </div>
        <div className="flex items-center gap-2">
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
          outbox.map((item) => (
            <div key={item.id} className="bg-black/40 border border-white/5 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getIcon(item.type)}
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.type}</span>
                </div>
                {item.status === "sent" ? (
                  <CheckCircle2 size={12} className="text-forest-400" />
                ) : (
                  <AlertCircle size={12} className="text-rose-400" />
                )}
              </div>
              <div className="text-xs font-semibold text-white/80 mb-1">To: {item.recipient}</div>
              <div className="text-sm font-bold text-white mb-2">{item.subject}</div>
              <div className="text-xs text-zinc-400 whitespace-pre-wrap font-mono bg-white/5 p-2 rounded-lg">{item.content}</div>
              <div className="text-[9px] text-zinc-600 font-bold tracking-widest mt-2 uppercase text-right">
                {new Date(item.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
