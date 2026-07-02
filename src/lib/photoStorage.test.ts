import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
  getCurrentProfile: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: mocks.upload,
        createSignedUrl: mocks.createSignedUrl,
        remove: mocks.remove,
      })),
    },
  },
}));

vi.mock("./repos/profile", () => ({
  getCurrentProfile: mocks.getCurrentProfile,
}));

import {
  uploadPhoto,
  getPhotoUrl,
  deletePhoto,
  dataUrlToBlob,
  clearSignedUrlCache,
  isInlineOrRemoteUrl,
  SIGNED_URL_TTL_SECONDS,
} from "./photoStorage";

const JPEG_DATA_URL = `data:image/jpeg;base64,${btoa("fake-jpeg-bytes")}`;

beforeEach(() => {
  vi.clearAllMocks();
  clearSignedUrlCache();
  mocks.getCurrentProfile.mockResolvedValue({ firebase_uid: "u1", tenant_id: "tenant-1", role: "owner" });
  mocks.upload.mockResolvedValue({ data: { path: "x" }, error: null });
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://cdn.test/signed" }, error: null });
  mocks.remove.mockResolvedValue({ data: [], error: null });
});

describe("dataUrlToBlob", () => {
  it("decodes a base64 data URL preserving bytes and content type", () => {
    const blob = dataUrlToBlob(JPEG_DATA_URL);
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBe("fake-jpeg-bytes".length);
  });

  it("handles non-base64 (URI-encoded) data URLs", () => {
    const blob = dataUrlToBlob("data:text/plain,hello%20world");
    expect(blob.type).toBe("text/plain");
    expect(blob.size).toBe("hello world".length);
  });

  it("throws on non-data-URL input", () => {
    expect(() => dataUrlToBlob("https://example.com/a.jpg")).toThrow();
    expect(() => dataUrlToBlob("not a url")).toThrow();
  });
});

describe("isInlineOrRemoteUrl", () => {
  it("matches data:, http: and https: but not storage paths", () => {
    expect(isInlineOrRemoteUrl(JPEG_DATA_URL)).toBe(true);
    expect(isInlineOrRemoteUrl("http://x.test/a.jpg")).toBe(true);
    expect(isInlineOrRemoteUrl("https://x.test/a.jpg")).toBe(true);
    expect(isInlineOrRemoteUrl("tenant-1/abc.jpg")).toBe(false);
  });
});

describe("uploadPhoto", () => {
  it("uploads under the tenant folder and returns the storage path", async () => {
    const path = await uploadPhoto(JPEG_DATA_URL, { ext: "jpg" });
    expect(path).toMatch(/^tenant-1\/[0-9a-f-]{36}\.jpg$/);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    const [calledPath, blob, opts] = mocks.upload.mock.calls[0];
    expect(calledPath).toBe(path);
    expect(blob).toBeInstanceOf(Blob);
    expect(opts).toEqual({ contentType: "image/jpeg" });
  });

  it("accepts a Blob directly and infers content type from ext when blob has none", async () => {
    const path = await uploadPhoto(new Blob([new Uint8Array([1, 2, 3])]), { ext: "png" });
    expect(path).toMatch(/\.png$/);
    const [, , opts] = mocks.upload.mock.calls[0];
    expect(opts).toEqual({ contentType: "image/png" });
  });

  it("rejects when the user has no tenant", async () => {
    mocks.getCurrentProfile.mockResolvedValue(null);
    await expect(uploadPhoto(JPEG_DATA_URL, { ext: "jpg" })).rejects.toThrow(/tenant/);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects when the storage upload errors", async () => {
    mocks.upload.mockResolvedValue({ data: null, error: new Error("network down") });
    await expect(uploadPhoto(JPEG_DATA_URL, { ext: "jpg" })).rejects.toThrow("network down");
  });
});

describe("getPhotoUrl", () => {
  it("passes data: and http(s): values through untouched (legacy rows)", async () => {
    await expect(getPhotoUrl(JPEG_DATA_URL)).resolves.toBe(JPEG_DATA_URL);
    await expect(getPhotoUrl("https://x.test/a.jpg")).resolves.toBe("https://x.test/a.jpg");
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("signs storage paths with the 7-day TTL and caches per path", async () => {
    const url1 = await getPhotoUrl("tenant-1/abc.jpg");
    const url2 = await getPhotoUrl("tenant-1/abc.jpg");
    expect(url1).toBe("https://cdn.test/signed");
    expect(url2).toBe(url1);
    expect(mocks.createSignedUrl).toHaveBeenCalledTimes(1);
    expect(mocks.createSignedUrl).toHaveBeenCalledWith("tenant-1/abc.jpg", SIGNED_URL_TTL_SECONDS);
  });

  it("rejects when signing fails", async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: new Error("denied") });
    await expect(getPhotoUrl("tenant-1/abc.jpg")).rejects.toThrow("denied");
  });
});

describe("deletePhoto", () => {
  it("removes the object and evicts the cached signed URL", async () => {
    await getPhotoUrl("tenant-1/abc.jpg");
    await deletePhoto("tenant-1/abc.jpg");
    expect(mocks.remove).toHaveBeenCalledWith(["tenant-1/abc.jpg"]);
    // Evicted -> next resolve re-signs.
    await getPhotoUrl("tenant-1/abc.jpg");
    expect(mocks.createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("is a no-op for legacy inline/remote values", async () => {
    await deletePhoto(JPEG_DATA_URL);
    await deletePhoto("https://x.test/a.jpg");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
