// reviewsDedup — PURE dedup + rollup math for ingested reviews (feat-reviews-ingestion).
//
// This is the hard-logic core for the reviews-ingestion feature. Given the reviews
// already stored for a tenant plus a fresh batch pulled from an external source
// (Google, Yelp, ...), it decides which rows are brand-new (INSERT) and which are
// re-ingests of rows we already have (UPDATE), keyed on `source + externalId`. It
// also rolls a set of ratings up into the summary numbers a storefront/widget shows.
//
// Everything here is PURE and DETERMINISTIC: no I/O, no clock reads, no randomness,
// no imports. Callers pass the reference "now" as an ISO string. Same inputs always
// produce the same outputs, so it is trivially unit-testable and safe to reuse.

/** A single review as pulled from an external source, normalized for ingestion. */
export interface IngestedReview {
  /** Origin of the review. Well-known values are 'google' | 'yelp'; any string is allowed. */
  source: 'google' | 'yelp' | string;
  /** Stable id of the review *within its source*. Unique per (source, externalId). */
  externalId: string;
  /** Star rating. Expected 1..5; out-of-range / non-finite values are ignored by rollups. */
  rating: number;
  text?: string;
  author?: string;
  /** ISO-8601 timestamp of when the review was created at the source. */
  createdAt: string;
}

/** A reference to a review row we already have stored (identity columns only). */
export interface ExistingReviewRef {
  source: string;
  externalId: string;
  /** Our internal primary key for the stored row. */
  id: string;
}

/** A single "update this stored row with this fresh review" instruction. */
export interface ReviewUpdate {
  /** Primary key of the stored row to update. */
  id: string;
  /** The fresh incoming review to overwrite it with. */
  review: IngestedReview;
}

/** The write plan produced by {@link dedupePlan}. */
export interface DedupePlan {
  /** Reviews with no matching stored row — insert as new. Preserves incoming order. */
  toInsert: IngestedReview[];
  /** Reviews that match a stored row by (source, externalId) — update in place. */
  toUpdate: ReviewUpdate[];
}

/** Per-star counts, always present for every bucket 1..5. */
export type RatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

/** The rolled-up summary produced by {@link rollupRatings}. */
export interface RatingRollup {
  /** Mean rating over valid reviews, rounded to 1 decimal. Empty -> 0. */
  avg: number;
  /** Number of valid reviews (finite rating in 1..5). */
  count: number;
  /** Valid reviews created within the trailing 30 days ending at `nowISO`. */
  last30dCount: number;
  /** Count per star bucket; always sums to `count`. */
  distribution: RatingDistribution;
}

// NUL separator: cannot appear in normal source/id text, so no two distinct
// (source, externalId) pairs can ever produce the same key by concatenation
// (e.g. ('a','bc') vs ('ab','c') stay distinct). Built via fromCharCode to keep
// the source file plain ASCII.
const KEY_SEP = String.fromCharCode(0);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Canonical dedup key for a review: `source` joined to `externalId`.
 *
 * Values are coerced to strings and joined with a NUL separator, so pairs like
 * ('a', 'bc') and ('ab', 'c') never collide. Nullish parts coerce to ''.
 */
export function reviewKey(source: string, externalId: string): string {
  return `${String(source ?? '')}${KEY_SEP}${String(externalId ?? '')}`;
}

/** True when `rating` is a finite number inside the 1..5 star range. */
export function isValidRating(rating: unknown): rating is number {
  return (
    typeof rating === 'number' &&
    Number.isFinite(rating) &&
    rating >= 1 &&
    rating <= 5
  );
}

/**
 * Split an incoming batch of reviews into inserts vs. updates against what we store.
 *
 * Matching is by `reviewKey(source, externalId)`. A review whose key matches an
 * existing row is an UPDATE (carrying that row's `id`); otherwise it is an INSERT.
 * Re-ingesting the exact same rows therefore yields `toInsert: []`.
 *
 * The batch is also de-duplicated against itself: if the same key appears more than
 * once in `incoming`, only the FIRST occurrence produces a plan entry (later
 * duplicates are dropped), so a self-duplicated batch can never plan two writes for
 * one key. Nullish rows in either array are skipped defensively.
 */
export function dedupePlan(
  existing: ExistingReviewRef[],
  incoming: IngestedReview[],
): DedupePlan {
  const existingIdByKey = new Map<string, string>();
  for (const row of existing ?? []) {
    if (!row) continue;
    const key = reviewKey(row.source, row.externalId);
    // First existing row for a key wins; ignore accidental duplicates.
    if (!existingIdByKey.has(key)) existingIdByKey.set(key, row.id);
  }

  const toInsert: IngestedReview[] = [];
  const toUpdate: ReviewUpdate[] = [];
  const seen = new Set<string>();

  for (const review of incoming ?? []) {
    if (!review) continue;
    const key = reviewKey(review.source, review.externalId);
    if (seen.has(key)) continue; // intra-batch duplicate — first occurrence already handled
    seen.add(key);

    const existingId = existingIdByKey.get(key);
    if (existingId !== undefined) {
      toUpdate.push({ id: existingId, review });
    } else {
      toInsert.push(review);
    }
  }

  return { toInsert, toUpdate };
}

/**
 * Roll a set of ratings up into summary numbers for a reviews widget/storefront.
 *
 * Only "valid" reviews — those with a finite rating in the 1..5 range — are counted;
 * malformed rows (NaN, null, out-of-range, non-numeric) are ignored so they cannot
 * skew the average or the distribution. Consequently `distribution` always sums to
 * `count`. `avg` is the mean of valid ratings rounded to one decimal (0 when there
 * are none). `last30dCount` counts valid reviews whose `createdAt` parses to a time
 * within the 30 days ending at `nowISO`; an unparseable `nowISO` yields 0 because
 * the window is undefined, and an unparseable `createdAt` is simply not in-window.
 */
export function rollupRatings(
  reviews: { rating: number; createdAt: string }[],
  nowISO: string,
): RatingRollup {
  const distribution: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const nowMs = Date.parse(nowISO);
  const hasWindow = !Number.isNaN(nowMs);
  const cutoffMs = hasWindow ? nowMs - THIRTY_DAYS_MS : NaN;

  let count = 0;
  let sum = 0;
  let last30dCount = 0;

  for (const review of reviews ?? []) {
    if (!review || !isValidRating(review.rating)) continue;

    count += 1;
    sum += review.rating;

    const bucket = Math.min(5, Math.max(1, Math.round(review.rating))) as
      | 1
      | 2
      | 3
      | 4
      | 5;
    distribution[bucket] += 1;

    if (hasWindow) {
      const t = Date.parse(review.createdAt);
      if (!Number.isNaN(t) && t >= cutoffMs && t <= nowMs) last30dCount += 1;
    }
  }

  const avg = count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
  return { avg, count, last30dCount, distribution };
}
