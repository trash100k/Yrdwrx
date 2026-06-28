// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Customer } from "../types";
import { tasksRepo } from "../lib/repos";
import { useToast } from "../contexts/ToastContext";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Button } from "../components/Button";
import { CheckSquare, Calendar, Clock, Trash2, Pencil, ListTodo, Plus } from "lucide-react";

// Persisted CRM Tasks. Backed by the Supabase `tasks` table via tasksRepo:
//  - tasksRepo.subscribe(cb) → realtime list (returns unsubscribe)
//  - create / update / remove / complete / reopen
// tenant_id is auto-stamped on create.

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  medium: { label: "Med", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  low: { label: "Low", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
};

const customerLabel = (c?: Customer) => {
  if (!c) return "";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.companyName || c.email || "Unnamed";
};

const emptyForm = () => ({
  id: null as string | null,
  title: "",
  notes: "",
  priority: "medium",
  status: "pending",
  due_date: "",
  customer_id: "",
});

const toDateInput = (iso?: string | null) => {
  if (!iso) return "";
  // store full ISO, edit as yyyy-mm-dd
  return String(iso).slice(0, 10);
};

const formatDue = (iso?: string | null) => {
  if (!iso) return "No due date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "No due date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return `In ${diff}d`;
  return d.toLocaleDateString();
};

export const CRMTasks = ({ customers = [] }: { customers: Customer[] }) => {
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<"list" | "calendar">("list");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = tasksRepo.subscribe((rows) => {
        setTasks(Array.isArray(rows) ? rows : []);
        setLoading(false);
      });
    } catch (e) {
      setLoading(false);
      showToast("Could not load tasks.", "error");
    }
    return () => {
      try { unsub && unsub(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {};
    for (const c of customers) if (c?.id) m[c.id] = c;
    return m;
  }, [customers]);

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      if (!q) return true;
      const cust = customerLabel(customerById[t.customer_id]).toLowerCase();
      return (
        (t.title || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q) ||
        cust.includes(q)
      );
    });
    // sort by due date ascending; nulls last
    return [...filtered].sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    });
  }, [tasks, search, customerById]);

  const pendingTasks = sorted.filter((t) => t.status !== "completed");
  const completedTasks = sorted.filter((t) => t.status === "completed");

  const openNew = () => {
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (task: any) => {
    setForm({
      id: task.id,
      title: task.title || "",
      notes: task.notes || "",
      priority: task.priority || "medium",
      status: task.status || "pending",
      due_date: toDateInput(task.due_date),
      customer_id: task.customer_id || "",
    });
    setModalOpen(true);
  };

  const setField = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) {
      showToast("Task title is required.", "error");
      return;
    }
    setSaving(true);
    const payload: any = {
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      customer_id: form.customer_id || null,
    };
    try {
      if (form.id) {
        await tasksRepo.update(form.id, payload);
        showToast("Task updated.", "success");
      } else {
        await tasksRepo.create(payload);
        showToast("Task created.", "success");
      }
      setModalOpen(false);
      setForm(emptyForm());
    } catch (e) {
      console.error("[CRMTasks] save failed", e);
      showToast("Could not save task.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (task: any) => {
    try {
      if (task.status === "completed") {
        await tasksRepo.reopen(task.id);
      } else {
        await tasksRepo.complete(task.id);
      }
    } catch (e) {
      console.error("[CRMTasks] toggle failed", e);
      showToast("Could not update task.", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await tasksRepo.remove(deleteTarget.id);
      showToast("Task deleted.", "success");
    } catch (e) {
      console.error("[CRMTasks] delete failed", e);
      showToast("Could not delete task.", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-y-auto custom-scrollbar flex-col bg-zinc-950">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-2">Tasks &amp; Action Items</h2>
          <p className="text-xs text-white/50">
            {loading ? "Loading tasks…" : `${pendingTasks.length} pending task${pendingTasks.length === 1 ? "" : "s"}.`}
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/40 outline-none focus:border-forest-500/50 transition-colors"
            />
          </div>
          <div className="bg-black border border-white/10 rounded-xl p-1 flex">
            <button
              onClick={() => setActiveView("list")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeView === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
            >
              List
            </button>
            <button
              onClick={() => setActiveView("calendar")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeView === "calendar" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
            >
              Calendar
            </button>
          </div>
          <button
            onClick={openNew}
            className="bg-white text-black font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl hover:bg-white/90 transition-colors shadow-lg active:scale-95 inline-flex items-center gap-2"
          >
            <Plus size={14} /> New Task
          </button>
        </div>
      </div>

      {activeView === "list" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 flex-1">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/40 border-b border-white/5 pb-4">Up Next</h3>

            {!loading && pendingTasks.length === 0 && (
              <div className="bg-zinc-900 border border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                <ListTodo size={40} className="text-white/10 mb-4" />
                <p className="text-sm font-bold text-white/70 mb-1">No open tasks</p>
                <p className="text-xs text-white/40 mb-6">Create a task to track follow-ups and action items.</p>
                <Button variant="forest" size="sm" leftIcon={<Plus size={14} />} onClick={openNew}>
                  New Task
                </Button>
              </div>
            )}

            {pendingTasks.map((task) => {
              const pri = PRIORITY_META[task.priority] || PRIORITY_META.medium;
              const cust = customerById[task.customer_id];
              const overdue = task.due_date && new Date(task.due_date).getTime() < Date.now();
              return (
                <div
                  key={task.id}
                  onClick={() => openEdit(task)}
                  className="bg-zinc-900 border border-white/5 p-5 rounded-2xl flex items-center gap-4 group hover:border-white/20 transition-colors cursor-pointer"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleComplete(task); }}
                    title="Mark complete"
                    className="w-6 h-6 rounded-md border-2 border-white/20 flex items-center justify-center shrink-0 hover:border-forest-500 hover:bg-forest-500/20 group-hover:bg-white/5 transition-all text-transparent hover:text-forest-500"
                  >
                    <CheckSquare size={14} />
                  </button>
                  <div className="flex-1 w-0">
                    <h4 className="font-bold text-white text-sm truncate">{task.title}</h4>
                    <p className="text-xs text-white/60 truncate mt-1">
                      {cust ? `For: ${customerLabel(cust)}` : task.notes ? task.notes : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest border ${pri.cls}`}>{pri.label}</span>
                    <div className={`flex items-center gap-1 text-xs py-1 px-3 rounded-lg border ${overdue ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-white/40 bg-black border-white/5"}`}>
                      <Clock size={12} /> {formatDue(task.due_date)}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(task); }}
                      title="Edit"
                      className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(task); }}
                      title="Delete"
                      className="p-2 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            <h3 className="text-sm font-black uppercase tracking-widest text-white/40 border-b border-white/5 pb-4 pt-8 mt-4">Completed</h3>
            {!loading && completedTasks.length === 0 && (
              <p className="text-xs text-white/30 italic px-1">No completed tasks yet.</p>
            )}
            {completedTasks.map((task) => {
              const cust = customerById[task.customer_id];
              return (
                <div key={task.id} className="bg-zinc-900/50 border border-white/5 p-5 rounded-2xl flex items-center gap-4 group">
                  <button
                    onClick={() => toggleComplete(task)}
                    title="Reopen task"
                    className="w-6 h-6 rounded-md bg-forest-500/20 text-forest-500 flex items-center justify-center shrink-0 hover:bg-forest-500/30 transition-colors"
                  >
                    <CheckSquare size={14} />
                  </button>
                  <div className="flex-1 w-0 opacity-60">
                    <h4 className="font-bold text-white text-sm truncate line-through decoration-white/30">{task.title}</h4>
                    <p className="text-xs text-white/60 truncate mt-1">{cust ? `For: ${customerLabel(cust)}` : "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-forest-400 bg-forest-500/10 py-1 px-3 rounded-lg border border-forest-500/20">Done</div>
                    <button
                      onClick={() => setDeleteTarget(task)}
                      title="Delete"
                      className="p-2 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 sticky top-0">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Due Today</h3>
                  <p className="text-[10px] text-white/50">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {(() => {
                const todayKey = new Date().toISOString().slice(0, 10);
                const dueToday = pendingTasks.filter((t) => toDateInput(t.due_date) === todayKey);
                if (dueToday.length === 0) {
                  return <p className="text-xs text-white/40">Nothing due today. You're clear.</p>;
                }
                return (
                  <div className="space-y-3">
                    {dueToday.map((t) => {
                      const pri = PRIORITY_META[t.priority] || PRIORITY_META.medium;
                      return (
                        <div
                          key={t.id}
                          onClick={() => openEdit(t)}
                          className="bg-black border border-white/5 p-4 rounded-xl shadow-md cursor-pointer hover:border-white/15 transition-colors"
                        >
                          <p className="text-sm text-white font-bold mb-1 truncate">{t.title}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest border ${pri.cls}`}>{pri.label}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-zinc-900 rounded-3xl border border-white/5 mt-4 p-8 flex flex-col items-center justify-center text-center">
          <Calendar size={64} className="text-white/10 mb-6" />
          <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Calendar Integration</h3>
          <p className="text-sm text-white/50 max-w-md">
            Full calendar view requires Google Workspace integration. Connect your Google account in Settings to view and manage appointments directly on your calendar.
          </p>
          <button className="mt-8 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-lg transition-colors border border-white/10">
            Connect Google Calendar
          </button>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Edit Task" : "New Task"}>
        <div className="flex flex-col gap-5">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="e.g. Follow up on invoice #104"
            autoFocus
          />

          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-300 ml-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Optional details…"
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/20 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Priority" value={form.priority} onChange={(e) => setField("priority", e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => setField("status", e.target.value)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="date"
              label="Due Date"
              value={form.due_date}
              onChange={(e) => setField("due_date", e.target.value)}
            />
            <Select label="Customer" value={form.customer_id} onChange={(e) => setField("customer_id", e.target.value)}>
              <option value="">— None —</option>
              {customers.filter((c) => c?.id).map((c) => (
                <option key={c.id} value={c.id}>{customerLabel(c)}</option>
              ))}
            </Select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="forest" onClick={save} isLoading={saving}>
              {form.id ? "Save Changes" : "Create Task"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete task?"
        description={`This permanently deletes "${deleteTarget?.title || "this task"}". This cannot be undone.`}
        confirmText="Delete"
        danger
      />
    </div>
  );
};
