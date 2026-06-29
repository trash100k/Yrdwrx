// @ts-nocheck
import React, { useState } from "react";
import { motion } from "motion/react";
import {
  CheckCircle2,
  FileText,
  CalendarPlus,
  Package,
  StickyNote,
  Plus,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { ConfidenceDot, RiskLevel } from "./ConfidenceDot";

// ---------------------------------------------------------------------------
// Discriminated action model. The server (/api/agent/closeout) emits these; the
// stack lets the user edit them inline before execution.
// ---------------------------------------------------------------------------
export type LineItem = { description: string; amount: number | null; fromCatalog?: boolean };

export type CloseoutAction =
  | { id: string; type: "close_job"; risk: RiskLevel; title: string; durationMinutes?: number | null }
  | {
      id: string;
      type: "invoice";
      risk: RiskLevel;
      title: string;
      lineItems: LineItem[];
      total: number | null;
    }
  | { id: string; type: "schedule"; risk: RiskLevel; title: string; when?: string | null }
  | { id: string; type: "inventory"; risk: RiskLevel; title: string; item?: string; action?: string }
  | { id: string; type: "note"; risk: RiskLevel; title: string; content?: string };

const TYPE_META: Record<CloseoutAction["type"], { icon: any; tint: string; label: string }> = {
  close_job: { icon: CheckCircle2, tint: "text-forest-400", label: "Close Job" },
  invoice: { icon: FileText, tint: "text-rose-400", label: "Invoice" },
  schedule: { icon: CalendarPlus, tint: "text-amber-400", label: "Schedule" },
  inventory: { icon: Package, tint: "text-sky-400", label: "Inventory" },
  note: { icon: StickyNote, tint: "text-zinc-300", label: "Note" },
};

interface ActionCardProps {
  action: CloseoutAction;
  /** Whether this card is selected for execution (the checkbox). */
  selected: boolean;
  onToggle: (id: string, next: boolean) => void;
  /** Patch the action in place (inline edits). */
  onChange: (id: string, patch: Partial<CloseoutAction>) => void;
  /** Whether a high-risk action has been explicitly confirmed. */
  confirmed?: boolean;
  onConfirm?: (id: string) => void;
}

const labelCls = "text-[10px] font-black uppercase tracking-widest text-zinc-500";
const fieldCls =
  "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-base focus:border-forest-500 outline-none min-h-[52px]";

/**
 * Reusable, typed closeout action card. Renders type-specific inline-editable
 * fields and obeys the risk tier (low pre-checked, medium one-tap, high invoice
 * requires explicit confirm). This is the core primitive of the closeout flow.
 */
export function ActionCard({ action, selected, onToggle, onChange, confirmed, onConfirm }: ActionCardProps) {
  const meta = TYPE_META[action.type] || TYPE_META.note;
  const Icon = meta.icon;
  const isHighInvoice = action.type === "invoice" && action.risk === "high";
  const needsConfirm = isHighInvoice && !confirmed;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`rounded-2xl border p-5 transition-colors ${
        selected ? "bg-zinc-900/80 border-white/15" : "bg-zinc-950/60 border-white/5"
      }`}
    >
      {/* Header: checkbox + icon + title + risk dot */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => onToggle(action.id, !selected)}
          aria-label={selected ? "Deselect" : "Select"}
          className={`shrink-0 w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-colors ${
            selected
              ? "bg-forest-500 border-forest-500 text-black"
              : "border-white/25 text-transparent hover:border-white/50"
          }`}
        >
          <CheckCircle2 size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icon size={18} className={`${meta.tint} shrink-0`} />
              <span className={`${labelCls} ${meta.tint}`}>{meta.label}</span>
            </div>
            <ConfidenceDot risk={action.risk} />
          </div>
          <h3 className="text-lg font-bold text-white leading-snug mt-1">{action.title}</h3>
        </div>
      </div>

      {/* Type-specific editable body */}
      <div className="mt-4 space-y-3">{renderBody(action, onChange)}</div>

      {/* High-risk invoice gate */}
      {needsConfirm && selected && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3">
          <ShieldAlert size={18} className="text-rose-400 shrink-0" />
          <p className="text-rose-200/80 text-xs font-bold uppercase tracking-wide flex-1">
            This bills the client. Confirm to arm it.
          </p>
          <button
            onClick={() => onConfirm?.(action.id)}
            className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black uppercase tracking-widest transition-colors min-h-[44px]"
          >
            Confirm
          </button>
        </div>
      )}
      {isHighInvoice && confirmed && selected && (
        <div className="mt-3 text-[11px] font-black uppercase tracking-widest text-rose-300/80 flex items-center gap-2">
          <ShieldAlert size={12} /> Armed — will bill on Do All
        </div>
      )}
    </motion.div>
  );
}

// --- Type-specific bodies --------------------------------------------------
function renderBody(action: CloseoutAction, onChange: ActionCardProps["onChange"]) {
  switch (action.type) {
    case "close_job":
      return (
        <div>
          <label className={labelCls}>Duration (min)</label>
          <input
            type="number"
            inputMode="numeric"
            value={action.durationMinutes ?? ""}
            placeholder="optional"
            onChange={(e) =>
              onChange(action.id, {
                durationMinutes: e.target.value === "" ? null : Number(e.target.value),
              } as any)
            }
            className={`${fieldCls} mt-1 max-w-[160px]`}
          />
        </div>
      );

    case "invoice":
      return <InvoiceBody action={action} onChange={onChange} />;

    case "schedule":
      return (
        <div>
          <label className={labelCls}>When</label>
          <input
            type="text"
            value={action.when ?? ""}
            placeholder='e.g. "next Tuesday morning"'
            onChange={(e) => onChange(action.id, { when: e.target.value } as any)}
            className={`${fieldCls} mt-1`}
          />
        </div>
      );

    case "inventory":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Item</label>
            <input
              type="text"
              value={action.item ?? ""}
              placeholder="item"
              onChange={(e) => onChange(action.id, { item: e.target.value } as any)}
              className={`${fieldCls} mt-1`}
            />
          </div>
          <div>
            <label className={labelCls}>Action</label>
            <input
              type="text"
              value={action.action ?? "reorder"}
              onChange={(e) => onChange(action.id, { action: e.target.value } as any)}
              className={`${fieldCls} mt-1`}
            />
          </div>
        </div>
      );

    case "note":
      return (
        <div>
          <label className={labelCls}>Note</label>
          <textarea
            value={action.content ?? action.title ?? ""}
            placeholder="Saved to knowledge base"
            onChange={(e) => onChange(action.id, { content: e.target.value } as any)}
            className={`${fieldCls} mt-1 min-h-[80px] leading-relaxed`}
          />
        </div>
      );

    default:
      return null;
  }
}

function InvoiceBody({ action, onChange }: { action: any; onChange: ActionCardProps["onChange"] }) {
  const items: LineItem[] = action.lineItems || [];

  const patchItem = (idx: number, patch: Partial<LineItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(action.id, { lineItems: next, total: sum(next) } as any);
  };
  const addItem = () => {
    const next = [...items, { description: "", amount: 0, fromCatalog: false }];
    onChange(action.id, { lineItems: next, total: sum(next) } as any);
  };
  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(action.id, { lineItems: next, total: sum(next) } as any);
  };

  return (
    <div className="space-y-2">
      <label className={labelCls}>Line Items</label>
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={it.description}
            placeholder="Description"
            onChange={(e) => patchItem(idx, { description: e.target.value })}
            className={`${fieldCls} flex-1`}
          />
          <div className="relative w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-base">$</span>
            <input
              type="number"
              inputMode="decimal"
              value={it.amount ?? ""}
              placeholder="0"
              onChange={(e) =>
                patchItem(idx, {
                  amount: e.target.value === "" ? null : Number(e.target.value),
                  fromCatalog: false,
                })
              }
              className={`${fieldCls} pl-7 tabular-nums`}
            />
          </div>
          <button
            onClick={() => removeItem(idx)}
            aria-label="Remove line item"
            className="shrink-0 w-11 h-11 rounded-xl bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-black uppercase tracking-widest transition-colors min-h-[44px]"
      >
        <Plus size={14} /> Add Line
      </button>

      <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/10">
        <span className={labelCls}>Total</span>
        <div className="flex items-center gap-1">
          <span className="text-zinc-500 text-lg">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={action.total ?? sum(items)}
            onChange={(e) =>
              onChange(action.id, { total: e.target.value === "" ? 0 : Number(e.target.value) } as any)
            }
            className="w-28 bg-transparent text-right text-2xl font-black text-white tabular-nums outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function sum(items: LineItem[]): number {
  return items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
}

export default ActionCard;
