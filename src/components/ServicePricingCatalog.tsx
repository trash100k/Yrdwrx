import { useState, useEffect } from "react";
import { INITIAL_SERVICE_CATALOG } from "../lib/constants";
import { useTenant } from "../contexts/TenantContext";
import { doc } from "firebase/firestore";
import { safeUpdateDoc as updateDoc } from "../lib/firebase";;
import { db } from "../lib/firebase";
import { useToast } from "../contexts/ToastContext";
import { Plus, X, Save } from "lucide-react";

export function ServicePricingCatalog() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState(INITIAL_SERVICE_CATALOG);
  const [saving, setSaving] = useState(false);
  
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState(INITIAL_SERVICE_CATALOG[0]?.name || "Custom");

  useEffect(() => {
    if (tenant?.settings?.serviceCatalog) {
      setCatalog(tenant.settings.serviceCatalog);
    } else {
      setCatalog(INITIAL_SERVICE_CATALOG);
    }
  }, [tenant]);

  const saveCatalog = async (newCatalog: typeof catalog) => {
    if (tenant?.id.startsWith("demo-")) {
      showToast("Cannot modify pricing in Demo mode.");
      return;
    }
    
    setSaving(true);
    try {
      const tenantRef = doc(db, "tenants", tenant!.id);
      await updateDoc(tenantRef, {
        "settings.serviceCatalog": newCatalog
      });
      showToast("Rates updated successfully.");
    } catch (err) {
      console.error(err);
      showToast("Failed to save rates.");
    } finally {
      setSaving(false);
    }
  };

  const handlePriceChange = (categoryIndex: number, serviceIndex: number, newPrice: string) => {
    const updated = [...catalog];
    updated[categoryIndex] = { ...updated[categoryIndex] };
    updated[categoryIndex].services = [...updated[categoryIndex].services];
    updated[categoryIndex].services[serviceIndex] = {
      ...updated[categoryIndex].services[serviceIndex],
      price: parseFloat(newPrice) || 0
    };
    setCatalog(updated);
  };

  const addCustomService = () => {
    if (!newServiceName) return;
    const updated = catalog.map(cat => {
      if (cat.name === (newServiceCategory || catalog[0].name)) {
        return {
          ...cat,
          services: [...cat.services, { name: newServiceName, price: parseFloat(newServicePrice) || 0 }]
        };
      }
      return cat;
    });

    setCatalog(updated);
    setNewServiceName("");
    setNewServicePrice("");
  };

  const removeService = (categoryName: string, serviceName: string) => {
    const updated = catalog.map(cat => {
      if (cat.name === categoryName) {
         return {
           ...cat,
           services: cat.services.filter(s => s.name !== serviceName)
         }
      }
      return cat;
    });
    setCatalog(updated);
  };

  return (
    <div className="bg-black/40 border border-white/5 rounded-2xl p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
             Standard Service Rates
           </h2>
           <p className="text-zinc-400 text-sm mt-1">Configure your default rates to speed up invoice generation.</p>
        </div>
        <button 
           onClick={() => saveCatalog(catalog)}
           disabled={saving}
           className="px-5 py-2.5 bg-emerald-600 text-white font-medium text-sm rounded-xl hover:bg-emerald-500 transition-colors flex items-center gap-2"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Rates"}
        </button>
      </div>

      <div className="space-y-8">
        {catalog.map((category, catIdx) => (
          <div key={category.name}>
             <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4 pb-2 border-b border-white/5">
               {category.name}
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {category.services.map((service, srvIdx) => (
                  <div 
                    key={service.name} 
                    className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 group hover:border-emerald-500/30 transition-colors"
                  >
                    <span className="text-sm font-medium text-zinc-200 truncate pr-3" title={service.name}>
                      {service.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative w-20">
                        <span className="absolute left-2.5 top-1.5 text-zinc-500 text-sm">$</span>
                        <input
                           type="number"
                           value={service.price}
                           onChange={(e) => handlePriceChange(catIdx, srvIdx, e.target.value)}
                           className="w-full bg-black border border-white/10 rounded-lg pl-6 pr-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700"
                           placeholder="0.00"
                        />
                      </div>
                      <button onClick={() => removeService(category.name, service.name)} className="p-1 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all rounded-md">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        ))}

        <div className="mt-8 pt-6 border-t border-white/5">
           <h4 className="text-sm font-medium text-zinc-300 mb-4">Add Custom Service</h4>
           <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/5 p-4 rounded-xl">
             <select 
               value={newServiceCategory}
               onChange={(e) => setNewServiceCategory(e.target.value)}
               className="w-full sm:w-48 bg-black border border-white/10 rounded-xl p-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 shrink-0"
             >
               {catalog.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
             </select>
             <input 
               type="text" 
               placeholder="Service name..." 
               value={newServiceName}
               onChange={(e) => setNewServiceName(e.target.value)}
               className="w-full sm:flex-1 min-w-[120px] bg-black border border-white/10 rounded-xl p-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder-zinc-600"
               onKeyDown={(e) => e.key === 'Enter' && addCustomService()}
             />
             <div className="relative w-full sm:w-32 shrink-0">
               <span className="absolute left-3 top-2.5 text-zinc-500 text-sm">$</span>
               <input 
                 type="number" 
                 placeholder="Rate" 
                 value={newServicePrice}
                 onChange={(e) => setNewServicePrice(e.target.value)}
                 className="w-full bg-black border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder-zinc-600"
                 onKeyDown={(e) => e.key === 'Enter' && addCustomService()}
               />
             </div>
             <button 
               onClick={addCustomService}
               disabled={!newServiceName}
               className="w-full sm:w-auto px-5 py-2.5 bg-white text-black font-medium text-sm rounded-xl hover:bg-zinc-200 transition-colors shrink-0 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Plus size={16} /> Add Item
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
