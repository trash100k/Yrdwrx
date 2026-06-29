// @ts-nocheck
import { describe, it, expect } from 'vitest';
// Contract (provided by main session in src/lib/routeAuth.ts):
//   isExcludedApiPath(fullPath) -> true for auth-excluded routes
//   requiresAuth(fullPath)      -> true for /api/* paths that are NOT excluded
import { isExcludedApiPath, requiresAuth } from '../src/lib/routeAuth';

describe('routeAuth.isExcludedApiPath', () => {
  it('excludes the magic-link validate route', () => {
    expect(isExcludedApiPath('/api/auth/magic-link/validate')).toBe(true);
  });

  it('excludes the stripe webhook (raw-body, signature-verified)', () => {
    expect(isExcludedApiPath('/api/stripe/webhook')).toBe(true);
  });

  it('excludes the health probe', () => {
    expect(isExcludedApiPath('/api/health')).toBe(true);
  });

  it('excludes the public intake namespace', () => {
    expect(isExcludedApiPath('/api/public/lead-intake')).toBe(true);
    expect(isExcludedApiPath('/api/public/tenant/abc')).toBe(true);
  });

  it('does NOT exclude /api/playground/* (now auth+metered — was open AI-cost abuse)', () => {
    expect(isExcludedApiPath('/api/playground/chat')).toBe(false);
    expect(isExcludedApiPath('/api/playground/anything/else')).toBe(false);
  });

  it('does NOT exclude /api/security/threats (security hardening)', () => {
    expect(isExcludedApiPath('/api/security/threats')).toBe(false);
  });

  it('does NOT exclude ordinary protected API routes', () => {
    expect(isExcludedApiPath('/api/design/process')).toBe(false);
    expect(isExcludedApiPath('/api/crm/enrich')).toBe(false);
    expect(isExcludedApiPath('/api/auth/magic-link/generate')).toBe(false);
  });
});

describe('routeAuth.requiresAuth', () => {
  it('requires auth for a normal protected /api route', () => {
    expect(requiresAuth('/api/design/process')).toBe(true);
    expect(requiresAuth('/api/crm/enrich')).toBe(true);
  });

  it('requires auth for /api/security/threats (no longer excluded)', () => {
    expect(requiresAuth('/api/security/threats')).toBe(true);
  });

  it('requires auth for /api/playground/* (no longer excluded)', () => {
    expect(requiresAuth('/api/playground/chat')).toBe(true);
  });

  it('requires auth for /api/auth/magic-link/generate (security hardening)', () => {
    expect(requiresAuth('/api/auth/magic-link/generate')).toBe(true);
  });

  it('does NOT require auth for excluded routes', () => {
    expect(requiresAuth('/api/stripe/webhook')).toBe(false);
    expect(requiresAuth('/api/health')).toBe(false);
    expect(requiresAuth('/api/auth/magic-link/validate')).toBe(false);
  });

  it('does NOT require auth for non-/api paths', () => {
    expect(requiresAuth('/health')).toBe(false);
    expect(requiresAuth('/')).toBe(false);
    expect(requiresAuth('/portal/abc')).toBe(false);
  });
});
