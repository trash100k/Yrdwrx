import { describe, it, expect } from 'vitest';
import { CircuitBreaker, CircuitOpenError, backoffDelay, sleep } from './circuitBreaker';

// Controllable clock for deterministic time-based transitions.
function fakeClock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; }, set: (v: number) => { t = v; } };
}

const fail = () => Promise.reject(new Error('upstream down'));
const ok = (v = 'ok') => Promise.resolve(v);

describe('CircuitBreaker', () => {
  it('passes through while CLOSED and returns the value', async () => {
    const cb = new CircuitBreaker();
    expect(await cb.run(() => ok('hi'))).toBe('hi');
    expect(cb.getState()).toBe('closed');
  });

  it('does NOT trip below the volume threshold even at 100% failure', async () => {
    const clk = fakeClock();
    const cb = new CircuitBreaker({ volumeThreshold: 5, failureRateThreshold: 0.5, now: clk.now });
    for (let i = 0; i < 4; i++) await cb.run(fail).catch(() => {});
    expect(cb.getState()).toBe('closed'); // only 4 samples < volumeThreshold 5
  });

  it('trips OPEN once volume + failure-rate are met, then fast-fails WITHOUT calling fn', async () => {
    const clk = fakeClock();
    const cb = new CircuitBreaker({ volumeThreshold: 5, failureRateThreshold: 0.5, now: clk.now });
    for (let i = 0; i < 5; i++) await cb.run(fail).catch(() => {});
    expect(cb.getState()).toBe('open');
    let called = false;
    await expect(cb.run(async () => { called = true; return 'x'; })).rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false); // fast-fail did not invoke fn
  });

  it('successes dilute the failure rate below the threshold (no trip)', async () => {
    const clk = fakeClock();
    const cb = new CircuitBreaker({ volumeThreshold: 4, failureRateThreshold: 0.75, now: clk.now });
    await cb.run(fail).catch(() => {});
    await cb.run(fail).catch(() => {});
    await cb.run(() => ok());
    await cb.run(() => ok()); // 2/4 = 0.5 < 0.75
    expect(cb.getState()).toBe('closed');
  });

  it('ages samples out of the rolling window', async () => {
    const clk = fakeClock();
    const cb = new CircuitBreaker({ volumeThreshold: 3, failureRateThreshold: 0.5, windowMs: 1000, now: clk.now });
    await cb.run(fail).catch(() => {});
    await cb.run(fail).catch(() => {});
    clk.advance(2000); // both age out
    await cb.run(fail).catch(() => {}); // only 1 sample in window now
    expect(cb.getState()).toBe('closed');
  });

  it('transitions OPEN → HALF_OPEN after the cooldown, then CLOSES after successThreshold probes', async () => {
    const clk = fakeClock();
    const cb = new CircuitBreaker({ volumeThreshold: 3, failureRateThreshold: 0.5, cooldownMs: 5000, successThreshold: 2, now: clk.now });
    for (let i = 0; i < 3; i++) await cb.run(fail).catch(() => {});
    expect(cb.getState()).toBe('open');
    clk.advance(5000);
    expect(cb.getState()).toBe('half_open');
    await cb.run(() => ok()); // probe 1
    expect(cb.getState()).toBe('half_open');
    await cb.run(() => ok()); // probe 2 → close
    expect(cb.getState()).toBe('closed');
  });

  it('a failed HALF_OPEN probe re-opens the circuit', async () => {
    const clk = fakeClock();
    const cb = new CircuitBreaker({ volumeThreshold: 3, failureRateThreshold: 0.5, cooldownMs: 5000, now: clk.now });
    for (let i = 0; i < 3; i++) await cb.run(fail).catch(() => {});
    clk.advance(5000);
    expect(cb.getState()).toBe('half_open');
    await cb.run(fail).catch(() => {}); // probe fails
    expect(cb.getState()).toBe('open');
  });

  it('an IGNORED throw is not recorded and cannot trip the breaker', async () => {
    const clk = fakeClock();
    const cb = new CircuitBreaker({ volumeThreshold: 3, failureRateThreshold: 0.5, now: clk.now });
    const clientErr = Object.assign(new Error('bad prompt'), { status: 400 });
    let ignored = 0;
    for (let i = 0; i < 5; i++) {
      await cb.run(() => Promise.reject(clientErr), {
        isFailure: (e: any) => e?.status !== 400,
        onIgnored: () => { ignored++; },
      }).catch(() => {});
    }
    expect(cb.getState()).toBe('closed'); // 400s never counted
    expect(ignored).toBe(5);
    expect(cb.stats().samples).toBe(0);
  });
});

describe('backoffDelay', () => {
  it('none jitter is deterministic exponential, capped at maxMs', () => {
    expect(backoffDelay(0, { baseMs: 100, maxMs: 10_000, jitter: 'none' })).toBe(100);
    expect(backoffDelay(1, { baseMs: 100, maxMs: 10_000, jitter: 'none' })).toBe(200);
    expect(backoffDelay(3, { baseMs: 100, maxMs: 10_000, jitter: 'none' })).toBe(800);
    expect(backoffDelay(20, { baseMs: 100, maxMs: 10_000, jitter: 'none' })).toBe(10_000); // capped
  });
  it('full jitter stays within [0, capped]', () => {
    const d0 = backoffDelay(2, { baseMs: 100, maxMs: 10_000, jitter: 'full', random: () => 0 });
    const d1 = backoffDelay(2, { baseMs: 100, maxMs: 10_000, jitter: 'full', random: () => 0.999 });
    expect(d0).toBe(0);
    expect(d1).toBeGreaterThan(0);
    expect(d1).toBeLessThanOrEqual(400); // 100*2^2
  });
  it('equal jitter is capped/2 + [0, capped/2]', () => {
    const lo = backoffDelay(2, { baseMs: 100, maxMs: 10_000, jitter: 'equal', random: () => 0 });
    const hi = backoffDelay(2, { baseMs: 100, maxMs: 10_000, jitter: 'equal', random: () => 1 });
    expect(lo).toBe(200); // 400/2
    expect(hi).toBe(400); // 400/2 + 400/2
  });
  it('returns a non-negative integer for junk input', () => {
    expect(backoffDelay(-5, { baseMs: 100, jitter: 'none' })).toBe(100);
    expect(backoffDelay(NaN as any, { jitter: 'none' })).toBeGreaterThanOrEqual(0);
  });
});

describe('sleep', () => {
  it('resolves after roughly the requested delay', async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});
