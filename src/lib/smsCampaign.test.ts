// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  detectSmsCommand,
  normalizeInbound,
  appendOptOutFooter,
  hasOptOutLanguage,
  OPT_OUT_FOOTER,
  countSmsSegments,
  canReceiveMarketing,
  canReceiveTransactional,
  partitionForMarketing,
  isWithinSendWindow,
} from "./smsCampaign";

describe("detectSmsCommand", () => {
  it("detects exact STOP keywords (case/punctuation-insensitive)", () => {
    for (const w of ["STOP", "stop", "Stop.", "UNSUBSCRIBE", "cancel", "quit", "end", "opt-out"]) {
      expect(detectSmsCommand(w)).toBe("stop");
    }
  });

  it("detects STOP when it leads a short natural sentence", () => {
    expect(detectSmsCommand("stop texting me")).toBe("stop");
    expect(detectSmsCommand("please STOP")).toBe("stop");
  });

  it("detects HELP and START commands", () => {
    expect(detectSmsCommand("HELP")).toBe("help");
    expect(detectSmsCommand("info")).toBe("help");
    expect(detectSmsCommand("START")).toBe("start");
    expect(detectSmsCommand("yes")).toBe("start");
  });

  it("returns null for ordinary conversational replies", () => {
    expect(detectSmsCommand("Sounds good, see you Tuesday")).toBeNull();
    expect(detectSmsCommand("how much for aeration?")).toBeNull();
    expect(detectSmsCommand("")).toBeNull();
    expect(detectSmsCommand(null)).toBeNull();
  });

  it("normalizes inbound text", () => {
    expect(normalizeInbound("  STOP!! ")).toBe("stop");
  });
});

describe("opt-out footer", () => {
  it("appends the footer to a marketing message", () => {
    expect(appendOptOutFooter("Spring aeration 15% off this week")).toBe(
      `Spring aeration 15% off this week ${OPT_OUT_FOOTER}`,
    );
  });

  it("is idempotent — does not double-append when STOP language already present", () => {
    const once = appendOptOutFooter("Deal! Reply STOP to opt out.");
    expect(once).toBe("Deal! Reply STOP to opt out.");
    expect(hasOptOutLanguage(once)).toBe(true);
  });

  it("handles empty body", () => {
    expect(appendOptOutFooter("")).toBe(OPT_OUT_FOOTER);
  });
});

describe("countSmsSegments", () => {
  it("counts a short GSM-7 message as 1 segment", () => {
    const r = countSmsSegments("Hi Dana, your crew is on the way!");
    expect(r.encoding).toBe("GSM-7");
    expect(r.segments).toBe(1);
  });

  it("splits a long GSM-7 message at 160/153", () => {
    expect(countSmsSegments("a".repeat(160)).segments).toBe(1);
    expect(countSmsSegments("a".repeat(161)).segments).toBe(2);
    expect(countSmsSegments("a".repeat(306)).segments).toBe(2);
    expect(countSmsSegments("a".repeat(307)).segments).toBe(3);
  });

  it("switches to UCS-2 (70/67) when a non-GSM char (emoji) is present", () => {
    const r = countSmsSegments("Thanks! 🌿");
    expect(r.encoding).toBe("UCS-2");
    expect(r.segments).toBe(1);
    expect(countSmsSegments("🌿".repeat(71)).segments).toBeGreaterThan(1);
  });

  it("counts GSM-7 extension chars (e.g. {}) as two units", () => {
    expect(countSmsSegments("{").units).toBe(2);
  });
});

describe("consent gating", () => {
  const marketing = { phone: "5551234567", smsConsent: "marketing" };
  const transactional = { phone: "5551234567", smsConsent: "transactional" };
  const none = { phone: "5551234567", smsConsent: "none" };
  const optedOut = { phone: "5551234567", smsConsent: "marketing", smsOptOutAt: "2026-06-01T00:00:00Z" };

  it("only allows marketing to fully-consented, non-opted-out numbers", () => {
    expect(canReceiveMarketing(marketing)).toBe(true);
    expect(canReceiveMarketing(transactional)).toBe(false);
    expect(canReceiveMarketing(none)).toBe(false);
    expect(canReceiveMarketing(optedOut)).toBe(false);
  });

  it("allows transactional to marketing OR transactional consent", () => {
    expect(canReceiveTransactional(marketing)).toBe(true);
    expect(canReceiveTransactional(transactional)).toBe(true);
    expect(canReceiveTransactional(none)).toBe(false);
    expect(canReceiveTransactional(optedOut)).toBe(false);
  });

  it("partitions a list with reasons", () => {
    const { sendable, excluded } = partitionForMarketing([
      marketing,
      transactional,
      optedOut,
      { smsConsent: "marketing" }, // no phone
    ]);
    expect(sendable).toHaveLength(1);
    expect(excluded.map((e) => e.reason).sort()).toEqual(["no_marketing_consent", "no_phone", "opted_out"]);
  });
});

describe("isWithinSendWindow", () => {
  it("allows daytime hours and blocks night hours", () => {
    expect(isWithinSendWindow(9)).toBe(true);
    expect(isWithinSendWindow(20)).toBe(true);
    expect(isWithinSendWindow(7)).toBe(false);
    expect(isWithinSendWindow(21)).toBe(false);
    expect(isWithinSendWindow(2)).toBe(false);
  });
});
