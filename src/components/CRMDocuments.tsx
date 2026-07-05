// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Customer } from "../types";
import {
  FileText, Folder, MoreVertical, Search, Upload, Download, ExternalLink,
  Loader2, Trash2, X, Sparkles, Check, AlertTriangle,
} from "lucide-react";
import { documentsRepo, expensesRepo, contractsRepo } from "../lib/repos";
import { useToast } from "../contexts/ToastContext";
import { fetchApi } from "../lib/api";
import { ConfirmDialog } from "./ConfirmDialog";

// Extraction kinds accepted by POST /api/documents/parse.
type ExtractKind = "vendor_invoice" | "contract" | "permit";

const EXTRACT_KIND_LABELS: Record<ExtractKind, string> = {
  vendor_invoice: "Vendor Invoice",
  contract: "Contract",
  permit: "Permit",
};

// Best-guess default extraction kind from the folder a doc lives in.
function defaultKindForDoc(doc: any): ExtractKind {
  const f = (doc?.folder || "").toLowerCase();
  if (f.includes("contract")) return "contract";
  if (f.includes("permit")) return "permit";
  return "vendor_invoice";
}

// Map a reviewed vendor-invoice draft (from vendorInvoiceToExpense on the server) to a Supabase
// `expenses` row. Mirrors toExpenseRow in Invoices.tsx: amount/merchant/category/date are columns;
// everything else nests into `data`. Nothing here re-derives money — the draft is authoritative.
function draftToExpenseRow(draft: any, doc: any) {
  return {
    amount: draft?.total ?? 0,
    merchant: draft?.vendor ?? "Unknown Vendor",
    category: "Supplies",
    date: draft?.date ?? null,
    data: {
      vendor: draft?.vendor ?? "Unknown Vendor",
      status: "cleared",
      source: "document_parse",
      documentId: doc?.id ?? null,
      lineItems: Array.isArray(draft?.items) ? draft.items : [],
      needsReview: !!draft?.needsReview,
      ...(draft?.jobId ? { jobId: draft.jobId } : {}),
      ...(draft?.customerId ? { customerId: draft.customerId } : {}),
    },
  };
}

function money(n: any): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "$0.00";
  return `$${v.toFixed(2)}`;
}

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

  // --- Document understanding ("Extract") state ---
  const [extractDoc, setExtractDoc] = useState<any | null>(null);
  const [extractKind, setExtractKind] = useState<ExtractKind>("vendor_invoice");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

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

  // --- Document understanding: open the Extract review modal for a doc ---
  const openExtract = (doc: any) => {
    setOpenMenuId(null);
    setExtractDoc(doc);
    setExtractKind(defaultKindForDoc(doc));
    setExtractResult(null);
    setExtractError(null);
    setExtractLoading(false);
  };

  const closeExtract = () => {
    setExtractDoc(null);
    setExtractResult(null);
    setExtractError(null);
    setExtractLoading(false);
    setSaving(false);
  };

  // Read a stored (private) document's bytes as a base64 data URL. Re-signs the storage path so a
  // stale long-lived signed URL doesn't 403; falls back to the persisted url.
  const loadDocBase64 = async (doc: any): Promise<{ base64: string; mimeType: string }> => {
    let url = doc?.url || null;
    if (doc?.storage_path) {
      try {
        const fresh = await documentsRepo.signedUrl(doc.storage_path, 600);
        if (fresh) url = fresh;
      } catch { /* fall back to the stored url */ }
    }
    if (!url) throw new Error("No file URL available for this document");
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Could not read the stored file");
    const blob = await resp.blob();
    const mimeType = blob.type || doc?.mime || "application/pdf";
    const base64: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("Could not read the stored file"));
      r.onloadend = () => resolve(String(r.result || ""));
      r.readAsDataURL(blob);
    });
    return { base64, mimeType };
  };

  // Run Gemini document understanding on the current doc. Result is shown for review — nothing is
  // written until the user confirms below.
  const runExtract = async (kind: ExtractKind) => {
    if (!extractDoc) return;
    setExtractKind(kind);
    setExtractLoading(true);
    setExtractError(null);
    setExtractResult(null);
    try {
      const { base64, mimeType } = await loadDocBase64(extractDoc);
      const res = await fetchApi("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          file: base64,
          mimeType,
          customerId: extractDoc?.customer_id || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Document parsing failed");
      setExtractResult(body);
    } catch (err: any) {
      setExtractError(err?.message || "Extraction failed");
    } finally {
      setExtractLoading(false);
    }
  };

  // Confirm a reviewed vendor-invoice draft → create a real expense (RLS-scoped repo).
  const confirmExpense = async () => {
    const draft = extractResult?.draft;
    if (!draft) return;
    setSaving(true);
    try {
      await expensesRepo.create(draftToExpenseRow(draft, extractDoc));
      showToast(`Expense created from "${extractDoc?.name || "document"}"`, "success");
      closeExtract();
    } catch (err: any) {
      showToast(err?.message ? `Could not create expense: ${err.message}` : "Could not create expense", "error");
    } finally {
      setSaving(false);
    }
  };

  // Confirm reviewed contract/permit fields → persist for review (RLS-scoped contracts repo).
  const saveFields = async () => {
    const fields = extractResult?.fields;
    if (!fields) return;
    setSaving(true);
    try {
      const parties = Array.isArray(fields.parties) ? fields.parties.filter(Boolean).join(", ") : "";
      await contractsRepo.create({
        name: fields.documentType
          ? `${fields.documentType}${parties ? " — " + parties : ""}`
          : extractDoc?.name || "Extracted Document",
        status: "review",
        customerId: extractDoc?.customer_id || undefined,
        data: {
          source: "document_parse",
          documentId: extractDoc?.id || null,
          kind: extractKind,
          extracted: fields,
        },
      });
      showToast("Extracted fields saved for review", "success");
      closeExtract();
    } catch (err: any) {
      showToast(err?.message ? `Could not save fields: ${err.message}` : "Could not save fields", "error");
    } finally {
      setSaving(false);
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
                        <button
                          onClick={() => openExtract(doc)}
                          className="w-8 h-8 rounded-full hover:bg-forest-500/10 flex items-center justify-center text-white/60 hover:text-forest-400 transition-colors"
                          title="Extract data with AI"
                        >
                          <Sparkles size={14} />
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
                                  onClick={() => openExtract(doc)}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-forest-400 hover:bg-forest-500/10 flex items-center gap-3 transition-colors"
                                >
                                  <Sparkles size={14} /> Extract data
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

      {extractDoc && (
        <ExtractModal
          doc={extractDoc}
          kind={extractKind}
          setKind={setExtractKind}
          loading={extractLoading}
          error={extractError}
          result={extractResult}
          saving={saving}
          onRun={runExtract}
          onConfirmExpense={confirmExpense}
          onSaveFields={saveFields}
          onClose={closeExtract}
        />
      )}
    </div>
  );
};

// --- Extract review modal ---------------------------------------------------
// Runs Gemini document understanding, then shows the STRUCTURED result for human review.
// Nothing is written until the user confirms: a vendor invoice becomes a draft expense the user
// creates; a contract/permit becomes structured fields the user saves.
const ExtractModal = ({
  doc, kind, setKind, loading, error, result, saving,
  onRun, onConfirmExpense, onSaveFields, onClose,
}: {
  doc: any;
  kind: ExtractKind;
  setKind: (k: ExtractKind) => void;
  loading: boolean;
  error: string | null;
  result: any | null;
  saving: boolean;
  onRun: (k: ExtractKind) => void;
  onConfirmExpense: () => void;
  onSaveFields: () => void;
  onClose: () => void;
}) => {
  const draft = result?.draft;
  const fields = result?.fields;
  const validation = result?.validation;
  const busy = loading || saving;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-forest-500/15 text-forest-400 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black uppercase tracking-widest text-white truncate">Extract data</h3>
              <p className="text-xs text-white/50 truncate">{doc?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Kind selector (hidden once a result is shown) */}
          {!result && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Document type</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(EXTRACT_KIND_LABELS) as ExtractKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    disabled={busy}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors border ${
                      kind === k
                        ? "bg-forest-500/15 text-forest-300 border-forest-500/40"
                        : "bg-black/40 text-white/60 border-white/10 hover:border-white/25"
                    } disabled:opacity-50`}
                  >
                    {EXTRACT_KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10 text-white/60">
              <Loader2 size={22} className="animate-spin text-forest-400" />
              <p className="text-sm font-bold">Reading the document…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-rose-400 mt-0.5 shrink-0" />
              <div className="text-sm text-rose-200">
                <p className="font-bold">Extraction failed</p>
                <p className="text-rose-300/80 text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Vendor invoice result → draft expense review */}
          {!loading && result && kind === "vendor_invoice" && draft && (
            <div className="space-y-4">
              {draft.needsReview && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-200">
                    <span className="font-bold">Needs review.</span>{" "}
                    {Array.isArray(validation?.errors) && validation.errors.length
                      ? validation.errors.join("; ")
                      : "Some fields could not be confidently extracted."}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-black/40 border border-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Vendor</p>
                  <p className="text-sm font-bold text-white mt-1 break-words">{draft.vendor}</p>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Date</p>
                  <p className="text-sm font-bold text-white mt-1">{draft.date || "—"}</p>
                </div>
              </div>

              <div className="rounded-xl bg-black/40 border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-white/40">
                      <th className="px-3 py-2 font-bold">Description</th>
                      <th className="px-3 py-2 font-bold text-right">Qty</th>
                      <th className="px-3 py-2 font-bold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.items || []).length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-4 text-center text-xs text-white/40">No line items detected</td></tr>
                    ) : (
                      draft.items.map((it: any, i: number) => (
                        <tr key={i} className="border-b border-white/5 last:border-0">
                          <td className="px-3 py-2 text-white/80">{it.description || "—"}</td>
                          <td className="px-3 py-2 text-right text-white/60">{it.quantity}</td>
                          <td className="px-3 py-2 text-right text-white/80 font-mono">{money(it.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white/5">
                      <td className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/40" colSpan={2}>Total</td>
                      <td className="px-3 py-2 text-right font-black text-white font-mono">{money(draft.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirmExpense}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-forest-500 text-black hover:bg-forest-400 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? "Creating…" : "Create expense"}
                </button>
              </div>
            </div>
          )}

          {/* Contract / permit result → structured field review */}
          {!loading && result && kind !== "vendor_invoice" && fields && (
            <div className="space-y-4">
              <div className="space-y-2">
                {[
                  ["Type", fields.documentType],
                  ["Parties", Array.isArray(fields.parties) ? fields.parties.filter(Boolean).join(", ") : fields.parties],
                  ["Effective", fields.effectiveDate],
                  ["Expires", fields.expirationDate],
                  ["Value", fields.totalValue != null ? money(fields.totalValue) : null],
                  ["Scope", fields.scopeOfWork],
                  ["Permit #", fields.permitNumber],
                  ["Authority", fields.issuingAuthority],
                  ["Jurisdiction", fields.jurisdiction],
                ]
                  .filter(([, v]) => v != null && String(v).trim() !== "")
                  .map(([label, v]) => (
                    <div key={String(label)} className="flex gap-3 rounded-xl bg-black/40 border border-white/5 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-24 shrink-0 pt-0.5">{label}</p>
                      <p className="text-sm text-white/85 break-words">{String(v)}</p>
                    </div>
                  ))}
              </div>

              {(Array.isArray(fields.keyTerms) && fields.keyTerms.length > 0) && (
                <div className="rounded-xl bg-black/40 border border-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Key terms</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-white/80">
                    {fields.keyTerms.map((t: any, i: number) => <li key={i}>{String(t)}</li>)}
                  </ul>
                </div>
              )}
              {(Array.isArray(fields.obligations) && fields.obligations.length > 0) && (
                <div className="rounded-xl bg-black/40 border border-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Obligations</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-white/80">
                    {fields.obligations.map((t: any, i: number) => <li key={i}>{String(t)}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={onSaveFields}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-forest-500 text-black hover:bg-forest-400 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? "Saving…" : "Save fields"}
                </button>
              </div>
            </div>
          )}

          {/* Idle: prompt to run */}
          {!loading && !error && !result && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onRun(kind)}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-forest-500 text-black hover:bg-forest-400 transition-colors flex items-center gap-2"
              >
                <Sparkles size={14} /> Run extraction
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
