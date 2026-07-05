// Bounded-concurrency semaphore with load-shedding.
//
// Caps the number of concurrent executions of an expensive operation. Used to bound concurrent
// upstream Gemini `generateContent` calls (YardWorx Scenario B): request coalescing already
// collapses IDENTICAL in-flight prompts to one call, but a flood of 5,000 DISTINCT prompts would
// still open 5,000 concurrent upstream calls and blow the model's own rate/quota. This bounds the
// concurrent count; callers past the cap wait up to `timeoutMs` for a slot, then are SHED with a
// `SemaphoreTimeoutError` (the server maps that to a clean 503 "at capacity, retry") instead of
// piling up an unbounded queue that pins workers.
//
// Slot accounting: an acquired slot is counted in `inUse`. On release, the slot is either
// TRANSFERRED to the next waiter (inUse unchanged — the waiter now holds it) or, if no one is
// waiting, freed (inUse--). A waiter that times out first is removed from the queue and its
// promise resolves via rejection; a subsequent release will never wake it (waking clears its
// timer, and timing-out removes it from the queue — the two paths are mutually exclusive).

export class SemaphoreTimeoutError extends Error {
  constructor(message = "semaphore acquire timed out") {
    super(message);
    this.name = "SemaphoreTimeoutError";
  }
}

interface Waiter {
  wake: () => void; // called by release() to hand this waiter the slot
}

export class Semaphore {
  private max: number;
  private inUse = 0;
  private waiters: Waiter[] = [];
  /** Observability: how many acquisitions were shed (timed out waiting for a slot). */
  shed = 0;

  constructor(max: number) {
    this.max = Math.max(1, Math.floor(max) || 1);
  }

  get active(): number {
    return this.inUse;
  }
  get queued(): number {
    return this.waiters.length;
  }

  private acquire(timeoutMs: number): Promise<void> {
    if (this.inUse < this.max) {
      this.inUse++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { wake: () => {} };
      const timer = setTimeout(() => {
        const i = this.waiters.indexOf(waiter);
        if (i >= 0) this.waiters.splice(i, 1);
        this.shed++;
        reject(new SemaphoreTimeoutError());
      }, Math.max(1, timeoutMs));
      if ((timer as any).unref) (timer as any).unref();
      waiter.wake = () => {
        clearTimeout(timer);
        // Slot is transferred from the releaser — inUse is NOT changed here (it already counts
        // this slot); the releaser deliberately did not decrement it.
        resolve();
      };
      this.waiters.push(waiter);
    });
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) next.wake(); // transfer the slot; inUse unchanged
    else this.inUse = Math.max(0, this.inUse - 1);
  }

  /**
   * Run `fn` under the concurrency cap. Waits up to `timeoutMs` for a slot; if none frees up in
   * time, throws `SemaphoreTimeoutError` WITHOUT running `fn` (load-shed). Always releases the
   * slot on completion (success or failure).
   */
  async run<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    await this.acquire(timeoutMs); // throws SemaphoreTimeoutError if it can't get a slot in time
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
