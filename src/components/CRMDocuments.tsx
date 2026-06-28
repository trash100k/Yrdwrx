// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Customer } from "../types";
import {
  FileText, Folder, MoreVertical, Search, Upload, Download, ExternalLink,
  Loader2, Trash2, X,
} from "lucide-react";
import { documentsRepo } from "../lib/repos";
import { useToast } from "../contexts/ToastContext";
import { ConfirmDialog } from "./ConfirmDialog";

const FOLDERS = ["Contracts", "Estimates", "Invoices", "Media", "General"];

const FOLDER_STYLES: Record<string, string> = {
  Contracts: "bg-blue-500/20 text-blue-400",
  Estimates: "bg-yellow-500/20 text-yellow-400",
  Invoices: "bg-green-500/20 text-green-400",
  Media: "bg-purple-500/20 text-purple-400",
  General: "bg-zinc-500/20 text-zinc-400",
};

function humanizeBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function humanizeDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export const CRMDocuments = ({ customers }: { customers: Customer[] }) => {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [uploadFolder, setUploadFolder] = useState<string>(FOLDERS[0]);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve a display name for a document's customer_id from the passed customers.
  const customerName = useMemo(() => {
    const map: Record<string, string> = {};
    (customers || []).forEach((c) => {
      if (!c?.id) return;
      map[c.id] =
        c.companyName ||
        [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
        c.email ||
        "Unknown";
    });
    return map;
  }, [customers]);

  // Real list + realtime updates.
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const unsub = documentsRepo.subscribe((rows) => {
      if (!mounted) return;
      setDocuments(rows || []);
      setLoading(false);
    });
    return () => {
      mounted = false;
      try { unsub && unsub(); } catch { /* noop */ }
    };
  }, []);

  // Folder file counts (live).
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((d) => {
      const f = d.folder || "General";
      counts[f] = (counts[f] || 0) + 1;
    });
    return counts;
  }, [documents]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (activeFolder && (d.folder || "General") !== activeFolder) return false;
      if (!q) return true;
      const hay = `${d.name || ""} ${d.folder || ""} ${customerName[d.customer_id] || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [documents, search, activeFolder, customerName]);

  const triggerUpload = (folder: string) => {
    setUploadFolder(folder);
    setShowUploadMenu(false);
    // Defer so state-set folder is captured by onChange via ref read.
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        await documentsRepo.upload(file, { folder: uploadFolder });
      }
      showToast(
        files.length > 1
          ? `${files.length} files uploaded to ${uploadFolder}`
          : `"${files[0].name}" uploaded to ${uploadFolder}`,
        "success"
      );
    } catch (err: any) {
      showToast(err?.message ? `Upload failed: ${err.message}` : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const openDoc = (doc: any) => {
    if (!doc?.url) {
      showToast("No file URL available for this document", "error");
      return;
    }
    window.open(doc.url, "_blank", "noopener,noreferrer");
  };

  const confirmDelete = async () => {
    const doc = pendingDelete;
    if (!doc?.id) return;
    try {
      await documentsRepo.remove(doc.id);
      showToast(`"${doc.name}" deleted`, "success");
    } catch (err: any) {
      showToast(err?.message ? `Delete failed: ${err.message}` : "Delete failed", "error");
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-y-auto custom-scrollbar flex-col bg-zinc-950">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.png,.jpg,.jpeg,.gif,.webp,.heic,.dwg,image/*,application/pdf"
        className="hidden"
        onChange={handleFiles}
      />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-2">Document Vault</h2>
          <p className="text-xs text-white/50">Securely store and manage client files and contracts.</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-black border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-white/40 outline-none focus:border-forest-500/50 transition-colors"
            />
          </div>

          {/* Upload with folder picker */}
          <div className="relative">
            <button
              disabled={uploading}
              onClick={() => setShowUploadMenu((v) => !v)}
              className="bg-white text-black font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl hover:bg-white/90 transition-colors shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-60"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Uploading…" : "Upload File"}
            </button>

            {showUploadMenu && !uploading && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUploadMenu(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden p-1.5">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Upload to folder</p>
                  {FOLDERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => triggerUpload(f)}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold text-white/80 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
                    >
                      <Folder size={14} className="text-white/40" /> {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Folder filter cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {["Contracts", "Estimates", "Invoices", "Media"].map((f) => {
          const isActive = activeFolder === f;
          return (
            <button
              key={f}
              onClick={() => setActiveFolder(isActive ? null : f)}
              className={`bg-zinc-900 border rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-colors text-left ${
                isActive ? "border-forest-500/50 bg-forest-500/5" : "border-white/5 hover:bg-white/5 hover:border-white/20"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${FOLDER_STYLES[f] || FOLDER_STYLES.General}`}>
                <Folder size={18} fill="currentColor" fillOpacity={0.2} />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">{f}</h4>
                <p className="text-[10px] text-white/40">{folderCounts[f] || 0} Files</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex-1">
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-white/40">
            {activeFolder ? `${activeFolder} Documents` : "All Documents"}
          </h3>
          {activeFolder && (
            <button
              onClick={() => setActiveFolder(null)}
              className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <X size={12} /> Clear filter
            </button>
          )}
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-black/40">
                <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest font-mono">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest font-mono hidden md:table-cell">Folder</th>
                <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest font-mono hidden md:table-cell">Client</th>
                <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest font-mono hidden sm:table-cell">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest font-mono hidden lg:table-cell">Size</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Loader2 size={20} className="animate-spin text-white/40 mx-auto" />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-white/40">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <p className="text-sm font-bold text-white/60">
                        {search || activeFolder ? "No documents match your filter" : "No documents yet"}
                      </p>
                      <p className="text-xs text-white/40">Use “Upload File” to add contracts, estimates, and media.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((doc) => (
                  <tr key={doc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                          <FileText size={14} />
                        </div>
                        <button
                          onClick={() => openDoc(doc)}
                          className="font-bold text-white text-sm group-hover:text-forest-400 transition-colors cursor-pointer text-left"
                        >
                          {doc.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-white/5 text-white/50">
                        {doc.folder || "General"}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-xs text-white/60">
                      {doc.customer_id ? customerName[doc.customer_id] || "—" : "—"}
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell text-xs text-white/40">{humanizeDate(doc.created_at)}</td>
                    <td className="px-6 py-4 hidden lg:table-cell text-xs text-white/40">{humanizeBytes(doc.size_bytes)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <a
                          href={doc.url || "#"}
                          download={doc.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => { if (!doc.url) { e.preventDefault(); showToast("No file URL available", "error"); } }}
                          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => openDoc(doc)}
                          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                          title="Open / preview"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                            title="More"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openMenuId === doc.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden p-1.5">
                                <button
                                  onClick={() => { setOpenMenuId(null); openDoc(doc); }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-white/80 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
                                >
                                  <ExternalLink size={14} /> Open
                                </button>
                                <button
                                  onClick={() => { setOpenMenuId(null); setPendingDelete(doc); }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-3 transition-colors"
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete document"
        description={`Permanently delete "${pendingDelete?.name ?? ""}"? This removes the file and its record and cannot be undone.`}
        confirmText="Delete"
        danger
      />
    </div>
  );
};
