// SMS / text-campaign compliance + composition helpers.
//
// Pure, dependency-free functions shared by the server (outbound send, inbound STOP/HELP
// handling) and the frontend (composer segment counter, consent-aware targeting). Kept
// type-clean (no @ts-nocheck) like securityUtils.ts because the compliance logic here is
// load-bearing and is unit-tested in smsCampaign.test.ts.
//
// Compliance grounding (see TEXT_CAMPAIGN_RESEARCH.md): TCPA/CTIA require honoring opt-out
// via any reasonable keyword, only texting consented numbers, and identifying an opt-out
// path on marketing messages. These helpers encode those rules so every send path enforces
// them the same way.

// --- Consent state ---------------------------------------------------------
// Mirrors customers.sms_consent (migration 0010): the level of permission on file.
//   none          -> never text (no consent captured)
//   transactional -> service messages only (confirmations, on-my-way, receipts)
//   marketing      -> full marketing/promotional consent (PEWC)
export type SmsConsent = "none" | "transactional" | "marketing";

export interface ConsentRecipient {
  consent?: SmsConsent | string | null;
  smsConsent?: SmsConsent | string | null; // camelCase alias as it arrives from the repo
  optOutAt?: string | null;
  smsOptOutAt?: string | null;
  phone?: string | null;
}

// --- Inbound command keywords (carrier-standard + common natural variants) --
export const STOP_KEYWORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout", "opt-out"];
export const HELP_KEYWORDS = ["help", "info"];
export const START_KEYWORDS = ["start", "yes", "unstop", "optin", "opt-in"];

export type SmsCommand = "stop" | "help" | "start" | null;

/** Normalize an inbound SMS body for keyword matching: trim, lowercase, strip punctuation. */
export function normalizeInbound(body: string | null | undefined): string {
  return String(body ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.!?,'"]+$/g, "")
    .trim();
}

/**
 * Classify an inbound message as an opt-out (STOP), help (HELP), or re-subscribe (START)
 * command. Matches an exact keyword OR a short message that clearly leads with one (e.g.
 * "stop texting me"). Returns null for ordinary conversational replies so the AI/agent
 * layer can handle them. STOP takes precedence — when in doubt, suppress.
 */
export function detectSmsCommand(body: string | null | undefined): SmsCommand {
  const text = normalizeInbound(body);
  if (!text) return null;
  const firstWord = text.split(/\s+/)[0];
  const isMatch = (kw: string[]) => kw.includes(text) || kw.includes(firstWord);
  if (isMatch(STOP_KEYWORDS) || /\bstop\b/.test(text)) return "stop";
  if (isMatch(HELP_KEYWORDS)) return "help";
  if (isMatch(START_KEYWORDS)) return "start";
  return null;
}

// --- Opt-out footer --------------------------------------------------------
export const OPT_OUT_FOOTER = "Reply STOP to opt out.";

/** True if the message already contains opt-out language (avoid double-appending). */
export function hasOptOutLanguage(body: string): boolean {
  return /\bstop\b/i.test(String(body ?? ""));
}

/**
 * Append the standard opt-out footer to a marketing message unless one is already present.
 * Idempotent. Use on marketing sends only — transactional messages don't need it.
 */
export function appendOptOutFooter(body: string, footer: string = OPT_OUT_FOOTER): string {
  const text = String(body ?? "").trimEnd();
  if (!text) return footer;
  if (hasOptOutLanguage(text)) return text;
  return `${text} ${footer}`;
}

// --- Segment counter -------------------------------------------------------
// GSM-7 basic + extension tables (GSM 03.38). Extension chars cost 2 units each.
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENSION = "^{}\\[~]|€";

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (GSM7_BASIC.indexOf(ch) === -1 && GSM7_EXTENSION.indexOf(ch) === -1) return false;
  }
  return true;
}

export interface SegmentInfo {
  encoding: "GSM-7" | "UCS-2";
  units: number; // billable character units
  segments: number; // number of SMS parts this message will split into
  perSegment: number; // capacity per segment at this length
  remaining: number; // units left before the next segment boundary
}

/**
 * Estimate how many SMS segments a message body will use, mirroring carrier math:
 * GSM-7 = 160 (single) / 153 (concatenated); UCS-2 = 70 / 67. Drives the composer's
 * "1 SMS / 2 SMS" counter and the cost estimate. Empty body counts as 1 segment of 0 units.
 */
export function countSmsSegments(body: string | null | undefined): SegmentInfo {
  const text = String(body ?? "");
  const gsm = isGsm7(text);
  let units = 0;
  if (gsm) {
    for (const ch of text) units += GSM7_EXTENSION.indexOf(ch) !== -1 ? 2 : 1;
  } else {
    units = text.length; // UTF-16 code units ~= UCS-2 billing units
  }
  const single = gsm ? 160 : 70;
  const concat = gsm ? 153 : 67;
  let segments: number;
  let perSegment: number;
  if (units <= single) {
    segments = 1;
    perSegment = single;
  } else {
    segments = Math.ceil(units / concat);
    perSegment = concat;
  }
  return {
    encoding: gsm ? "GSM-7" : "UCS-2",
    units,
    segments,
    perSegment,
    remaining: Math.max(0, segments * perSegment - units),
  };
}

// --- Consent gating --------------------------------------------------------
function consentOf(r: ConsentRecipient): string {
  return String(r.consent ?? r.smsConsent ?? "none").toLowerCase();
}
function optOutOf(r: ConsentRecipient): string | null | undefined {
  return r.optOutAt ?? r.smsOptOutAt ?? null;
}

/** True only when the recipient has full marketing consent on file and has not opted out. */
export function canReceiveMarketing(recipient: ConsentRecipient): boolean {
  if (!recipient) return false;
  if (optOutOf(recipient)) return false;
  return consentOf(recipient) === "marketing";
}

/** True when the recipient can receive a transactional/service message (and hasn't opted out). */
export function canReceiveTransactional(recipient: ConsentRecipient): boolean {
  if (!recipient) return false;
  if (optOutOf(recipient)) return false;
  const c = consentOf(recipient);
  return c === "marketing" || c === "transactional";
}

export interface ConsentPartition<T> {
  sendable: T[];
  excluded: Array<{ recipient: T; reason: "no_phone" | "opted_out" | "no_marketing_consent" }>;
}

/**
 * Split a recipient list into who can lawfully receive a MARKETING text vs who must be
 * excluded (and why). The UI surfaces the excluded count ("12 excluded: no marketing
 * consent") and the server re-checks before sending — never trust the client alone.
 */
export function partitionForMarketing<T extends ConsentRecipient>(recipients: T[]): ConsentPartition<T> {
  const sendable: T[] = [];
  const excluded: ConsentPartition<T>["excluded"] = [];
  for (const r of recipients || []) {
    if (!r || !String(r.phone ?? "").trim()) {
      excluded.push({ recipient: r, reason: "no_phone" });
    } else if (optOutOf(r)) {
      excluded.push({ recipient: r, reason: "opted_out" });
    } else if (consentOf(r) !== "marketing") {
      excluded.push({ recipient: r, reason: "no_marketing_consent" });
    } else {
      sendable.push(r);
    }
  }
  return { sendable, excluded };
}

// --- Quiet hours -----------------------------------------------------------
// CTIA best practice: send only during the recipient's local daytime. Default window
// 8:00–21:00. Marketing sends outside the window should be deferred, not sent.
export const QUIET_HOURS_START = 8; // inclusive
export const QUIET_HOURS_END = 21; // exclusive

/** True if the given local hour (0–23) is inside the allowed sending window. */
export function isWithinSendWindow(localHour: number, start = QUIET_HOURS_START, end = QUIET_HOURS_END): boolean {
  return localHour >= start && localHour < end;
}
