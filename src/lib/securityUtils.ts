import { isIP } from 'net';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

/**
 * Validates if an IP address is in a private, loopback, or link-local range.
 * This is a key defense against Server-Side Request Forgery (SSRF).
 */
export function isPrivateIP(ip: string): boolean {
  if (!isIP(ip)) return false;

  const parts = ip.split('.').map(Number);

  // IPv4 Private Ranges:
  // 10.0.0.0 – 10.255.255.255
  // 172.16.0.0 – 172.31.255.255
  // 192.168.0.0 – 192.168.255.255
  // 127.0.0.0 – 127.255.255.255 (Loopback)
  // 169.254.0.0 – 169.254.255.255 (Link-local)

  // IPv4-mapped IPv6 (::ffff:169.254.169.254) — unwrap and re-check the embedded v4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPrivateIP(mapped[1]);

  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // 100.64/10 CGNAT
  if (parts[0] === 0) return true; // 0.0.0.0/8

  // IPv6 loopback / link-local / unique-local.
  const low = ip.toLowerCase();
  if (ip === '::1' || low.startsWith('fe80:') || low.startsWith('fc') || low.startsWith('fd')) {
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
