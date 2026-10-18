import { isIP } from 'net';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

/**
 * Validates if an IP address is in a private, loopback, or link-local range.
 * This is a key defense against Server-Side Request Forgery (SSRF).
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip) return false;
  const cleanIp = ip.trim().replace(/^\[|\]$/g, '');
  if (!isIP(cleanIp)) return false;

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  const mapped = /^::ffff:(.+)$/i.exec(cleanIp);
  if (mapped) {
    const rest = mapped[1];
    if (rest.includes('.')) {
      return isPrivateIP(rest);
    }
    const hexParts = rest.split(':').map((p) => parseInt(p, 16));
    if (hexParts.length === 2 && !hexParts.some(isNaN)) {
      const v4 = `${(hexParts[0] >> 8) & 255}.${hexParts[0] & 255}.${(hexParts[1] >> 8) & 255}.${hexParts[1] & 255}`;
      return isPrivateIP(v4);
    }
  }

  const parts = cleanIp.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true; // link-local incl. cloud metadata 169.254.169.254
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // 100.64/10 CGNAT
    if (parts[0] === 0) return true; // 0.0.0.0/8
  }

  // IPv6 loopback / link-local / unique-local / unspecified (::)
  const low = cleanIp.toLowerCase();
  if (low === '::' || low === '::1' || low.startsWith('fe80:') || low.startsWith('fc') || low.startsWith('fd')) {
    return true;
  }

  return false;
}

/**
 * Validates a URL for SSRF protection by checking its protocol and resolving its hostname.
 */
export async function validateSafeUrl(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);

    // Only allow http and https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname;
    const cleanHost = hostname.replace(/^\[|\]$/g, '');

    // 1. Check if the hostname itself is an IP and if it's private
    if (isIP(cleanHost)) {
      return !isPrivateIP(cleanHost);
    }

    // 2. Resolve the hostname and reject if ANY returned address is private. Checking only
    //    the first A record let a multi-record name (one public, one private) slip through.
    //    (Full DNS-rebind TOCTOU protection also needs connect-time IP pinning at the egress
    //    layer; callers additionally set redirect:"error" so a 3xx can't bounce to an internal host.)
    try {
      const results = await lookup(cleanHost, { all: true });
      const addrs = Array.isArray(results) ? results : [results];
      if (addrs.length === 0) return false;
      for (const r of addrs) {
        if (isPrivateIP((r as any).address)) return false;
      }
    } catch (dnsErr) {
      // If we can't resolve it, it might be a local-only hostname
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}
