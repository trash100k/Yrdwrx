// Circuit breaker + backoff-with-jitter for external dependencies.
//
// Pure, deterministic state machine (clock + RNG injected) so it is fully unit-tested. Wraps a
// flaky upstream (Gemini origin call, geocoding fetch) and, once it is failing above a rate in a
// rolling window, "opens" — fast-failing with CircuitOpenError instead of piling more doomed calls
// onto a struggling dependency (and pinning workers). After a cooldown it half-opens to probe;
// enough consecutive probe successes close it again.
//
// Design contract:
//  - CLOSED: pass through; record each outcome. Trip to OPEN when, within windowMs, the sample
//    count >= volumeThreshold AND failures/total >= failureRateThreshold.
//  - OPEN: fast-fail with CircuitOpenError WITHOUT calling fn, until cooldownMs elapses → HALF_OPEN.
//  - HALF_OPEN: allow probes; successThreshold consecutive successes → CLOSED; any failure → OPEN.
//  - run<T>() classifies a thrown error via isFailure: a "distress" throw is recorded (can trip);
//    an ignored throw (e.g. a caller 4xx that is our fault, not the upstream's) is NOT recorded and
//    does not consume a half-open probe — onIgnored is invoked and the error rethrown.

export type CircuitState = 'closed' | 'open' | 'half_open';

export class CircuitOpenError extends Error {
  constructor(message = 'circuit is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerOptions {
  failureRateThreshold?: number; // 0..1
  volumeThreshold?: number;      // min samples in window before it can trip
  windowMs?: number;             // rolling window for the failure rate
  cooldownMs?: number;           // OPEN → HALF_OPEN after this
  successThreshold?: number;     // consecutive HALF_OPEN successes to CLOSE
  now?: () => number;            // injectable clock
}

export interface RunHooks {
  isFailure?: (err: unknown) => boolean; // true => distress (record + maybe trip); default: all throws
  onIgnored?: (err: unknown) => void;    // called when isFailure===false
}

interface Sample { t: number; ok: boolean; }

function clampNum(v: unknown, dflt: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private samples: Sample[] = [];
  private openedAt = 0;
  private halfOpenSuccesses = 0;
  private readonly failureRateThreshold: number;
  private readonly volumeThreshold: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;
  private readonly now: () => number;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureRateThreshold = clampNum(opts.failureRateThreshold, 0.5, 0, 1);
    this.volumeThreshold = Math.floor(clampNum(opts.volumeThreshold, 10, 1, 1_000_000));
    this.windowMs = Math.floor(clampNum(opts.windowMs, 30_000, 1, 3_600_000));
    this.cooldownMs = Math.floor(clampNum(opts.cooldownMs, 15_000, 1, 3_600_000));
    this.successThreshold = Math.floor(clampNum(opts.successThreshold, 2, 1, 1_000_000));
    this.now = opts.now || Date.now;
  }

  /** Current state (transitions OPEN→HALF_OPEN lazily when the cooldown has elapsed). */
  getState(): CircuitState {
    if (this.state === 'open' && this.now() - this.openedAt >= this.cooldownMs) {
      this.state = 'half_open';
      this.halfOpenSuccesses = 0;
    }
    return this.state;
  }

  private prune(t: number) {
    const cutoff = t - this.windowMs;
    if (this.samples.length && this.samples[0].t <= cutoff) {
      this.samples = this.samples.filter((s) => s.t > cutoff);
    }
  }

  private record(ok: boolean) {
    const t = this.now();
    this.samples.push({ t, ok });
    this.prune(t);
    if (this.state === 'closed' && this.samples.length >= this.volumeThreshold) {
      const failures = this.samples.reduce((n, s) => n + (s.ok ? 0 : 1), 0);
      if (failures / this.samples.length >= this.failureRateThreshold) {
        this.trip();
      }
    }
  }

  private trip() {
    this.state = 'open';
    this.openedAt = this.now();
    this.halfOpenSuccesses = 0;
  }

  private onSuccess() {
    if (this.state === 'half_open') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.successThreshold) {
        this.state = 'closed';
        this.samples = [];
      }
    } else {
      this.record(true);
    }
  }

  private onFailure() {
    if (this.state === 'half_open') {
      this.trip(); // a probe failed — back to OPEN
    } else {
      this.record(false);
    }
  }

  /**
   * Run `fn` under the breaker. Fast-fails with CircuitOpenError while OPEN. Records distress
   * failures (per hooks.isFailure); ignored throws don't count and don't consume a half-open probe.
   */
  async run<T>(fn: () => Promise<T>, hooks: RunHooks = {}): Promise<T> {
    if (this.getState() === 'open') {
      throw new CircuitOpenError();
    }
    try {
      const out = await fn();
      this.onSuccess();
      return out;
    } catch (err) {
      const isFailure = hooks.isFailure ? hooks.isFailure(err) : true;
      if (isFailure) {
        this.onFailure();
      } else if (hooks.onIgnored) {
        hooks.onIgnored(err);
      }
      throw err;
    }
  }

  /** Test/observability helpers. */
  stats() {
    const failures = this.samples.reduce((n, s) => n + (s.ok ? 0 : 1), 0);
    return { state: this.getState(), samples: this.samples.length, failures };
  }
}

export type JitterMode = 'full' | 'equal' | 'none';

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  jitter?: JitterMode;
  random?: () => number; // injectable RNG (default Math.random)
}

/**
 * Exponential backoff delay for retry `attempt` (0-based): base * 2^attempt, capped at maxMs, with
 * optional jitter. Returns a non-negative integer of milliseconds.
 *  - none:  the (capped) exponential delay, no randomness.
 *  - full:  uniform in [0, capped].
 *  - equal: capped/2 + uniform in [0, capped/2].
 */
export function backoffDelay(attempt: number, opts: BackoffOptions = {}): number {
  const base = clampNum(opts.baseMs, 200, 0, 3_600_000);
  const max = clampNum(opts.maxMs, 30_000, 0, 3_600_000);
  const rnd = opts.random || Math.random;
  const a = Math.max(0, Math.floor(Number(attempt) || 0));
  const exp = base * Math.pow(2, Math.min(a, 30)); // cap the exponent so it can't overflow
  const capped = Math.min(max, exp);
  let delay: number;
  switch (opts.jitter) {
    case 'none': delay = capped; break;
    case 'equal': delay = capped / 2 + rnd() * (capped / 2); break;
    case 'full':
    default: delay = rnd() * capped; break;
  }
  const ms = Math.floor(delay);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/** Promise that resolves after `ms` (unref'd timer so it never keeps the process alive). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, Math.max(0, Number(ms) || 0));
    if ((t as any).unref) (t as any).unref();
  });
}
