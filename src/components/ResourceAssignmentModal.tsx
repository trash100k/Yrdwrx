import React, { useState, useEffect } from "react";
import { inventoryRepo, crewsRepo } from "../lib/repos";
import { InventoryItem } from "../types";
import { useToast } from "../contexts/ToastContext";
import { X, Package, Plus, Trash2, CheckCircle, Truck, Box } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const ResourceAssignmentModal = ({
  isOpen,
  onClose,
  crews
}: {
  isOpen: boolean;
  onClose: () => void;
  crews: any[];
}) => {
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedCrewRef, setSelectedCrewRef] = useState<string>("");
  const [selectedItemRef, setSelectedItemRef] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // RLS scopes inventory to the caller's tenant; subscribe pushes a fresh full list on any change.
    const unsubscribe = inventoryRepo.subscribe((rows) => {
      const docs = (rows || []).map((r: any) => ({ ...(r.data || {}), ...r }) as InventoryItem);
      setInventory(docs);
    });
    return () => unsubscribe();
  }, [isOpen]);

  const activeCrew = crews.find(c => c.id === selectedCrewRef);

  const handleAssign = async () => {
    if (!selectedCrewRef || !selectedItemRef || quantity < 1) return;
    setIsSubmitting(true);
    
    try {
      const selectedItem = inventory.find(i => i.id === selectedItemRef);
      if (!selectedItem) throw new Error("Item not found");

      const crew = crews.find(c => c.id === selectedCrewRef);
      if (!crew) throw new Error("Crew not found");

      // We'll store it on the crew document as 'assignedResources'
      const activeJob = crew.job || crew.currentJob || "General Service";
      const currentResources = crew.assignedResources || [];
      
      const updatedResources = [...currentResources, {
         id: Math.random().toString(36).substring(7),
         itemId: selectedItem.id,
         name: selectedItem.name,
         sku: selectedItem.sku,
         quantity,
         job: activeJob,
         assignedAt: new Date().toISOString()
      }];

      // assignedResources is freeform per-crew extras -> store in the jsonb `data` blob.
      await crewsRepo.update(selectedCrewRef, {
        data: { ...(crew.data || {}), assignedResources: updatedResources }
      });

      // Optionally deduct from stock (not stringently requested but conceptually valid)
      if (selectedItem.stock !== undefined) {
         const newStock = Math.max(0, selectedItem.stock - quantity);
         await inventoryRepo.update(selectedItemRef, {
           stock: newStock
         });
      }

      showToast(`Assigned ${quantity}x ${selectedItem.name} to ${crew.name}`, "success");
      setSelectedItemRef("");
      setQuantity(1);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to assign resource", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async (resourceId: string, itemId: string, returnQty: number) => {
    if (!activeCrew) return;
    try {
      const updatedResources = (activeCrew.assignedResources || []).filter((r: any) => r.id !== resourceId);

      await crewsRepo.update(activeCrew.id, {
        data: { ...(activeCrew.data || {}), assignedResources: updatedResources }
      });

      // Add back to inventory
      const item = inventory.find(i => i.id === itemId);
      if (item && item.stock !== undefined) {
         await inventoryRepo.update(itemId, {
           stock: item.stock + returnQty
         });
      }

      showToast("Resource returned to inventory", "success");
    } catch (err: any) {
       console.error(err);
       showToast("Failed to return resource", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-zinc-900 border border-white/10 w-full max-w-4xl rounded-[28px] overflow-hidden shadow-2xl p-6 sm:p-10 text-white relative"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-white rounded-full bg-white/5 transition-all"
        >
          <X size={16} />
        </button>

        <div className="mb-8">
          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full border border-blue-500/20 font-black uppercase tracking-widest flex items-center gap-2 w-fit">
            <Package size={14} /> Resource & Asset Tracking
          </span>
          <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mt-4">
            Equipment Assignment
          </h3>
          <p className="text-xs text-zinc-400 mt-2">
            Map specific equipment from inventory to active service orders to track asset utilization per job.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 border-b border-white/5 pb-2">
              1. Select Crew & Job
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                  Target Crew
                </label>
                <select
                  className="w-full bg-black border border-white/5 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition-all text-white"
                  value={selectedCrewRef}
                  onChange={(e) => setSelectedCrewRef(e.target.value)}
                >
                  <option value="">-- Select Crew --</option>
                  {crews.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.job || c.currentJob || "Idle"})</option>
                  ))}
                </select>
              </div>

              {activeCrew && (
                <div className="bg-black border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                    <Truck size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Active Job Order</p>
                    <p className="text-sm font-bold text-white">{activeCrew.job || activeCrew.currentJob || "No specific job assigned"}</p>
                  </div>
                </div>
              )}
            </div>

            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 mt-8 border-b border-white/5 pb-2">
              2. Assign Equipment
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                  Inventory Asset
                </label>
                <select
                  className="w-full bg-black border border-white/5 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition-all text-white"
                  value={selectedItemRef}
                  onChange={(e) => setSelectedItemRef(e.target.value)}
                >
                  <option value="">-- Select Equipment --</option>
                  {inventory.map(i => (
                    <option key={i.id} value={i.id} disabled={i.stock === 0}>
                      {i.name} {i.sku && `(${i.sku})`} - IN STOCK: {i.stock || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-black border border-white/5 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition-all text-white"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>
                <button
                  onClick={handleAssign}
                  disabled={!selectedCrewRef || !selectedItemRef || quantity < 1 || isSubmitting}
                  className="flex-1 bg-blue-500 text-black px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-400 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 h-[46px]"
                >
                   {isSubmitting ? "Assigning..." : <><Plus size={16} /> Assign to Job</>}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-black/40 border-l border-white/5 pl-0 lg:pl-8 mt-8 lg:mt-0 max-h-[500px] overflow-y-auto custom-scrollbar">
            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6 border-b border-white/5 pb-2">
               Active Checked-Out Assets {activeCrew ? `for ${activeCrew.name}` : ""}
            </h4>

            {!activeCrew ? (
               <div className="text-center text-zinc-600 text-xs italic py-10">
                 Select a crew to view their checked-out assets.
               </div>
            ) : (
               <div className="space-y-3">
                 {activeCrew.assignedResources && activeCrew.assignedResources.length > 0 ? (
                    activeCrew.assignedResources.map((res: any) => (
                      <div key={res.id} className="bg-zinc-950 border border-white/5 p-4 rounded-xl flex items-center justify-between group">
                         <div>
                            <p className="text-sm font-bold text-white mb-1">{res.name} <span className="text-zinc-500 text-xs ml-1">x{res.quantity}</span></p>
                            <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">Job: {res.job}</p>
                         </div>
                         <button 
                           onClick={() => handleReturn(res.id, res.itemId, res.quantity)}
                           className="bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 border border-white/10 rounded-lg p-2 transition-colors opacity-0 group-hover:opacity-100"
                           title="Return to Inventory"
                         >
                            <Trash2 size={14} />
                         </button>
                      </div>
                    ))
                 ) : (
                   <div className="text-center text-zinc-600 text-[10px] font-bold uppercase tracking-widest py-10 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                     No assets currently assigned to this crew.
                   </div>
                 )}
               </div>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
};
