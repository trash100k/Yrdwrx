import React, { useState, useEffect, useCallback } from "react";
import { Users, Mail, Shield, UserPlus, Check, X, Trash2, Copy, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { fetchApi } from "../lib/api";

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  isSelf: boolean;
}

export function TeamManagement() {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [isSending, setIsSending] = useState(false);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [provisionUnavailable, setProvisionUnavailable] = useState(false);

  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [pendingRemove, setPendingRemove] = useState<TeamMember | null>(null);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetchApi("/api/team");
      if (res.status === 503) {
        setProvisionUnavailable(true);
        setMembers([]);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Failed to load team members", "error");
        setMembers([]);
        return;
      }
      setProvisionUnavailable(false);
      setMembers(Array.isArray(data?.members) ? data.members : []);
    } catch (err) {
      showToast("Failed to load team members", "error");
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSending(true);
    setInviteLink(null);
    try {
      const res = await fetchApi("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data?.error || "Failed to send invite", "error");
        return;
      }

      if (data?.emailed) {
        showToast(`Invite sent to ${email}`, "success");
      } else if (data?.inviteLink) {
        setInviteLink(data.inviteLink);
        showToast("Invite link created — copy & send it", "success");
      } else {
        showToast(`Invite sent to ${email}`, "success");
      }

      setEmail("");
      setRole("employee");
      loadMembers();
    } catch (err) {
      showToast("Failed to send invite", "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast("Invite link copied", "success");
    } catch (err) {
      showToast("Could not copy — select the link manually", "error");
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    const member = pendingRemove;
    try {
      const res = await fetchApi("/api/team/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Failed to remove member", "error");
        return;
      }
      showToast(`${member.name || member.email} removed`, "success");
      loadMembers();
    } catch (err) {
      showToast("Failed to remove member", "error");
    }
  };

  return (
    <div className="bg-zinc-900 border border-white/5 molten-edge rounded-2xl overflow-hidden mt-12">
      <div className="p-6 sm:p-8 bg-black/20 border-b border-white/5 molten-edge flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-celtic-500/10 text-celtic-400 flex items-center justify-center shrink-0 border border-celtic-500/20">
            <Users size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Team Management</h3>
            <p className="text-sm text-zinc-400">Invite and manage employee and foreman access.</p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="team@example.com"
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500 transition-colors placeholder:text-white/20"
              required
            />
          </div>
          <div className="w-full sm:w-48 space-y-2">
            <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Access Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-celtic-500 transition-colors"
            >
              <option value="employee">Employee</option>
              <option value="foreman">Foreman</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSending || !email}
            className="w-full sm:w-auto bg-celtic-500 hover:bg-celtic-600 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            Send Invite
          </button>
        </form>

        {inviteLink && (
          <div className="bg-black/30 border border-celtic-500/20 p-4 rounded-xl space-y-2">
            <label className="text-xs font-bold text-celtic-400 uppercase tracking-widest flex items-center gap-2">
              <Mail size={14} /> Invite Link
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white/80 text-sm focus:outline-none focus:border-celtic-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <Copy size={16} /> Copy
              </button>
            </div>
            <p className="text-xs text-zinc-500">No email was sent — share this link with the invitee.</p>
          </div>
        )}

        <div className="mt-8">
          <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Team Members</h4>

          {provisionUnavailable ? (
            <div className="bg-black/30 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-400">Team management needs the server service key.</p>
            </div>
          ) : loadingMembers ? (
            <div className="bg-black/30 border border-white/5 p-6 rounded-xl flex items-center justify-center gap-3 text-zinc-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading team…</span>
            </div>
          ) : members.length === 0 ? (
            <div className="bg-black/30 border border-white/5 p-6 rounded-xl text-center">
              <Users size={24} className="text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">No team members yet. Invite your first employee above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="bg-black/30 border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-celtic-500/10 text-celtic-400 flex items-center justify-center shrink-0 border border-celtic-500/20 font-bold uppercase">
                      {(member.name || member.email || "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold truncate">{member.name || member.email}</span>
                        {member.isSelf && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-celtic-400 bg-celtic-500/10 border border-celtic-500/20 px-2 py-0.5 rounded-full shrink-0">
                            you
                          </span>
                        )}
                      </div>
                      {member.name && <p className="text-xs text-zinc-500 truncate">{member.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Shield size={11} className="text-celtic-400" />
                      {member.role}
                    </span>
                    {!member.isSelf && (
                      <button
                        type="button"
                        onClick={() => setPendingRemove(member)}
                        title="Remove member"
                        className="w-9 h-9 rounded-xl bg-white/5 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500 border border-white/10 hover:border-rose-500/20 flex items-center justify-center transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8">
          <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Role Privileges</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-black/30 border border-white/5 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-white font-bold">
                <Shield size={16} className="text-zinc-400" /> Employee
              </div>
              <ul className="text-sm text-zinc-400 space-y-2">
                <li className="flex items-center gap-2"><Check size={14} className="text-forest-500" /> Access to routing & schedules</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-forest-500" /> Basic Copilot workflows</li>
                <li className="flex items-center gap-2"><X size={14} className="text-red-500" /> Cannot see Crew Suite or Inventory</li>
                <li className="flex items-center gap-2"><X size={14} className="text-red-500" /> Cannot see Financials/CRM</li>
              </ul>
            </div>
            <div className="bg-black/30 border border-white/5 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-white font-bold">
                <Shield size={16} className="text-celtic-400" /> Foreman
              </div>
              <ul className="text-sm text-zinc-400 space-y-2">
                <li className="flex items-center gap-2"><Check size={14} className="text-forest-500" /> All Employee features</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-forest-500" /> Full access to Crew Suite</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-forest-500" /> Full access to Inventory</li>
                <li className="flex items-center gap-2"><X size={14} className="text-red-500" /> Cannot see Financials/CRM</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        title="Remove team member?"
        description={`This will revoke access for ${pendingRemove?.name || pendingRemove?.email || "this member"}. They will no longer be able to sign in.`}
        confirmText="Remove"
        danger
      />
    </div>
  );
}
