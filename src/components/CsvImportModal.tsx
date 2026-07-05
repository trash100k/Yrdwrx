// @ts-nocheck
// Reusable CSV import wizard for customers AND inventory.
// Flow: pick file -> map arbitrary headers to fields -> preview a dedupe plan (create/update/
// review/skip) -> resolve near-dupes -> execute through the RLS-scoped repo. Re-importing the
// same file updates matched rows instead of creating duplicates (see src/lib/csvImport.ts).
import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, ArrowRight, ArrowLeft, Check, AlertTriangle, X, FileText } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useToast } from "../contexts/ToastContext";
import {
  guessMapping,
  mapRow,
  buildImportPlan,
} from "../lib/csvImport";
import { executeImportPlan } from "../lib/csvImportExec";

const ACTION_STYLES = {
  create: { label: "New", cls: "text-forest-400 bg-forest-500/10 border-forest-500/20" },
  update: { label: "Update", cls: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  review: { label: "Review", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  skip: { label: "Skip", cls: "text-zinc-500 bg-white/5 border-white/10" },
};

// Resolution options presented for each `review` (near-duplicate) row.
const REVIEW_RESOLUTIONS = [
  { value: "update", label: "Merge into match" },
  { value: "create", label: "Import as new" },
  { value: "skip", label: "Skip" },
];

export function CsvImportModal({
  isOpen,
  onClose,
  entityLabel, // "customers" | "inventory items"
  fields, // FieldDef[]
  matchConfig, // MatchConfig
  existing, // existing rows (with id) for dedupe
  repo, // { create, update }
  toRow = (r) => r, // shape mapped row -> repo columns
  onComplete,
}) {
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [step, setStep] = useState(0); // 0 pick, 1 map, 2 preview, 3 done
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [resolutions, setResolutions] = useState({}); // decisionIndex -> "update"|"create"|"skip"
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep(0);
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setResolutions({});
    setResult(null);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: true, // parse off the main thread so large files don't freeze the UI
      complete: (res) => {
        const hs = (res.meta?.fields || []).filter(Boolean);
        const rows = (res.data || []).filter((r) => r && Object.values(r).some((v) => String(v ?? "").trim() !== ""));
        if (!hs.length || !rows.length) {
          showToast("That file has no readable rows.", "error");
          return;
        }
        setHeaders(hs);
        setRawRows(rows);
        setMapping(guessMapping(hs, fields));
        setStep(1);
      },
      error: () => showToast("Failed to parse CSV file.", "error"),
    });
  };

  // Mapped + sanitized rows for the current mapping.
  const mappedRows = useMemo(
    () => (step >= 1 ? rawRows.map((r) => mapRow(r, mapping, fields)) : []),
    [rawRows, mapping, fields, step],
  );

  const plan = useMemo(
    () => (step >= 2 ? buildImportPlan(mappedRows, existing || [], matchConfig) : null),
    [mappedRows, existing, matchConfig, step],
  );

  // Fields that at least one column maps to — used to warn if nothing meaningful is mapped.
  const mappedFieldCount = useMemo(
    () => new Set(Object.values(mapping).filter(Boolean)).size,
    [mapping],
  );

  // Default a near-dup ("review") to "merge into match" when there's a single match, else to
  // "import as new" (an ambiguous multi-match has candidates but no single merge target).
  const reviewDefault = (d) => (d.matchId ? "update" : "create");
  const effectiveAction = (d) => resolutions[d.index] || (d.action === "review" ? reviewDefault(d) : d.action);

  const summary = useMemo(() => {
    if (!plan) return null;
    const c = { create: 0, update: 0, skip: 0 };
    for (const d of plan.decisions) {
      const a = effectiveAction(d);
      c[a === "review" ? "update" : a] = (c[a === "review" ? "update" : a] || 0) + 1;
    }
    return c;
  }, [plan, resolutions]);

  const runImport = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const resolved = plan.decisions.map((d) => ({
        index: d.index,
        action: effectiveAction(d),
        matchId: d.matchId,
        row: d.row,
      }));
      const res = await executeImportPlan(resolved, repo, toRow);
      setResult(res);
      setStep(3);
      const msg = `Imported: ${res.created} new, ${res.updated} updated, ${res.skipped} skipped` +
        (res.errors.length ? `, ${res.errors.length} failed` : "");
      showToast(msg, res.errors.length ? "info" : "success");
      onComplete?.(res);
    } catch (e) {
      showToast("Import failed: " + (e?.message || "unknown error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const previewRows = plan?.decisions?.slice(0, 100) || [];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Import ${entityLabel}`} maxWidth="4xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-[10px] uppercase tracking-wider font-bold">
        {["Upload", "Map columns", "Preview & dedupe", "Done"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-lg border ${i <= step ? "text-forest-400 border-forest-500/30 bg-forest-500/10" : "text-zinc-600 border-white/5"}`}>
              {i + 1}. {s}
            </span>
            {i < 3 && <ArrowRight size={12} className="text-zinc-700" />}
          </div>
        ))}
      </div>

      {/* Step 0 — pick file */}
      {step === 0 && (
        <div className="text-center py-8">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" id="csv-import-file" />
          <label
            htmlFor="csv-import-file"
            className="mx-auto flex flex-col items-center gap-3 max-w-md p-10 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-forest-500/40 hover:bg-forest-500/5 transition-all"
          >
            <Upload size={32} className="text-forest-400" />
            <span className="font-bold text-white">Choose a CSV file</span>
            <span className="text-xs text-zinc-500">
              Any column layout — you'll map columns next. Re-importing the same file updates
              your existing {entityLabel} instead of duplicating them.
            </span>
          </label>
        </div>
      )}

      {/* Step 1 — map columns */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <FileText size={14} /> {fileName} · {rawRows.length} rows · {headers.length} columns
          </div>
          <div className="border border-white/5 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-white/5 text-[10px] uppercase tracking-wider font-bold text-zinc-500">
              <div className="bg-zinc-950 px-4 py-2">CSV Column</div>
              <div className="bg-zinc-950 px-4 py-2">Maps to field</div>
            </div>
            <div className="max-h-[45vh] overflow-y-auto custom-scrollbar divide-y divide-white/5">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-2 gap-4 items-center px-4 py-2">
                  <div className="text-sm text-white truncate" title={h}>
                    {h}
                    <span className="block text-[10px] text-zinc-600 truncate">
                      e.g. {String(rawRows[0]?.[h] ?? "").slice(0, 32) || "—"}
                    </span>
                  </div>
                  <select
                    value={mapping[h] || ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                    className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-forest-500/50 outline-none"
                  >
                    <option value="">— Ignore —</option>
                    {fields.map((f) => (
                      <option key={f.field} value={f.field}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          {mappedFieldCount === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle size={14} /> Map at least one column to a field to continue.
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" leftIcon={<ArrowLeft size={14} />} onClick={reset}>Back</Button>
            <Button variant="forest" rightIcon={<ArrowRight size={14} />} disabled={mappedFieldCount === 0} onClick={() => setStep(2)}>
              Preview
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — preview & dedupe */}
      {step === 2 && plan && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {(["create", "update", "review", "skip"]).map((k) => (
              <div key={k} className={`rounded-xl border p-3 text-center ${ACTION_STYLES[k].cls}`}>
                <div className="text-2xl font-bold">{plan.counts[k]}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold">{ACTION_STYLES[k].label}</div>
              </div>
            ))}
          </div>
          {plan.counts.review > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle size={14} /> {plan.counts.review} possible duplicate(s) need your call below.
            </div>
          )}

          <div className="border border-white/5 rounded-2xl overflow-hidden">
            <div className="max-h-[42vh] overflow-y-auto custom-scrollbar divide-y divide-white/5">
              {previewRows.map((d) => {
                const a = effectiveAction(d);
                const style = ACTION_STYLES[a === "review" ? "review" : a];
                return (
                  <div key={d.index} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] uppercase font-bold ${style.cls}`}>
                      {style.label}
                    </span>
                    <span className="text-white truncate flex-1">{matchConfig.displayName(d.row)}</span>
                    {d.action === "review" ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-amber-400/80 truncate max-w-[220px]" title={d.reason}>{d.reason}</span>
                        <select
                          value={resolutions[d.index] || reviewDefault(d)}
                          onChange={(e) => setResolutions((r) => ({ ...r, [d.index]: e.target.value }))}
                          className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        >
                          {REVIEW_RESOLUTIONS.filter((o) => o.value !== "update" || d.matchId).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-600 truncate max-w-[220px]" title={d.reason}>{d.reason}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {plan.decisions.length > previewRows.length && (
              <div className="px-4 py-2 text-[10px] text-zinc-600 bg-zinc-950">
                Showing first {previewRows.length} of {plan.decisions.length} rows — all {plan.decisions.length} will be imported.
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <Button variant="ghost" leftIcon={<ArrowLeft size={14} />} onClick={() => setStep(1)}>Back to mapping</Button>
            <Button variant="forest" isLoading={busy} leftIcon={<Check size={14} />} onClick={runImport}>
              {summary ? `Import ${summary.create} new + ${summary.update} updated` : "Import"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — done */}
      {step === 3 && result && (
        <div className="text-center py-8 space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-forest-500/10 border border-forest-500/30 flex items-center justify-center">
            <Check size={28} className="text-forest-400" />
          </div>
          <div className="text-white font-bold text-lg">Import complete</div>
          <div className="text-sm text-zinc-400">
            {result.created} created · {result.updated} updated · {result.skipped} skipped
            {result.errors.length > 0 && (
              <span className="block text-rose-400 mt-1">{result.errors.length} row(s) failed — see console.</span>
            )}
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={reset}>Import another</Button>
            <Button variant="forest" onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
