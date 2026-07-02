// Photos -> Supabase Storage ("photos" bucket) so DB rows persist small storage
// paths instead of megabyte base64 data URLs (the row-bloat epicenter).
//
// The bucket is PRIVATE; Storage RLS restricts authenticated users to their own
// `${tenant_id}/...` folder, so reads go through short-lived signed URLs (cached
// in-memory per path). Legacy rows that still hold inline `data:` or absolute
// `http(s):` URLs pass straight through getPhotoUrl so they keep rendering.
import { supabase } from "./supabase";
import { getCurrentProfile } from "./repos/profile";

const BUCKET = "photos";

/** Signed-URL lifetime: 7 days. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

// Re-sign slightly before real expiry so a cached URL never dies mid-render.
const EXPIRY_SAFETY_MS = 60 * 1000;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export interface UploadPhotoOptions {
  /** File extension for the stored object (default "jpg"). */
  ext?: string;
}

/** True for inline data URLs and absolute http(s) URLs (legacy persisted values). */
export function isInlineOrRemoteUrl(value: string): boolean {
  return /^data:/i.test(value) || /^https?:\/\//i.test(value);
}

/** Convert a `data:` URL to a Blob (browser-safe; no fetch round-trip). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (!/^data:/i.test(dataUrl) || comma < 0) {
    throw new Error("photoStorage: not a data URL");
  }
  const header = dataUrl.slice(5, comma); // e.g. "image/jpeg;base64"
  const isBase64 = /;base64$/i.test(header);
  const contentType = header.replace(/;base64$/i, "") || "application/octet-stream";
  const payload = dataUrl.slice(comma + 1);
  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: contentType });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

/**
 * Upload a photo (data URL or Blob) to the caller's tenant folder in the private
 * "photos" bucket. Returns the storage path (`${tenant_id}/${uuid}.${ext}`) —
 * persist THAT, not the image bytes.
 */
export async function uploadPhoto(
  dataUrlOrBlob: string | Blob,
  opts: UploadPhotoOptions = {},
): Promise<string> {
  const profile = await getCurrentProfile();
  const tenantId = profile?.tenant_id;
  if (!tenantId) {
    throw new Error("photoStorage: no tenant for the current user");
  }

  const blob =
    typeof dataUrlOrBlob === "string" ? dataUrlToBlob(dataUrlOrBlob) : dataUrlOrBlob;
  const ext = (opts.ext || "jpg").replace(/^\./, "").toLowerCase();
  const contentType = blob.type || MIME_BY_EXT[ext] || "application/octet-stream";
  const path = `${tenantId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType });
  if (error) throw error;
  return path;
}

interface SignedUrlCacheEntry {
  url: string;
  expiresAt: number;
}

// path -> signed URL, so repeated renders of the same photo don't re-sign.
const signedUrlCache = new Map<string, SignedUrlCacheEntry>();

/**
 * Resolve a persisted photo reference to something an <img> can render.
 * Storage paths become signed URLs (cached); legacy inline `data:` and absolute
 * `http(s):` URLs pass through untouched so old rows keep working.
 */
export async function getPhotoUrl(path: string): Promise<string> {
  if (!path || isInlineOrRemoteUrl(path)) return path;

  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw error ?? new Error(`photoStorage: could not sign ${path}`);
  }
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - EXPIRY_SAFETY_MS,
  });
  return data.signedUrl;
}

/** Delete a stored photo. No-op for legacy inline/remote values (nothing stored). */
export async function deletePhoto(path: string): Promise<void> {
  if (!path || isInlineOrRemoteUrl(path)) return;
  signedUrlCache.delete(path);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

/** Test hook: reset the signed-URL cache between cases. */
export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}
