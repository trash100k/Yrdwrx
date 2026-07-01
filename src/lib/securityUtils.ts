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

  let normalizedIP = ip;
  // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  if (isIP(ip) === 6 && ip.toLowerCase().startsWith('::ffff:')) {
    const lastPart = ip.split(':').pop();
    if (lastPart && isIP(lastPart) === 4) {
      normalizedIP = lastPart;
    }
  }

  if (isIP(normalizedIP) === 4) {
    const parts = normalizedIP.split('.').map(Number);

    // IPv4 Private Ranges:
    // 10.0.0.0 – 10.255.255.255
    // 172.16.0.0 – 172.31.255.255
    // 192.168.0.0 – 192.168.255.255
    // 127.0.0.0 – 127.255.255.255 (Loopback)
    // 169.254.0.0 – 169.254.255.255 (Link-local)

    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true; // 0.0.0.0
  } else {
    // IPv6 (basic check for loopback and unique local addresses)
    if (
      normalizedIP === '::1' ||
      normalizedIP.toLowerCase().startsWith('fe80:') ||
      normalizedIP.toLowerCase().startsWith('fc00:') ||
      normalizedIP.toLowerCase().startsWith('fd00:')
    ) {
      return true;
    }
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

    // 2. Resolve hostname to check for DNS rebinding / private IP resolution
    try {
      const { address } = await lookup(hostname);
      if (isPrivateIP(address)) {
        return false;
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
