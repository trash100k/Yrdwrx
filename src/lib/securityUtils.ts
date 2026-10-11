import { isIP } from 'net';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

/**
 * Validates if an IP address is in a private, loopback, or link-local range.
 * This is a key defense against Server-Side Request Forgery (SSRF).
 */
export function isPrivateIP(ip: string): boolean {
  let clean = ip.toLowerCase().trim();
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1);
  }

  if (!isIP(clean)) return false;

  // Reject unspecified / wildcard addresses
  if (clean === '::' || clean === '0.0.0.0') return true;

  // IPv4-mapped IPv6 in dotted-decimal format (::ffff:127.0.0.1) — unwrap and re-check embedded v4.
  const mappedDotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(clean);
  if (mappedDotted) return isPrivateIP(mappedDotted[1]);

  // IPv4-mapped IPv6 in hex format (::ffff:7f00:1 or ::ffff:a9fe:a9fe) — decode to dotted-decimal and re-check.
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(clean);
  if (mappedHex) {
    const h1 = parseInt(mappedHex[1], 16);
    const h2 = parseInt(mappedHex[2], 16);
    const p1 = (h1 >> 8) & 0xff;
    const p2 = h1 & 0xff;
    const p3 = (h2 >> 8) & 0xff;
    const p4 = h2 & 0xff;
    return isPrivateIP(`${p1}.${p2}.${p3}.${p4}`);
  }

  const parts = clean.split('.').map(Number);

  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // 100.64/10 CGNAT
  if (parts[0] === 0) return true; // 0.0.0.0/8

  // IPv6 loopback / link-local / unique-local.
  if (clean === '::1' || clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) {
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

    let hostname = url.hostname;
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    // 1. Check if the hostname itself is an IP and if it's private
    if (isIP(hostname)) {
      return !isPrivateIP(hostname);
    }

    // 2. Resolve the hostname and reject if ANY returned address is private. Checking only
    //    the first A record let a multi-record name (one public, one private) slip through.
    //    (Full DNS-rebind TOCTOU protection also needs connect-time IP pinning at the egress
    //    layer; callers additionally set redirect:"error" so a 3xx can't bounce to an internal host.)
    try {
      const results = await lookup(hostname, { all: true });
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
