// @ts-nocheck

import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  initializeFirestore,
  memoryLocalCache,
} from "firebase/firestore";
import { supabase, getCurrentUser } from "./supabase";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0666744694",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// YardWorx runs on Supabase Auth + Postgres as the system of record. Firebase is
// legacy and optional: a handful of not-yet-migrated components still import `db`,
// `auth`, `storage`, `analytics` from here and call Firestore's `collection(db, …)`
// at mount. Two failure modes to avoid:
//
//  1) initializeAuth/getAuth/getStorage with an EMPTY apiKey throws
//     `auth/invalid-api-key` synchronously at module load → the whole SPA goes
//     blank. So we only init auth/storage/analytics when a real apiKey is present.
//  2) Exporting `db = null` makes legacy `collection(db, …)` throw synchronously
//     at render → the root error boundary swallows the entire view. Firestore's
//     own init only needs a projectId (NOT an apiKey), so we always create a valid
//     `db`. Locked/unauthenticated reads then fail gracefully via the async
//     onSnapshot error callback (which legacy call sites already tolerate) instead
//     of crashing the render. Their primary data paths already go through Supabase.
const hasFirebaseConfig = !!firebaseConfig.apiKey;

let app: ReturnType<typeof initializeApp> | null = null;
let firestoreDb: ReturnType<typeof initializeFirestore> | null = null;
let tempAuth: ReturnType<typeof getAuth> | null = null;
let storageInst: ReturnType<typeof getStorage> | null = null;
export let analytics: ReturnType<typeof getAnalytics> | null = null;

try {
  // initializeApp + Firestore work with just a projectId — no apiKey required.
  app = initializeApp(firebaseConfig);
  firestoreDb = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
} catch (e) {
  console.warn("[firebase] Firestore init skipped:", (e as Error)?.message);
  app = null;
  firestoreDb = null;
}

if (hasFirebaseConfig && app) {
  try {
    try {
      tempAuth = initializeAuth(app, { persistence: inMemoryPersistence });
    } catch (e) {
      // Fallback in case it's already initialized
      tempAuth = getAuth(app);
    }
    storageInst = getStorage(app);
    // Analytics is only supported in browser environments
    isSupported()
      .then((supported) => {
        if (supported && app) analytics = getAnalytics(app);
      })
      .catch(() => {});
  } catch (e) {
    console.warn(
      "[firebase] auth/storage init skipped — running Supabase-only:",
      (e as Error)?.message,
    );
    tempAuth = null;
    storageInst = null;
  }
} else {
  console.info("[firebase] no VITE_FIREBASE_API_KEY — Supabase-only mode");
}

// Cast away the `| null` so the public type contract matches the pre-Supabase
// behavior (legacy consumers without @ts-nocheck assume these are non-null). At
// runtime `db` is virtually always a valid Firestore instance (init needs only a
// projectId); `auth`/`storage` may be null in Supabase-only mode, but the only
// callers are legacy Google-OAuth buttons behind explicit user clicks.
export const db = firestoreDb as ReturnType<typeof initializeFirestore>;
export const auth = tempAuth as ReturnType<typeof getAuth>;
export const storage = storageInst as ReturnType<typeof getStorage>;

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

/**
 * Gold Standard Audit Trail.
 * Every critical mutation should be followed by a call to this function.
 *
 * Best-effort write to Supabase `system_logs`. RLS scopes the row to the
 * caller's tenant when there's a session. Logging must never throw or block
 * the UI, so failures are swallowed.
 */
export async function logSystemEvent(
  event: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from("system_logs").insert({
      event,
      user_id: getCurrentUser()?.uid || "system",
      metadata,
      tenant_id: (metadata?.tenantId as string) || null,
    });
  } catch (error) {
    console.warn("[AUDIT LOG FAILED]", error);
  }
}
