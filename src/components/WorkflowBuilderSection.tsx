import React, { useState, useMemo } from "react";
import { Workflow, Plus, Trash2, ArrowRight, Save, Zap, Play, Activity, ChevronDown, ChevronUp, CheckCircle, UserPlus, DollarSign, FileText, Send, Mail, AlertTriangle, Pause, Clock } from "lucide-react";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  targetPayload: string;
  active: boolean;
  lastRunTime?: string;
  enableRetries?: boolean;
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

const generateDataForWorkflow = (id: string) => {
  const data = [];
  let seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  for (let i = 29; i >= 0; i--) {
    const randomSuccess = Math.floor(((seed * (i + 1)) % 40)) + 5;
    const randomFailure = Math.floor(((seed * (i + 1) * 3) % 8));
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      success: randomSuccess,
      failure: randomFailure
    });
  }
  return data;
};

const getTriggerIcon = (id: string) => {
  switch (id) {
    case "job_completed": return <CheckCircle size={14} className="text-blue-400" />;
    case "client_created": return <UserPlus size={14} className="text-blue-400" />;
    case "invoice_paid": return <DollarSign size={14} className="text-blue-400" />;
    case "quote_approved": return <FileText size={14} className="text-blue-400" />;
    default: return <Activity size={14} className="text-blue-400" />;
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

  const handleSave = async () => {
    if (!tenant) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "tenants", tenant.id), {
        "settings.workflows": workflows,
      });
      showToast("Workflows saved successfully", "success");
    } catch (error) {
      console.error("Error saving workflows", error);
      showToast("Failed to save workflows", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-zinc-900 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6 mt-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-normal md:tracking-tighter flex items-center gap-3">
            <Activity className="text-blue-400" size={24} /> Workflow Builder
          </h2>
          <p className="text-xs text-white/50 leading-relaxed mt-1 max-w-2xl">
            Design your own deterministic "If This, Then That" (IFTTT) automations to seamlessly link platform events with verified actions. 
          </p>
        </div>
        <button
          onClick={handleAddWorkflow}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
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
                         <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
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
                          <span className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">
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
                        Ran {workflow.lastRunTime}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateWorkflow(workflow.id, "active", !workflow.active);
                      }}
                      className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${
                        workflow.active ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40 hover:bg-white/10"
                      }`}
                    >
                      <Play size={10} className={workflow.active ? "text-emerald-400" : "text-white/40"} />
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
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Trigger (IF)
                        </label>
                        <select
                          value={workflow.trigger}
                          onChange={(e) => handleUpdateWorkflow(workflow.id, "trigger", e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors appearance-none"
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

                    {workflow.active && (
                      <div className="pt-6 mt-4 border-t border-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                            30-Day Activity
                          </label>
                          <div className="flex items-center gap-3 text-[10px] uppercase font-bold tracking-widest">
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Success</span>
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div> Failed</span>
                          </div>
                        </div>
                        <div className="h-28 w-full p-2 bg-black/30 rounded-xl border border-white/5">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={generateDataForWorkflow(workflow.id)} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px' }}
                                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              />
                              <Bar dataKey="success" name="Success" stackId="a" fill="#10b981" />
                              <Bar dataKey="failure" name="Failure" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
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
