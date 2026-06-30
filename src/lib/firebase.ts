// @ts-nocheck
// Firebase has been removed. Identity (Supabase Auth), data + realtime (Supabase
// Postgres), and file storage (Supabase Storage) are all Supabase now.
//
// This module survives ONLY as a thin compatibility shim so we don't have to touch the
// dozens of call sites that still import `auth`/`db`/`storage`/`analytics` (now inert
// nulls — callers already guard with optional chaining) and the observability helpers
// (OperationType / handleFirestoreError / logSystemEvent). New code should import the
// Supabase client from ./supabase directly.
import { supabase, getCurrentUser } from "./supabase";

// Inert legacy exports. `auth?.currentUser`, `db`, etc. resolve to null/undefined and
// every remaining caller tolerates that (optional chaining + fallbacks).
export const db: any = null;
export const auth: any = null;
export const storage: any = null;
export const analytics: any = null;

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

/**
 * Observability helper retained from the Firebase era. Captures operation context for
 * debugging and best-effort logs non-permission failures to Supabase `system_logs`.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: { userId: getCurrentUser()?.uid ?? null },
    operationType,
    path,
  };
  const errorMessage = JSON.stringify(errInfo);
  console.error("[YARDWORX DATA ERROR]", errorMessage);
  if (!errorMessage.toLowerCase().includes("permission")) {
    logSystemEvent("ERROR_CAPTURE", { operationType, path, error: errInfo.error }).catch(() => {});
  }
}

/**
 * Audit trail. Best-effort write to Supabase `system_logs`; RLS scopes the row to the
 * caller's tenant when there's a session. Logging must never throw or block the UI.
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
