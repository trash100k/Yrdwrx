
/**
 * Security utility functions for protecting the application.
 */

/**
 * Checks if a URL points to a private or restricted IP address.
 * This helps prevent Server-Side Request Forgery (SSRF) attacks.
 */
export function isPrivateIP(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    // Check for localhost
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    ) {
      return true;
    }

    // Check for private IP ranges (IPv4)
    // 10.0.0.0 – 10.255.255.255
    // 172.16.0.0 – 172.31.255.255
    // 192.168.0.0 – 192.168.255.255
    // 169.254.0.0 - 169.254.255.255 (Link-local)
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4) {
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
    }

    // Check for private/reserved hostname suffixes
    const privateSuffixes = ['.local', '.internal', '.lan', '.home', '.corp'];
    if (privateSuffixes.some(suffix => hostname.endsWith(suffix))) {
      return true;
    }

    return false;
  } catch (e) {
    return true; // Invalid URL or failed parse should be treated as restricted
  }
}
