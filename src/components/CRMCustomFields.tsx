import React, { useState } from "react";
import { Customer } from "../types";
import { Plus, X, Tag, FileText } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useToast } from "../contexts/ToastContext";

export const CRMCustomFields = ({ customer, onUpdate }: { customer: Customer, onUpdate?: () => void }) => {
  const { showToast } = useToast();
  const [fields, setFields] = useState<Record<string, string>>(customer.customFields || {});
  const [isEditing, setIsEditing] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleSave = async (updatedFields: Record<string, string>) => {
    try {
      if(customer.id) {
         await updateDoc(doc(db, "customers", customer.id), { customFields: updatedFields });
         setFields(updatedFields);
         if(onUpdate) onUpdate();
         showToast("Custom fields updated", "success");
      }
    } catch(err) {
      console.error(err);
      showToast("Failed to update custom fields", "error");
    }
  };

  const addField = () => {
    if(!newKey || !newValue) return;
    const finalFields = { ...fields, [newKey]: newValue };
    handleSave(finalFields);
    setNewKey("");
    setNewValue("");
  };

  const removeField = (keyToRemove: string) => {
    const finalFields = { ...fields };
    delete finalFields[keyToRemove];
    handleSave(finalFields);
  };

  return (
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
        {Object.entries(fields).map(([key, value]) => (
           <div key={key} className="flex items-start justify-between gap-4 border-b border-white/5 pb-4 last:border-0">
             <div className="flex-1">
               <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest">{key}</p>
               <p className="text-sm font-bold text-white mt-1">{value}</p>
             </div>
             {isEditing && (
               <button onClick={() => removeField(key)} className="text-white/20 hover:text-rose-400 transition-colors p-1">
                 <X size={14} />
               </button>
             )}
           </div>
        ))}

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
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-forest-500/50"
              />
              <input 
                type="text" 
                placeholder="Value"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-forest-500/50"
              />
              <button 
                onClick={addField}
                disabled={!newKey || !newValue}
                className="w-full bg-white text-black font-black disabled:opacity-50 text-[10px] uppercase tracking-widest py-2 rounded-lg hover:bg-white/90 transition-colors"
              >
                Save Property
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
