// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { promisify } from 'util';

// Table-driven fuzzing derived from TEST_MATRIX.md (section 1: Unicode/RTL/Zalgo,
// length-overflow, XSS, path-traversal, negative/huge numbers). We exercise the PURE
// validators that actually exist in the app (securityUtils): isPrivateIP and
// validateSafeUrl. DNS is mocked so resolvable public hosts are deterministic offline;
// everything malformed/private/non-http must be rejected.

vi.mock('dns', () => {
  const table: Record<string, string> = {
    'malicious.com': '198.51.100.7', // public (TEST_DOC, RFC 5737)
    'example.com': '93.184.216.34',
  };
  const custom = async (hostname: string) => {
    const address = table[hostname];
    if (!address) {
      const err: any = new Error(`ENOTFOUND ${hostname}`);
      err.code = 'ENOTFOUND';
      throw err;
    }
    return { address, family: 4 };
  };
  const lookup: any = (hostname: string, opts: any, cb?: any) => {
    const callback = typeof opts === 'function' ? opts : cb;
    custom(hostname).then(
      ({ address, family }) => callback(null, address, family),
      (err) => callback(err),
    );
  };
  lookup[promisify.custom] = custom;
  return { default: { lookup }, lookup };
});

import { isPrivateIP, validateSafeUrl } from '../src/lib/securityUtils';

// ---- isPrivateIP fuzzing: garbage / overflow / fuzz inputs must never throw -----------
describe('isPrivateIP fuzzing (must reject non-IP / hostile input, never throw)', () => {
  const ZALGO = 'Z͂a̐l͊g͗o̓ t͋e̓x̣t̓';
  const RTL = 'مرحبا بك في Cutty';
  const cases: Array<[string, string]> = [
    ['empty string', ''],
    ['whitespace', '   '],
    ['newlines/tabs', '\n\n\t\r'],
    ['emoji', '🌴🏡✨🔥💀'],
    ['zalgo', ZALGO],
    ['rtl/mixed', RTL],
    ['xss script', "<script>alert('XSS')</script>"],
    ['img onerror', '<img src=x onerror=alert(1)>'],
    ['path traversal', '../../../etc/passwd'],
    ['negative number', '-1'],
    ['huge number', '9999999999999999.99'],
    ['scientific', '1.5e10'],
    ['length overflow', 'A'.repeat(5000)],
    ['octet overflow', '999.999.999.999'],
    ['too few octets', '10.0.0'],
    ['letters in octet', '10.a.0.1'],
  ];

  it.each(cases)('rejects %s as not a private IP', (_label, input) => {
    expect(isPrivateIP(input)).toBe(false);
  });
});

// ---- validateSafeUrl fuzzing: dangerous/malformed inputs must be rejected -------------
describe('validateSafeUrl fuzzing (rejects malformed/dangerous, normalizes safe)', () => {
  const cleanReject: Array<[string, string]> = [
    ['empty', ''],
    ['whitespace', '   '],
    ['plain text', 'not a url'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['file scheme', 'file:///etc/passwd'],
    ['ftp scheme', 'ftp://example.com'],
    ['path traversal as url', '../../../etc/passwd'],
    ['xss as url', "<script>alert('XSS')</script>"],
    ['private ip host', 'http://10.0.0.1/'],
    ['loopback host', 'http://127.0.0.1/'],
    ['link-local metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['unresolvable host', 'http://nonexistent.invalid/'],
  ];

  it.each(cleanReject)('rejects %s', async (_label, input) => {
    expect(await validateSafeUrl(input)).toBe(false);
  });

  it('allows a well-formed http(s) URL that resolves to a public IP (mocked DNS)', async () => {
    expect(await validateSafeUrl('https://example.com/page?q=1')).toBe(true);
    // Even a "malicious"-looking but PUBLIC host passes the SSRF check (it is not a
    // private/loopback target). Content-level safety is a separate concern.
    expect(await validateSafeUrl('https://malicious.com/return')).toBe(true);
  });
});
