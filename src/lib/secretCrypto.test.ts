import { describe, it, expect, afterEach } from "vitest";
import { randomBytes } from "crypto";
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  isEncryptionConfigured,
  getKey,
} from "./secretCrypto";

const ENV = "SECRET_ENCRYPTION_KEY";

// Each test controls the key explicitly; always restore to unset afterwards so cases
// don't leak state into one another.
afterEach(() => {
  delete process.env[ENV];
});

const setKey = (v: string) => {
  process.env[ENV] = v;
};

describe("secretCrypto — Tier 2 (key set: AES-256-GCM)", () => {
  it("roundtrips a secret with a base64 key", () => {
    setKey(randomBytes(32).toString("base64"));
    const secret = "qbo_refresh_token_ABC123.äöü.🌱";
    const enc = encryptSecret(secret);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain(secret); // ciphertext must not leak plaintext
    expect(enc.startsWith("v1.gcm:")).toBe(true);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("produces a distinct ciphertext each time (random IV) but decrypts to the same value", () => {
    setKey(randomBytes(32).toString("base64"));
    const secret = "same-secret";
    const a = encryptSecret(secret);
    const b = encryptSecret(secret);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(secret);
    expect(decryptSecret(b)).toBe(secret);
  });

  it("reports encryption as configured when a key is present", () => {
    setKey(randomBytes(32).toString("base64"));
    expect(isEncryptionConfigured()).toBe(true);
    expect(getKey()).not.toBeNull();
    expect(getKey()!.length).toBe(32);
  });
});

describe("secretCrypto — Tier 1 (no key: dev passthrough)", () => {
  it("returns plaintext unchanged when no key is set", () => {
    expect(process.env[ENV]).toBeUndefined();
    const secret = "plaintext_token";
    const enc = encryptSecret(secret);
    expect(enc).toBe(secret); // unchanged
    expect(isEncrypted(enc)).toBe(false);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("reports encryption as NOT configured and getKey null", () => {
    expect(isEncryptionConfigured()).toBe(false);
    expect(getKey()).toBeNull();
  });
});

describe("secretCrypto — tamper / integrity", () => {
  it("throws when the ciphertext body is tampered (auth-tag failure)", () => {
    setKey(randomBytes(32).toString("base64"));
    const enc = encryptSecret("sensitive");
    // Flip a character in the ciphertext segment (last of the three base64 parts).
    const parts = enc.slice("v1.gcm:".length).split(":");
    const ctBuf = Buffer.from(parts[2], "base64");
    ctBuf[0] = ctBuf[0] ^ 0xff;
    const tampered = `v1.gcm:${parts[0]}:${parts[1]}:${ctBuf.toString("base64")}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when the auth tag is tampered", () => {
    setKey(randomBytes(32).toString("base64"));
    const enc = encryptSecret("sensitive");
    const parts = enc.slice("v1.gcm:".length).split(":");
    const tagBuf = Buffer.from(parts[1], "base64");
    tagBuf[0] = tagBuf[0] ^ 0xff;
    const tampered = `v1.gcm:${parts[0]}:${tagBuf.toString("base64")}:${parts[2]}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when a different key is used to decrypt", () => {
    setKey(randomBytes(32).toString("base64"));
    const enc = encryptSecret("sensitive");
    setKey(randomBytes(32).toString("base64")); // rotate to a wrong key
    expect(() => decryptSecret(enc)).toThrow();
  });

  it("throws when a v1.gcm ciphertext is decrypted with NO key configured", () => {
    setKey(randomBytes(32).toString("base64"));
    const enc = encryptSecret("sensitive");
    delete process.env[ENV];
    expect(() => decryptSecret(enc)).toThrow(/SECRET_ENCRYPTION_KEY/);
  });

  it("throws on a malformed v1.gcm envelope", () => {
    setKey(randomBytes(32).toString("base64"));
    expect(() => decryptSecret("v1.gcm:onlyonepart")).toThrow(/Malformed/);
  });
});

describe("secretCrypto — legacy plaintext / forward-compat decrypt", () => {
  it("passes a legacy plaintext value through even WITH a key set (existing rows keep working)", () => {
    setKey(randomBytes(32).toString("base64"));
    const legacy = "legacy_plaintext_access_token"; // not v1.gcm-prefixed
    expect(decryptSecret(legacy)).toBe(legacy);
    expect(isEncrypted(legacy)).toBe(false);
  });

  it("passes a legacy plaintext value through with NO key set", () => {
    const legacy = "legacy_plaintext";
    expect(decryptSecret(legacy)).toBe(legacy);
  });
});

describe("secretCrypto — empty / null handling", () => {
  it("encrypt: empty and null/undefined => ''", () => {
    setKey(randomBytes(32).toString("base64"));
    expect(encryptSecret("")).toBe("");
    expect(encryptSecret(null)).toBe("");
    expect(encryptSecret(undefined)).toBe("");
  });

  it("decrypt: empty and null/undefined => ''", () => {
    setKey(randomBytes(32).toString("base64"));
    expect(decryptSecret("")).toBe("");
    expect(decryptSecret(null)).toBe("");
    expect(decryptSecret(undefined)).toBe("");
  });

  it("empty handling holds in passthrough mode too", () => {
    expect(encryptSecret("")).toBe("");
    expect(decryptSecret("")).toBe("");
  });
});

describe("secretCrypto — key acceptance (base64 / hex / derived string)", () => {
  const secret = "token_value_to_roundtrip";

  it("accepts a 32-byte base64 key", () => {
    setKey(randomBytes(32).toString("base64"));
    const k = getKey();
    expect(k).not.toBeNull();
    expect(k!.length).toBe(32);
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("accepts a 64-char hex key", () => {
    setKey(randomBytes(32).toString("hex")); // 64 hex chars
    const k = getKey();
    expect(k!.length).toBe(32);
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("derives a 32-byte key from an arbitrary passphrase string", () => {
    setKey("just-a-dev-passphrase-that-is-not-base64-or-hex");
    const k = getKey();
    expect(k).not.toBeNull();
    expect(k!.length).toBe(32); // stretched via sha256
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("a hex key and its base64-of-32-bytes counterpart both yield 32-byte keys", () => {
    const bytes = randomBytes(32);
    setKey(bytes.toString("hex"));
    const kHex = getKey();
    setKey(bytes.toString("base64"));
    const kB64 = getKey();
    expect(kHex!.equals(bytes)).toBe(true);
    expect(kB64!.equals(bytes)).toBe(true);
    expect(kHex!.equals(kB64!)).toBe(true); // same underlying key material
  });
});

describe("secretCrypto — isEncrypted", () => {
  it("true only for v1.gcm-prefixed strings", () => {
    expect(isEncrypted("v1.gcm:aaa:bbb:ccc")).toBe(true);
    expect(isEncrypted("plaintext")).toBe(false);
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted("v2.kms:whatever")).toBe(false); // not our current envelope
  });
});
