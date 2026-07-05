// AI missed-call receptionist / speed-to-lead — PURE decision + formatting core.
//
// This module holds the deterministic, I/O-free logic behind the receptionist
// feature: normalizing a caller's phone, extracting {name, address, need, urgency}
// from what they said (a mock-safe heuristic fallback used whenever Gemini is off),
// building the instant SMS reply copy, and rendering the Twilio voice TwiML.
//
// Like notificationRules.ts / usageLedger.ts it imports NOTHING from the server,
// React, Firebase, or any I/O. Every input is passed in; the wall clock is only read
// via a caller-supplied `nowISO`. Given the same inputs it always yields the same
// output, so it unit-tests cleanly and can be shared by server.ts and the client.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Urgency = "low" | "medium" | "high";

export interface ReceptionistExtraction {
  name: string;
  address: string;
  need: string;
  urgency: Urgency;
  summary: string;
}

export interface BusinessHours {
  /** IANA tz (e.g. "America/Chicago"). Omitted/invalid → UTC hour of nowISO. */
  tz?: string;
  /** Open hour or "HH:MM". */
  start?: string | number;
  /** Close hour or "HH:MM". */
  end?: string | number;
  /** Open days, 0=Sun..6=Sat. Omitted → open every day. */
  days?: number[];
}

export interface ReceptionistSettings {
  enabled?: boolean;
  autoReply?: boolean;
  twilioNumber?: string;
  businessHours?: BusinessHours | null;
  afterHoursMessage?: string;
}

// Lead `data.source` values a receptionist-captured lead can carry. The Inbox
// filters on these to show the receptionist queue.
export const RECEPTIONIST_SOURCES = [
  "missed_call",
  "voicemail",
  "inbound_sms",
  "receptionist",
] as const;

// The Gemini system instruction. Exported so the server's mock-mode matcher (and
// tests) can key off it, and so there is one canonical prompt.
export const RECEPTIONIST_SYSTEM_INSTRUCTION = `You are the AI receptionist for a local landscaping / field-service company.
A prospective customer just called or texted. From their message, extract the lead
details as STRICT JSON with exactly these keys:
{
  "name": "the caller's name, or empty string",
  "address": "the service address or city they mention, or empty string",
  "need": "a short phrase (<= 8 words) describing the work they want, e.g. 'weekly lawn mowing', 'fallen tree removal', 'landscape design quote'",
  "urgency": "low | medium | high — high for emergencies (storm/tree damage, flooding, leaks, safety), medium for 'this week'/quotes/scheduling, low otherwise",
  "summary": "one plain-language sentence a busy owner can skim"
}
Do not invent details that were not said. Output ONLY the JSON object.`;

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

export interface NormalizedPhone {
  raw: string;
  digits: string;
  last10: string;
  /** Best-effort E.164. US-defaults a bare 10-digit number to +1. */
  e164: string;
  valid: boolean;
}

export function normalizePhone(raw: any): NormalizedPhone {
  const s = String(raw ?? "").trim();
  const hadPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  const valid = digits.length >= 10 && digits.length <= 15;
  const last10 = digits.slice(-10);
  let e164 = "";
  if (valid) {
    if (hadPlus) e164 = "+" + digits;
    else if (digits.length === 10) e164 = "+1" + digits; // US default
    else e164 = "+" + digits;
  }
  return { raw: s, digits, last10, e164, valid };
}

// ---------------------------------------------------------------------------
// Urgency
// ---------------------------------------------------------------------------

const HIGH_URGENCY =
  /\b(emergency|asap|urgent(?:ly)?|right away|immediately|today|tonight|flood(?:ing|ed)?|leak(?:ing)?|burst|storm|fell|fallen|down(?:ed)? tree|tree (?:is )?down|hazard|danger(?:ous)?|gas|sparking|no water|water everywhere)\b/i;
const MEDIUM_URGENCY =
  /\b(this week|by (?:friday|the weekend|monday|tomorrow)|tomorrow|soon|quote|estimate|schedule|book|appointment|before (?:the )?(?:party|event|wedding))\b/i;

export function classifyUrgency(text: any): Urgency {
  const s = String(text ?? "");
  if (HIGH_URGENCY.test(s)) return "high";
  if (MEDIUM_URGENCY.test(s)) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Heuristic extraction (mock-safe fallback — used whenever Gemini is unavailable)
// ---------------------------------------------------------------------------

const SERVICE_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(mow(?:ing|ed)?|lawn cut|grass cut|cut(?:ting)? (?:the )?(?:grass|lawn))\b/i, "lawn mowing"],
  [/\b(landscap\w*)\b/i, "landscaping"],
  [/\b(clean[\s-]?up|yard clean|debris)\b/i, "yard cleanup"],
  [/\b(leaf|leaves)\b/i, "leaf removal"],
  [/\b(snow|plow(?:ing)?|ice)\b/i, "snow removal"],
  [/\b(hedge|shrub|bush|trim(?:ming)?|prun\w*)\b/i, "trimming & pruning"],
  [/\b(tree)\b/i, "tree work"],
  [/\b(mulch\w*)\b/i, "mulching"],
  [/\b(sod|seed(?:ing)?|new lawn)\b/i, "sod / seeding"],
  [/\b(irrigation|sprinkler\w*)\b/i, "irrigation"],
  [/\b(fertiliz\w*|weed\w*|aerat\w*|lawn (?:care|treatment))\b/i, "lawn treatment"],
  [/\b(gutter\w*)\b/i, "gutter cleaning"],
  [/\b(fence\w*)\b/i, "fencing"],
  [/\b(patio|paver\w*|hardscap\w*|retaining wall)\b/i, "hardscaping"],
  [/\b(drainage|grading|erosion)\b/i, "drainage / grading"],
  [/\b(design|redesign|makeover)\b/i, "landscape design"],
];

const ADDRESS_RE =
  /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:st(?:reet)?|ave(?:nue)?|road|rd|drive|dr|lane|ln|blvd|boulevard|court|ct|way|circle|cir|place|pl|terrace|ter|trail|trl|highway|hwy|pkwy|parkway)\b\.?)/i;

const NAME_RE =
  /(?:my name is|this is|i am|i'm|it's|its|name's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;

/** Clean, collapse whitespace, clamp. */
function tidy(s: any, n: number): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
}

/**
 * Pull structured lead fields out of free-text WITHOUT an LLM. This is the
 * deterministic fallback the server uses in mock mode (no GEMINI_API_KEY) and when
 * a real Gemini call fails — so the receptionist always captures *something* honest.
 */
export function extractLeadHeuristic(message: any): ReceptionistExtraction {
  const msg = tidy(message, 2000);
  const nameMatch = msg.match(NAME_RE);
  const name = nameMatch ? tidy(nameMatch[1], 120) : "";
  const addrMatch = msg.match(ADDRESS_RE);
  const address = addrMatch ? tidy(addrMatch[1], 240) : "";

  let need = "";
  for (const [re, label] of SERVICE_KEYWORDS) {
    if (re.test(msg)) {
      need = label;
      break;
    }
  }

  const urgency = classifyUrgency(msg);
  const summary = msg ? tidy(msg, 200) : "";
  return { name, address, need, urgency, summary };
}

/**
 * Coerce any extraction (AI JSON *or* heuristic) into a clean, complete
 * ReceptionistExtraction, backfilling missing fields from a heuristic pass over
 * the raw message. Never throws; always returns all five keys.
 */
export function normalizeExtraction(raw: any, message: any): ReceptionistExtraction {
  const h = extractLeadHeuristic(message);
  const r = raw && typeof raw === "object" ? raw : {};
  const urgencyRaw = String(r.urgency ?? "").toLowerCase();
  const urgency: Urgency =
    urgencyRaw === "high" || urgencyRaw === "medium" || urgencyRaw === "low"
      ? (urgencyRaw as Urgency)
      : h.urgency;
  const need = tidy(r.need, 80) || h.need;
  return {
    name: tidy(r.name, 120) || h.name,
    address: tidy(r.address, 240) || h.address,
    need,
    urgency,
    summary: tidy(r.summary, 200) || h.summary || need,
  };
}

// ---------------------------------------------------------------------------
// Business hours (pure; caller supplies nowISO)
// ---------------------------------------------------------------------------

function toHour(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return ((Math.floor(v) % 24) + 24) % 24;
  if (typeof v === "string") {
    const m = v.match(/^(\d{1,2})(?::(\d{2}))?/);
    if (m) {
      const h = parseInt(m[1], 10);
      if (Number.isFinite(h)) return ((h % 24) + 24) % 24;
    }
  }
  return null;
}

function localParts(nowISO: string, tz?: string): { hour: number; day: number } | null {
  const t = Date.parse(nowISO);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        hourCycle: "h23",
        weekday: "short",
      }).formatToParts(d);
      const hourPart = parts.find((p) => p.type === "hour");
      const wdPart = parts.find((p) => p.type === "weekday");
      const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      if (hourPart && wdPart) {
        const h = parseInt(hourPart.value, 10);
        const day = wdMap[wdPart.value];
        if (Number.isFinite(h) && day != null) return { hour: ((h % 24) + 24) % 24, day };
      }
    } catch {
      /* invalid tz → fall through to UTC */
    }
  }
  return { hour: d.getUTCHours(), day: d.getUTCDay() };
}

/**
 * Is `nowISO` inside the configured business hours? Missing/blank config → true
 * (treat as always open; the caller only uses this to pick the copy). Supports
 * overnight windows (start > end). Deterministic given (nowISO, config).
 */
export function isWithinBusinessHours(
  hours: BusinessHours | null | undefined,
  nowISO: string,
): boolean {
  if (!hours || (hours.start == null && hours.end == null && !hours.days)) return true;
  const now = localParts(nowISO, hours.tz);
  if (!now) return true; // cannot determine → assume open
  if (Array.isArray(hours.days) && hours.days.length > 0 && !hours.days.includes(now.day)) {
    return false;
  }
  const s = toHour(hours.start);
  const e = toHour(hours.end);
  if (s == null || e == null || s === e) return true; // no/degenerate window → open
  return s < e ? now.hour >= s && now.hour < e : now.hour >= s || now.hour < e;
}

// ---------------------------------------------------------------------------
// Reply copy (TCPA: always carries a "Reply STOP" opt-out notice)
// ---------------------------------------------------------------------------

export interface ReplyInput {
  name?: string;
  need?: string;
  businessName?: string;
  withinHours?: boolean;
  afterHoursMessage?: string;
}

const STOP_FOOTER = " Reply STOP to opt out.";

export function buildReceptionistReply(input: ReplyInput = {}): string {
  const name = tidy(input.name, 60);
  const need = tidy(input.need, 80);
  const brand = tidy(input.businessName, 60) || "our team";
  const who = name ? `Thanks ${name}!` : "Thanks for reaching out!";
  const what = need ? ` We got your request for ${need}.` : " We got your message.";
  const when =
    input.withinHours === false
      ? input.afterHoursMessage
        ? ` ${tidy(input.afterHoursMessage, 120)}`
        : " We're closed right now but will get back to you first thing."
      : ` Someone from ${brand} will reach out shortly.`;
  let body = `${who}${what}${when}`;
  // Reserve room for the mandatory opt-out footer, then clamp the whole SMS.
  const max = 320 - STOP_FOOTER.length;
  if (body.length > max) body = body.slice(0, max - 1) + "…";
  return body + STOP_FOOTER;
}

// ---------------------------------------------------------------------------
// TwiML (pure string builders; every dynamic value is XML-escaped)
// ---------------------------------------------------------------------------

export function xmlEscape(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const VOICE = "Polly.Joanna";

export interface InboundTwimlInput {
  businessName?: string;
  withinHours?: boolean;
  afterHoursMessage?: string;
  gatherUrl: string;
  transcriptionUrl: string;
  recordedUrl: string;
}

/** Greeting + speech-gather, with a voicemail (transcribed) fallback. */
export function buildInboundVoiceTwiml(i: InboundTwimlInput): string {
  const brand = xmlEscape(tidy(i.businessName, 60) || "our team");
  const greeting =
    i.withinHours === false && i.afterHoursMessage
      ? xmlEscape(tidy(i.afterHoursMessage, 200))
      : `Thanks for calling ${brand}. Sorry we missed you.`;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Say voice="${VOICE}">${greeting} In a few words, tell me your name and what you need, and we'll text you right back.</Say>` +
    `<Gather input="speech" speechTimeout="auto" language="en-US" action="${xmlEscape(i.gatherUrl)}" method="POST">` +
    `<Say voice="${VOICE}">Go ahead, I'm listening.</Say>` +
    `</Gather>` +
    `<Say voice="${VOICE}">Sorry, I didn't catch that. Please leave a short message after the tone.</Say>` +
    `<Record maxLength="120" playBeep="true" transcribe="true" transcribeCallback="${xmlEscape(i.transcriptionUrl)}" action="${xmlEscape(i.recordedUrl)}" method="POST"/>` +
    `<Say voice="${VOICE}">Thanks. We'll text you shortly. Goodbye.</Say>` +
    `</Response>`
  );
}

export interface VoicemailTwimlInput {
  transcriptionUrl: string;
  recordedUrl: string;
}

/** Straight-to-voicemail (transcribed) prompt. */
export function buildVoicemailTwiml(i: VoicemailTwimlInput): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Say voice="${VOICE}">Please leave your name, address, and what you need after the tone, and we'll text you right back.</Say>` +
    `<Record maxLength="120" playBeep="true" transcribe="true" transcribeCallback="${xmlEscape(i.transcriptionUrl)}" action="${xmlEscape(i.recordedUrl)}" method="POST"/>` +
    `<Say voice="${VOICE}">Thanks. We'll be in touch shortly. Goodbye.</Say>` +
    `</Response>`
  );
}

/** A terminal spoken acknowledgement + hangup. */
export function buildAckTwiml(message: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Say voice="${VOICE}">${xmlEscape(tidy(message, 300))}</Say><Hangup/></Response>`
  );
}
