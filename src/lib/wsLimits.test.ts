import { describe, it, expect } from 'vitest';
import { LiveLimiter, liveLimiterConfigFromEnv } from './wsLimits';

describe('liveLimiterConfigFromEnv', () => {
  it('applies defaults when unset', () => {
    expect(liveLimiterConfigFromEnv({})).toEqual({ maxPerIp: 25, maxPerTenant: 25, attemptsPerWindow: 30, windowMs: 60_000 });
  });
  it('honors overrides and ignores junk/negatives', () => {
    const c = liveLimiterConfigFromEnv({ LIVE_MAX_PER_IP: '3', LIVE_MAX_PER_TENANT: 'nope', LIVE_ATTEMPTS_PER_MIN: '-5', LIVE_ATTEMPT_WINDOW_MS: '5000' });
    expect(c).toEqual({ maxPerIp: 3, maxPerTenant: 25, attemptsPerWindow: 30, windowMs: 5000 });
  });
});

describe('LiveLimiter.allowAttempt — pre-upgrade attempt throttle', () => {
  const cfg = { maxPerIp: 100, maxPerTenant: 100, attemptsPerWindow: 3, windowMs: 60_000 };
  it('allows up to attemptsPerWindow then refuses within the window', () => {
    const l = new LiveLimiter(cfg);
    const T = 1000;
    expect(l.allowAttempt('ip', T)).toBe(true);
    expect(l.allowAttempt('ip', T)).toBe(true);
    expect(l.allowAttempt('ip', T)).toBe(true);
    expect(l.allowAttempt('ip', T)).toBe(false); // 4th within window
  });
  it('resets after the window elapses', () => {
    const l = new LiveLimiter(cfg);
    const T = 1000;
    for (let i = 0; i < 3; i++) l.allowAttempt('ip', T);
    expect(l.allowAttempt('ip', T)).toBe(false);
    expect(l.allowAttempt('ip', T + 60_001)).toBe(true); // new window
  });
  it('isolates keys', () => {
    const l = new LiveLimiter(cfg);
    for (let i = 0; i < 3; i++) l.allowAttempt('a', 1000);
    expect(l.allowAttempt('a', 1000)).toBe(false);
    expect(l.allowAttempt('b', 1000)).toBe(true);
  });
  it('pruneAttempts drops expired windows', () => {
    const l = new LiveLimiter(cfg);
    l.allowAttempt('a', 1000);
    expect(l.attemptWindows()).toBe(1);
    l.pruneAttempts(70_000);
    expect(l.attemptWindows()).toBe(0);
  });
});

describe('LiveLimiter — per-IP concurrent cap', () => {
  it('reserves up to maxPerIp, refuses beyond, and releases', () => {
    const l = new LiveLimiter({ maxPerIp: 2, maxPerTenant: 99, attemptsPerWindow: 99, windowMs: 1000 });
    expect(l.reserveIp('ip')).toBe(true);
    expect(l.reserveIp('ip')).toBe(true);
    expect(l.reserveIp('ip')).toBe(false); // at cap
    l.releaseIp('ip');
    expect(l.reserveIp('ip')).toBe(true); // slot freed
    expect(l.ipCount('ip')).toBe(2);
  });
  it('release never goes negative and cleans up the key', () => {
    const l = new LiveLimiter({ maxPerIp: 2, maxPerTenant: 99, attemptsPerWindow: 99, windowMs: 1000 });
    l.reserveIp('ip');
    l.releaseIp('ip');
    l.releaseIp('ip'); // over-release
    expect(l.ipCount('ip')).toBe(0);
  });
});

describe('LiveLimiter — per-tenant concurrent cap', () => {
  it('reserves up to maxPerTenant, refuses beyond, and releases', () => {
    const l = new LiveLimiter({ maxPerIp: 99, maxPerTenant: 2, attemptsPerWindow: 99, windowMs: 1000 });
    expect(l.reserveTenant('t1')).toBe(true);
    expect(l.reserveTenant('t1')).toBe(true);
    expect(l.reserveTenant('t1')).toBe(false);
    expect(l.reserveTenant('t2')).toBe(true); // isolated tenant
    l.releaseTenant('t1');
    expect(l.reserveTenant('t1')).toBe(true);
  });
});
