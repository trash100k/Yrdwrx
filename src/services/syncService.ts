import { safeStorage } from '../lib/storage';
// @ts-nocheck
//
// Offline write queue. Mutations made while offline are persisted to localStorage and
// flushed to SUPABASE (via the repo layer) when connectivity returns. This used to flush
// to Firestore (the dead project), so offline field writes were silently lost — now each
// queued action is dispatched to the matching repo, which RLS-scopes it to the tenant.

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

interface PendingAction {
  id: string;
  type: "CREATE" | "UPDATE" | "DELETE";
  collection: string;
  docId?: string;
  tenantId: string;
  data: Record<string, unknown>;
  timestamp: number;
}

const STORAGE_KEY = "terramind_sync_queue";

class SyncService {
  private queue: PendingAction[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.processQueue());
    }
  }

  private loadQueue() {
    const saved = safeStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.queue = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse sync queue", e);
        this.queue = [];
      }
    }
  }

  private saveQueue() {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
  }

  public async queueAction(
    type: "CREATE" | "UPDATE" | "DELETE",
    collectionName: string,
    data: Record<string, unknown>,
    tenantId: string,
    docId?: string,
  ) {
    const action: PendingAction = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      collection: collectionName,
      docId,
      tenantId,
      data: { ...data, tenantId }, // tenantId kept for back-compat; stripped before write
      timestamp: Date.now(),
    };

    this.queue.push(action);
    this.saveQueue();

    if (typeof navigator !== "undefined" && navigator.onLine) {
      this.processQueue();
    }

    return action.id;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    this.isProcessing = true;
    const action = this.queue[0];

    try {
      const repo = REPOS[action.collection];
      if (!repo) {
        // Unknown collection — drop it rather than wedge the queue forever.
        console.warn(`[syncService] no repo for "${action.collection}"; dropping queued action`);
      } else {
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
      }

      // Success (or dropped) — remove from queue and continue.
      this.queue.shift();
      this.saveQueue();
      this.isProcessing = false;
      if (this.queue.length > 0) this.processQueue();
    } catch (e) {
      console.error("Sync error, will retry later:", e);
      this.isProcessing = false;
      // Leave the action at the head of the queue; it retries on the next online event.
    }
  }

  public getQueueLength() {
    return this.queue.length;
  }
}

export const syncService = new SyncService();
