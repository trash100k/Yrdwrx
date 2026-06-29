// @ts-nocheck
// Pure, dependency-free undo/redo history + provenance helpers for the Design Studio
// render iteration loop. No imports, no browser/node APIs — bundles into both the
// frontend and the server. All functions are pure (return new objects, never mutate
// their inputs). Timestamps are passed IN so behavior stays deterministic/testable.

export interface RenderSnapshot {
  image: string;                 // the composited render data-url (the "HEAD")
  regions?: any[];
  labels?: Record<string, string>;
  provenance?: any;
  ts?: number;
}

export interface HistoryState {
  stack: RenderSnapshot[];
  index: number;
}

// Maximum number of snapshots retained in a history stack. Older snapshots are
// dropped (FIFO) once a push would exceed this cap.
const MAX_HISTORY = 20;

// Create a fresh history. An empty history is { stack: [], index: -1 }.
export function historyInit(initial?: RenderSnapshot | null): HistoryState {
  if (initial == null) {
    return { stack: [], index: -1 };
  }
  return { stack: [initial], index: 0 };
}

// Append a new snapshot at the current HEAD. Any redo tail (snapshots after the
// current index) is discarded. The stack is capped at MAX_HISTORY by dropping the
// oldest entries; the index always lands on the newest snapshot.
export function historyPush(h: HistoryState, snap: RenderSnapshot): HistoryState {
  // Truncate redo tail, then append the new snapshot.
  let stack = h.stack.slice(0, h.index + 1);
  stack = stack.concat([snap]);
  // Cap the stack length, dropping the oldest entries.
  if (stack.length > MAX_HISTORY) {
    stack = stack.slice(stack.length - MAX_HISTORY);
  }
  return { stack, index: stack.length - 1 };
}

// Move one step back in history. No-op on an empty history; clamps at 0.
export function historyUndo(h: HistoryState): HistoryState {
  if (h.stack.length === 0) {
    return { stack: h.stack.slice(), index: -1 };
  }
  return { stack: h.stack.slice(), index: Math.max(0, h.index - 1) };
}

// Move one step forward in history. Clamps at the newest snapshot.
export function historyRedo(h: HistoryState): HistoryState {
  if (h.stack.length === 0) {
    return { stack: h.stack.slice(), index: -1 };
  }
  return { stack: h.stack.slice(), index: Math.min(h.stack.length - 1, h.index + 1) };
}

// The snapshot at the current HEAD, or null when the history is empty / unpositioned.
export function historyCurrent(h: HistoryState): RenderSnapshot | null {
  if (h.index < 0 || h.index >= h.stack.length) {
    return null;
  }
  return h.stack[h.index];
}

export function canUndo(h: HistoryState): boolean {
  return h.index > 0;
}

export function canRedo(h: HistoryState): boolean {
  return h.index < h.stack.length - 1;
}

// Build a provenance record to persist alongside a saved design: what model/version
// produced it, when, and from what source. Gemini image outputs carry an embedded
// SynthID watermark, so synthId is always true. createdAt is derived from the passed-in
// timestamp (no Date.now() call here — keep this deterministic).
export function buildProvenance(opts: {
  model: string;
  prompt?: string;
  sourceHash?: string;
  zone?: number | null;
  regionCount?: number;
  ts: number;
}): {
  model: string;
  prompt?: string;
  sourceHash?: string;
  zone?: number | null;
  regionCount?: number;
  createdAt: string;
  synthId: boolean;
} {
  return {
    model: opts.model,
    prompt: opts.prompt,
    sourceHash: opts.sourceHash,
    zone: opts.zone,
    regionCount: opts.regionCount,
    createdAt: new Date(opts.ts).toISOString(),
    synthId: true,
  };
}
