import React, { useState } from "react";
import { Customer } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useToast } from "../contexts/ToastContext";
import { Phone, Mail, MoreVertical, CreditCard } from "lucide-react";

export const Pipeline = ({ customers, onSelectCustomer }: { customers: Customer[], onSelectCustomer: (c: Customer) => void }) => {
  const { showToast } = useToast();
  
  const columns = [
    { id: "lead", label: "Lead", color: "bg-blue-500" },
    { id: "contacted", label: "Contacted", color: "bg-purple-500" },
    { id: "estimate", label: "Estimate", color: "bg-yellow-500" },
    { id: "active", label: "Active", color: "bg-forest-500" },
    { id: "lost", label: "Lost", color: "bg-rose-500" }
  ];

  const handleDrop = async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    const customerId = e.dataTransfer.getData("customerId");
    if (!customerId) return;
    try {
      await updateDoc(doc(db, "customers", customerId), { status: statusId });
      showToast(`Moved to ${statusId}`, "success");
    } catch(err) {
      console.error(err);
      showToast("Failed to move customer", "error");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex h-full w-full gap-4 p-6 overflow-x-auto custom-scrollbar items-start">
      {columns.map(col => {
        const columnCustomers = customers.filter(c => (c.status || "lead") === col.id);
        
        return (
          <div 
            key={col.id} 
            className="flex-shrink-0 w-80 bg-zinc-900/50 rounded-3xl p-4 flex flex-col h-full border border-white/5"
            onDrop={(e) => handleDrop(e, col.id)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.color}`}></span>
                {col.label}
              </h3>
              <span className="text-[10px] bg-white/10 px-2 py-1 rounded-md text-white/40 font-bold">{columnCustomers.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-10 h-[calc(100vh-350px)]">
              {columnCustomers.map(customer => (
                <div
                  key={customer.id}
                  draggable
                  onDragStart={(e) => {
                     e.dataTransfer.setData("customerId", customer.id!);
                  }}
                  onClick={() => onSelectCustomer(customer)}
                  className="bg-black border border-white/10 p-4 rounded-2xl cursor-grab active:cursor-grabbing hover:border-forest-500/50 transition-colors shadow-xl"
                >
                  <p className="font-bold text-sm text-white mb-1 truncate">{customer.firstName} {customer.lastName}</p>
                  {customer.address && <p className="text-[10px] text-white/40 truncate mb-3">{customer.address}</p>}
                  {customer.aiScore && (
                    <div className="mb-3">
                      <span className="text-[9px] bg-forest-500/10 text-forest-400 px-2 py-0.5 rounded uppercase font-bold tracking-widest border border-forest-500/20">
                         {customer.aiScoreLabel || "High Value"} ({customer.aiScore})
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-auto">
                    {customer.phone && <div onClick={(e) => e.stopPropagation()}><a href={`tel:${customer.phone}`} className="p-1.5 bg-white/5 rounded-md hover:bg-white/10 text-white/60 inline-flex"><Phone size={12} /></a></div>}
                    {customer.email && <div onClick={(e) => e.stopPropagation()}><a href={`mailto:${customer.email}`} className="p-1.5 bg-white/5 rounded-md hover:bg-white/10 text-white/60 inline-flex"><Mail size={12} /></a></div>}
                    {customer.stripeCustomerId && <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-md inline-flex"><CreditCard size={12} /></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
