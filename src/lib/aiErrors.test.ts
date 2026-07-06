import { describe, it, expect } from 'vitest';
import { classifyRateLimit, parseRetryAfterSeconds } from './aiErrors';

describe('classifyRateLimit — upstream Gemini rate-limit detection', () => {
  it('flags a numeric 429 status', () => {
    expect(classifyRateLimit({ status: 429 }).isRateLimited).toBe(true);
    expect(classifyRateLimit({ statusCode: 429 }).isRateLimited).toBe(true);
    expect(classifyRateLimit({ response: { status: 429 } }).isRateLimited).toBe(true);
  });
  it('flags the string status RESOURCE_EXHAUSTED', () => {
    expect(classifyRateLimit({ status: 'RESOURCE_EXHAUSTED' }).isRateLimited).toBe(true);
  });
  it('flags common quota / rate-limit message phrasings', () => {
    expect(classifyRateLimit(new Error('429 Too Many Requests')).isRateLimited).toBe(true);
    expect(classifyRateLimit(new Error('RESOURCE_EXHAUSTED: quota exceeded')).isRateLimited).toBe(true);
    expect(classifyRateLimit(new Error('You exceeded your current quota')).isRateLimited).toBe(true);
    expect(classifyRateLimit(new Error('rate limit reached')).isRateLimited).toBe(true);
  });
  it('does NOT flag unrelated errors', () => {
    expect(classifyRateLimit({ status: 500 }).isRateLimited).toBe(false);
    expect(classifyRateLimit(new Error('internal server error')).isRateLimited).toBe(false);
    expect(classifyRateLimit(null).isRateLimited).toBe(false);
    expect(classifyRateLimit('a plain string').isRateLimited).toBe(false);
    expect(classifyRateLimit({ status: 404 }).isRateLimited).toBe(false);
  });
  it('extracts retryDelay from the message when rate-limited', () => {
    const info = classifyRateLimit(new Error('429 RESOURCE_EXHAUSTED. retryDelay:"42s"'));
    expect(info.isRateLimited).toBe(true);
    expect(info.retryAfterSec).toBe(42);
  });
  it('returns null retry when rate-limited but no delay present', () => {
    expect(classifyRateLimit({ status: 429 }).retryAfterSec).toBeNull();
  });
});

describe('parseRetryAfterSeconds — Retry-After / retryDelay parsing + clamping', () => {
  it('reads a Map-like headers.get', () => {
    const e = { headers: new Map([['retry-after', '30']]) };
    expect(parseRetryAfterSeconds(e)).toBe(30);
  });
  it('reads a plain-object headers bag (both casings)', () => {
    expect(parseRetryAfterSeconds({ headers: { 'retry-after': '15' } })).toBe(15);
    expect(parseRetryAfterSeconds({ headers: { 'Retry-After': '20' } })).toBe(20);
  });
  it('parses a retryDelay:"Ns" string in the message', () => {
    expect(parseRetryAfterSeconds(new Error('please retry. retryDelay: "12s"'))).toBe(12);
  });
  it('rounds a fractional delay up (ceil)', () => {
    expect(parseRetryAfterSeconds(new Error('retryDelay:"1.2s"'))).toBe(2);
  });
  it('clamps a zero/sub-1 delay to a floor of 1', () => {
    expect(parseRetryAfterSeconds({ headers: { 'retry-after': '0' } })).toBe(1);
  });
  it('clamps an oversized delay to 3600', () => {
    expect(parseRetryAfterSeconds({ headers: { 'retry-after': '99999' } })).toBe(3600);
  });
  it('returns null when nothing parseable is present', () => {
    expect(parseRetryAfterSeconds(new Error('boom'))).toBeNull();
    expect(parseRetryAfterSeconds(null)).toBeNull();
    expect(parseRetryAfterSeconds({ headers: {} })).toBeNull();
  });
});
