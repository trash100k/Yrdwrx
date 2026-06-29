import React, { useState, useEffect } from "react";
import { handleFirestoreError, OperationType } from "../lib/firebase";
import { inspectionFormsRepo } from "../lib/repos";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { Plus, Trash2, Save, X, Edit, ListChecks } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function FormBuilder() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [forms, setForms] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentForm, setCurrentForm] = useState<any>(null);

  useEffect(() => {
    if (!tenant) return;
    const unsubscribe = inspectionFormsRepo.subscribe((rows: any[]) => {
      // Map the `name` column back to the `jobType` field the UI uses for display/edit.
      const data = (rows || []).map((r) => ({ ...r, jobType: r.name ?? r.jobType ?? "" }));
      setForms(data);
    });
    return () => unsubscribe();
  }, [tenant]);

  const handleCreateNew = () => {
    setCurrentForm({
      jobType: "",
      fields: []
    });
    setIsEditing(true);
  };

  const handleEdit = (form: any) => {
    setCurrentForm({ ...form });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!tenant) return;
    try {
      await inspectionFormsRepo.remove(id);
      showToast("Form deleted successfully", "success");
    } catch (e: any) {
      showToast("Failed to delete form", "error");
    }
  };

  const handleSave = async () => {
    if (!tenant || !currentForm) return;
    if (!currentForm.jobType) {
      showToast("Job Type is required", "error");
      return;
    }
    
    try {
      // The UI's "jobType" identifier maps to the `name` column.
      const payload = {
        name: currentForm.jobType,
        fields: currentForm.fields,
      };

      if (currentForm.id) {
        await inspectionFormsRepo.update(currentForm.id, payload);
        showToast("Form updated successfully", "success");
      } else {
        await inspectionFormsRepo.create({
          ...payload,
          status: "active",
        });
        showToast("Form created successfully", "success");
      }
      setIsEditing(false);
      setCurrentForm(null);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, "Failed to save form");
      showToast("Failed to save form", "error");
    }
  };

  const addField = () => {
    setCurrentForm({
      ...currentForm,
      fields: [
        ...currentForm.fields,
        { id: Date.now().toString(), label: "", type: "checkbox", required: false }
      ]
    });
  };

  const updateField = (id: string, key: string, value: any) => {
    setCurrentForm({
      ...currentForm,
      fields: currentForm.fields.map((f: any) => f.id === id ? { ...f, [key]: value } : f)
    });
  };

  const removeField = (id: string) => {
    setCurrentForm({
      ...currentForm,
      fields: currentForm.fields.filter((f: any) => f.id !== id)
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ListChecks className="text-forest-400" size={32} />
            Inspection Forms
          </h1>
          <p className="text-zinc-400 mt-2">Manage custom inspection checklists per job type</p>
        </div>
        {!isEditing && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-forest-500 text-white rounded-lg hover:bg-forest-600 transition-colors font-medium border border-forest-400/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
          >
            <Plus size={20} />
            Create Form
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {forms.map((form) => (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-900/80 border border-white/10 rounded-xl p-6 backdrop-blur-sm shadow-xl relative group hover:border-forest-500/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white max-w-[80%] break-words">{form.jobType}</h3>
                  <div className="flex z-10 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(form)} className="p-1.5 bg-zinc-800 hover:bg-forest-500/20 hover:text-forest-400 text-zinc-400 rounded-lg transition-colors">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(form.id)} className="p-1.5 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-zinc-400">
                    <span className="font-semibold text-white">{form.fields?.length || 0}</span> fields defined
                  </p>
                </div>
              </motion.div>
            ))}
            {forms.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-white/10 rounded-2xl">
                <ListChecks size={48} className="mb-4 opacity-50" />
                <p>No inspection forms created yet.</p>
                <button
                  onClick={handleCreateNew}
                  className="mt-4 text-forest-400 hover:text-forest-300 font-medium hover:underline"
                >
                  Create your first form
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-white/10 rounded-2xl flex-1 flex flex-col overflow-hidden max-h-full"
        >
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ListChecks className="text-forest-400" />
              {currentForm.id ? "Edit Form" : "New Form"}
            </h2>
            <button onClick={() => setIsEditing(false)} className="text-zinc-400 hover:text-white p-2 transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-8">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Job Type Identifier</label>
              <input
                type="text"
                placeholder="e.g. 'Tree Trimming' or 'Mowing'"
                value={currentForm.jobType}
                onChange={(e) => setCurrentForm({ ...currentForm, jobType: e.target.value })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 transition-colors"
              />
              <p className="text-xs text-zinc-500">This form will appear when a crew starts a job with this exact type.</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Form Fields</label>
                <button
                  onClick={addField}
                  className="text-xs font-bold px-3 py-1.5 bg-forest-500/20 text-forest-400 hover:bg-forest-500/30 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus size={14} /> Add Field
                </button>
              </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {currentForm.fields?.map((field: any, index: number) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-zinc-950 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center relative group"
                    >
                      <div className="flex-1 space-y-1 w-full">
                        <label className="text-xs text-zinc-500">Field Label</label>
                        <input
                          type="text"
                          placeholder="e.g. 'Did you check the oil?'"
                          value={field.label}
                          onChange={(e) => updateField(field.id, "label", e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-forest-500"
                        />
                      </div>
                      
                      <div className="w-full md:w-48 space-y-1">
                        <label className="text-xs text-zinc-500">Field Type</label>
                        <select
                          value={field.type}
                          onChange={(e) => updateField(field.id, "type", e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-forest-500 appearance-none"
                        >
                          <option value="text">Text Input</option>
                          <option value="checkbox">Checkbox (Yes/No)</option>
                          <option value="number">Number</option>
                          <option value="image">Photo Upload</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-5">
                        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(field.id, "required", e.target.checked)}
                            className="rounded border-white/20 bg-zinc-900 text-forest-500 focus:ring-forest-500"
                          />
                          Required
                        </label>
                      </div>

                      <div className="pt-5 md:pl-2">
                         <button onClick={() => removeField(field.id)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10">
                           <Trash2 size={18} />
                         </button>
                      </div>
                    </motion.div>
                  ))}
                  {(!currentForm.fields || currentForm.fields.length === 0) && (
                    <div className="text-center py-8 text-sm text-zinc-500 border border-dashed border-white/10 rounded-xl">
                      No fields added yet.
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-3 shrink-0">
            <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 text-zinc-400 hover:text-white font-medium transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-forest-500 text-white rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:bg-forest-600 transition-colors font-bold">
              <Save size={18} />
              Save Form
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
