import React from "react";
import { Customer } from "../types";
import { FileText, Folder, MoreVertical, Search, Upload, Download, ExternalLink } from "lucide-react";

export const CRMDocuments = ({ customers }: { customers: Customer[] }) => {
  const documents = [
    { id: 1, name: "Q3_Service_Agreement.pdf", type: "pdf", size: "2.4 MB", date: "Oct 12, 2026", customer: "Jane Doe" },
    { id: 2, name: "Property_Blueprint.dwg", type: "cad", size: "14.1 MB", date: "Sep 28, 2026", customer: "Smith Corp" },
    { id: 3, name: "Signed_Estimate_104.pdf", type: "pdf", size: "1.1 MB", date: "Sep 15, 2026", customer: "Jane Doe" },
    { id: 4, name: "Site_Photos.zip", type: "zip", size: "145 MB", date: "Aug 02, 2026", customer: "Acme Inc" },
    { id: 5, name: "HOA_Guidelines_2026.docx", type: "doc", size: "0.8 MB", date: "Jan 14, 2026", customer: "John Smith" },
  ];

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-y-auto custom-scrollbar flex-col bg-zinc-950">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-2">
         <div>
           <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-2">Document Vault</h2>
           <p className="text-xs text-white/50">Securely store and manage client files and contracts.</p>
         </div>
         
         <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input type="text" placeholder="Search files..." className="w-full bg-black border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-white/40 outline-none focus:border-forest-500/50 transition-colors" />
            </div>
            
            <button className="bg-white text-black font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl hover:bg-white/90 transition-colors shadow-lg active:scale-95 flex items-center gap-2">
              <Upload size={16} /> Upload Fill
            </button>
         </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 hover:border-white/20 transition-colors">
          <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
            <Folder size={18} fill="currentColor" fillOpacity={0.2} />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Contracts</h4>
            <p className="text-[10px] text-white/40">12 Files</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 hover:border-white/20 transition-colors">
          <div className="w-10 h-10 bg-yellow-500/20 text-yellow-400 rounded-xl flex items-center justify-center shrink-0">
            <Folder size={18} fill="currentColor" fillOpacity={0.2} />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Estimates</h4>
            <p className="text-[10px] text-white/40">45 Files</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 hover:border-white/20 transition-colors">
          <div className="w-10 h-10 bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center shrink-0">
            <Folder size={18} fill="currentColor" fillOpacity={0.2} />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Invoices</h4>
            <p className="text-[10px] text-white/40">89 Files</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 hover:border-white/20 transition-colors">
          <div className="w-10 h-10 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center shrink-0">
            <Folder size={18} fill="currentColor" fillOpacity={0.2} />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Media</h4>
            <p className="text-[10px] text-white/40">203 Files</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex-1">
        <h3 className="text-sm font-black uppercase tracking-widest text-white/40 border-b border-white/5 pb-4 mb-4">Recent Documents</h3>
        
        <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-black/40">
                <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest font-mono">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest font-mono hidden md:table-cell">Client</th>
                <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest font-mono hidden sm:table-cell">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest font-mono hidden lg:table-cell">Size</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                         <FileText size={14} />
                      </div>
                      <span className="font-bold text-white text-sm group-hover:text-forest-400 transition-colors cursor-pointer">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-xs text-white/60">{doc.customer}</td>
                  <td className="px-6 py-4 hidden sm:table-cell text-xs text-white/40">{doc.date}</td>
                  <td className="px-6 py-4 hidden lg:table-cell text-xs text-white/40">{doc.size}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                         <Download size={14} />
                       </button>
                       <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                         <ExternalLink size={14} />
                       </button>
                       <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                         <MoreVertical size={14} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
