import { describe, it, expect } from "vitest";
import {
  resolveNotification,
  isQuietHoursActive,
  getHourOfDay,
  getEnabledChannels,
  ALL_CHANNELS,
  OWNER_EVENTS,
  OWNER_DEFAULT_CHANNELS,
  type NotifPrefs,
  type Channel,
} from "./notificationRules";

// A fixed "noon UTC" reference used whenever the specific time doesn't matter
// (no quiet-hours window in play). Deterministic — the module never reads a clock.
const NOON_UTC = "2026-07-05T12:00:00Z";

const allOn: Partial<Record<Channel, boolean>> = { email: true, sms: true, push: true };

describe("getEnabledChannels", () => {
  it("returns only channels set to true, in canonical order", () => {
    expect(getEnabledChannels({ sms: true, email: true })).toEqual(["email", "sms"]);
  });

  it("ignores channels set to false or absent", () => {
    expect(getEnabledChannels({ email: false, sms: true, push: false })).toEqual(["sms"]);
  });

  it("returns [] for empty, null, and undefined", () => {
    expect(getEnabledChannels({})).toEqual([]);
    expect(getEnabledChannels(null)).toEqual([]);
    expect(getEnabledChannels(undefined)).toEqual([]);
  });
});

describe("getHourOfDay", () => {
  it("returns the UTC hour when no timezone is given", () => {
    expect(getHourOfDay("2026-07-05T12:00:00Z")).toBe(12);
    expect(getHourOfDay("2026-07-05T00:30:00Z")).toBe(0);
    expect(getHourOfDay("2026-07-05T23:59:00Z")).toBe(23);
  });

  it("applies a fixed-offset timezone deterministically (Honolulu, UTC-10, no DST)", () => {
    // 12:00Z is 02:00 in Honolulu.
    expect(getHourOfDay("2026-07-05T12:00:00Z", "Pacific/Honolulu")).toBe(2);
    // 05:00Z is 19:00 the previous day in Honolulu.
    expect(getHourOfDay("2026-07-05T05:00:00Z", "Pacific/Honolulu")).toBe(19);
  });

  it("falls back to UTC hour for an invalid timezone string", () => {
    expect(getHourOfDay("2026-07-05T12:00:00Z", "Not/AZone")).toBe(12);
    expect(getHourOfDay("2026-07-05T12:00:00Z", "")).toBe(12);
  });

  it("returns null for an unparseable timestamp", () => {
    expect(getHourOfDay("not-a-date")).toBeNull();
    // @ts-expect-error exercising the runtime guard with a non-string
    expect(getHourOfDay(null)).toBeNull();
  });
});

describe("isQuietHoursActive", () => {
  it("returns false when quietHours is null/undefined", () => {
    expect(isQuietHoursActive(null, NOON_UTC)).toBe(false);
    expect(isQuietHoursActive(undefined, NOON_UTC)).toBe(false);
  });

  it("same-day window is inclusive of start, exclusive of end", () => {
    const w = { startHour: 9, endHour: 17 };
    expect(isQuietHoursActive(w, "2026-07-05T09:00:00Z")).toBe(true); // start inclusive
    expect(isQuietHoursActive(w, "2026-07-05T16:00:00Z")).toBe(true);
    expect(isQuietHoursActive(w, "2026-07-05T17:00:00Z")).toBe(false); // end exclusive
    expect(isQuietHoursActive(w, "2026-07-05T08:00:00Z")).toBe(false);
  });

  it("wrap-around window (21 -> 7) spans overnight", () => {
    const w = { startHour: 21, endHour: 7 };
    expect(isQuietHoursActive(w, "2026-07-05T23:00:00Z")).toBe(true); // late night
    expect(isQuietHoursActive(w, "2026-07-05T03:00:00Z")).toBe(true); // early morning
    expect(isQuietHoursActive(w, "2026-07-05T21:00:00Z")).toBe(true); // start inclusive
    expect(isQuietHoursActive(w, "2026-07-05T07:00:00Z")).toBe(false); // end exclusive
    expect(isQuietHoursActive(w, "2026-07-05T12:00:00Z")).toBe(false); // midday
  });

  it("handles endHour = 24 as end-of-day (21 -> 24)", () => {
    const w = { startHour: 21, endHour: 24 };
    expect(isQuietHoursActive(w, "2026-07-05T22:00:00Z")).toBe(true);
    expect(isQuietHoursActive(w, "2026-07-05T23:00:00Z")).toBe(true);
    expect(isQuietHoursActive(w, "2026-07-05T02:00:00Z")).toBe(false);
  });

  it("degenerate window (start === end) is inactive", () => {
    expect(isQuietHoursActive({ startHour: 21, endHour: 21 }, "2026-07-05T21:00:00Z")).toBe(false);
  });

  it("returns false for NaN / non-finite hours", () => {
    expect(isQuietHoursActive({ startHour: NaN, endHour: 7 }, NOON_UTC)).toBe(false);
    expect(isQuietHoursActive({ startHour: 21, endHour: Infinity }, NOON_UTC)).toBe(false);
  });

  it("returns false when the timestamp is unparseable", () => {
    expect(isQuietHoursActive({ startHour: 21, endHour: 7 }, "garbage")).toBe(false);
  });

  it("honors the timezone when deciding the window (Honolulu)", () => {
    const w = { startHour: 21, endHour: 7, tz: "Pacific/Honolulu" };
    // 12:00Z -> 02:00 Honolulu -> inside 21->7.
    expect(isQuietHoursActive(w, "2026-07-05T12:00:00Z")).toBe(true);
    // Same instant, no tz -> 12:00 UTC -> outside the window.
    expect(isQuietHoursActive({ startHour: 21, endHour: 7 }, "2026-07-05T12:00:00Z")).toBe(false);
  });
});

describe("resolveNotification — happy path", () => {
  it("fires all enabled channels when nothing suppresses them", () => {
    const prefs: NotifPrefs = { channels: allOn };
    const d = resolveNotification("invoice_created", prefs, NOON_UTC);
    expect(d.channels).toEqual(["email", "sms", "push"]);
    expect(d.suppressed).toEqual([]);
    expect(d.reason).toBe("delivered");
  });

  it("fires only the subset of channels that are enabled", () => {
    const prefs: NotifPrefs = { channels: { email: true, push: true } };
    const d = resolveNotification("new_message", prefs, NOON_UTC);
    expect(d.channels).toEqual(["email", "push"]);
    expect(d.suppressed).toEqual([]);
    expect(d.reason).toBe("delivered");
  });

  it("keeps output arrays in canonical email/sms/push order", () => {
    const prefs: NotifPrefs = { channels: { push: true, sms: true, email: true } };
    const d = resolveNotification("design_approved", prefs, NOON_UTC);
    expect(d.channels).toEqual(["email", "sms", "push"]);
  });
});

describe("resolveNotification — opt-outs", () => {
  it("drops SMS on smsOptOut", () => {
    const prefs: NotifPrefs = { channels: allOn, smsOptOut: true };
    const d = resolveNotification("invoice_created", prefs, NOON_UTC);
    expect(d.channels).toEqual(["email", "push"]);
    expect(d.suppressed).toEqual(["sms"]);
    expect(d.reason).toBe("delivered, sms_opt_out");
  });

  it("drops email on emailOptOut", () => {
    const prefs: NotifPrefs = { channels: allOn, emailOptOut: true };
    const d = resolveNotification("invoice_paid", prefs, NOON_UTC);
    expect(d.channels).toEqual(["sms", "push"]);
    expect(d.suppressed).toEqual(["email"]);
    expect(d.reason).toBe("delivered, email_opt_out");
  });

  it("drops both when both opt-outs are set", () => {
    const prefs: NotifPrefs = { channels: allOn, smsOptOut: true, emailOptOut: true };
    const d = resolveNotification("invoice_paid", prefs, NOON_UTC);
    expect(d.channels).toEqual(["push"]);
    expect(d.suppressed).toEqual(["email", "sms"]);
    expect(d.reason).toBe("delivered, sms_opt_out, email_opt_out");
  });

  it("opt-out on a channel that was never enabled is a no-op", () => {
    const prefs: NotifPrefs = { channels: { email: true }, smsOptOut: true };
    const d = resolveNotification("new_message", prefs, NOON_UTC);
    expect(d.channels).toEqual(["email"]);
    expect(d.suppressed).toEqual([]);
    expect(d.reason).toBe("delivered");
  });
});

describe("resolveNotification — quiet hours", () => {
  const quietPrefs: NotifPrefs = {
    channels: allOn,
    quietHours: { startHour: 21, endHour: 7 },
  };

  it("holds SMS + push during quiet hours; email still fires", () => {
    const d = resolveNotification("new_message", quietPrefs, "2026-07-05T23:30:00Z");
    expect(d.channels).toEqual(["email"]);
    expect(d.suppressed).toEqual(["sms", "push"]);
    expect(d.reason).toBe("delivered, quiet_hours");
  });

  it("is active in the early-morning tail of a wrap window", () => {
    const d = resolveNotification("new_message", quietPrefs, "2026-07-05T04:00:00Z");
    expect(d.channels).toEqual(["email"]);
    expect(d.suppressed).toEqual(["sms", "push"]);
  });

  it("fires everything outside quiet hours", () => {
    const d = resolveNotification("new_message", quietPrefs, "2026-07-05T12:00:00Z");
    expect(d.channels).toEqual(["email", "sms", "push"]);
    expect(d.suppressed).toEqual([]);
    expect(d.reason).toBe("delivered");
  });

  it("suppresses only push when SMS is not enabled and it is quiet", () => {
    const prefs: NotifPrefs = {
      channels: { email: true, push: true },
      quietHours: { startHour: 21, endHour: 7 },
    };
    const d = resolveNotification("new_message", prefs, "2026-07-05T23:00:00Z");
    expect(d.channels).toEqual(["email"]);
    expect(d.suppressed).toEqual(["push"]);
    expect(d.reason).toBe("delivered, quiet_hours");
  });

  it("smsOptOut takes precedence over quiet-hours as the SMS reason", () => {
    const prefs: NotifPrefs = {
      channels: allOn,
      smsOptOut: true,
      quietHours: { startHour: 21, endHour: 7 },
    };
    const d = resolveNotification("new_message", prefs, "2026-07-05T23:00:00Z");
    expect(d.channels).toEqual(["email"]);
    expect(d.suppressed).toEqual(["sms", "push"]);
    // SMS -> sms_opt_out, push -> quiet_hours, email delivered.
    expect(d.reason).toBe("delivered, quiet_hours, sms_opt_out");
  });

  it("combines email opt-out + quiet hours -> nothing fires", () => {
    const prefs: NotifPrefs = {
      channels: { email: true, sms: true, push: true },
      emailOptOut: true,
      quietHours: { startHour: 21, endHour: 7 },
    };
    const d = resolveNotification("new_message", prefs, "2026-07-05T23:00:00Z");
    expect(d.channels).toEqual([]);
    expect(d.suppressed).toEqual(["email", "sms", "push"]);
    expect(d.reason).toBe("quiet_hours, email_opt_out");
  });
});

describe("resolveNotification — event mutes", () => {
  it("mutes all channels for a muted event", () => {
    const prefs: NotifPrefs = { channels: allOn, eventMutes: ["invoice_created"] };
    const d = resolveNotification("invoice_created", prefs, NOON_UTC);
    expect(d.channels).toEqual([]);
    expect(d.suppressed).toEqual(["email", "sms", "push"]);
    expect(d.reason).toBe("event_muted");
  });

  it("only mutes the listed event, not others", () => {
    const prefs: NotifPrefs = { channels: allOn, eventMutes: ["invoice_created"] };
    const d = resolveNotification("invoice_paid", prefs, NOON_UTC);
    expect(d.channels).toEqual(["email", "sms", "push"]);
    expect(d.reason).toBe("delivered");
  });

  it("mute wins over quiet hours and opt-outs", () => {
    const prefs: NotifPrefs = {
      channels: allOn,
      smsOptOut: true,
      quietHours: { startHour: 21, endHour: 7 },
      eventMutes: ["new_message"],
    };
    const d = resolveNotification("new_message", prefs, "2026-07-05T23:00:00Z");
    expect(d.channels).toEqual([]);
    expect(d.reason).toBe("event_muted");
  });

  it("ignores a non-array eventMutes (guard)", () => {
    const prefs = { channels: allOn, eventMutes: "invoice_created" } as unknown as NotifPrefs;
    const d = resolveNotification("invoice_created", prefs, NOON_UTC);
    expect(d.channels).toEqual(["email", "sms", "push"]);
    expect(d.reason).toBe("delivered");
  });
});

describe("resolveNotification — owner/ops events", () => {
  it("falls back to owner default channels when no channel preference is set", () => {
    const prefs: NotifPrefs = { channels: {} };
    const d = resolveNotification("low_stock", prefs, NOON_UTC);
    expect(d.channels).toEqual([...OWNER_DEFAULT_CHANNELS]);
    expect(d.reason).toBe("delivered");
  });

  it("owner fallback also applies with null prefs", () => {
    const d = resolveNotification("crew_arrival", null, NOON_UTC);
    expect(d.channels).toEqual([...OWNER_DEFAULT_CHANNELS]);
    expect(d.reason).toBe("delivered");
  });

  it("owner defaults still respect quiet hours (push held, email fires)", () => {
    const prefs: NotifPrefs = { channels: {}, quietHours: { startHour: 21, endHour: 7 } };
    const d = resolveNotification("crew_arrival", prefs, "2026-07-05T23:00:00Z");
    expect(d.channels).toEqual(["email"]);
    expect(d.suppressed).toEqual(["push"]);
    expect(d.reason).toBe("delivered, quiet_hours");
  });

  it("owner defaults still respect emailOptOut", () => {
    const prefs: NotifPrefs = { channels: {}, emailOptOut: true };
    const d = resolveNotification("low_stock", prefs, NOON_UTC);
    expect(d.channels).toEqual(["push"]);
    expect(d.suppressed).toEqual(["email"]);
    expect(d.reason).toBe("delivered, email_opt_out");
  });

  it("respects an explicit channel preference on an owner event (no fallback)", () => {
    const prefs: NotifPrefs = { channels: { sms: true } };
    const d = resolveNotification("low_stock", prefs, NOON_UTC);
    expect(d.channels).toEqual(["sms"]);
    expect(d.reason).toBe("delivered");
  });

  it("does NOT fall back when the user explicitly disabled channels (keys present)", () => {
    const prefs: NotifPrefs = { channels: { email: false, push: false } };
    const d = resolveNotification("low_stock", prefs, NOON_UTC);
    expect(d.channels).toEqual([]);
    expect(d.suppressed).toEqual([]);
    expect(d.reason).toBe("no_channels_enabled");
  });

  it("mute still wins over the owner fallback", () => {
    const prefs: NotifPrefs = { channels: {}, eventMutes: ["low_stock"] };
    const d = resolveNotification("low_stock", prefs, NOON_UTC);
    expect(d.channels).toEqual([]);
    expect(d.suppressed).toEqual([...OWNER_DEFAULT_CHANNELS]);
    expect(d.reason).toBe("event_muted");
  });
});

describe("resolveNotification — empty / no channels", () => {
  it("fires nothing for a non-owner event with no channels enabled", () => {
    const prefs: NotifPrefs = { channels: {} };
    const d = resolveNotification("invoice_created", prefs, NOON_UTC);
    expect(d.channels).toEqual([]);
    expect(d.suppressed).toEqual([]);
    expect(d.reason).toBe("no_channels_enabled");
  });

  it("fires nothing when all channels are explicitly false", () => {
    const prefs: NotifPrefs = { channels: { email: false, sms: false, push: false } };
    const d = resolveNotification("new_message", prefs, NOON_UTC);
    expect(d.channels).toEqual([]);
    expect(d.reason).toBe("no_channels_enabled");
  });
});

describe("resolveNotification — input guards", () => {
  it("treats null prefs as empty for a non-owner event", () => {
    const d = resolveNotification("invoice_created", null, NOON_UTC);
    expect(d.channels).toEqual([]);
    expect(d.reason).toBe("no_channels_enabled");
  });

  it("treats undefined prefs as empty", () => {
    const d = resolveNotification("invoice_created", undefined, NOON_UTC);
    expect(d.channels).toEqual([]);
    expect(d.reason).toBe("no_channels_enabled");
  });

  it("tolerates a missing channels object (guard)", () => {
    const prefs = {} as unknown as NotifPrefs;
    const d = resolveNotification("invoice_created", prefs, NOON_UTC);
    expect(d.channels).toEqual([]);
    expect(d.reason).toBe("no_channels_enabled");
  });

  it("does not suppress on an unparseable nowISO even with quiet hours set", () => {
    const prefs: NotifPrefs = { channels: allOn, quietHours: { startHour: 21, endHour: 7 } };
    const d = resolveNotification("new_message", prefs, "totally-not-a-date");
    expect(d.channels).toEqual(["email", "sms", "push"]);
    expect(d.reason).toBe("delivered");
  });

  it("does not suppress on NaN quiet-hours bounds", () => {
    const prefs: NotifPrefs = {
      channels: allOn,
      quietHours: { startHour: NaN, endHour: 7 },
    };
    const d = resolveNotification("new_message", prefs, "2026-07-05T23:00:00Z");
    expect(d.channels).toEqual(["email", "sms", "push"]);
    expect(d.reason).toBe("delivered");
  });

  it("treats an empty-string nowISO as undeterminable time", () => {
    const prefs: NotifPrefs = { channels: allOn, quietHours: { startHour: 21, endHour: 7 } };
    const d = resolveNotification("new_message", prefs, "");
    expect(d.channels).toEqual(["email", "sms", "push"]);
  });
});

describe("exported constants", () => {
  it("ALL_CHANNELS is the canonical trio", () => {
    expect([...ALL_CHANNELS]).toEqual(["email", "sms", "push"]);
  });

  it("OWNER_EVENTS are low_stock and crew_arrival", () => {
    expect([...OWNER_EVENTS]).toEqual(["low_stock", "crew_arrival"]);
  });

  it("OWNER_DEFAULT_CHANNELS excludes SMS by default", () => {
    expect([...OWNER_DEFAULT_CHANNELS]).toEqual(["email", "push"]);
    expect(OWNER_DEFAULT_CHANNELS).not.toContain("sms");
  });
});
