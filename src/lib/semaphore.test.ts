import { describe, it, expect, vi } from "vitest";
import { Semaphore, SemaphoreTimeoutError } from "./semaphore";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("Semaphore — bounded concurrency with load-shed", () => {
  it("never runs more than `max` fns concurrently", async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const gates = [deferred<void>(), deferred<void>(), deferred<void>(), deferred<void>()];
    const task = (i: number) =>
      sem.run(async () => {
        active++;
        peak = Math.max(peak, active);
        await gates[i].promise;
        active--;
      }, 10_000);

    const runs = gates.map((_, i) => task(i));
    // Let the first batch acquire.
    await Promise.resolve();
    await Promise.resolve();
    expect(sem.active).toBe(2);
    expect(sem.queued).toBe(2);

    // Release them one at a time; peak must never exceed 2.
    for (const g of gates) { g.resolve(); await new Promise((r) => setTimeout(r, 0)); }
    await Promise.all(runs);
    expect(peak).toBe(2);
    expect(sem.active).toBe(0);
    expect(sem.queued).toBe(0);
  });

  it("transfers a freed slot to the next waiter (FIFO) without exceeding the cap", async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];
    const g0 = deferred<void>();
    const a = sem.run(async () => { order.push(0); await g0.promise; }, 10_000);
    const b = sem.run(async () => { order.push(1); }, 10_000);
    const c = sem.run(async () => { order.push(2); }, 10_000);
    await Promise.resolve();
    expect(sem.active).toBe(1);
    expect(sem.queued).toBe(2);
    g0.resolve();
    await Promise.all([a, b, c]);
    expect(order).toEqual([0, 1, 2]); // strict FIFO handoff
    expect(sem.active).toBe(0);
  });

  it("sheds (throws SemaphoreTimeoutError) when no slot frees up in time, without running fn", async () => {
    vi.useFakeTimers();
    try {
      const sem = new Semaphore(1);
      const hold = deferred<void>();
      const leader = sem.run(() => hold.promise, 10_000);
      let ran = false;
      const shed = sem.run(async () => { ran = true; }, 50); // tiny deadline

      const assertion = expect(shed).rejects.toBeInstanceOf(SemaphoreTimeoutError);
      await vi.advanceTimersByTimeAsync(60);
      await assertion;
      expect(ran).toBe(false); // fn NEVER ran
      expect(sem.shed).toBe(1);
      expect(sem.queued).toBe(0); // shed waiter removed from the queue

      hold.resolve();
      await leader;
      expect(sem.active).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases the slot even when fn throws", async () => {
    const sem = new Semaphore(1);
    await expect(sem.run(async () => { throw new Error("boom"); }, 1000)).rejects.toThrow("boom");
    expect(sem.active).toBe(0);
    // The slot is free — a subsequent run acquires immediately.
    const ok = await sem.run(async () => "ok", 1000);
    expect(ok).toBe("ok");
  });

  it("high cap is a passthrough under normal load (no queueing)", async () => {
    const sem = new Semaphore(24);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => sem.run(async () => i, 1000)),
    );
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(sem.shed).toBe(0);
    expect(sem.active).toBe(0);
  });

  it("clamps a bad max to a floor of 1", async () => {
    const sem = new Semaphore(0);
    const hold = deferred<void>();
    const a = sem.run(() => hold.promise, 10_000);
    await Promise.resolve();
    expect(sem.active).toBe(1);
    const b = sem.run(async () => "b", 10_000);
    await Promise.resolve();
    expect(sem.queued).toBe(1); // second call waits — cap really is 1
    hold.resolve();
    await Promise.all([a, b]);
  });
});
