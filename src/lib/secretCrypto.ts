// Application-layer secret encryption for at-rest secrets (starting with the QuickBooks
// Online OAuth access/refresh tokens in the `integrations` table, which were stored in
// PLAINTEXT). This is a small, dependency-free envelope over node's `crypto` that is
// deliberately TIERED so local dev stays a friction-free no-op while production is strong:
//
//   Tier 1 — DEV (no key):      SECRET_ENCRYPTION_KEY unset  => passthrough. encryptSecret()
//                               returns plaintext, decryptSecret() returns it back unchanged.
//                               Existing plaintext rows keep working; tests need no key.
//   Tier 2 — STAGING/PROD:      SECRET_ENCRYPTION_KEY set    => AES-256-GCM (authenticated).
//                               Key comes from Secret Manager (32-byte base64 / 64-char hex /
//                               any string, which is stretched via SHA-256). Ciphertext is
//                               self-describing: "v1.gcm:<iv>:<tag>:<ct>".
//   Tier 3 — PROD (future):     KMS_KEY_NAME set             => Cloud KMS envelope. A per-tenant
//                               Data Encryption Key (DEK) does the AES-256-GCM leaf encryption
//                               and is WRAPPED by a KMS Key Encryption Key (KEK). The seam for
//                               this lives at the bottom of the file (`KmsEnvelopeProvider`) so
//                               @google-cloud/kms can slot in WITHOUT touching any caller. That
//                               dependency is intentionally NOT added yet — future "v2.kms:"
//                               ciphertexts would carry the wrapped DEK alongside the payload.
//
// Design guarantees:
//   * FORWARD-COMPATIBLE: any value NOT prefixed "v1.gcm:" is treated as legacy plaintext and
//     passed through by decryptSecret(). So flipping the key on is safe — old rows still read,
//     and new writes are encrypted. (One-time re-encrypt of existing rows is a follow-up; see
//     the TODO returned with this change.)
//   * AUTHENTICATED: GCM's 128-bit auth tag is verified on decrypt; any tamper throws.
//   * NO KEY MATERIAL OR PLAINTEXT IS EVER LOGGED here or by callers.
//   * The key is read from env on each call (never cached at module load) so ops/tests can
//     rotate or toggle it without a process restart.
//
// Typed, no `@ts-nocheck`, zero new dependencies (node `crypto` only).

import { createCipheriv, createDecipheriv, createHash, randomBytes, type CipherGCMTypes } from "crypto";

const ALGO: CipherGCMTypes = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce — the standard/recommended size for AES-GCM.
const KEY_BYTES = 32; // AES-256.
/** Self-describing ciphertext prefix. Bump to "v2.kms:" for the Tier-3 KMS envelope. */
const PREFIX = "v1.gcm:";

/**
 * Resolve the symmetric key from `SECRET_ENCRYPTION_KEY`.
 *  - 64-char hex          -> decoded to 32 bytes as-is.
 *  - base64 of 32 bytes   -> decoded and used as-is.
 *  - anything else        -> stretched to 32 bytes via SHA-256(raw) (accepts a passphrase).
 * Returns null when the env var is unset/empty (Tier-1 dev passthrough).
 */
export function getKey(): Buffer | null {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // 64-char hex (checked first: hex is also valid base64, but decodes to 48 bytes there).
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  // Exactly-32-byte base64.
  const asB64 = Buffer.from(trimmed, "base64");
  if (asB64.length === KEY_BYTES) return asB64;
  // Fallback: derive a 32-byte key from the raw string.
  return createHash("sha256").update(trimmed).digest();
}

/** True when a key is configured (Tier 2/3 active); false in Tier-1 dev passthrough. */
export function isEncryptionConfigured(): boolean {
  return getKey() !== null;
}

/** True when a value is one of our encrypted envelopes (vs. legacy plaintext). */
export function isEncrypted(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith(PREFIX);
}

/**
 * Encrypt a secret for storage.
 *  - empty/null  -> "" (nothing to protect).
 *  - no key      -> plaintext returned unchanged (Tier-1 dev passthrough).
 *  - key present -> AES-256-GCM, "v1.gcm:<base64(iv)>:<base64(tag)>:<base64(ct)>".
 */
export function encryptSecret(plaintext: string | null | undefined): string {
  if (plaintext == null || plaintext === "") return "";
  const key = getKey();
  if (!key) return String(plaintext); // dev passthrough — nothing to encrypt with.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/**
 * Decrypt a stored secret.
 *  - empty         -> "".
 *  - NOT prefixed  -> returned as-is (legacy plaintext / Tier-1 passthrough; forward-compatible).
 *  - prefixed, no key -> throws (we have ciphertext but nothing to decrypt it with).
 *  - prefixed, key -> AES-256-GCM decrypt with auth-tag verification (throws on tamper).
 */
export function decryptSecret(stored: string | null | undefined): string {
  if (stored == null || stored === "") return "";
  const s = String(stored);
  if (!s.startsWith(PREFIX)) return s; // legacy plaintext / passthrough.
  const key = getKey();
  if (!key) {
    throw new Error(
      "SECRET_ENCRYPTION_KEY is required to decrypt an encrypted secret (found v1.gcm ciphertext but no key is configured).",
    );
  }
  const parts = s.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret: expected 'v1.gcm:<iv>:<tag>:<ct>'.");
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag); // GCM verifies this in final(); a wrong/tampered tag throws.
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Tier-3 EXTENSION POINT — Cloud KMS envelope encryption (prod, future). DO NOT wire the
// @google-cloud/kms dependency here yet. This is the seam a KMS-wrapped per-tenant DEK slots
// into: a boot-time provider is registered, encrypt/decrypt gain a "v2.kms:" branch that
// generates+wraps a DEK per write and unwraps it per read. Callers (server.ts) stay identical.
// ─────────────────────────────────────────────────────────────────────────────────────

/** Wraps/unwraps a per-tenant Data Encryption Key with a KMS-held Key Encryption Key. */
export interface KmsEnvelopeProvider {
  /** Wrap a freshly-generated 32-byte DEK; returns the KMS-wrapped key (base64). */
  wrapDek(dek: Buffer): Promise<string>;
  /** Unwrap a previously-wrapped DEK back to raw key bytes. */
  unwrapDek(wrapped: string): Promise<Buffer>;
}

let kmsProvider: KmsEnvelopeProvider | null = null;

/** Register (or clear) the KMS provider at boot. Left null keeps us on Tier 1/2. */
export function registerKmsProvider(provider: KmsEnvelopeProvider | null): void {
  kmsProvider = provider;
}

/** True once a KMS provider is registered AND KMS_KEY_NAME is set (Tier-3 active). */
export function isKmsConfigured(): boolean {
  return !!process.env.KMS_KEY_NAME && kmsProvider !== null;
}
