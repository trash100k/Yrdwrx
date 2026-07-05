// Notification channel-resolution rules — the pure decision core behind the
// `feat-notifications` feature. Given a domain event and a user's notification
// preferences, it decides which delivery channels a notification should fire on,
// which were suppressed, and why.
//
// Everything here is PURE and DETERMINISTIC. There are NO imports of the server,
// Firebase, React, or any I/O. The caller passes `nowISO` (the reference instant);
// the module never reads the wall clock (no Date.now) and never uses randomness.
// Given the same inputs it always yields the same output, so it unit-tests cleanly.
//
// Quiet-hours time-of-day resolution uses the built-in `Intl` API (bundled ICU,
// no import) when a timezone is supplied — this is a deterministic function of the
// (instant, timezone) pair, not a clock read. Without a timezone it falls back to
// the UTC hour of `nowISO`.

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Events that can trigger a notification. */
export type NotifEvent =
  | "invoice_created"
  | "invoice_paid"
  | "new_message"
  | "design_approved"
  | "low_stock"
  | "crew_arrival";

/** Delivery channels a notification can go out on. */
export type Channel = "email" | "sms" | "push";

/** A quiet-hours window. Hours are 0–23 wall-clock in the given `tz` (or UTC). */
export interface QuietHours {
  /** Inclusive start hour of the quiet window (0–23). */
  startHour: number;
  /** Exclusive end hour of the quiet window (0–23; 24 is accepted as end-of-day). */
  endHour: number;
  /** IANA timezone (e.g. "America/New_York"). If omitted/invalid, UTC is used. */
  tz?: string;
}

/** A user's notification preferences. */
export interface NotifPrefs {
  /** Which channels are enabled. A channel fires only if its value is `true`. */
  channels: Partial<Record<Channel, boolean>>;
  /** Global SMS opt-out (e.g. TCPA STOP). Drops SMS regardless of `channels`. */
  smsOptOut?: boolean;
  /** Global email opt-out (e.g. unsubscribed). Drops email regardless of `channels`. */
  emailOptOut?: boolean;
  /** Quiet-hours window during which SMS + push are held (email still allowed). */
  quietHours?: QuietHours | null;
  /** Events the user has fully muted (no channels fire). */
  eventMutes?: NotifEvent[];
}

/** The reason codes that can appear in `NotifDecision.reason`. */
export type NotifReasonCode =
  | "event_muted"
  | "no_channels_enabled"
  | "delivered"
  | "quiet_hours"
  | "sms_opt_out"
  | "email_opt_out";

/** The outcome of resolving a notification. */
export interface NotifDecision {
  /** Channels the notification actually fires on (ordered email, sms, push). */
  channels: Channel[];
  /** Channels that were candidates but got held back (same ordering). */
  suppressed: Channel[];
  /** Comma-joined, stably-ordered reason codes explaining the decision. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Canonical channel ordering used for all output arrays. */
export const ALL_CHANNELS: readonly Channel[] = ["email", "sms", "push"];

/** Owner/ops-facing events. When the user has expressed no channel preference
 *  at all, these fall back to {@link OWNER_DEFAULT_CHANNELS}. */
export const OWNER_EVENTS: readonly NotifEvent[] = ["low_stock", "crew_arrival"];

/** Default channels for owner/ops events when no channel preference is configured. */
export const OWNER_DEFAULT_CHANNELS: readonly Channel[] = ["email", "push"];

/** Stable output ordering for reason codes in {@link NotifDecision.reason}. */
const REASON_ORDER: readonly NotifReasonCode[] = [
  "event_muted",
  "no_channels_enabled",
  "delivered",
  "quiet_hours",
  "sms_opt_out",
  "email_opt_out",
];

// ---------------------------------------------------------------------------
// Time helpers (pure)
// ---------------------------------------------------------------------------

/** Normalize an hour to 0–23, tolerating fractional/negative/over-24 inputs.
 *  Returns null for non-finite input (NaN, Infinity). */
function normalizeHour(n: number): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return (((Math.floor(n) % 24) + 24) % 24);
}

/**
 * Resolve the 0–23 wall-clock hour of `nowISO`.
 * - With a valid `tz`, uses `Intl` (bundled ICU) to get the local hour — deterministic.
 * - Without a `tz`, or if `tz` is invalid, falls back to the UTC hour.
 * Returns null when `nowISO` cannot be parsed.
 */
export function getHourOfDay(nowISO: string, tz?: string): number | null {
  const t = typeof nowISO === "string" ? Date.parse(nowISO) : NaN;
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);

  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        hourCycle: "h23",
      }).formatToParts(d);
      const hourPart = parts.find((p) => p.type === "hour");
      if (hourPart) {
        const hv = parseInt(hourPart.value, 10);
        if (Number.isFinite(hv)) return ((hv % 24) + 24) % 24;
      }
    } catch {
      // Invalid timezone string -> fall through to UTC.
    }
  }

  return d.getUTCHours();
}

/**
 * Is `nowISO` inside the quiet-hours window? Supports wrap-around windows
 * (e.g. 21 -> 7 spans overnight). Returns false when:
 * - `quietHours` is null/undefined,
 * - start/end hours are non-finite,
 * - the window is degenerate (start === end),
 * - `nowISO` is unparseable (time cannot be determined).
 */
export function isQuietHoursActive(
  quietHours: QuietHours | null | undefined,
  nowISO: string,
): boolean {
  if (!quietHours) return false;

  const s = normalizeHour(quietHours.startHour);
  const e = normalizeHour(quietHours.endHour);
  if (s === null || e === null) return false;
  if (s === e) return false; // empty / degenerate window

  const h = getHourOfDay(nowISO, quietHours.tz);
  if (h === null) return false; // cannot determine the time -> do not suppress

  if (s < e) return h >= s && h < e; // same-day window
  return h >= s || h < e; // wrap-around (overnight) window
}

// ---------------------------------------------------------------------------
// Core resolution
// ---------------------------------------------------------------------------

/** Channels the user has explicitly enabled (value === true), in canonical order. */
export function getEnabledChannels(
  channels: Partial<Record<Channel, boolean>> | null | undefined,
): Channel[] {
  if (!channels || typeof channels !== "object") return [];
  return ALL_CHANNELS.filter((c) => channels[c] === true);
}

function formatReason(codes: Set<NotifReasonCode>): string {
  return REASON_ORDER.filter((c) => codes.has(c)).join(", ");
}

/**
 * Decide which channels a notification fires on.
 *
 * Rules (applied in order):
 *  1. Start from the user's enabled channels. For {@link OWNER_EVENTS}, if the user
 *     has expressed no channel preference at all, fall back to {@link OWNER_DEFAULT_CHANNELS}.
 *  2. If the event is muted (`eventMutes`), nothing fires.
 *  3. Drop SMS if `smsOptOut`; drop email if `emailOptOut`.
 *  4. During quiet hours, hold SMS + push (email is still allowed).
 *
 * All inputs are guarded: a null/garbage `prefs`, missing `channels`, a
 * non-array `eventMutes`, NaN quiet-hours, and an unparseable `nowISO` are all
 * handled without throwing.
 *
 * @param event  the domain event that occurred
 * @param prefs  the user's notification preferences
 * @param nowISO reference instant (ISO 8601) driving the quiet-hours check
 */
export function resolveNotification(
  event: NotifEvent,
  prefs: NotifPrefs | null | undefined,
  nowISO: string,
): NotifDecision {
  const p: Partial<NotifPrefs> = prefs ?? {};
  const channelsCfg: Partial<Record<Channel, boolean>> =
    p.channels && typeof p.channels === "object" ? p.channels : {};
  const mutes: NotifEvent[] = Array.isArray(p.eventMutes) ? p.eventMutes : [];

  // 1. Base candidate channels.
  let base = getEnabledChannels(channelsCfg);
  if (
    base.length === 0 &&
    OWNER_EVENTS.includes(event) &&
    Object.keys(channelsCfg).length === 0
  ) {
    base = [...OWNER_DEFAULT_CHANNELS];
  }
  const baseSet = new Set<Channel>(base);
  const candidates = ALL_CHANNELS.filter((c) => baseSet.has(c));

  // 2. Fully-muted event short-circuits everything.
  if (mutes.includes(event)) {
    return { channels: [], suppressed: candidates, reason: "event_muted" };
  }

  const quiet = isQuietHoursActive(p.quietHours ?? null, nowISO);

  const fired: Channel[] = [];
  const suppressed: Channel[] = [];
  const codes = new Set<NotifReasonCode>();

  for (const c of candidates) {
    if (c === "email") {
      // 3. Email opt-out drops email; quiet hours never affect email.
      if (p.emailOptOut) {
        suppressed.push(c);
        codes.add("email_opt_out");
      } else {
        fired.push(c);
      }
    } else if (c === "sms") {
      // 3 + 4. Opt-out wins over quiet hours; both suppress SMS.
      if (p.smsOptOut) {
        suppressed.push(c);
        codes.add("sms_opt_out");
      } else if (quiet) {
        suppressed.push(c);
        codes.add("quiet_hours");
      } else {
        fired.push(c);
      }
    } else {
      // push — 4. Held during quiet hours.
      if (quiet) {
        suppressed.push(c);
        codes.add("quiet_hours");
      } else {
        fired.push(c);
      }
    }
  }

  if (fired.length > 0) codes.add("delivered");
  if (candidates.length === 0) codes.add("no_channels_enabled");

  return { channels: fired, suppressed, reason: formatReason(codes) };
}
