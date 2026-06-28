// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promisify } from 'util';

// --- Deterministic, offline DNS mock -------------------------------------------------
// securityUtils.ts does `import dns from 'dns'` then `promisify(dns.lookup)`. To keep the
// public-URL and localhost cases hermetic (no real network/DNS), we mock the `dns` module
// so that lookups resolve from a static table instead of hitting a resolver.
//
// `promisify(dns.lookup)` returns `{ address, family }`. We attach the well-known
// `util.promisify.custom` symbol to our mock `lookup` so the promisified version resolves
// to that exact shape (mirroring Node's real custom-promisified dns.lookup).
const RESOLUTIONS: Record<string, string> = {
  'www.google.com': '142.250.72.36', // public
  'example.com': '93.184.216.34', // public
  localhost: '127.0.0.1', // loopback -> private
};

function makeMockLookup() {
  const custom = async (hostname: string) => {
    const address = RESOLUTIONS[hostname];
    if (!address) {
      const err: any = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
      err.code = 'ENOTFOUND';
      throw err;
    }
    return { address, family: address.includes(':') ? 6 : 4 };
  };
  // Callback form (in case anything promisifies without the custom symbol).
  const lookup: any = (hostname: string, _opts: any, cb?: any) => {
    const callback = typeof _opts === 'function' ? _opts : cb;
    custom(hostname).then(
      ({ address, family }) => callback(null, address, family),
      (err) => callback(err),
    );
  };
  lookup[promisify.custom] = custom;
  return lookup;
}

vi.mock('dns', () => {
  const lookup = makeMockLookup();
  return { default: { lookup }, lookup };
});

// Imported AFTER vi.mock so the module picks up the mocked dns at evaluation time.
import { isPrivateIP, validateSafeUrl } from './securityUtils';

describe('securityUtils', () => {
  describe('isPrivateIP', () => {
    it('should identify private IPv4 addresses', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
    });

    it('should identify loopback and link-local addresses', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('169.254.1.1')).toBe(true);
      expect(isPrivateIP('0.0.0.0')).toBe(true);
      expect(isPrivateIP('::1')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should return false for public IP addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('208.67.222.222')).toBe(false);
    });

    it('should return false for non-IP strings', () => {
      expect(isPrivateIP('not-an-ip')).toBe(false);
      expect(isPrivateIP('')).toBe(false);
    });
  });

  describe('validateSafeUrl', () => {
    it('should allow safe public URLs (mocked DNS -> public IPs)', async () => {
      expect(await validateSafeUrl('https://www.google.com')).toBe(true);
      expect(await validateSafeUrl('http://example.com/page')).toBe(true);
    });

    it('should block URLs with private IP hostnames', async () => {
      expect(await validateSafeUrl('http://127.0.0.1')).toBe(false);
      expect(await validateSafeUrl('http://192.168.1.100/admin')).toBe(false);
      expect(await validateSafeUrl('http://10.0.0.1')).toBe(false);
      expect(await validateSafeUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    });

    it('should block non-http/https protocols', async () => {
      expect(await validateSafeUrl('ftp://example.com')).toBe(false);
      expect(await validateSafeUrl('file:///etc/passwd')).toBe(false);
      expect(await validateSafeUrl('javascript:alert(1)')).toBe(false);
    });

    it('should block hostnames that resolve to private IPs (mocked DNS)', async () => {
      // localhost resolves to 127.0.0.1 in our mock table -> blocked.
      expect(await validateSafeUrl('http://localhost')).toBe(false);
    });

    it('should block hostnames that fail to resolve (mocked DNS ENOTFOUND)', async () => {
      expect(await validateSafeUrl('http://this-host-does-not-exist.invalid')).toBe(false);
    });

    it('should reject malformed URLs', async () => {
      expect(await validateSafeUrl('not a url')).toBe(false);
      expect(await validateSafeUrl('')).toBe(false);
    });
  });
});
