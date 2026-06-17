import React from "react";
import { Customer } from "../types";
import { User, MapPin } from "lucide-react";

export const CustomerMap = ({ customers, onSelectCustomer }: { customers: Customer[], onSelectCustomer: (c: Customer) => void }) => {
  return (
    <div className="flex h-full w-full gap-4 p-6 bg-zinc-950 relative overflow-hidden">
      {/* Background Grid Pattern to look map-like */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      
      <div className="flex-1 rounded-2xl relative z-10 flex flex-col items-center justify-center p-8 text-center text-white/40">
        <div className="w-24 h-24 bg-white/5 rounded-full flex flex-col items-center justify-center border border-white/10 mb-6 shadow-2xl relative overflow-hidden">
        <MapPin size={32} className="text-white/20" />
        </div>
        <h3 className="text-2xl font-black uppercase tracking-widest text-white mb-2">Customer Map Directory</h3>
        <p className="max-w-md text-sm leading-relaxed text-white/50 mb-8 border border-white/5 bg-white/5 p-4 rounded-xl">
           To enable real interactive geographical maps, add your <strong className="text-white">GOOGLE_MAPS_API_KEY</strong> environment variable in AI Studio Settings. 
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full h-[60vh] overflow-y-auto custom-scrollbar content-start p-2">
           {customers.map(customer => (
             <div onClick={() => onSelectCustomer(customer)} key={customer.id} className="bg-black/60 border border-white/10 p-5 rounded-2xl text-left hover:border-forest-500/50 hover:bg-forest-500/5 transition-colors cursor-pointer group flex gap-4 backdrop-blur-xl">
                <div className="w-10 h-10 rounded-full bg-forest-500/20 text-forest-500 flex items-center justify-center shrink-0 border border-forest-500/30">
                  <MapPin size={16} />
                </div>
                <div className="flex-1 w-0">
                  <h4 className="font-bold text-white text-sm truncate">{customer.firstName} {customer.lastName}</h4>
                  <p className="text-[10px] text-white/40 truncate mt-1 leading-tight">{customer.address || "No address on file"}</p>
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};
