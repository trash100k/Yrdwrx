// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import { Customer } from "../types";
import {
  Briefcase,
  Calendar,
  CheckSquare,
  Clock,
  MapPin,
  Plus,
  DollarSign,
  User,
  Loader2,
  Trash2,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { jobsRepo } from "../lib/repos";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "../contexts/ToastContext";

const STATUSES = [
  "PENDING",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
] as const;

type JobStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: "Pending",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
};

const STATUS_BADGE: Record<JobStatus, "default" | "success" | "warning" | "danger" | "info" | "forest"> = {
  PENDING: "warning",
  SCHEDULED: "info",
  IN_PROGRESS: "forest",
  COMPLETED: "success",
  CANCELED: "danger",
};

const emptyForm = (customerId?: string) => ({
  title: "",
  status: "PENDING" as JobStatus,
  date: "",
  address: "",
  assigned_to: "",
  revenue: "",
  notes: "",
  customer_id: customerId || null,
});

const fmtDate = (iso?: string) => {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const toDateInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

export const CRMJobs = ({ customer }: { customer: Customer }) => {
  const { showToast } = useToast();
  const customerId = (customer?.id as string) || undefined;

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm(customerId));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!customerId) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await jobsRepo.forCustomer(customerId);
      // Sort by date (most recent first); undated jobs sink to the bottom.
      const sorted = [...(rows || [])].sort((a, b) => {
        const av = a.date ? new Date(a.date).getTime() : -Infinity;
        const bv = b.date ? new Date(b.date).getTime() : -Infinity;
        return bv - av;
      });
      setJobs(sorted);
    } catch (err: any) {
      console.error("Failed to load jobs:", err);
      showToast(err?.message || "Failed to load jobs", "error");
    } finally {
      setLoading(false);
    }
  }, [customerId, showToast]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(customerId));
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (job: any) => {
    setEditingId(job.id);
    setForm({
      title: job.title || "",
      status: (job.status as JobStatus) || "PENDING",
      date: toDateInput(job.date),
      address: job.address || "",
      assigned_to: job.assigned_to || "",
      revenue: job.revenue != null ? String(job.revenue) : "",
      notes: job.notes || "",
      customer_id: job.customer_id || customerId || null,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title?.trim()) errs.title = "Title is required";
    if (form.revenue !== "" && isNaN(Number(form.revenue))) errs.revenue = "Revenue must be a number";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        status: form.status,
        date: form.date ? new Date(form.date).toISOString() : null,
        address: form.address?.trim() || null,
        assigned_to: form.assigned_to?.trim() || null,
        revenue: form.revenue === "" ? null : Number(form.revenue),
        notes: form.notes?.trim() || null,
      };

      if (editingId) {
        await jobsRepo.update(editingId, payload);
        showToast("Job updated", "success");
      } else {
        await jobsRepo.create({ ...payload, customer_id: customerId || null });
        showToast("Job created", "success");
      }
      setShowModal(false);
      await loadJobs();
    } catch (err: any) {
      console.error("Failed to save job:", err);
      setFormErrors({ _form: err?.message || "Failed to save job" });
    } finally {
      setIsSaving(false);
    }
  };

  // Inline status transition from a job card.
  const handleStatusChange = async (job: any, status: JobStatus) => {
    if (status === job.status) return;
    try {
      await jobsRepo.update(job.id, { status });
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status } : j)));
      showToast(`Marked ${STATUS_LABELS[status]}`, "success");
    } catch (err: any) {
      console.error("Failed to update status:", err);
      showToast(err?.message || "Failed to update status", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await jobsRepo.remove(deleteId);
      setJobs((prev) => prev.filter((j) => j.id !== deleteId));
      showToast("Job deleted", "success");
    } catch (err: any) {
      console.error("Failed to delete job:", err);
      showToast(err?.message || "Failed to delete job", "error");
    } finally {
      setDeleteId(null);
    }
  };

  const completedCount = jobs.filter((j) => j.status === "COMPLETED").length;
  const scheduledCount = jobs.filter((j) => j.status === "SCHEDULED" || j.status === "IN_PROGRESS").length;
  const totalValue = jobs.reduce((sum, j) => sum + (Number(j.revenue) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-white/5 molten-edge p-8 shadow-2xl relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Briefcase size={16} className="text-forest-400" /> Job & Service History
            </h4>
            <p className="text-[10px] text-white/40 font-bold uppercase mt-1 tracking-widest">
              For {customer.firstName} {customer.lastName}
            </p>
          </div>

          <button
            onClick={openCreate}
            className="bg-white text-black text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-white/90 transition-colors shadow-lg shadow-white/10"
          >
            <Plus size={14} /> New Job
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/40 border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Total Jobs</p>
            <h3 className="text-2xl font-bold text-white">{jobs.length}</h3>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Completed</p>
            <h3 className="text-2xl font-bold text-white">{completedCount}</h3>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Active</p>
            <h3 className="text-2xl font-bold text-forest-400">{scheduledCount}</h3>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Total Value</p>
            <h3 className="text-2xl font-bold text-blue-400">${totalValue.toLocaleString()}</h3>
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/40">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/10 rounded-2xl">
              <Briefcase size={28} className="text-white/20 mb-3" />
              <p className="text-sm font-bold text-white/60 uppercase tracking-widest">No Jobs Yet</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-1 mb-5">
                Schedule the first service for this client
              </p>
              <Button variant="forest" size="sm" leftIcon={<Plus size={14} />} onClick={openCreate}>
                Create Job
              </Button>
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col md:flex-row gap-4 bg-white/5 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors group"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h5 className="text-sm font-bold text-white">{job.title}</h5>
                    <Badge variant={STATUS_BADGE[job.status as JobStatus] || "default"}>
                      {STATUS_LABELS[job.status as JobStatus] || job.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-white/40 uppercase tracking-widest mt-4">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {fmtDate(job.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={12} /> {job.assigned_to || "Unassigned"}
                    </span>
                    {job.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {job.address}
                      </span>
                    )}
                  </div>

                  {job.notes && (
                    <p className="text-xs text-white/50 mt-3 leading-relaxed line-clamp-2">{job.notes}</p>
                  )}

                  <div className="mt-4 max-w-[200px]">
                    <Select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job, e.target.value as JobStatus)}
                      className="[&_select]:h-9 [&_select]:text-[11px]"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="md:w-40 flex flex-col md:items-end justify-between border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-4 gap-3">
                  <div className="text-sm font-bold text-white">
                    {job.revenue != null ? `$${Number(job.revenue).toLocaleString()}` : "--"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(job)}
                      className="text-xs font-bold text-forest-400 hover:text-forest-300 transition-colors flex items-center gap-1"
                    >
                      <Pencil size={12} /> View Details
                    </button>
                    <button
                      onClick={() => setDeleteId(job.id)}
                      className="p-1.5 text-white/30 hover:text-rose-400 transition-colors"
                      aria-label="Delete job"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Edit Job" : "New Job"}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-5">
          {formErrors._form && (
            <div className="flex items-center gap-2 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={14} /> {formErrors._form}
            </div>
          )}

          <Input
            label="Title"
            placeholder="e.g. Lawn Maintenance"
            value={form.title}
            error={formErrors.title}
            onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>

            <Input
              label="Date"
              type="date"
              value={form.date}
              leftIcon={<Calendar size={16} />}
              onChange={(e) => setForm((f: any) => ({ ...f, date: e.target.value }))}
            />
          </div>

          <Input
            label="Address"
            placeholder="Service location"
            value={form.address}
            leftIcon={<MapPin size={16} />}
            onChange={(e) => setForm((f: any) => ({ ...f, address: e.target.value }))}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Assigned To"
              placeholder="Technician / crew"
              value={form.assigned_to}
              leftIcon={<User size={16} />}
              onChange={(e) => setForm((f: any) => ({ ...f, assigned_to: e.target.value }))}
            />

            <Input
              label="Revenue"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.revenue}
              error={formErrors.revenue}
              leftIcon={<DollarSign size={16} />}
              onChange={(e) => setForm((f: any) => ({ ...f, revenue: e.target.value }))}
            />
          </div>

          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-300 ml-1">Notes</label>
            <textarea
              rows={3}
              placeholder="Scope, materials, special instructions..."
              value={form.notes}
              onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-white/20 focus:ring-2 focus:ring-white/10 focus:ring-offset-2 focus:ring-offset-zinc-950 transition-all rounded-xl p-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="forest" isLoading={isSaving}>
              {editingId ? "Save Changes" : "Create Job"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Job"
        description="This will permanently remove the job from this client's service history. This action cannot be undone."
        confirmText="Delete"
        danger
      />
    </div>
  );
};
