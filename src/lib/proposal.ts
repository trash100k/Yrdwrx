// Living Proposal — pure view-tracking + follow-up-threshold logic behind the "close it in
// the driveway" lane. A Proposal is a tiered (good/better/best) offer with before/after
// imagery, persisted on a `customer_design_visions.proposal` JSONB blob and linked to an
// estimate invoice (which carries the shipped e-sign + deposit hooks). This module is the
// money/engagement-sensitive math, kept PURE + typed so the server wiring stays trivial and
// the "customer viewed 2×, hasn't signed" auto-follow-up rule is unit-tested and shared with
// the owner-side engagement badge. No I/O here — callers persist the returned patch.

export interface ProposalTier {
  /** Stable slug: "good" | "better" | "best" (or any owner-defined id). */
  id: string;
  /** Display name, e.g. "Essential" / "Recommended" / "Premium". */
  name: string;
  /** Tier price in dollars. */
  price: number;
  /** One-line pitch. */
  blurb?: string;
  /** What's included at this tier. */
  bullets?: string[];
}

export interface ProposalView {
  at: string;
  ip?: string | null;
  ua?: string | null;
}

export interface Proposal {
  title?: string;
  summary?: string;
  tiers?: ProposalTier[];
  /** id of the recommended tier (defaults the client's selection + highlights it). */
  recommendedTier?: string;
  /** The client's picked tier id (set when they choose one before signing). */
  selectedTier?: string | null;
  /** Linked estimate invoice — the sign/deposit endpoints operate on THIS invoice. */
  estimateInvoiceId?: string | null;
  beforeUrl?: string | null;
  afterUrl?: string | null;
  /** Lifecycle: draft -> sent -> viewed -> signed/accepted. Cosmetic; the invoice is
   *  authoritative for "signed" (see `signed` args below). */
  status?: string;
  sentAt?: string | null;
  firstViewedAt?: string | null;
  lastViewedAt?: string | null;
  viewCount?: number;
  views?: ProposalView[];
  /** When the last "viewed but unsigned" owner nudge was fired (cooldown anchor). */
  followUpSentAt?: string | null;
  approved?: boolean;
  approvedAt?: string | null;
  [k: string]: any;
}

/** Two opens within this window count as one (guards StrictMode double-mount + refreshes). */
export const VIEW_DEDUPE_MS = 5_000;
/** Fire the "opened but not signed" nudge once the customer has opened it this many times. */
export const FOLLOWUP_VIEW_THRESHOLD = 2;
/** Never re-nudge the owner about the same proposal more than once per this window. */
export const FOLLOWUP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Cap the stored view trail so the JSONB row can't grow unbounded. */
const MAX_VIEWS = 50;

function ms(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

export interface RecordViewOpts {
  now?: string;
  ip?: string | null;
  ua?: string | null;
  /** The linked estimate is signed/accepted — so this view must not advance status to "viewed". */
  signed?: boolean;
  dedupeMs?: number;
}

/**
 * Fold an open/view event into a proposal. Returns a NEW proposal object (the patch the
 * caller persists) plus `counted` = whether it incremented the view count (false when the
 * open landed inside the dedupe window). Never mutates the input. Bumps viewCount +
 * first/lastViewedAt + a capped `views[]` trail, and advances a live proposal to "viewed"
 * (never downgrades a signed/accepted one).
 */
export function recordProposalView(
  proposal: Proposal | null | undefined,
  opts: RecordViewOpts = {},
): { proposal: Proposal; counted: boolean } {
  const now = opts.now || new Date().toISOString();
  const nowMs = ms(now);
  const p: Proposal = { ...(proposal || {}) };

  const last = ms(p.lastViewedAt);
  const window = opts.dedupeMs ?? VIEW_DEDUPE_MS;
  const deduped = Number.isFinite(last) && Number.isFinite(nowMs) && nowMs - last < window;

  if (!p.firstViewedAt) p.firstViewedAt = now;
  p.lastViewedAt = now;

  if (!deduped) {
    p.viewCount = (Number(p.viewCount) || 0) + 1;
    const prior = Array.isArray(p.views) ? p.views.slice(-(MAX_VIEWS - 1)) : [];
    prior.push({ at: now, ip: opts.ip ?? null, ua: opts.ua ? String(opts.ua).slice(0, 200) : null });
    p.views = prior;
  }

  if (!opts.signed && p.status !== "signed" && p.status !== "accepted" && !p.approved) {
    p.status = "viewed";
  }

  return { proposal: p, counted: !deduped };
}

export interface FollowUpOpts {
  now?: string;
  /** The linked estimate is signed/accepted — suppress the nudge. */
  signed?: boolean;
  threshold?: number;
  cooldownMs?: number;
}

/**
 * True when the owner should be nudged that a customer has opened the proposal but hasn't
 * signed: opened >= threshold times, not signed/accepted/approved, and not already nudged
 * inside the cooldown. Pure — the caller fires the notification + stamps followUpSentAt.
 */
export function shouldFollowUp(proposal: Proposal | null | undefined, opts: FollowUpOpts = {}): boolean {
  if (!proposal) return false;
  if (opts.signed) return false;
  if (proposal.status === "signed" || proposal.status === "accepted" || proposal.approved) return false;

  const views = Number(proposal.viewCount) || 0;
  if (views < (opts.threshold ?? FOLLOWUP_VIEW_THRESHOLD)) return false;

  const now = opts.now ? ms(opts.now) : Date.now();
  const lastNudge = ms(proposal.followUpSentAt);
  if (Number.isFinite(lastNudge) && Number.isFinite(now) && now - lastNudge < (opts.cooldownMs ?? FOLLOWUP_COOLDOWN_MS)) {
    return false;
  }
  return true;
}

export interface DeriveTiersOpts {
  goodName?: string;
  betterName?: string;
  bestName?: string;
  goodFactor?: number;
  bestFactor?: number;
}

/** Round to the nearest $5 (never below $1 for a positive input) for clean tier pricing. */
function roundTier(n: number): number {
  const v = Math.max(0, Number(n) || 0);
  if (v <= 0) return 0;
  const rounded = Math.round(v / 5) * 5;
  return rounded < 1 ? Math.round(v) : rounded;
}

/**
 * Build a good/better/best ladder from a single estimate total when the owner sends an
 * estimate as a proposal without explicit tiers. The middle tier == the estimate amount and
 * is the recommended one; "good" trims scope, "best" adds premium upgrades.
 */
export function deriveTiers(baseAmount: number, opts: DeriveTiersOpts = {}): ProposalTier[] {
  const base = Math.max(0, Number(baseAmount) || 0);
  const good = opts.goodFactor ?? 0.85;
  const best = opts.bestFactor ?? 1.25;
  return [
    { id: "good", name: opts.goodName || "Essential", price: roundTier(base * good), blurb: "Core scope to get the job done right.", bullets: [] },
    { id: "better", name: opts.betterName || "Recommended", price: roundTier(base), blurb: "The full scope we recommend for lasting results.", bullets: [] },
    { id: "best", name: opts.bestName || "Premium", price: roundTier(base * best), blurb: "Everything in Recommended, plus premium upgrades.", bullets: [] },
  ];
}

/** Normalize the owner-facing status, treating a signed linked invoice as authoritative. */
export function proposalDisplayStatus(proposal: Proposal | null | undefined, signed?: boolean): string {
  if (signed || proposal?.status === "signed" || proposal?.status === "accepted" || proposal?.approved) return "signed";
  const views = Number(proposal?.viewCount) || 0;
  if (views > 0) return "viewed";
  if (proposal?.sentAt) return "sent";
  return "draft";
}

/** Short human badge for the owner surface: "Opened 2× · not signed", "Signed", "Sent", … */
export function engagementLabel(proposal: Proposal | null | undefined, signed?: boolean): string {
  const status = proposalDisplayStatus(proposal, signed);
  const views = Number(proposal?.viewCount) || 0;
  switch (status) {
    case "signed":
      return "Signed";
    case "viewed":
      return `Opened ${views}×${" · not signed"}`;
    case "sent":
      return "Sent · not opened";
    default:
      return "Draft";
  }
}
