import { describe, it, expect, vi, afterEach } from "vitest";
import { buildEntry, log, requestId, REPORTED_ERROR_TYPE } from "./logger";

describe("logger buildEntry", () => {
  it("emits INFO with severity, message, ISO timestamp and arbitrary fields", () => {
    const e = buildEntry("INFO", "hello", { requestId: "abc", status: 200 });
    expect(e.severity).toBe("INFO");
    expect(e.message).toBe("hello");
    expect(e.requestId).toBe("abc");
    expect(e.status).toBe(200);
    expect(typeof e.timestamp).toBe("string");
    // Valid ISO 8601 timestamp.
    expect(new Date(e.timestamp as string).toISOString()).toBe(e.timestamp);
  });

  it("does NOT add Error-Reporting fields to non-error levels", () => {
    for (const sev of ["DEBUG", "INFO", "WARNING"] as const) {
      const e = buildEntry(sev, "m");
      expect(e["@type"]).toBeUndefined();
      expect(e.stack_trace).toBeUndefined();
      expect(e.serviceContext).toBeUndefined();
    }
  });

  it("tags ERROR entries so GCP Error Reporting ingests them (with the real stack)", () => {
    const err = new Error("kaboom-detail");
    const e = buildEntry("ERROR", "save failed", { requestId: "r1" }, err);
    expect(e.severity).toBe("ERROR");
    expect(e["@type"]).toBe(REPORTED_ERROR_TYPE);
    // The stack (needed for grouping) is present in both message and stack_trace.
    expect(String(e.message)).toContain("kaboom-detail");
    expect(String(e.stack_trace)).toContain("kaboom-detail");
    // Human summary + correlation fields survive.
    expect(e.summary).toBe("save failed");
    expect(e.requestId).toBe("r1");
    expect(e.serviceContext).toBeTruthy();
  });

  it("synthesizes a stack when no Error object is supplied so it still groups", () => {
    const e = buildEntry("ERROR", "orphan error");
    expect(e["@type"]).toBe(REPORTED_ERROR_TYPE);
    expect(typeof e.stack_trace).toBe("string");
    expect(String(e.stack_trace)).toContain("orphan error");
    expect(String(e.stack_trace)).toMatch(/\bat\b/); // contains stack frames
  });

  it("accepts a non-Error thrown value (string) for the stack source", () => {
    const e = buildEntry("ERROR", "weird throw", {}, "just a string");
    expect(String(e.stack_trace)).toContain("just a string");
  });
});

describe("logger emit routing", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes INFO/DEBUG/WARNING to stdout as a single JSON line", () => {
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    log.info("hi", { a: 1 });
    expect(out).toHaveBeenCalledTimes(1);
    const line = out.mock.calls[0][0] as string;
    // Exactly one physical line (trailing newline only).
    expect(line.endsWith("\n")).toBe(true);
    expect(line.trimEnd().includes("\n")).toBe(false);
    const parsed = JSON.parse(line);
    expect(parsed.severity).toBe("INFO");
    expect(parsed.message).toBe("hi");
    expect(parsed.a).toBe(1);
  });

  it("routes ERROR to stderr (Error Reporting picks up stderr) and stays single-line", () => {
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const errStream = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    log.error("boom", new Error("with\nnewline\nin\nstack"));
    expect(errStream).toHaveBeenCalledTimes(1);
    expect(out).not.toHaveBeenCalled();
    const line = errStream.mock.calls[0][0] as string;
    // Embedded newlines in the stack must be escaped — one physical line.
    expect(line.trimEnd().includes("\n")).toBe(false);
    const parsed = JSON.parse(line);
    expect(parsed["@type"]).toBe(REPORTED_ERROR_TYPE);
  });

  it("never throws even on an un-serializable field", () => {
    const errStream = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const circular: any = {};
    circular.self = circular;
    expect(() => log.error("cannot serialize", undefined, { circular })).not.toThrow();
    expect(errStream).toHaveBeenCalledTimes(1);
    // Fallback line is still valid JSON.
    expect(() => JSON.parse(errStream.mock.calls[0][0] as string)).not.toThrow();
  });
});

describe("requestId", () => {
  it("returns non-empty, unique ids", () => {
    const a = requestId();
    const b = requestId();
    expect(a).toBeTruthy();
    expect(typeof a).toBe("string");
    expect(a).not.toBe(b);
  });
});
