import React from "react";
import { Calendar, CheckCircle2, Clock } from "lucide-react";

interface ClientDashboardProps {
  client: any;
  upcomingServices: any[];
  recentProjects: any[];
}

export default function ClientDashboard({ client, upcomingServices, recentProjects }: ClientDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Client Context */}
      <div className="bg-zinc-900 border border-white/5 molten-edge rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl sm:text-2xl font-black uppercase text-white mb-1">
          Welcome back, {client?.name?.split(" ")[0] || "Client"}
        </h2>
        <p className="text-zinc-400 text-sm">{client?.address}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Upcoming Services */}
        <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col h-full">
          <h3 className="text-xs font-black text-celtic-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Calendar size={16} /> Upcoming Services
          </h3>
          <div className="flex-1 space-y-4">
            {upcomingServices.length > 0 ? (
              upcomingServices.map((service, idx) => (
                <div key={idx} className="bg-black/40 rounded-2xl p-5 border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-celtic-500" />
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-white uppercase text-sm tracking-widest">{service.title}</p>
                    <span className="bg-celtic-500/10 text-celtic-400 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                      {service.date}
                    </span>
                  </div>
                  <p className="text-white/60 text-xs">{service.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black tracking-widest text-zinc-500">
                      <Clock size={10} /> {service.time || "TBD"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-black/20 rounded-2xl border border-white/5 border-dashed h-full min-h-[150px]">
                <Calendar className="text-zinc-600 mb-3" size={32} />
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">No scheduled services</p>
              </div>
            )}
          </div>
        </div>

        {/* Recently Completed */}
        <div className="bg-zinc-900 border-4 border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col h-full">
          <h3 className="text-xs font-black text-forest-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <CheckCircle2 size={16} /> Recent Projects
          </h3>
          <div className="flex-1 space-y-4">
            {recentProjects.length > 0 ? (
              recentProjects.map((project, idx) => (
                <div key={idx} className="bg-black/40 rounded-2xl p-5 border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-forest-500" />
                  <p className="font-bold text-white uppercase text-sm tracking-widest mb-1">{project.title}</p>
                  <p className="text-forest-400 text-xs font-bold uppercase tracking-widest mb-3">Completed: {project.date}</p>
                  <div className="bg-white/5 p-3 rounded-lg">
                    <p className="text-white/70 text-xs">
                      <span className="text-zinc-400 font-bold mr-1 uppercase">Status Note:</span>
                      {project.statusUpdate}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-black/20 rounded-2xl border border-white/5 border-dashed h-full min-h-[150px]">
                <CheckCircle2 className="text-zinc-600 mb-3" size={32} />
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">No recent completions</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
