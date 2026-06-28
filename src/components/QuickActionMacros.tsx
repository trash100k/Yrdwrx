// @ts-nocheck
import React from "react";
import { useNavigate } from "react-router-dom";
import { Zap, UserPlus, CalendarPlus, FileText, Map } from "lucide-react";
import { useRole } from "../hooks/useRole";

// Honest quick-launchers — they open the real flow (no fake progress bars or invented
// numbers). Owners can also just talk to YardPilot to do these hands-free.
export default function QuickActionMacros() {
  const navigate = useNavigate();
  const { role } = useRole();
  const prefix = role === "employee" || role === "foreman" ? "/employee" : "/admin";

  const ACTIONS = [
    {
      id: "client",
      label: "Add Client",
      icon: UserPlus,
      to: `${prefix}/crm`,
      color: "text-celtic-400",
      bg: "bg-celtic-500/10",
      border: "border-celtic-500/20",
    },
    {
      id: "job",
      label: "Schedule Job",
      icon: CalendarPlus,
      to: `${prefix}/scheduler`,
      color: "text-forest-400",
      bg: "bg-forest-500/10",
      border: "border-forest-500/20",
    },
    {
      id: "invoice",
      label: "Create Invoice",
      icon: FileText,
      to: `${prefix}/invoices`,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      id: "route",
      label: "Optimize Routes",
      icon: Map,
      to: `${prefix}/routing`,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/20",
    },
  ];

  return (
    <div className="bg-zinc-950 border border-white/5 molten-edge shadow-md p-6 sm:p-8 rounded-[24px] relative overflow-hidden">
      <header className="mb-6 flex items-center gap-4">
        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-300">
          <Zap size={20} />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-0.5">
            Quick Actions
          </h2>
          <p className="text-sm font-medium text-zinc-500">
            Jump straight into the most common tasks
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => navigate(a.to)}
              className={`p-5 border flex flex-col items-center justify-center text-center gap-3 rounded-[20px] transition-all duration-200 ${a.border} hover:border-white/20 hover:bg-white/5 active:scale-95`}
            >
              <div className={`p-2 rounded-lg ${a.bg}`}>
                <Icon size={24} className={a.color} />
              </div>
              <h3 className="text-sm font-bold text-white leading-snug">{a.label}</h3>
            </button>
          );
        })}
      </div>
    </div>
  );
}
