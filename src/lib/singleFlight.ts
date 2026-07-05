// Single-flight / request coalescing.
//
// Collapse N concurrent calls for the same key into ONE execution; every caller resolves
// from that single result. This is the classic cache-stampede / thundering-herd guard —
// YardWorx Scenario B: "5,000 users ask the same AI question at once" all MISS a cold cache
// key simultaneously and, without coalescing, each fire a separate (paid, rate-limited)
// Gemini call. With single-flight, the first caller does the work and the other 4,999 ride
// its in-flight promise, then everyone drains from the now-warm cache.
//
// The in-flight slot is released as soon as the underlying promise SETTLES (success OR
// failure), so:
//   - the map is naturally bounded by the number of DISTINCT in-flight keys (no growth), and
//   - a failed call does not wedge the key — a later caller is free to retry.
//
// Ordering contract: the caller's `fn` is expected to populate any shared cache BEFORE it
// resolves. Because the slot is only deleted after the promise settles, and the cache write
// happens inside `fn` (i.e. before settle), there is no window where the slot is gone but the
// answer isn't cached yet. Callers therefore check the cache FIRST, then fall through to
// `run()` on a miss.

export class SingleFlight<T = unknown> {
  private inflight = new Map<string, Promise<T>>();
  /** Observability: how many calls were served by riding an existing in-flight leader. */
  coalesced = 0;

  /** Number of distinct keys currently executing. */
  get size(): number {
    return this.inflight.size;
  }

  /** True if a call for `key` is already in flight. */
  has(key: string): boolean {
    return this.inflight.has(key);
  }

  /**
   * Run `fn` for `key`. If a call for `key` is already in flight, return that same promise
   * instead of starting a second execution. The slot is released once the underlying promise
   * settles (via `finally`), so subsequent calls re-execute.
   */
  run(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      this.coalesced++;
      return existing;
    }
    // Wrap in an async IIFE so a synchronous throw inside `fn` becomes a rejected promise
    // (and still gets its slot cleaned up) rather than escaping `run` synchronously.
    const p = (async () => fn())();
    this.inflight.set(key, p);
    // Attach cleanup that runs on BOTH resolve and reject. We intentionally do NOT `await`
    // here — returning `p` (not the cleanup chain) preserves the leader's exact value/rejection
    // for every awaiter while still releasing the slot after settle.
    const release = () => {
      // Only delete if it's still OUR promise (defensive against a re-entrant overwrite).
      if (this.inflight.get(key) === p) this.inflight.delete(key);
    };
    p.then(release, release);
    return p;
  }
}
