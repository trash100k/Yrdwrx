// @ts-nocheck
// "Merge duplicate customers" action. Surfaces duplicate GROUPS (exact-key + fuzzy near-dup)
// found in the current client book, lets the owner pick the survivor per group, then reassigns
// the loser's jobs/invoices/tasks/etc. to the survivor and archives the loser (soft-delete).
// No jobs or invoices are ever orphaned — child records move first, then the loser is archived.
import React, { useMemo, useState } from "react";
import { Users, ArrowRight, Check, AlertTriangle, Crown } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useToast } from "../contexts/ToastContext";
import { findDuplicateGroups, customerMatch } from "../lib/csvImport";
import { mergeCustomers } from "../lib/csvImportExec";

const nameOf = (c) =>
  `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.companyName || c.email || c.phone || "(unnamed)";
const detailOf = (c) => [c.email, c.phone, c.address].filter(Boolean).join(" · ") || "no contact info";

export function MergeCustomersModal({ isOpen, onClose, customers, onMerged }) {
  const { showToast } = useToast();
  const [survivorByGroup, setSurvivorByGroup] = useState({}); // groupKey -> survivorId
  const [busyKey, setBusyKey] = useState(null);
  const [mergedKeys, setMergedKeys] = useState(new Set());

  const withId = useMemo(() => (customers || []).filter((c) => c && c.id), [customers]);

  const groups = useMemo(() => {
    if (!isOpen) return [];
    return findDuplicateGroups(withId, customerMatch).map((g, i) => ({
      ...g,
      key: `${g.confidence}-${g.members.map((m) => m.id).join("-")}-${i}`,
    }));
  }, [withId, isOpen]);

  const survivorFor = (g) => survivorByGroup[g.key] || g.members[0].id;

  const doMerge = async (g) => {
    const survivorId = survivorFor(g);
    const losers = g.members.filter((m) => m.id !== survivorId);
    const survivor = g.members.find((m) => m.id === survivorId);
    if (!losers.length) return;
    setBusyKey(g.key);
    try {
      let reassignedTotal = 0;
      for (const loser of losers) {
        const res = await mergeCustomers(survivorId, loser.id, { survivor, loser });
        reassignedTotal += Object.values(res.reassigned || {}).reduce((a, b) => a + b, 0);
        if (res.errors?.length) {
          // Non-fatal per-table issues (e.g. a table absent in this deployment) — surface, don't block.
          console.warn("[merge] partial errors", res.errors);
        }
      }
      setMergedKeys((prev) => new Set(prev).add(g.key));
      showToast(
        `Merged ${losers.length + 1} records into ${nameOf(survivor)} · ${reassignedTotal} linked record(s) reassigned`,
        "success",
      );
      onMerged?.();
    } catch (e) {
      showToast("Merge failed: " + (e?.message || "unknown error"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const activeGroups = groups.filter((g) => !mergedKeys.has(g.key));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Merge duplicate customers" maxWidth="3xl">
      {activeGroups.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-forest-500/10 border border-forest-500/30 flex items-center justify-center">
            <Check size={28} className="text-forest-400" />
          </div>
          <div className="text-white font-bold">
            {groups.length === 0 ? "No duplicates found" : "All duplicates resolved"}
          </div>
          <div className="text-xs text-zinc-500 max-w-sm mx-auto">
            We scan on email, phone, and name+address (exact) plus close name matches (near). Your
            client book looks clean.
          </div>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-zinc-400">
            {activeGroups.length} duplicate group(s). Pick the record to keep (the survivor) — the
            others' jobs, invoices, tasks and messages move to it before they're archived.
          </div>
          {activeGroups.map((g) => {
            const survivorId = survivorFor(g);
            return (
              <div key={g.key} className="border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] uppercase font-bold ${g.confidence === "exact" ? "text-sky-400 bg-sky-500/10 border-sky-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"}`}>
                    {g.confidence === "exact" ? "Exact" : "Likely"}
                  </span>
                  <span className="text-[11px] text-zinc-500">{g.reason}</span>
                </div>
                <div className="grid gap-2">
                  {g.members.map((m) => {
                    const isSurvivor = m.id === survivorId;
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSurvivor ? "border-forest-500/40 bg-forest-500/5" : "border-white/5 hover:bg-white/5"}`}
                      >
                        <input
                          type="radio"
                          name={`survivor-${g.key}`}
                          checked={isSurvivor}
                          onChange={() => setSurvivorByGroup((s) => ({ ...s, [g.key]: m.id }))}
                          className="accent-forest-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate flex items-center gap-2">
                            {isSurvivor && <Crown size={12} className="text-forest-400 shrink-0" />}
                            {nameOf(m)}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate">{detailOf(m)}</div>
                        </div>
                        <span className="text-[10px] text-zinc-600 shrink-0">
                          {isSurvivor ? "Keep" : "Archive"}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="forest"
                    size="sm"
                    isLoading={busyKey === g.key}
                    leftIcon={<Users size={14} />}
                    rightIcon={<ArrowRight size={14} />}
                    onClick={() => doMerge(g)}
                  >
                    Merge {g.members.length} into 1
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <AlertTriangle size={12} /> Archived records go to Trash and can be restored — history is never lost.
          </div>
        </div>
      )}
    </Modal>
  );
}
