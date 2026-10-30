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

  // Strip brackets if present (e.g. "[::1]" or "[127.0.0.1]")
  let cleanIp = ip.trim().replace(/^\[|\]$/g, '');

  // Check and unwrap IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1 hex representation)
  const mappedMatch = /^(?:::ffff:|0*:0*:0*:0*:0*:ffff:)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-fA-F]{1,4}):([0-9a-fA-F]{1,4}))$/i.exec(cleanIp);
  if (mappedMatch) {
    if (mappedMatch[1]) {
      cleanIp = mappedMatch[1];
    } else if (mappedMatch[2] && mappedMatch[3]) {
      const x = parseInt(mappedMatch[2], 16);
      const y = parseInt(mappedMatch[3], 16);
      cleanIp = `${(x >> 8) & 0xff}.${x & 0xff}.${(y >> 8) & 0xff}.${y & 0xff}`;
    }
  }

  if (!isIP(cleanIp)) return false;

  const low = cleanIp.toLowerCase();

  // IPv6 unspecified (:: or 0:0:0:0:0:0:0:0)
  if (low === '::' || /^0*(?::0*){7}$/.test(low)) {
    return true;
  }

  // IPv6 loopback (::1 or 0:0:0:0:0:0:0:1) / link-local / unique-local
  if (
    low === '::1' ||
    /^0*(?::0*){6}:0*1$/.test(low) ||
    low.startsWith('fe80:') ||
    low.startsWith('fc') ||
    low.startsWith('fd')
  ) {
    return true;
  }

  // IPv4 Private Ranges:
  // 10.0.0.0 – 10.255.255.255
  // 172.16.0.0 – 172.31.255.255
  // 192.168.0.0 – 192.168.255.255
  // 127.0.0.0 – 127.255.255.255 (Loopback)
  // 169.254.0.0 – 169.254.255.255 (Link-local)
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
