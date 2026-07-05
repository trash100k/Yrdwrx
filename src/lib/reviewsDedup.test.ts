import { describe, it, expect } from 'vitest';
import {
  reviewKey,
  isValidRating,
  dedupePlan,
  rollupRatings,
  type IngestedReview,
  type ExistingReviewRef,
} from './reviewsDedup';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const review = (
  source: string,
  externalId: string,
  rating = 5,
  createdAt = '2026-01-01T00:00:00.000Z',
  extra: Partial<IngestedReview> = {},
): IngestedReview => ({ source, externalId, rating, createdAt, ...extra });

const ref = (source: string, externalId: string, id: string): ExistingReviewRef => ({
  source,
  externalId,
  id,
});

// ---------------------------------------------------------------------------
// reviewKey
// ---------------------------------------------------------------------------

describe('reviewKey', () => {
  it('is stable for the same (source, externalId)', () => {
    expect(reviewKey('google', 'abc')).toBe(reviewKey('google', 'abc'));
  });

  it('differs when source differs', () => {
    expect(reviewKey('google', 'abc')).not.toBe(reviewKey('yelp', 'abc'));
  });

  it('differs when externalId differs', () => {
    expect(reviewKey('google', 'abc')).not.toBe(reviewKey('google', 'abd'));
  });

  it('does not collide across the source/externalId boundary', () => {
    // Naive concatenation would make ('a','bc') === ('ab','c').
    expect(reviewKey('a', 'bc')).not.toBe(reviewKey('ab', 'c'));
  });

  it('coerces nullish parts to empty string without throwing', () => {
    expect(reviewKey(undefined as any, undefined as any)).toBe(
      reviewKey('', ''),
    );
    expect(reviewKey(null as any, 'x')).toBe(reviewKey('', 'x'));
  });
});

// ---------------------------------------------------------------------------
// isValidRating
// ---------------------------------------------------------------------------

describe('isValidRating', () => {
  it('accepts finite ratings in the 1..5 range (inclusive)', () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(3.7)).toBe(true);
  });

  it('rejects out-of-range ratings', () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(-1)).toBe(false);
    expect(isValidRating(0.9)).toBe(false);
    expect(isValidRating(5.1)).toBe(false);
  });

  it('rejects non-finite and non-number values', () => {
    expect(isValidRating(NaN)).toBe(false);
    expect(isValidRating(Infinity)).toBe(false);
    expect(isValidRating(null)).toBe(false);
    expect(isValidRating(undefined)).toBe(false);
    expect(isValidRating('5')).toBe(false);
    expect(isValidRating({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dedupePlan
// ---------------------------------------------------------------------------

describe('dedupePlan', () => {
  it('inserts everything when there is nothing stored', () => {
    const incoming = [review('google', 'a'), review('yelp', 'b')];
    const plan = dedupePlan([], incoming);
    expect(plan.toInsert).toEqual(incoming);
    expect(plan.toUpdate).toEqual([]);
  });

  it('re-ingesting the same rows yields ZERO inserts (all updates)', () => {
    const incoming = [review('google', 'a'), review('yelp', 'b')];
    const existing = [ref('google', 'a', 'row-1'), ref('yelp', 'b', 'row-2')];
    const plan = dedupePlan(existing, incoming);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toUpdate).toEqual([
      { id: 'row-1', review: incoming[0] },
      { id: 'row-2', review: incoming[1] },
    ]);
  });

  it('running the plan twice is idempotent for inserts (second pass = 0 inserts)', () => {
    const incoming = [review('google', 'a'), review('yelp', 'b')];
    const firstPass = dedupePlan([], incoming);
    expect(firstPass.toInsert).toHaveLength(2);
    // Simulate the rows now existing with assigned ids.
    const existing = firstPass.toInsert.map((r, i) =>
      ref(r.source, r.externalId, `id-${i}`),
    );
    const secondPass = dedupePlan(existing, incoming);
    expect(secondPass.toInsert).toEqual([]);
    expect(secondPass.toUpdate).toHaveLength(2);
  });

  it('splits a mixed batch into new inserts and matched updates', () => {
    const existing = [ref('google', 'known', 'row-known')];
    const known = review('google', 'known', 4);
    const fresh = review('yelp', 'fresh', 3);
    const plan = dedupePlan(existing, [known, fresh]);
    expect(plan.toInsert).toEqual([fresh]);
    expect(plan.toUpdate).toEqual([{ id: 'row-known', review: known }]);
  });

  it('carries the FRESH incoming review (not stored data) on updates', () => {
    const existing = [ref('google', 'a', 'row-1')];
    const fresh = review('google', 'a', 2, '2026-05-05T00:00:00.000Z', {
      text: 'updated text',
      author: 'Jane',
    });
    const plan = dedupePlan(existing, [fresh]);
    expect(plan.toUpdate[0].review).toBe(fresh);
    expect(plan.toUpdate[0].review.text).toBe('updated text');
  });

  it('de-duplicates within the incoming batch (first occurrence wins, one insert)', () => {
    const first = review('google', 'dup', 5, '2026-01-01T00:00:00.000Z');
    const second = review('google', 'dup', 1, '2026-02-01T00:00:00.000Z');
    const plan = dedupePlan([], [first, second]);
    expect(plan.toInsert).toEqual([first]);
    expect(plan.toUpdate).toEqual([]);
  });

  it('de-duplicates repeated matches within the batch to a single update', () => {
    const existing = [ref('google', 'dup', 'row-1')];
    const first = review('google', 'dup', 5);
    const second = review('google', 'dup', 1);
    const plan = dedupePlan(existing, [first, second]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toUpdate).toEqual([{ id: 'row-1', review: first }]);
  });

  it('treats same externalId across different sources as distinct rows', () => {
    const g = review('google', 'shared');
    const y = review('yelp', 'shared');
    const plan = dedupePlan([ref('google', 'shared', 'row-g')], [g, y]);
    expect(plan.toUpdate).toEqual([{ id: 'row-g', review: g }]);
    expect(plan.toInsert).toEqual([y]);
  });

  it('preserves incoming order in toInsert', () => {
    const incoming = [
      review('google', 'c'),
      review('google', 'a'),
      review('google', 'b'),
    ];
    const plan = dedupePlan([], incoming);
    expect(plan.toInsert.map((r) => r.externalId)).toEqual(['c', 'a', 'b']);
  });

  it('first stored row wins when existing has duplicate keys', () => {
    const existing = [ref('google', 'a', 'first'), ref('google', 'a', 'second')];
    const plan = dedupePlan(existing, [review('google', 'a')]);
    expect(plan.toUpdate).toEqual([
      { id: 'first', review: review('google', 'a') },
    ]);
  });

  it('returns an empty plan for an empty incoming batch', () => {
    const plan = dedupePlan([ref('google', 'a', 'row-1')], []);
    expect(plan).toEqual({ toInsert: [], toUpdate: [] });
  });

  it('is defensive against nullish arrays and nullish rows', () => {
    const plan = dedupePlan(null as any, undefined as any);
    expect(plan).toEqual({ toInsert: [], toUpdate: [] });

    const withHoles = dedupePlan(
      [null as any, ref('google', 'a', 'row-1')],
      [null as any, review('google', 'a'), undefined as any],
    );
    expect(withHoles.toInsert).toEqual([]);
    expect(withHoles.toUpdate).toEqual([
      { id: 'row-1', review: review('google', 'a') },
    ]);
  });
});

// ---------------------------------------------------------------------------
// rollupRatings
// ---------------------------------------------------------------------------

const NOW = '2026-07-05T00:00:00.000Z';

describe('rollupRatings', () => {
  it('returns the empty rollup for no reviews', () => {
    expect(rollupRatings([], NOW)).toEqual({
      avg: 0,
      count: 0,
      last30dCount: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it('computes count, sum-based avg and per-star distribution (happy path)', () => {
    const reviews = [
      { rating: 5, createdAt: NOW },
      { rating: 4, createdAt: NOW },
      { rating: 5, createdAt: NOW },
      { rating: 1, createdAt: NOW },
    ];
    const out = rollupRatings(reviews, NOW);
    expect(out.count).toBe(4);
    expect(out.avg).toBe(3.8); // (5+4+5+1)/4 = 3.75 -> 3.8
    expect(out.distribution).toEqual({ 1: 1, 2: 0, 3: 0, 4: 1, 5: 2 });
  });

  it('rounds avg to exactly one decimal place', () => {
    expect(rollupRatings([{ rating: 3, createdAt: NOW }, { rating: 4, createdAt: NOW }], NOW).avg).toBe(3.5);
    expect(
      rollupRatings(
        [
          { rating: 5, createdAt: NOW },
          { rating: 5, createdAt: NOW },
          { rating: 4, createdAt: NOW },
        ],
        NOW,
      ).avg,
    ).toBe(4.7); // 14/3 = 4.666... -> 4.7
  });

  it('distribution always sums to count', () => {
    const reviews = [
      { rating: 1, createdAt: NOW },
      { rating: 2, createdAt: NOW },
      { rating: 3, createdAt: NOW },
      { rating: 4, createdAt: NOW },
      { rating: 5, createdAt: NOW },
    ];
    const out = rollupRatings(reviews, NOW);
    const total = out.distribution[1] + out.distribution[2] + out.distribution[3] + out.distribution[4] + out.distribution[5];
    expect(total).toBe(out.count);
    expect(total).toBe(5);
  });

  it('buckets fractional ratings by rounding while averaging the raw value', () => {
    const out = rollupRatings(
      [
        { rating: 3.7, createdAt: NOW }, // -> bucket 4
        { rating: 2.5, createdAt: NOW }, // -> bucket 3 (round half up)
        { rating: 4.5, createdAt: NOW }, // -> bucket 5
      ],
      NOW,
    );
    expect(out.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 });
    expect(out.count).toBe(3);
    expect(out.avg).toBe(3.6); // (3.7+2.5+4.5)/3 = 3.5666... -> 3.6
  });

  it('ignores malformed ratings (NaN, null, undefined, non-number, out-of-range)', () => {
    const reviews = [
      { rating: 5, createdAt: NOW },
      { rating: NaN, createdAt: NOW },
      { rating: null as any, createdAt: NOW },
      { rating: undefined as any, createdAt: NOW },
      { rating: '4' as any, createdAt: NOW },
      { rating: 0, createdAt: NOW },
      { rating: 6, createdAt: NOW },
      { rating: Infinity, createdAt: NOW },
    ];
    const out = rollupRatings(reviews, NOW);
    expect(out.count).toBe(1);
    expect(out.avg).toBe(5);
    expect(out.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 });
  });

  it('counts reviews created within the trailing 30-day window (inclusive at 30 days)', () => {
    const reviews = [
      { rating: 5, createdAt: NOW }, // exactly now -> in
      { rating: 5, createdAt: '2026-06-20T12:00:00.000Z' }, // ~15 days ago -> in
      { rating: 5, createdAt: '2026-06-05T00:00:00.000Z' }, // exactly 30 days ago -> in
      { rating: 5, createdAt: '2026-06-04T23:59:59.000Z' }, // just over 30 days -> out
      { rating: 5, createdAt: '2025-01-01T00:00:00.000Z' }, // long ago -> out
    ];
    const out = rollupRatings(reviews, NOW);
    expect(out.count).toBe(5);
    expect(out.last30dCount).toBe(3);
  });

  it('excludes future-dated reviews from the last-30d window', () => {
    const out = rollupRatings(
      [{ rating: 5, createdAt: '2026-07-06T00:00:00.000Z' }],
      NOW,
    );
    expect(out.count).toBe(1);
    expect(out.last30dCount).toBe(0);
  });

  it('still counts a review with an unparseable createdAt, just not in the window', () => {
    const out = rollupRatings([{ rating: 4, createdAt: 'not-a-date' }], NOW);
    expect(out.count).toBe(1);
    expect(out.avg).toBe(4);
    expect(out.last30dCount).toBe(0);
  });

  it('returns last30dCount 0 (but valid count/avg) when nowISO is unparseable', () => {
    const out = rollupRatings(
      [
        { rating: 5, createdAt: NOW },
        { rating: 3, createdAt: NOW },
      ],
      'garbage',
    );
    expect(out.count).toBe(2);
    expect(out.avg).toBe(4);
    expect(out.last30dCount).toBe(0);
  });

  it('is defensive against a nullish reviews array', () => {
    expect(rollupRatings(null as any, NOW)).toEqual({
      avg: 0,
      count: 0,
      last30dCount: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it('skips nullish rows inside the reviews array', () => {
    const out = rollupRatings(
      [null as any, { rating: 5, createdAt: NOW }, undefined as any],
      NOW,
    );
    expect(out.count).toBe(1);
    expect(out.avg).toBe(5);
  });

  it('returns a fresh distribution object per call (no shared mutation)', () => {
    const a = rollupRatings([{ rating: 5, createdAt: NOW }], NOW);
    const b = rollupRatings([{ rating: 1, createdAt: NOW }], NOW);
    expect(a.distribution).not.toBe(b.distribution);
    expect(a.distribution[5]).toBe(1);
    expect(b.distribution[5]).toBe(0);
  });
});
