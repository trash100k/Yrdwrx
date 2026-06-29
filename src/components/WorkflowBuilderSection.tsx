// @ts-nocheck
import React, { useState, useMemo } from "react";
import { Workflow, Plus, Trash2, ArrowRight, Save, Zap, Play, Activity, ChevronDown, ChevronUp, CheckCircle, UserPlus, DollarSign, FileText, Send, Mail, AlertTriangle, Pause, Clock } from "lucide-react";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { tenantsRepo } from "../lib/repos";

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  targetPayload: string;
  active: boolean;
  lastRunTime?: string;
  enableRetries?: boolean;
  // Real run metadata recorded by the automation engine (src/lib/automations.ts).
  runCount?: number;
  lastError?: string | null;
}

const AVAILABLE_TRIGGERS = [
  { id: "job_completed", label: "When a Job is Completed" },
  { id: "client_created", label: "When a New Client is Added" },
  { id: "invoice_paid", label: "When an Invoice is Paid" },
  { id: "quote_approved", label: "When a Quote is Approved" },
];

const AVAILABLE_ACTIONS = [
  { id: "send_webhook", label: "Send to Webhook (Zapier/Make)" },
  { id: "draft_followup_email", label: "AI Draft Follow-up Email" },
  { id: "flag_for_review", label: "Flag for Manager Review" },
];

// Humanize an ISO timestamp into a short relative string ("just now", "5m ago",
// "3h ago", "2d ago"), falling back to a locale date for older runs.
const humanizeRunTime = (iso?: string): string => {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return iso === "Never" ? "Never" : iso;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
};

const getTriggerIcon = (id: string) => {
  switch (id) {
    case "job_completed": return <CheckCircle size={14} className="text-celtic-400" />;
    case "client_created": return <UserPlus size={14} className="text-celtic-400" />;
    case "invoice_paid": return <DollarSign size={14} className="text-celtic-400" />;
    case "quote_approved": return <FileText size={14} className="text-celtic-400" />;
    default: return <Activity size={14} className="text-celtic-400" />;
  }
};

const getActionIcon = (id: string) => {
  switch (id) {
    case "send_webhook": return <Send size={14} className="text-amber-400" />;
    case "draft_followup_email": return <Mail size={14} className="text-amber-400" />;
    case "flag_for_review": return <AlertTriangle size={14} className="text-amber-400" />;
    default: return <Activity size={14} className="text-amber-400" />;
  }
};

export function WorkflowBuilderSection() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  
  const [workflows, setWorkflows] = useState<AutomationRule[]>(
    tenant?.settings?.workflows || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAddWorkflow = () => {
    const id = String(Date.now());
    const newRule: AutomationRule = {
      id,
      name: "New Automation",
      trigger: "job_completed",
      action: "send_webhook",
      targetPayload: "",
      active: true,
      lastRunTime: "Never",
      enableRetries: true,
    };
    setWorkflows([...workflows, newRule]);
    setExpandedId(id);
  };

  const handleUpdateWorkflow = (id: string, field: keyof AutomationRule, value: any) => {
    setWorkflows(workflows.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const handleRemoveWorkflow = (id: string) => {
    setWorkflows(workflows.filter(w => w.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  // Persist a workflow list to tenant.settings.workflows. Shared by the explicit
  // "Save Workflows" button and the inline Active/Paused toggle so a toggle survives
  // navigating away before the user hits Save.
  const persistWorkflows = async (next: AutomationRule[]) => {
    if (!tenant) return false;
    await tenantsRepo.updateSettings({ workflows: next });
    return true;
  };

  // Flip Active/Paused and immediately persist just that change (optimistic local update
  // first so the toggle feels instant, rollback on failure).
  const handleToggleActive = async (id: string) => {
    const next = workflows.map(w => w.id === id ? { ...w, active: !w.active } : w);
    const prev = workflows;
    setWorkflows(next);
    try {
      await persistWorkflows(next);
    } catch (error) {
      console.error("Error saving workflow status", error);
      setWorkflows(prev);
      showToast("Failed to update workflow status", "error");
    }
  };

  const handleSave = async () => {
    if (!tenant) return;
    setIsSaving(true);
    try {
      await persistWorkflows(workflows);
      showToast("Workflows saved successfully", "success");
    } catch (error) {
      console.error("Error saving workflows", error);
      showToast("Failed to save workflows", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-zinc-900 border border-white/5 molten-edge rounded-3xl p-6 sm:p-8 space-y-6 mt-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-normal md:tracking-tighter flex items-center gap-3">
            <Activity className="text-celtic-400" size={24} /> Workflow Builder
          </h2>
          <p className="text-xs text-white/50 leading-relaxed mt-1 max-w-2xl">
            Design your own deterministic "If This, Then That" (IFTTT) automations to seamlessly link platform events with verified actions. 
          </p>
        </div>
        <button
          onClick={handleAddWorkflow}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-celtic-500/10 text-celtic-400 hover:bg-celtic-500/20 border border-celtic-500/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
        >
          <Plus size={14} /> Add Rule
        </button>
      </div>

      <div className="space-y-4">
        {workflows.length === 0 ? (
          <div className="p-8 border border-white/5 border-dashed rounded-2xl flex flex-col items-center justify-center text-center bg-white/[0.02]">
            <Workflow size={32} className="text-white/20 mb-3" />
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">No Workflows Active</h3>
            <p className="text-xs text-white/40 mt-1 max-w-sm">
              Create deterministic pipelines to automatically draft emails, sync with Zapier, or flag items for review based on everyday actions.
            </p>
          </div>
        ) : (
          workflows.map((workflow) => {
            const isExpanded = expandedId === workflow.id;
            const triggerLabel = AVAILABLE_TRIGGERS.find(t => t.id === workflow.trigger)?.label || workflow.trigger;
            const actionLabel = AVAILABLE_ACTIONS.find(a => a.id === workflow.action)?.label || workflow.action;

            return (
              <div key={workflow.id} className={`bg-black/40 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'shadow-2xl ring-1 ring-white/10' : 'hover:bg-black/60'}`}>
                {/* Visual Summary Card / Header */}
                <div 
                  className={`p-4 flex items-center justify-between gap-4 cursor-pointer select-none transition-colors ${isExpanded ? 'bg-white/[0.03]' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : workflow.id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="shrink-0">
                      {workflow.active ? (
                         <div className="w-8 h-8 rounded-full bg-forest-500/10 border border-forest-500/20 flex items-center justify-center text-forest-400">
                           <Zap size={14} />
                         </div>
                      ) : (
                         <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                           <Pause size={14} />
                         </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-sm font-bold uppercase tracking-wider truncate transition-colors ${workflow.active ? 'text-white' : 'text-white/50'}`}>
                        {workflow.name}
                      </h4>
                      {!isExpanded && (
                        <div className="flex items-center gap-2 mt-1 text-[10px] uppercase font-bold tracking-widest text-white/40 whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                          <span className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded bg-celtic-500/10 text-celtic-300">
                            {getTriggerIcon(workflow.trigger)}
                            <span className="truncate max-w-[120px] sm:max-w-none">{triggerLabel}</span>
                          </span>
                          <ArrowRight size={10} className="shrink-0 text-white/20" />
                          <span className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">
                            {getActionIcon(workflow.action)}
                            <span className="truncate max-w-[120px] sm:max-w-none">{actionLabel}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {workflow.lastRunTime && (
                      <div className="hidden md:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30 mr-2">
                        <Clock size={12} />
                        Ran {humanizeRunTime(workflow.lastRunTime)}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(workflow.id);
                      }}
                      className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${
                        workflow.active ? "bg-forest-500/20 text-forest-400" : "bg-white/5 text-white/40 hover:bg-white/10"
                      }`}
                    >
                      <Play size={10} className={workflow.active ? "text-forest-400" : "text-white/40"} />
                      {workflow.active ? "Active" : "Paused"}
                    </button>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 ml-2">
                       {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Editor Form */}
                {isExpanded && (
                  <div className="p-5 border-t border-white/5 space-y-5 bg-black/20">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 max-w-md">
                        <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 block">Rule Name</label>
                        <input
                          type="text"
                          value={workflow.name}
                          onChange={(e) => handleUpdateWorkflow(workflow.id, "name", e.target.value)}
                          placeholder="Name this automation..."
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-bold placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors uppercase tracking-wider"
                        />
                      </div>
                      <div className="flex items-center gap-3 self-end shrink-0">
                        <button
                          onClick={() => handleRemoveWorkflow(workflow.id)}
                          className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-celtic-500"></div> Trigger (IF)
                        </label>
                        <select
                          value={workflow.trigger}
                          onChange={(e) => handleUpdateWorkflow(workflow.id, "trigger", e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-celtic-500 transition-colors appearance-none"
                        >
                          {AVAILABLE_TRIGGERS.map((t) => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      <ArrowRight className="hidden md:block text-white/20 mt-4 shrink-0" size={20} />

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Action (THEN)
                        </label>
                        <select
                          value={workflow.action}
                          onChange={(e) => handleUpdateWorkflow(workflow.id, "action", e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors appearance-none"
                        >
                          {AVAILABLE_ACTIONS.map((a) => (
                            <option key={a.id} value={a.id}>{a.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {workflow.action === "send_webhook" && (
                      <div className="pt-2 pl-4 border-l-2 border-white/5 space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 block">
                            Webhook Destination URL
                          </label>
                          <input
                            type="url"
                            value={workflow.targetPayload}
                            onChange={(e) => handleUpdateWorkflow(workflow.id, "targetPayload", e.target.value)}
                            placeholder="https://hooks.zapier.com/..."
                            className="w-full max-w-lg bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/20 focus:outline-none focus:border-amber-500 transition-colors text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={workflow.enableRetries !== false} // Default to true if undefined
                              onChange={(e) => handleUpdateWorkflow(workflow.id, "enableRetries", e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                          </label>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white uppercase tracking-widest">Enable Retries</span>
                            <span className="text-[10px] text-white/40">Automatically retry failed webhooks up to 3 times before pausing</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-6 mt-4 border-t border-white/5">
                      <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-4 block">
                        Run Stats
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/30 rounded-xl border border-white/5 p-4">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                            <Zap size={12} className="text-forest-400" /> Total Runs
                          </div>
                          <div className="text-2xl font-black text-white tabular-nums">
                            {workflow.runCount || 0}
                          </div>
                        </div>
                        <div className="bg-black/30 rounded-xl border border-white/5 p-4">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                            <Clock size={12} className="text-celtic-400" /> Last Run
                          </div>
                          <div className="text-sm font-bold text-white">
                            {humanizeRunTime(workflow.lastRunTime)}
                          </div>
                        </div>
                      </div>
                      {workflow.lastError && (
                        <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-400" />
                          <div>
                            <span className="font-bold uppercase tracking-widest text-[10px] text-red-400 block mb-0.5">
                              Last Error
                            </span>
                            <span className="font-mono break-all">{workflow.lastError}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {workflows.length > 0 && (
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-100 text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <Save size={16} />
              {isSaving ? "Saving..." : "Save Workflows"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
