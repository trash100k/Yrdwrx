/**
 * Security utilities for protecting against common vulnerabilities.
 */

/**
 * Checks if a given string is a private or loopback IP address.
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4 Private Ranges
  // 10.0.0.0 - 10.255.255.255
  // 172.16.0.0 - 172.31.255.255
  // 192.168.0.0 - 192.168.255.255
  // 127.0.0.0 - 127.255.255.255 (Loopback)
  // 169.254.0.0 - 169.254.255.255 (Link-local)

  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Pattern);

  if (match) {
    const octets = match.slice(1).map(Number);
    if (octets[0] === 0) return true; // 0.0.0.0/8
    if (octets[0] === 10) return true;
    if (octets[0] === 127) return true;
    if (octets[0] === 169 && octets[1] === 254) return true;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
  }

  // IPv6 Private/Loopback
  const lowerIP = ip.toLowerCase();
  if (lowerIP === "::1" || lowerIP === "localhost" || lowerIP === "::") return true;
  if (lowerIP.startsWith("fe80:")) return true;
  if (lowerIP.startsWith("fc00:") || lowerIP.startsWith("fd00:")) return true;

  return false;
}

/**
 * Validates a URL to prevent SSRF and other URI-based attacks.
 */
export function validateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);

    // Only allow http and https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    // Check if hostname is a private IP
    // url.hostname for [::] is "::"
    let hostname = url.hostname;
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      hostname = hostname.slice(1, -1);
    }

    if (isPrivateIP(hostname)) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}
