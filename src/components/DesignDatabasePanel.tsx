import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useTenant } from "../contexts/TenantContext";
import { Trash2, Plus, GripVertical, Save, Zap, HelpCircle } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

interface CatalogItem {
  id?: string;
  type: "supplier" | "workType" | "area" | "material";
  name: string;
  description?: string;
  tags?: string[];
  tenantId: string;
  metadata?: Record<string, any>;
}

export function DesignDatabasePanel() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<CatalogItem["type"]>("material");
  
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");

  useEffect(() => {
    if (!tenant) return;
    const q = query(collection(db, "design_catalog"), where("tenantId", "==", tenant.id));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CatalogItem)));
    });
    return unsub;
  }, [tenant]);

  const handleAddItem = async () => {
    if (!newItemName.trim() || !tenant) return;
    try {
      await addDoc(collection(db, "design_catalog"), {
        tenantId: tenant.id,
        type: activeCategory,
        name: newItemName,
        description: newItemDesc,
        createdAt: serverTimestamp()
      });
      setNewItemName("");
      setNewItemDesc("");
      showToast("Added to catalog", "success");
    } catch (err) {
      showToast("Failed to add item", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "design_catalog", id));
      showToast("Item removed", "success");
    } catch (err) {
      showToast("Failed to delete", "error");
    }
  };

  const filteredItems = items.filter(i => i.type === activeCategory);

  const getCategoryLabel = (cat: CatalogItem["type"]) => {
    switch(cat) {
      case "material": return "Plants & Materials Whitelist";
      case "workType": return "Types of Work We Do";
      case "supplier": return "Preferred Suppliers";
      case "area": return "Service Areas";
    }
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-forest-500/5 blur-[100px] rounded-full -mr-40 -mt-40 pointer-events-none" />
      
      <div className="flex flex-col gap-2 mb-10 relative z-10">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Design Database</h2>
        <p className="text-white/60 font-medium">Curate your operational reality. This database informs the AI in the Design Studio, Copilot, and Quoting systems so it builds accurate proposals using your actual suppliers, areas, and preferred materials.</p>
      </div>

      <div className="flex bg-black p-1 rounded-2xl border-2 border-white/10 mb-8 overflow-x-auto relative z-10">
        {(["material", "workType", "supplier", "area"] as CatalogItem["type"][]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-1 py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
              activeCategory === cat ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
          >
            {getCategoryLabel(cat)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-black/40 border border-white/5 p-6 rounded-2xl">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <Plus size={16} className="text-forest-400" /> Add {getCategoryLabel(activeCategory)}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-widest mb-1 block">Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Double-Shredded Hardwood Mulch"
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-forest-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-widest mb-1 block">Details / Rules (Optional)</label>
                <textarea
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="e.g. Plant > 5ft from masonry"
                  rows={3}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-forest-500 transition-colors resize-none"
                />
              </div>
              <button
                onClick={handleAddItem}
                disabled={!newItemName.trim()}
                className="w-full py-3 bg-forest-500/20 text-forest-400 hover:bg-forest-500 hover:text-black border border-forest-500/30 rounded-xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={14} /> Save to Database
              </button>
            </div>

            <div className="mt-6 p-4 bg-celtic-500/10 border border-celtic-500/20 rounded-xl">
              <p className="text-[10px] uppercase font-black tracking-widest text-celtic-400 mb-2 flex items-center gap-2">
                <Zap size={12} /> AI Integration
              </p>
              <p className="text-xs text-celtic-400/80 leading-relaxed font-medium">
                The Design Studio AI and Scheduler will automatically reference these entries to generate realistic bids, prevent botanical violations, and route crews only to active service areas.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <div className="bg-black/20 border border-white/5 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                <HelpCircle size={48} className="text-white/10 mb-4" />
                <p className="text-white/40 font-bold uppercase tracking-widest mb-2">No Entries Yet</p>
                <p className="text-sm text-white/30 max-w-sm">Add items here to restrict the AI to realistic options for your business.</p>
              </div>
            ) : (
              filteredItems.map(item => (
                <div key={item.id} className="group bg-black/40 border border-white/5 hover:border-forest-500/30 p-4 rounded-xl flex items-center gap-4 transition-all">
                  <div className="text-white/20 cursor-grab active:cursor-grabbing">
                    <GripVertical size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white uppercase tracking-tight">{item.name}</p>
                    {item.description && <p className="text-xs text-white/50 truncate mt-1 italic">{item.description}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(item.id!)}
                    className="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
