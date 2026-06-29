// @ts-nocheck
import React, { useState } from "react";
import { Customer } from "../types";
import { Plus, X, Tag, FileText } from "lucide-react";
import { customersRepo } from "../lib/repos";
import { useToast } from "../contexts/ToastContext";
import { ConfirmDialog } from "../components/ConfirmDialog";

// Field types are encoded inline within the existing Record<string,string> map
// using a lightweight, backward-compatible prefix convention:
//   "::type::<type>::<rawValue>"
// Plain strings (no prefix) are treated as "text", so legacy fields keep working.
type FieldType = "text" | "number" | "date" | "boolean";

const TYPE_PREFIX = "::type::";
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
];

const decodeField = (stored: string): { type: FieldType; value: string } => {
  if (typeof stored === "string" && stored.startsWith(TYPE_PREFIX)) {
    const rest = stored.slice(TYPE_PREFIX.length);
    const sep = rest.indexOf("::");
    if (sep !== -1) {
      const type = rest.slice(0, sep) as FieldType;
      const value = rest.slice(sep + 2);
      if (FIELD_TYPES.some(t => t.value === type)) {
        return { type, value };
      }
    }
  }
  // Unknown / legacy plain string -> text
  return { type: "text", value: stored ?? "" };
};

const encodeField = (type: FieldType, value: string): string => {
  // Keep plain text fields as bare strings for maximum backward-compatibility.
  if (type === "text") return value;
  return `${TYPE_PREFIX}${type}::${value}`;
};

const formatDisplay = (type: FieldType, value: string): string => {
  if (type === "boolean") return value === "true" ? "Yes" : "No";
  if (!value) return "—";
  return value;
};

export const CRMCustomFields = ({ customer, onUpdate }: { customer: Customer, onUpdate?: () => void }) => {
  const { showToast } = useToast();
  const [fields, setFields] = useState<Record<string, string>>(customer.customFields || {});
  const [isEditing, setIsEditing] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);

  const handleSave = async (updatedFields: Record<string, string>) => {
    try {
      if(customer.id) {
         await customersRepo.update(customer.id, { customFields: updatedFields });
         setFields(updatedFields);
         if(onUpdate) onUpdate();
         showToast("Custom fields updated", "success");
      }
    } catch(err) {
      console.error(err);
      showToast("Failed to update custom fields", "error");
    }
  };

  // Inline value edit — updates the raw value while preserving the field's type.
  const updateFieldValue = (key: string, rawValue: string) => {
    const { type } = decodeField(fields[key]);
    const finalFields = { ...fields, [key]: encodeField(type, rawValue) };
    handleSave(finalFields);
  };

  const addField = () => {
    if(!newKey) return;
    if(newType !== "boolean" && !newValue) return;
    const valueToStore = newType === "boolean" ? (newValue || "false") : newValue;
    const finalFields = { ...fields, [newKey]: encodeField(newType, valueToStore) };
    handleSave(finalFields);
    setNewKey("");
    setNewValue("");
    setNewType("text");
  };

  const removeField = (keyToRemove: string) => {
    setPendingRemoveKey(keyToRemove);
  };

  const confirmRemoveField = () => {
    if (!pendingRemoveKey) return;
    const finalFields = { ...fields };
    delete finalFields[pendingRemoveKey];
    handleSave(finalFields);
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-forest-500/50";

  const renderEditInput = (key: string, type: FieldType, value: string) => {
    if (type === "boolean") {
      return (
        <select
          value={value === "true" ? "true" : "false"}
          onChange={e => updateFieldValue(key, e.target.value)}
          className={inputClass}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }
    return (
      <input
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        defaultValue={value}
        onBlur={e => { if (e.target.value !== value) updateFieldValue(key, e.target.value); }}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={inputClass}
      />
    );
  };

  return (
    <>
    <div className="bg-white/5 rounded-2xl p-10 border border-white/5 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <h4 className="text-xs md:text-[10px] text-white/40 uppercase tracking-[0.2em]">
          Custom Properties
        </h4>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-[10px] font-black text-forest-400 uppercase tracking-widest hover:text-white transition-colors"
        >
          {isEditing ? "Done" : "Edit"}
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(fields).map(([key, stored]) => {
          const { type, value } = decodeField(stored);
          return (
           <div key={key} className="flex items-start justify-between gap-4 border-b border-white/5 pb-4 last:border-0">
             <div className="flex-1">
               <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest flex items-center gap-2">
                 {key}
                 <span className="text-[8px] text-forest-400/60 tracking-widest">{type}</span>
               </p>
               {isEditing ? (
                 <div className="mt-2">{renderEditInput(key, type, value)}</div>
               ) : (
                 <p className="text-sm font-bold text-white mt-1">{formatDisplay(type, value)}</p>
               )}
             </div>
             {isEditing && (
               <button onClick={() => removeField(key)} className="text-white/20 hover:text-rose-400 transition-colors p-1">
                 <X size={14} />
               </button>
             )}
           </div>
          );
        })}

        {Object.keys(fields).length === 0 && !isEditing && (
          <p className="text-xs text-white/20 italic font-medium">No custom properties defined.</p>
        )}

        {isEditing && (
          <div className="mt-6 p-4 bg-black/40 rounded-xl border border-white/10">
            <h5 className="text-[10px] uppercase font-bold text-white/60 tracking-widest mb-3 flex items-center gap-2"><Plus size={12}/> Add Property</h5>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Field Name (e.g. Gate Code)"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className={inputClass}
              />
              <select
                value={newType}
                onChange={e => { setNewType(e.target.value as FieldType); setNewValue(""); }}
                className={inputClass}
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {newType === "boolean" ? (
                <select
                  value={newValue || "false"}
                  onChange={e => setNewValue(e.target.value)}
                  className={inputClass}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type={newType === "number" ? "number" : newType === "date" ? "date" : "text"}
                  placeholder="Value"
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  className={inputClass}
                />
              )}
              <button
                onClick={addField}
                disabled={!newKey || (newType !== "boolean" && !newValue)}
                className="w-full bg-white text-black font-black disabled:opacity-50 text-[10px] uppercase tracking-widest py-2 rounded-lg hover:bg-white/90 transition-colors"
              >
                Save Property
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    <ConfirmDialog
      isOpen={!!pendingRemoveKey}
      onClose={() => setPendingRemoveKey(null)}
      onConfirm={confirmRemoveField}
      title="Remove custom property?"
      description={pendingRemoveKey ? `"${pendingRemoveKey}" will be permanently removed from this client.` : ""}
      confirmText="Remove"
      danger
    />
    </>
  );
};
