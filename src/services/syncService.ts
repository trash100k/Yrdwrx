import { safeStorage } from '../lib/storage';
// @ts-nocheck

import { collection, doc, serverTimestamp,  } from "firebase/firestore";
import { safeAddDoc as addDoc, safeUpdateDoc as updateDoc } from "../lib/firebase";;
import { db } from "../lib/firebase";

interface PendingAction {
  id: string;
  type: "CREATE" | "UPDATE";
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
    window.addEventListener("online", () => this.processQueue());
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
    type: "CREATE" | "UPDATE",
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
      data: { ...data, tenantId }, // Ensure tenantId is in the actual doc data
      timestamp: Date.now(),
    };

    this.queue.push(action);
    this.saveQueue();

    if (navigator.onLine) {
      this.processQueue();
    }

    return action.id;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0 || !navigator.onLine)
      return;

    this.isProcessing = true;

    const action = this.queue[0];

    try {
      if (action.type === "CREATE") {
        await addDoc(collection(db, action.collection), {
          ...action.data,
          _syncedAt: serverTimestamp(),
        });
      } else if (action.type === "UPDATE" && action.docId) {
        await updateDoc(doc(db, action.collection, action.docId), {
          ...action.data,
          _syncedAt: serverTimestamp(),
        });
      }

      // Success, remove from queue
      this.queue.shift();
      this.saveQueue();

      this.isProcessing = false;
      // Recursively process next
      if (this.queue.length > 0) {
        this.processQueue();
      }
    } catch (e) {
      console.error("Sync error, will retry later:", e);
      this.isProcessing = false;
      // Wait before next attempt if it's a persistent error
    }
  }

  public getQueueLength() {
    return this.queue.length;
  }
}

export const syncService = new SyncService();
