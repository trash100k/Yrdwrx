import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  classifyUrgency,
  extractLeadHeuristic,
  normalizeExtraction,
  isWithinBusinessHours,
  buildReceptionistReply,
  xmlEscape,
  buildInboundVoiceTwiml,
  buildAckTwiml,
  RECEPTIONIST_SOURCES,
} from "./receptionist";

describe("normalizePhone", () => {
  it("US-defaults a bare 10-digit number to +1 E.164", () => {
    const p = normalizePhone("(601) 555-0123");
    expect(p.valid).toBe(true);
    expect(p.last10).toBe("6015550123");
    expect(p.e164).toBe("+16015550123");
  });

  it("preserves an explicit country code", () => {
    expect(normalizePhone("+44 20 7946 0958").e164).toBe("+442079460958");
  });

  it("rejects too-short input", () => {
    const p = normalizePhone("12345");
    expect(p.valid).toBe(false);
    expect(p.e164).toBe("");
  });

  it("does not throw on null", () => {
    expect(normalizePhone(null).valid).toBe(false);
  });
});

describe("classifyUrgency", () => {
  it("flags emergencies as high", () => {
    expect(classifyUrgency("A tree fell on my driveway, need it gone ASAP")).toBe("high");
    expect(classifyUrgency("My yard is flooding after the storm")).toBe("high");
  });
  it("flags quotes / this-week as medium", () => {
    expect(classifyUrgency("Can I get a quote for weekly mowing")).toBe("medium");
    expect(classifyUrgency("Need it done this week")).toBe("medium");
  });
  it("defaults to low", () => {
    expect(classifyUrgency("Just wondering about your services")).toBe("low");
  });
});

describe("extractLeadHeuristic", () => {
  it("pulls name, address, need, and urgency from a natural message", () => {
    const r = extractLeadHeuristic(
      "Hi, my name is John Carter, I need weekly lawn mowing at 123 Oak Street, kind of urgent",
    );
    expect(r.name).toBe("John Carter");
    expect(r.address.toLowerCase()).toContain("123 oak street");
    expect(r.need).toBe("lawn mowing");
    expect(r.urgency).toBe("high"); // "urgent"
  });

  it("maps tree work and marks storm damage urgent", () => {
    const r = extractLeadHeuristic("A big tree came down in the storm, can someone help");
    expect(r.need).toBe("tree work");
    expect(r.urgency).toBe("high");
  });

  it("returns empty fields (never throws) for empty input", () => {
    const r = extractLeadHeuristic("");
    expect(r).toEqual({ name: "", address: "", need: "", urgency: "low", summary: "" });
  });
});

describe("normalizeExtraction", () => {
  it("prefers AI-provided fields and clamps urgency", () => {
    const r = normalizeExtraction(
      { name: "Dana", need: "landscape design quote", urgency: "HIGH", summary: "wants a redesign" },
      "we spoke on the phone",
    );
    expect(r.name).toBe("Dana");
    expect(r.need).toBe("landscape design quote");
    expect(r.urgency).toBe("high");
    expect(r.summary).toBe("wants a redesign");
  });

  it("backfills missing fields from the raw message heuristically", () => {
    const r = normalizeExtraction({}, "this is Pat, need mulching at 45 Elm Rd");
    expect(r.name).toBe("Pat");
    expect(r.need).toBe("mulching");
    expect(r.address.toLowerCase()).toContain("45 elm rd");
  });

  it("falls back to need for summary when none given", () => {
    const r = normalizeExtraction({ need: "gutter cleaning" }, "");
    expect(r.summary).toBe("gutter cleaning");
  });
});

describe("isWithinBusinessHours", () => {
  // 2026-07-06 is a Monday. 15:00Z.
  const monAfternoon = "2026-07-06T15:00:00Z";
  it("returns true with no config", () => {
    expect(isWithinBusinessHours(null, monAfternoon)).toBe(true);
    expect(isWithinBusinessHours({}, monAfternoon)).toBe(true);
  });
  it("respects a same-day window (UTC)", () => {
    expect(isWithinBusinessHours({ start: 8, end: 17 }, monAfternoon)).toBe(true);
    expect(isWithinBusinessHours({ start: 8, end: 17 }, "2026-07-06T02:00:00Z")).toBe(false);
  });
  it("accepts HH:MM strings", () => {
    expect(isWithinBusinessHours({ start: "09:00", end: "17:30" }, monAfternoon)).toBe(true);
  });
  it("respects open days", () => {
    // Sunday 2026-07-05
    expect(isWithinBusinessHours({ days: [1, 2, 3, 4, 5] }, "2026-07-05T15:00:00Z")).toBe(false);
    expect(isWithinBusinessHours({ days: [1, 2, 3, 4, 5] }, monAfternoon)).toBe(true);
  });
  it("handles overnight windows", () => {
    expect(isWithinBusinessHours({ start: 20, end: 6 }, "2026-07-06T23:00:00Z")).toBe(true);
    expect(isWithinBusinessHours({ start: 20, end: 6 }, monAfternoon)).toBe(false);
  });
});

describe("buildReceptionistReply", () => {
  it("greets by name, states the need, and always carries a STOP footer", () => {
    const r = buildReceptionistReply({ name: "John", need: "lawn mowing", businessName: "GreenPro" });
    expect(r).toContain("Thanks John!");
    expect(r).toContain("lawn mowing");
    expect(r).toContain("GreenPro");
    expect(r).toMatch(/Reply STOP to opt out\.$/);
  });

  it("works without a name and uses an after-hours message when closed", () => {
    const r = buildReceptionistReply({
      need: "snow removal",
      withinHours: false,
      afterHoursMessage: "We open at 8am and will call you then.",
    });
    expect(r).toContain("Thanks for reaching out!");
    expect(r).toContain("We open at 8am");
    expect(r).toMatch(/Reply STOP to opt out\.$/);
  });

  it("clamps overly long copy but keeps the footer", () => {
    const r = buildReceptionistReply({ name: "X".repeat(400), need: "Y".repeat(400) });
    expect(r.length).toBeLessThanOrEqual(320);
    expect(r).toMatch(/Reply STOP to opt out\.$/);
  });
});

describe("TwiML builders", () => {
  it("escapes XML-significant characters", () => {
    expect(xmlEscape(`Tom & "Jerry" <co>`)).toBe("Tom &amp; &quot;Jerry&quot; &lt;co&gt;");
  });

  it("renders inbound TwiML with escaped action URLs and a Gather", () => {
    const xml = buildInboundVoiceTwiml({
      businessName: "A & B Lawns",
      gatherUrl: "https://x.test/api/public/voice/gather?callSid=CA1&x=2",
      transcriptionUrl: "https://x.test/api/public/voice/transcription",
      recordedUrl: "https://x.test/api/public/voice/recorded",
    });
    expect(xml).toContain("<Response>");
    expect(xml).toContain('input="speech"');
    expect(xml).toContain("A &amp; B Lawns");
    expect(xml).toContain("callSid=CA1&amp;x=2");
    expect(xml).toContain("transcribeCallback=");
  });

  it("renders a terminal ack + hangup", () => {
    const xml = buildAckTwiml("Thanks, goodbye.");
    expect(xml).toContain("<Hangup/>");
    expect(xml).toContain("Thanks, goodbye.");
  });
});

describe("RECEPTIONIST_SOURCES", () => {
  it("includes the channels the Inbox filters on", () => {
    expect(RECEPTIONIST_SOURCES).toContain("missed_call");
    expect(RECEPTIONIST_SOURCES).toContain("voicemail");
    expect(RECEPTIONIST_SOURCES).toContain("inbound_sms");
  });
});
