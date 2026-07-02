// @ts-nocheck
//
// Offline write queue. Mutations made while offline are persisted to localStorage and
// flushed to SUPABASE (via the repo layer) when connectivity returns. This used to flush
// to Firestore (the dead project), so offline field writes were silently lost — now each
// queued action is dispatched to the matching repo, which RLS-scopes it to the tenant.
//
// Hardening (multi-tab / crash safety):
//   1. SINGLE-FLUSHER: only one tab drains the queue at a time. Uses the Web Locks API
//      (navigator.locks, name "yw-sync-flush") when available, else a localStorage lease
//      lock (owner id + expiry, with stale-lock takeover when the holder dies).
//   2. DEAD-LETTER: each queued op carries an attempt counter; after MAX_ATTEMPTS (5)
//      failed flushes it is moved to a persisted dead-letter list instead of blocking
//      the queue forever (poison-pill protection). See getDeadLetter()/retryDeadLetter().
//   3. IDEMPOTENCY: every op gets a stable id at enqueue. Successfully-applied ids are
//      recorded in a persisted ring buffer (~200 entries) BEFORE the op is dequeued, so
//      a crash between "applied at server" and "removed from queue" is skipped on the
//      next flush instead of double-applied.
//
// The pure decision helpers (lease validity, attempt bookkeeping, queue/ring merging)
// are exported below and unit-tested in ./syncService.test.ts.

import { safeStorage } from "../lib/storage";
import {
  customersRepo,
  jobsRepo,
  leadsRepo,
  materialLogsRepo,
  invoicesRepo,
  expensesRepo,
  reviewsRepo,
  inventoryRepo,
  crewsRepo,
  vendorsRepo,
  knowledgeRepo,
  designCatalogRepo,
  contractsRepo,
  inspectionFormsRepo,
  designVisionsRepo,
  tasksRepo,
  timesheetsRepo,
} from "../lib/repos";

// Map a queued collection name (Firestore-era camelCase OR Supabase snake_case) to its repo.
const REPOS: Record<string, any> = {
  customers: customersRepo,
  jobs: jobsRepo,
  leads: leadsRepo,
  materialLogs: materialLogsRepo,
  material_logs: materialLogsRepo,
  invoices: invoicesRepo,
  expenses: expensesRepo,
  reviews: reviewsRepo,
  inventory: inventoryRepo,
  crews: crewsRepo,
  vendors: vendorsRepo,
  knowledge: knowledgeRepo,
  designCatalog: designCatalogRepo,
  design_catalog: designCatalogRepo,
  contracts: contractsRepo,
  inspectionForms: inspectionFormsRepo,
  inspection_forms: inspectionFormsRepo,
  designVisions: designVisionsRepo,
  customer_design_visions: designVisionsRepo,
  tasks: tasksRepo,
  timesheets: timesheetsRepo,
};

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export interface PendingAction {
  id: string;
  type: "CREATE" | "UPDATE" | "DELETE";
  collection: string;
  docId?: string;
  tenantId: string;
  data: Record<string, unknown>;
  timestamp: number;
  /** Failed-flush counter. Optional for back-compat with pre-hardening persisted queues. */
  attempts?: number;
}

export interface DeadLetterItem extends PendingAction {
  attempts: number;
  lastError?: string;
  deadAt: number;
}

export interface LockLease {
  owner: string;
  expiresAt: number;
}

/** Minimal storage surface the pure lease helpers operate on (localStorage-shaped). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = "terramind_sync_queue";
const DEAD_LETTER_KEY = "terramind_sync_dead_letter";
const APPLIED_KEY = "terramind_sync_applied";
const LEASE_KEY = "terramind_sync_flush_lease";
const FLUSH_LOCK_NAME = "yw-sync-flush";

/** Failed flushes before an op is moved to the dead-letter list. */
export const MAX_ATTEMPTS = 5;
/** Size of the persisted applied-op-id ring buffer used for idempotent replay. */
export const APPLIED_RING_CAP = 200;
/** localStorage lease lifetime; renewed after each drained item, stale after expiry. */
export const LEASE_TTL_MS = 30_000;

// ---------------------------------------------------------------------------
// Pure decision logic (exported for unit tests — no window/DOM access in here)
// ---------------------------------------------------------------------------

/** Stable per-op id, assigned once at enqueue time (the idempotency key). */
export function newOpId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

/** Parse a persisted lease; returns null for missing/corrupt/wrong-shape values. */
export function parseLease(raw: string | null | undefined): LockLease | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.owner === "string" &&
      parsed.owner.length > 0 &&
      typeof parsed.expiresAt === "number" &&
      Number.isFinite(parsed.expiresAt)
    ) {
      return { owner: parsed.owner, expiresAt: parsed.expiresAt };
    }
  } catch {
    /* corrupt — treat as no lease */
  }
  return null;
}

/** A lease is valid while its expiry is strictly in the future. */
export function isLeaseValid(lease: LockLease | null | undefined, now: number): boolean {
  return !!lease && lease.expiresAt > now;
}

/**
 * Try to take the flush lease. Succeeds when the slot is free, the current lease is
 * expired/corrupt (stale-lock takeover), or we already own it (re-entrant renew).
 * localStorage has no compare-and-swap, so a read-back verifies we won any same-instant
 * race — the loser observes the winner's write and backs off.
 */
export function tryAcquireLease(
  storage: StorageLike,
  key: string,
  ownerId: string,
  ttlMs: number,
  now: number,
): boolean {
  const current = parseLease(storage.getItem(key));
  if (isLeaseValid(current, now) && current!.owner !== ownerId) return false;
  storage.setItem(key, JSON.stringify({ owner: ownerId, expiresAt: now + ttlMs }));
  const check = parseLease(storage.getItem(key));
  return !!check && check.owner === ownerId;
}

/** Extend a lease we still own; refuses to touch someone else's lease. */
export function renewLease(
  storage: StorageLike,
  key: string,
  ownerId: string,
  ttlMs: number,
  now: number,
): boolean {
  const current = parseLease(storage.getItem(key));
  if (!current || current.owner !== ownerId) return false;
  storage.setItem(key, JSON.stringify({ owner: ownerId, expiresAt: now + ttlMs }));
  return true;
}

/** Release a lease only if we own it (never clobber another tab's lease). */
export function releaseLease(storage: StorageLike, key: string, ownerId: string): void {
  const current = parseLease(storage.getItem(key));
  if (current && current.owner === ownerId) storage.removeItem(key);
}

/**
 * Attempt bookkeeping for a failed flush: returns a NEW action with the counter
 * bumped, plus whether it has crossed the dead-letter threshold. Never mutates input.
 */
export function recordFailure<T extends { attempts?: number }>(
  action: T,
  maxAttempts: number = MAX_ATTEMPTS,
): { action: T & { attempts: number }; dead: boolean } {
  const prev =
    typeof action.attempts === "number" && Number.isFinite(action.attempts) && action.attempts > 0
      ? action.attempts
      : 0;
  const attempts = prev + 1;
  return { action: { ...action, attempts }, dead: attempts >= maxAttempts };
}

/** Append an id to the applied ring buffer: dedupes, keeps at most `cap` newest ids. */
export function pushApplied(ring: string[], id: string, cap: number = APPLIED_RING_CAP): string[] {
  const next = ring.filter((x) => x !== id);
  next.push(id);
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Union two applied-id rings (persisted-first order), deduped and capped to the newest. */
export function mergeIdRings(a: string[], b: string[], cap: number = APPLIED_RING_CAP): string[] {
  const merged: string[] = [];
  for (const id of [...a, ...b]) {
    if (typeof id === "string" && id.length > 0 && !merged.includes(id)) merged.push(id);
  }
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

/**
 * Reconcile the persisted queue (which other tabs may have written) with this tab's
 * in-memory queue. Union by op id; on a conflict the copy with the higher attempt
 * count wins (attempt bookkeeping only moves forward), ties go to the in-memory copy.
 * Result is ordered by enqueue timestamp (id as a stable tie-break).
 */
export function mergeQueues(persisted: PendingAction[], memory: PendingAction[]): PendingAction[] {
  const byId = new Map<string, PendingAction>();
  for (const a of persisted) {
    if (a && typeof a.id === "string" && a.id) byId.set(a.id, a);
  }
  for (const a of memory) {
    if (!a || typeof a.id !== "string" || !a.id) continue;
    const existing = byId.get(a.id);
    if (!existing || (a.attempts ?? 0) >= (existing.attempts ?? 0)) byId.set(a.id, a);
  }
  return [...byId.values()].sort(
    (x, y) => x.timestamp - y.timestamp || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

function readJsonArray(key: string): any[] {
  const raw = safeStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`[syncService] failed to parse ${key}`, e);
    return [];
  }
}

class SyncService {
  private queue: PendingAction[] = [];
  private deadLetterList: DeadLetterItem[] = [];
  private appliedIds: string[] = [];
  private isProcessing = false;
  private holdingLease = false;
  /** Per-tab identity for the lease lock. */
  private readonly tabId = newOpId();

  constructor() {
    this.queue = readJsonArray(STORAGE_KEY);
    this.deadLetterList = readJsonArray(DEAD_LETTER_KEY);
    this.appliedIds = readJsonArray(APPLIED_KEY).filter((x) => typeof x === "string");
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.processQueue());
    }
  }

  private saveQueue() {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
  }

  private saveDeadLetter() {
    safeStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(this.deadLetterList));
  }

  private saveApplied() {
    safeStorage.setItem(APPLIED_KEY, JSON.stringify(this.appliedIds));
  }

  /**
   * Refresh queue / dead-letter / applied state from storage and merge with memory,
   * so tabs see each other's enqueues, flushes and dead-letterings. Ops already
   * applied or dead-lettered (possibly by another tab) are dropped from the queue.
   */
  private reloadAndMerge() {
    const persistedApplied = readJsonArray(APPLIED_KEY).filter((x) => typeof x === "string");
    this.appliedIds = mergeIdRings(persistedApplied, this.appliedIds, APPLIED_RING_CAP);

    const deadById = new Map<string, DeadLetterItem>();
    for (const d of [...readJsonArray(DEAD_LETTER_KEY), ...this.deadLetterList]) {
      if (d && typeof d.id === "string" && d.id) deadById.set(d.id, d);
    }
    this.deadLetterList = [...deadById.values()];

    const applied = new Set(this.appliedIds);
    const dead = new Set(this.deadLetterList.map((d) => d.id));
    this.queue = mergeQueues(readJsonArray(STORAGE_KEY), this.queue).filter(
      (a) => !applied.has(a.id) && !dead.has(a.id),
    );
  }

  private markApplied(id: string) {
    this.appliedIds = pushApplied(this.appliedIds, id, APPLIED_RING_CAP);
    this.saveApplied();
  }

  public async queueAction(
    type: "CREATE" | "UPDATE" | "DELETE",
    collectionName: string,
    data: Record<string, unknown>,
    tenantId: string,
    docId?: string,
  ) {
    // Pick up other tabs' pending writes before persisting, so we don't clobber them.
    this.reloadAndMerge();

    const action: PendingAction = {
      id: newOpId(), // stable idempotency key, assigned exactly once
      type,
      collection: collectionName,
      docId,
      tenantId,
      data: { ...data, tenantId }, // tenantId kept for back-compat; stripped before write
      timestamp: Date.now(),
      attempts: 0,
    };

    this.queue.push(action);
    this.saveQueue();

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void this.processQueue();
    }

    return action.id;
  }

  /**
   * Flush the queue. Safe to call from anywhere/any time: re-entry within the tab is
   * guarded by `isProcessing`, and cross-tab concurrency by the flush lock — only one
   * tab drains at a time.
   */
  public async processQueue() {
    if (this.isProcessing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    // Reconcile with storage first: another (possibly closed) tab may have left
    // persisted ops this tab's in-memory queue doesn't know about yet.
    this.reloadAndMerge();
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    try {
      await this.withFlushLock(() => this.drain());
    } finally {
      this.isProcessing = false;
    }
  }

  /** Run `fn` while holding the cross-tab flush lock; no-op if another tab holds it. */
  private async withFlushLock(fn: () => Promise<void>): Promise<void> {
    const locks = typeof navigator !== "undefined" ? (navigator as any).locks : undefined;
    if (locks && typeof locks.request === "function") {
      try {
        await locks.request(FLUSH_LOCK_NAME, { ifAvailable: true }, async (lock: any) => {
          if (!lock) return; // another tab is flushing — it will drain our persisted ops
          await fn();
        });
        return;
      } catch {
        /* Web Locks unavailable/broken — fall through to the lease lock */
      }
    }

    if (!tryAcquireLease(safeStorage, LEASE_KEY, this.tabId, LEASE_TTL_MS, Date.now())) {
      return; // live lease held by another tab
    }
    this.holdingLease = true;
    try {
      await fn();
    } finally {
      this.holdingLease = false;
      releaseLease(safeStorage, LEASE_KEY, this.tabId);
    }
  }

  private async drain() {
    while (true) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;

      // Re-read storage each step so ops enqueued by other tabs mid-drain are included.
      this.reloadAndMerge();
      if (this.queue.length === 0) break;
      const action = this.queue[0];

      // Idempotency: already applied (e.g. crash after apply, before dequeue) — skip.
      if (this.appliedIds.includes(action.id)) {
        this.queue.shift();
        this.saveQueue();
        continue;
      }

      const repo = REPOS[action.collection];
      if (!repo) {
        // Unknown collection — drop it rather than wedge the queue forever.
        console.warn(`[syncService] no repo for "${action.collection}"; dropping queued action`);
        this.queue.shift();
        this.saveQueue();
        continue;
      }

      try {
        // The stored tenantId is a Firestore-era artifact; RLS + repo.create's
        // auto-stamp own tenant scoping, so strip it from the payload.
        const { tenantId: _tid, ...payload } = action.data as any;
        if (action.type === "CREATE") {
          await repo.create(payload);
        } else if (action.type === "UPDATE" && action.docId) {
          await repo.update(action.docId, payload);
        } else if (action.type === "DELETE" && action.docId) {
          await repo.remove(action.docId);
        }

        // Mark applied BEFORE dequeueing: if we crash between these two persisted
        // writes, the next flush sees the applied id and skips instead of re-applying.
        this.markApplied(action.id);
        this.queue.shift();
        this.saveQueue();
      } catch (e: any) {
        const { action: updated, dead } = recordFailure(action, MAX_ATTEMPTS);
        if (dead) {
          // Poison pill: park it in the dead-letter list and keep the queue moving.
          console.error(
            `[syncService] dead-lettering op ${action.id} (${action.type} ${action.collection}) after ${updated.attempts} attempts:`,
            e,
          );
          this.queue.shift();
          this.deadLetterList.push({
            ...updated,
            lastError: String(e?.message ?? e),
            deadAt: Date.now(),
          });
          this.saveDeadLetter();
          this.saveQueue();
          continue;
        }
        console.error("Sync error, will retry later:", e);
        this.queue[0] = updated;
        this.saveQueue();
        break; // transient failure — preserve ordering, retry on the next online event
      }

      if (this.holdingLease) {
        renewLease(safeStorage, LEASE_KEY, this.tabId, LEASE_TTL_MS, Date.now());
      }
    }
  }

  public getQueueLength() {
    return this.queue.length;
  }

  public getQueue(): PendingAction[] {
    return [...this.queue];
  }

  // --- Dead-letter accessors -----------------------------------------------

  public getDeadLetter(): DeadLetterItem[] {
    return [...this.deadLetterList];
  }

  public getDeadLetterLength() {
    return this.deadLetterList.length;
  }

  /** Drop one dead-lettered op (by id) or all of them. */
  public clearDeadLetter(id?: string) {
    this.deadLetterList = id ? this.deadLetterList.filter((d) => d.id !== id) : [];
    this.saveDeadLetter();
  }

  /**
   * Move one dead-lettered op (by id) or all of them back onto the live queue with a
   * fresh attempt budget, then kick a flush. Returns how many ops were re-queued.
   */
  public retryDeadLetter(id?: string): number {
    const toRetry = id ? this.deadLetterList.filter((d) => d.id === id) : [...this.deadLetterList];
    if (toRetry.length === 0) return 0;

    const retryIds = new Set(toRetry.map((d) => d.id));
    this.deadLetterList = this.deadLetterList.filter((d) => !retryIds.has(d.id));

    const queued = new Set(this.queue.map((a) => a.id));
    for (const item of toRetry) {
      if (queued.has(item.id)) continue;
      const { lastError: _err, deadAt: _at, ...action } = item;
      this.queue.push({ ...action, attempts: 0 });
    }
    this.queue.sort((a, b) => a.timestamp - b.timestamp);

    this.saveDeadLetter();
    this.saveQueue();

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void this.processQueue();
    }
    return toRetry.length;
  }
}

export const syncService = new SyncService();
