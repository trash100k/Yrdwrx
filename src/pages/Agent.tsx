import React, { useState, useEffect } from "react";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { fetchApi } from "../lib/api";
import { knowledgeRepo, tenantsRepo } from "../lib/repos";
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
  Plus,
  Loader2,
  Trash2,
  Save
} from "lucide-react";

import BrainChat from "../components/CuttyChat";
import { WorkflowBuilderSection } from "../components/WorkflowBuilderSection";

import { DeepResearchTab, VideoMarketingTab } from "../components/AgentLabs";

// Flatten the freeform `data` jsonb onto the row so UI fields (sourceType, etc.) read
// directly; real columns win over jsonb keys.
const adaptKnowledge = (r: any) => ({ ...(r?.data || {}), ...r });

export default function Agent() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("chat");

  // --- Knowledge Base (real `knowledge` table via knowledgeRepo) ---
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [newSourceTopic, setNewSourceTopic] = useState("");
  const [newSourceContent, setNewSourceContent] = useState("");
  const [addingSource, setAddingSource] = useState(false);

  useEffect(() => {
    // subscribe() fires immediately and on realtime changes; returns an unsubscribe fn.
    const unsub = knowledgeRepo.subscribe((rows: any[]) => {
      setKnowledge((rows || []).map(adaptKnowledge));
    });
    return () => unsub();
  }, []);

  const handleAddSource = async () => {
    const topic = newSourceTopic.trim();
    const content = newSourceContent.trim();
    if (!topic || !content) {
      showToast("Add a title and some content for the source", "warning");
      return;
    }
    setAddingSource(true);
    try {
      await knowledgeRepo.create({
        topic,
        content,
        tags: ["agent-source"],
        lastUpdated: new Date().toISOString(),
        relevanceCount: 0,
      });
      setNewSourceTopic("");
      setNewSourceContent("");
      showToast("Knowledge source added", "success");
    } catch (e) {
      console.error("Failed to add knowledge source", e);
      showToast("Failed to add source", "error");
    } finally {
      setAddingSource(false);
    }
  };

  const handleRemoveSource = async (id: string) => {
    try {
      await knowledgeRepo.remove(id);
      showToast("Source removed", "success");
    } catch (e) {
      console.error("Failed to remove source", e);
      showToast("Failed to remove source", "error");
    }
  };

  // --- Agent Settings (persisted to tenant.settings.agent) ---
  const agentSettings = (tenant?.settings as any)?.agent || {};
  const [agentName, setAgentName] = useState<string>(agentSettings.name ?? "YardPilot");
  const [agentPersona, setAgentPersona] = useState<string>(
    agentSettings.persona ??
      "You are the ultimate operations assistant. You are concise, highly analytical, and focused on driving business outcomes."
  );
  const [reasoningModel, setReasoningModel] = useState<string>(agentSettings.reasoningModel ?? "Gemini 2.5 Pro");
  const [toolModel, setToolModel] = useState<string>(agentSettings.toolModel ?? "Gemini 2.0 Flash");
  const [temperature, setTemperature] = useState<number>(
    typeof agentSettings.temperature === "number" ? agentSettings.temperature : 0.4
  );
  const [savingAgent, setSavingAgent] = useState(false);

  // Re-sync controlled fields when the tenant profile (re)loads.
  useEffect(() => {
    const a = (tenant?.settings as any)?.agent || {};
    setAgentName(a.name ?? "YardPilot");
    setAgentPersona(
      a.persona ??
        "You are the ultimate operations assistant. You are concise, highly analytical, and focused on driving business outcomes."
    );
    setReasoningModel(a.reasoningModel ?? "Gemini 2.5 Pro");
    setToolModel(a.toolModel ?? "Gemini 2.0 Flash");
    setTemperature(typeof a.temperature === "number" ? a.temperature : 0.4);
  }, [tenant?.id]);

  const handleSaveAgentSettings = async () => {
    if (!tenant) return;
    setSavingAgent(true);
    try {
      await tenantsRepo.updateSettings({
        agent: {
          name: agentName,
          persona: agentPersona,
          reasoningModel,
          toolModel,
          temperature,
        },
      });
      showToast("Agent settings saved", "success");
    } catch (e) {
      console.error("Failed to save agent settings", e);
      showToast("Failed to save agent settings", "error");
    } finally {
      setSavingAgent(false);
    }
  };

  // --- SOC Security Guard (real threat log + persisted guardrail toggles) ---
  const [threatCount, setThreatCount] = useState<number | null>(null);
  const [threatLoadFailed, setThreatLoadFailed] = useState(false);
  const socSettings = (tenant?.settings as any)?.soc || {};
  const [guardrails, setGuardrails] = useState<Record<string, boolean>>({
    zeroTolerance: socSettings.zeroTolerance ?? true,
    promptInjection: socSettings.promptInjection ?? true,
    circuitBreaker: socSettings.circuitBreaker ?? true,
    ownerAlerts: socSettings.ownerAlerts ?? false,
  });

  useEffect(() => {
    const s = (tenant?.settings as any)?.soc || {};
    setGuardrails({
      zeroTolerance: s.zeroTolerance ?? true,
      promptInjection: s.promptInjection ?? true,
      circuitBreaker: s.circuitBreaker ?? true,
      ownerAlerts: s.ownerAlerts ?? false,
    });
  }, [tenant?.id]);

  // Pull the real (in-memory, admin-only) threat log count when the SOC tab is opened.
  useEffect(() => {
    if (activeTab !== "soc-compliance") return;
    let active = true;
    (async () => {
      try {
        const res = await fetchApi("/api/security/threats");
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || !contentType.includes("application/json")) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!active) return;
        setThreatCount(Array.isArray(data) ? data.length : 0);
        setThreatLoadFailed(false);
      } catch (e) {
        console.error("Failed to load threat log", e);
        if (active) {
          setThreatLoadFailed(true);
          setThreatCount(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [activeTab]);

  const toggleGuardrail = async (key: string) => {
    const next = { ...guardrails, [key]: !guardrails[key] };
    setGuardrails(next);
    try {
      await tenantsRepo.updateSettings({ soc: next });
    } catch (e) {
      console.error("Failed to save guardrail setting", e);
      setGuardrails(guardrails); // rollback
      showToast("Failed to save guardrail setting", "error");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto align-top">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-forest-500/10 rounded-md border border-forest-500/20 text-xs font-medium tracking-wide text-forest-400">
            <Sparkles size={14} />
            YardWorx Agent Workspace
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
          <div className="p-4 bg-zinc-950 border border-white/5 molten-edge rounded-2xl flex flex-col gap-2">
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

          <div className="mt-auto p-5 bg-forest-500/5 border border-forest-500/10 rounded-2xl">
            <h4 className="text-sm border-b border-forest-500/10 pb-2 mb-3 text-forest-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <Cpu size={16} /> Runtime Stats
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Context Window</span>
                <span className="text-white font-mono">1.2m tokens</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Memory Usage</span>
                <span className="text-forest-400 font-mono">Normal</span>
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
           <div className="bg-zinc-950 border border-white/5 molten-edge rounded-[24px] h-full shadow-2xl overflow-hidden relative min-h-[600px] flex flex-col">
              {/* Top Bar for Area */}
              <div className="h-16 border-b border-white/5 molten-edge flex items-center px-6 shrink-0 bg-white/5 backdrop-blur-xl">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-forest-500/20 text-forest-400 border border-forest-500/30 flex items-center justify-center">
                       <Bot size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white leading-tight capitalize">
                        {activeTab === "chat" ? "YardPilot" : activeTab.replace("-", " ")}
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
                     <div className="max-w-3xl mx-auto w-full">
                       {/* Real deterministic automation builder (persists to tenant.settings.workflows). */}
                       <WorkflowBuilderSection />
                     </div>
                   </div>
                 )}
                 {activeTab === "knowledge" && (
                   <div className="flex-1 p-6 sm:p-8 overflow-y-auto w-full">
                     <div className="max-w-3xl mx-auto space-y-6 w-full">
                       <div>
                         <h3 className="text-xl font-bold text-white">Knowledge Base Sources</h3>
                         <p className="text-zinc-400 text-sm mt-1">
                           Facts and notes the agent can draw on. Stored in your workspace knowledge base.
                         </p>
                       </div>

                       {/* Add a real source -> knowledgeRepo.create */}
                       <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                         <input
                           type="text"
                           value={newSourceTopic}
                           onChange={(e) => setNewSourceTopic(e.target.value)}
                           placeholder="Source title (e.g. Service pricing 2026)"
                           className="w-full min-w-0 bg-black border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-forest-500"
                         />
                         <textarea
                           rows={3}
                           value={newSourceContent}
                           onChange={(e) => setNewSourceContent(e.target.value)}
                           placeholder="What should the agent know? Paste notes, policies, or facts here..."
                           className="w-full min-w-0 bg-black border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-forest-500 leading-relaxed"
                         />
                         <div className="flex justify-end">
                           <button
                             onClick={handleAddSource}
                             disabled={addingSource}
                             className="px-4 py-2 bg-forest-600 hover:bg-forest-500 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                           >
                             {addingSource ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                             {addingSource ? "Adding..." : "Add Source"}
                           </button>
                         </div>
                       </div>

                       {knowledge.length === 0 ? (
                         <div className="p-8 border border-white/10 border-dashed rounded-xl flex flex-col items-center justify-center text-center">
                           <BrainCircuit size={28} className="text-zinc-600 mb-3" />
                           <h4 className="text-white font-medium text-sm">No sources yet</h4>
                           <p className="text-zinc-500 text-xs mt-1 max-w-sm">
                             Add notes, policies, or pricing above to give the agent grounded context.
                           </p>
                         </div>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {knowledge.map((kb) => (
                             <div key={kb.id} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                               <div className="flex justify-between items-start mb-4">
                                 <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
                                   <BrainCircuit size={20} />
                                 </div>
                                 <button
                                   onClick={() => handleRemoveSource(kb.id)}
                                   className="text-zinc-500 hover:text-red-400 transition-colors"
                                   aria-label={`Remove ${kb.topic || "source"}`}
                                 >
                                   <Trash2 size={16} />
                                 </button>
                               </div>
                               <h4 className="text-white font-medium text-sm mb-1">{kb.topic || "Untitled"}</h4>
                               {kb.content && (
                                 <p className="text-zinc-400 text-xs line-clamp-2 mb-3">{kb.content}</p>
                               )}
                               <div className="flex justify-between items-center mt-3">
                                 <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Note</p>
                                 {kb.lastUpdated && (
                                   <p className="text-xs text-zinc-400">
                                     {new Date(kb.lastUpdated).toLocaleDateString()}
                                   </p>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
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
                             <input
                               type="text"
                               value={agentName}
                               onChange={(e) => setAgentName(e.target.value)}
                               className="w-full min-w-0 bg-black border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-forest-500"
                             />
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-zinc-300 mb-1">System Prompt / Persona</label>
                             <textarea
                               rows={4}
                               value={agentPersona}
                               onChange={(e) => setAgentPersona(e.target.value)}
                               className="w-full min-w-0 bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-forest-500 leading-relaxed"
                             ></textarea>
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
                             <select
                               value={reasoningModel}
                               onChange={(e) => setReasoningModel(e.target.value)}
                               className="bg-black border border-white/10 text-white rounded-lg px-3 py-1.5 outline-none"
                             >
                               <option>Gemini 2.5 Pro</option>
                               <option>Gemini 2.0 Flash</option>
                             </select>
                           </div>
                           <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                             <div>
                               <p className="text-white font-medium">Fast Tool-Use Model</p>
                               <p className="text-zinc-400 text-sm">Used for sub-agent rapid tasks</p>
                             </div>
                             <select
                               value={toolModel}
                               onChange={(e) => setToolModel(e.target.value)}
                               className="bg-black border border-white/10 text-white rounded-lg px-3 py-1.5 outline-none"
                             >
                               <option>Gemini 2.0 Flash</option>
                               <option>Gemini 2.5 Pro</option>
                             </select>
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-zinc-300 mb-1">Temperature ({temperature.toFixed(1)})</label>
                             <input
                               type="range"
                               min="0"
                               max="1"
                               step="0.1"
                               value={temperature}
                               onChange={(e) => setTemperature(parseFloat(e.target.value))}
                               className="w-full min-w-0 accent-forest-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                             />
                           </div>
                         </div>
                       </div>

                       <div className="flex justify-end pt-2">
                         <button
                           onClick={handleSaveAgentSettings}
                           disabled={savingAgent}
                           className="px-6 py-3 bg-forest-600 hover:bg-forest-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
                         >
                           {savingAgent ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                           {savingAgent ? "Saving..." : "Save Settings"}
                         </button>
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

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                         <div className="p-4 bg-zinc-900 border border-white/5 molten-edge rounded-xl">
                           <h4 className="text-white font-medium mb-1">Threats Blocked</h4>
                           {threatLoadFailed ? (
                             <p className="text-sm text-zinc-500 mt-2">Unavailable</p>
                           ) : threatCount === null ? (
                             <Loader2 size={22} className="animate-spin text-zinc-500 mt-2" />
                           ) : (
                             <p className="text-3xl font-black text-forest-500 italic">{threatCount}</p>
                           )}
                           <p className="text-xs text-zinc-500 mt-1">
                             {threatLoadFailed
                               ? "Could not reach the threat log"
                               : "Blocked requests in the current server session"}
                           </p>
                         </div>
                         <div className="p-4 bg-zinc-900 border border-white/5 molten-edge rounded-xl">
                           <h4 className="text-white font-medium mb-1">Request Scanning</h4>
                           <p className="text-xl font-black text-forest-500 mt-2 uppercase tracking-wide">Active</p>
                           <p className="text-xs text-zinc-500 mt-1">Injection & path-traversal scanning on every /api/ request</p>
                         </div>
                       </div>

                       <div className="space-y-4">
                         <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Guardrail Preferences</h3>
                         <p className="text-xs text-zinc-500 -mt-2 mb-2">
                           These preferences are saved to your workspace settings.
                         </p>

                         <div className="flex items-start justify-between p-4 bg-zinc-900 border border-white/5 molten-edge rounded-xl">
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
                           <button
                             onClick={() => toggleGuardrail("zeroTolerance")}
                             aria-pressed={guardrails.zeroTolerance}
                             aria-label="Toggle zero-tolerance policy"
                             className={`w-10 h-6 rounded-full relative cursor-pointer shrink-0 transition-colors ${guardrails.zeroTolerance ? "bg-forest-500" : "bg-white/10"}`}
                           >
                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${guardrails.zeroTolerance ? "right-1" : "left-1"}`}></div>
                           </button>
                         </div>

                         <div className="flex items-start justify-between p-4 bg-zinc-900 border border-white/5 molten-edge rounded-xl">
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
                           <button
                             onClick={() => toggleGuardrail("promptInjection")}
                             aria-pressed={guardrails.promptInjection}
                             aria-label="Toggle prompt injection prevention"
                             className={`w-10 h-6 rounded-full relative cursor-pointer shrink-0 transition-colors ${guardrails.promptInjection ? "bg-forest-500" : "bg-white/10"}`}
                           >
                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${guardrails.promptInjection ? "right-1" : "left-1"}`}></div>
                           </button>
                         </div>

                         <div className="flex items-start justify-between p-4 bg-zinc-900 border border-white/5 molten-edge rounded-xl">
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
                           <button
                             onClick={() => toggleGuardrail("circuitBreaker")}
                             aria-pressed={guardrails.circuitBreaker}
                             aria-label="Toggle tool execution circuit breaker"
                             className={`w-10 h-6 rounded-full relative cursor-pointer shrink-0 transition-colors ${guardrails.circuitBreaker ? "bg-forest-500" : "bg-white/10"}`}
                           >
                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${guardrails.circuitBreaker ? "right-1" : "left-1"}`}></div>
                           </button>
                         </div>

                       </div>

                       <div className="pt-6 mt-6 border-t border-white/10">
                         <h3 className="text-lg font-bold text-white mb-4">Alerts</h3>

                         <div className="flex items-center justify-between p-4 bg-zinc-900 border border-white/5 molten-edge rounded-xl">
                           <div className="flex items-center gap-3">
                             <Bell size={18} className="text-zinc-400" />
                             <div>
                               <p className="text-white font-medium text-sm">Owner SMS & Email Alert</p>
                               <p className="text-zinc-500 text-xs">Notify when an attack vector reaches threshold (Strike 3)</p>
                             </div>
                           </div>
                           <button
                             onClick={() => toggleGuardrail("ownerAlerts")}
                             aria-pressed={guardrails.ownerAlerts}
                             aria-label="Toggle owner alerts"
                             className={`w-10 h-6 rounded-full relative cursor-pointer shrink-0 transition-colors ${guardrails.ownerAlerts ? "bg-forest-500" : "bg-white/10"}`}
                           >
                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${guardrails.ownerAlerts ? "right-1" : "left-1"}`}></div>
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
