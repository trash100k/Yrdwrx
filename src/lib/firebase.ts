// @ts-nocheck

import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  initializeFirestore,
  memoryLocalCache,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
const firebaseConfig = { projectId: "gen-lang-client-0666744694" };

const app = initializeApp(firebaseConfig);

const firestoreDb = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

export const db = firestoreDb;

let tempAuth;
try {
  tempAuth = initializeAuth(app, {
    persistence: inMemoryPersistence
  });
} catch(e) {
  // Fallback in case it's already initialized
  tempAuth = getAuth(app);
}

export const auth = tempAuth;

export const storage = getStorage(app);

// Analytics is only supported in browser environments
export let analytics: ReturnType<typeof getAnalytics> | null = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

/**
 * Enhanced error handler for Gold Standard observability.
 * Captures auth state and operation context for rapid debugging.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      emailVerified: auth?.currentUser?.emailVerified,
    },
    operationType,
    path,
  };

  const errorMessage = JSON.stringify(errInfo);
  console.error("[STRAT-OS FIREBASE ERROR]", errorMessage);

  // Log failure to systemLogs if it's not a permission error (which would fail itself)
  if (!errorMessage.toLowerCase().includes("permission")) {
    logSystemEvent("ERROR_CAPTURE", {
      operationType,
      path,
      error: errInfo.error,
    }).catch(() => {});
  }
}

import { syncService } from "../services/syncService";

/**
 * Gold Standard Audit Trail.
 * Every critical mutation should be followed by a call to this function.
 */
export async function logSystemEvent(
  event: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    // Audit logs are critical but shouldn't block the UI if they fail.
    // In low service areas, these are queued.
    if (navigator.onLine) {
      await addDoc(collection(db, "systemLogs"), {
        event,
        userId: auth?.currentUser?.uid || "system",
        timestamp: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
        metadata,
      });
    } else {
      await syncService.queueAction(
        "CREATE",
        "systemLogs",
        {
          event,
          userId: auth?.currentUser?.uid || "system",
          timestamp: new Date().toISOString(),
          metadata,
        },
        (metadata.tenantId as string) || "genesis-1",
      );
    }
  } catch (error) {
    console.warn("[AUDIT LOG FAILED]", error);
  }
}
