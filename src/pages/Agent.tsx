import { useToast } from '../contexts/ToastContext';
import React, { useState } from "react";
import { useTenant } from "../contexts/TenantContext";
import { motion } from "motion/react";
import { 
  Bot, 
  Sparkles, 
  Terminal, 
  Workflow, 
  Cpu,
  BrainCircuit,
  MessageSquare,
  Settings,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Bell,
  Webhook
} from "lucide-react";

import BrainChat from "../components/CuttyChat";

import { DeepResearchTab, VideoMarketingTab } from "../components/AgentLabs";

export default function Agent() {
  const { showToast } = useToast();

  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto align-top">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20 text-xs font-medium tracking-wide text-emerald-400">
            <Sparkles size={14} />
            Cutty Agent Workspace
          </div>
          <h1 className="text-3xl sm:text-4xl font-sans font-bold tracking-tight text-white mt-2">
            Copilot Studio
          </h1>
          <p className="text-zinc-400 font-medium text-sm mt-1">
            Build, test, and deploy specialized AI agents
          </p>
        </div>
      </header>

      {/* Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
        
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          <div className="p-4 bg-zinc-950 border border-white/5 rounded-2xl flex flex-col gap-2">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">Workspace Views</h3>
            
            <button 
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "chat" 
                  ? "bg-white/10 text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <MessageSquare size={18} />
              Interactive Session
            </button>
            <button 
              onClick={() => setActiveTab("workflows")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "workflows" 
                  ? "bg-white/10 text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Workflow size={18} />
              Agent Workflows
            </button>
            <button 
              onClick={() => setActiveTab("knowledge")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "knowledge" 
                  ? "bg-white/10 text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <BrainCircuit size={18} />
              Knowledge Base
            </button>
            <button 
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "settings" 
                  ? "bg-white/10 text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings size={18} />
              Agent Settings
            </button>
            <button 
              onClick={() => setActiveTab("research")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "research" 
                  ? "bg-white/10 text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Workflow size={18} />
              Deep Research
            </button>
            <button 
              onClick={() => setActiveTab("marketing")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "marketing" 
                  ? "bg-white/10 text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Workflow size={18} /> {/* Need to fix icons if want but workflow is fine */}
              Video Marketing
            </button>
            <button 
              onClick={() => setActiveTab("soc-compliance")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "soc-compliance" 
                  ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <ShieldCheck size={18} />
              SOC Security Guard
            </button>

          </div>

          <div className="mt-auto p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
            <h4 className="text-sm border-b border-emerald-500/10 pb-2 mb-3 text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <Cpu size={16} /> Runtime Stats
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Context Window</span>
                <span className="text-white font-mono">1.2m tokens</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Memory Usage</span>
                <span className="text-emerald-400 font-mono">Normal</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Active Plugins</span>
                <span className="text-white">4 Modules</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
           <div className="bg-zinc-950 border border-white/5 rounded-[24px] h-full shadow-2xl overflow-hidden relative min-h-[600px] flex flex-col">
              {/* Top Bar for Area */}
              <div className="h-16 border-b border-white/5 flex items-center px-6 shrink-0 bg-white/5 backdrop-blur-xl">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                       <Bot size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white leading-tight capitalize">
                        {activeTab === "chat" ? "Cutty Copilot" : activeTab.replace("-", " ")}
                      </h2>
                      <p className="text-[10px] text-zinc-400 font-medium font-mono uppercase tracking-widest leading-none mt-1">
                        System ready
                      </p>
                    </div>
                 </div>
              </div>

              {/* View Content */}
              <div className="flex-1 flex overflow-hidden">
                 {activeTab === "chat" && (
                   <div className="flex-1 flex flex-col h-full bg-zinc-950">
                     <BrainChat mode="full" hideHeader />
                   </div>
                 )}
                 {activeTab === "workflows" && (
                   <div className="flex-1 p-6 sm:p-8 overflow-y-auto w-full">
                     <div className="max-w-3xl mx-auto space-y-6 w-full">
                       <div className="flex items-center justify-between">
                         <h3 className="text-xl font-bold text-white">Active Workflows</h3>
                         <button onClick={() => showToast("Workflow Builder coming soon", "info")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-medium transition-colors">
                           Create New Workflow
                         </button>
                       </div>
                       
                       {[
                         { title: "Lead Ingestion & Triage", desc: "Monitors generic inbox, scores lead, drafts initial reply.", status: "Active" },
                         { title: "Invoice Follow-Up Sequence", desc: "Sends staggered reminders to unpaid clients at 7, 14, and 30 days.", status: "Active" },
                         { title: "Weekly Performance Brief", desc: "Compiles local CRM data into a digest every Friday at 4 PM.", status: "Paused" }
                       ].map((wf, i) => (
                         <div key={i} className="p-5 bg-white/5 border border-white/10 rounded-xl flex items-start justify-between">
                           <div>
                             <h4 className="text-white font-medium mb-1">{wf.title}</h4>
                             <p className="text-zinc-400 text-sm">{wf.desc}</p>
                           </div>
                           <div className="flex items-center gap-3">
                             <span className={`text-xs font-bold px-2 py-1 rounded border uppercase ${wf.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                               {wf.status}
                             </span>
                             <button onClick={() => showToast("Opening settings", "info")} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg">
                               <Settings size={16} />
                             </button>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
                 {activeTab === "knowledge" && (
                   <div className="flex-1 p-6 sm:p-8 overflow-y-auto w-full">
                     <div className="max-w-3xl mx-auto space-y-6 w-full">
                       <div className="flex items-center justify-between">
                         <h3 className="text-xl font-bold text-white">Knowledge Base Sources</h3>
                         <button onClick={() => showToast("Data source wizard opened", "info")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-medium transition-colors">
                           Add Source
                         </button>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {[
                           { name: "Company Policy PDF", type: "Document", size: "2.4 MB", updated: "2 days ago" },
                           { name: "Service Pricing 2026", type: "Spreadsheet", size: "84 KB", updated: "1 week ago" },
                           { name: "Historical Quotes", type: "Database Linked", size: "12,042 rows", updated: "Just now" }
                         ].map((kb, i) => (
                           <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                             <div className="flex justify-between items-start mb-4">
                               <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
                                 <BrainCircuit size={20} />
                               </div>
                               <button onClick={() => showToast("Knowledge Base synced", "success")} className="text-xs font-medium text-emerald-400 hover:text-emerald-300">Sync</button>
                             </div>
                             <h4 className="text-white font-medium text-sm mb-1">{kb.name}</h4>
                             <div className="flex justify-between items-center mt-3">
                               <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{kb.type}</p>
                               <p className="text-xs text-zinc-400">{kb.updated}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>
                 )}
                 {activeTab === "settings" && (
                   <div className="flex-1 p-6 sm:p-8 overflow-y-auto w-full">
                     <div className="max-w-2xl mx-auto space-y-8 w-full">
                       
                       <div>
                         <h3 className="text-xl font-bold text-white mb-4">Behavioral Profile</h3>
                         <div className="space-y-4">
                           <div>
                             <label className="block text-sm font-medium text-zinc-300 mb-1">Agent Name</label>
                             <input type="text" defaultValue="Cutty Copilot" className="w-full min-w-0 bg-black border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500" />
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-zinc-300 mb-1">System Prompt / Persona</label>
                             <textarea rows={4} defaultValue="You are the ultimate operations assistant. You are concise, highly analytical, and focused on driving business outcomes..." className="w-full min-w-0 bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 leading-relaxed"></textarea>
                           </div>
                         </div>
                       </div>
                       
                       <div className="pt-6 border-t border-white/10">
                         <h3 className="text-lg font-bold text-white mb-4">Model Configuration</h3>
                         <div className="space-y-4">
                           <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                             <div>
                               <p className="text-white font-medium">Default Reasoning Model</p>
                               <p className="text-zinc-400 text-sm">LLM used for complex analysis</p>
                             </div>
                             <select className="bg-black border border-white/10 text-white rounded-lg px-3 py-1.5 outline-none">
                               <option>Gemini 2.5 Pro</option>
                               <option>Gemini 2.0 Flash</option>
                             </select>
                           </div>
                           <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                             <div>
                               <p className="text-white font-medium">Fast Tool-Use Model</p>
                               <p className="text-zinc-400 text-sm">Used for sub-agent rapid tasks</p>
                             </div>
                             <select className="bg-black border border-white/10 text-white rounded-lg px-3 py-1.5 outline-none">
                               <option>Gemini 2.0 Flash</option>
                               <option>Gemini 2.5 Pro</option>
                             </select>
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-zinc-300 mb-1">Temperature ({0.4})</label>
                             <input type="range" min="0" max="1" step="0.1" defaultValue="0.4" className="w-full min-w-0 accent-emerald-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                           </div>
                         </div>
                       </div>
                       
                     </div>
                   </div>
                 )}
                 {activeTab === "research" && <DeepResearchTab />}
                 {activeTab === "marketing" && <VideoMarketingTab />}
                 {activeTab === "soc-compliance" && (
                   <div className="flex-1 p-6 sm:p-8 overflow-y-auto w-full">
                     <div className="max-w-3xl mx-auto space-y-8 w-full">
                       
                       <div>
                         <div className="flex items-center gap-3 mb-2">
                           <ShieldCheck size={24} className="text-red-500" />
                           <h3 className="text-xl font-bold text-white">SOC-AI Threat Protection</h3>
                         </div>
                         <p className="text-zinc-400 text-sm mb-6">
                           Manage AI-specific SOC compliance rules. This system dynamically analyzes end-user inputs to prevent prompt injection, tool abuse, and data exfiltration.
                         </p>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                         <div className="p-4 bg-zinc-900 border border-white/5 rounded-xl">
                           <h4 className="text-white font-medium mb-1">Total Prevented</h4>
                           <p className="text-3xl font-black text-emerald-500 italic">24</p>
                           <p className="text-xs text-zinc-500 mt-1">Last 30 days</p>
                         </div>
                         <div className="p-4 bg-zinc-900 border border-white/5 rounded-xl">
                           <h4 className="text-white font-medium mb-1">Active Lockouts</h4>
                           <p className="text-3xl font-black text-amber-500 italic">1</p>
                           <p className="text-xs text-zinc-500 mt-1">Flagged for review</p>
                         </div>
                         <div className="p-4 bg-zinc-900 border border-white/5 rounded-xl">
                           <h4 className="text-white font-medium mb-1">Security Status</h4>
                           <p className="text-xl font-black text-emerald-500 mt-2 uppercase tracking-wide">Secured</p>
                           <p className="text-xs text-zinc-500 mt-1">SOC-2 Aligned</p>
                         </div>
                       </div>
                       
                       <div className="space-y-4">
                         <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Active Guardrails</h3>
                         
                         <div className="flex items-start justify-between p-4 bg-zinc-900 border border-white/5 rounded-xl">
                           <div className="flex gap-4">
                             <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 border border-red-500/20">
                               <AlertTriangle size={20} />
                             </div>
                             <div>
                               <h4 className="text-white font-medium">Zero-Tolerance (0-Strike) Employee Policy</h4>
                               <p className="text-zinc-400 text-sm mt-1 mb-3">Instant lockout for blatant injection attempts, prompt-exfiltration, or trying to access financial ledgers by bypassing Employee roles.</p>
                               <div className="text-xs bg-black/50 px-3 py-2 rounded-md font-mono text-zinc-500 break-all border border-red-500/10">
                                 Action upon detection: <span className="text-red-500 font-bold">Instant Account Lockout & Owner Alert</span>
                               </div>
                             </div>
                           </div>
                           <div className="w-10 h-6 bg-emerald-500 rounded-full relative cursor-pointer shrink-0">
                             <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                           </div>
                         </div>

                         <div className="flex items-start justify-between p-4 bg-zinc-900 border border-white/5 rounded-xl">
                           <div className="flex gap-4">
                             <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                               <AlertTriangle size={20} />
                             </div>
                             <div>
                               <h4 className="text-white font-medium">Prompt Injection & Jailbreak Prevention</h4>
                               <p className="text-zinc-400 text-sm mt-1 mb-3">Scans prompts for systemic overrides, "Ignore Previous Instructions", and simulated personas designed to break rules.</p>
                               <div className="text-xs bg-black px-3 py-2 rounded-md font-mono text-zinc-500 break-all border border-white/5">
                                 Action upon detection: <span className="text-amber-500 font-bold">Reject prompt & warn user</span>
                               </div>
                             </div>
                           </div>
                           <div className="w-10 h-6 bg-emerald-500 rounded-full relative cursor-pointer opacity-50 shrink-0">
                             <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                           </div>
                         </div>

                         <div className="flex items-start justify-between p-4 bg-zinc-900 border border-white/5 rounded-xl">
                           <div className="flex gap-4">
                             <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                               <Lock size={20} />
                             </div>
                             <div>
                               <h4 className="text-white font-medium">Tool Execution Circuit Breaker</h4>
                               <p className="text-zinc-400 text-sm mt-1 mb-3">Rate limits sequential tool calls and blocks unauthorized destructive actions (e.g. bulk deleting Customer CRM data without explicit user 2FA).</p>
                               <div className="text-xs bg-black px-3 py-2 rounded-md font-mono text-zinc-500 border border-white/5">
                                 Action upon detection: <span className="text-red-500 font-bold">Lockout session (3 strikes)</span>
                               </div>
                             </div>
                           </div>
                           <div className="w-10 h-6 bg-emerald-500 rounded-full relative cursor-pointer opacity-50 shrink-0">
                             <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                           </div>
                         </div>

                       </div>

                       <div className="pt-6 mt-6 border-t border-white/10">
                         <h3 className="text-lg font-bold text-white mb-4">Backend Webhook & Alerts</h3>
                         
                         <div className="flex items-center justify-between p-4 bg-zinc-900 border border-white/5 rounded-xl mb-4">
                           <div className="flex items-center gap-3">
                             <Bell size={18} className="text-zinc-400" />
                             <div>
                               <p className="text-white font-medium text-sm">Owner SMS & Email Alert</p>
                               <p className="text-zinc-500 text-xs">Notify when an attack vector reaches threshold (Strike 3)</p>
                             </div>
                           </div>
                           <div className="w-10 h-6 bg-emerald-500 rounded-full relative cursor-pointer opacity-50">
                             <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                           </div>
                         </div>

                         <div className="flex items-center justify-between p-4 bg-zinc-900 border border-white/5 rounded-xl">
                           <div className="flex items-center gap-3">
                             <Webhook size={18} className="text-zinc-400" />
                             <div>
                               <p className="text-white font-medium text-sm">Security Webhook Endpoint</p>
                               <p className="text-zinc-500 text-xs">POST payload to your backend: https://api.yoursite.com/secdev/webhook</p>
                             </div>
                           </div>
                           <button onClick={() => showToast("Configuration saved", "success")} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white transition-colors">
                             Configure
                           </button>
                         </div>
                       </div>
                       
                     </div>
                   </div>
                 )}
              </div>

           </div>
        </div>

      </div>
    </div>
  );
}
