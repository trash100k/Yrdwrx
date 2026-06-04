/**
 * Data Loss Prevention (DLP) Utilities
 * Ensures sensitive data like raw credit card numbers do not enter our databases
 * or logs. Required for PCI-DSS compliance and general data safety.
 */

// Basic CC regex that detects 13 to 19 digit strings, optionally separated by spaces or dashes
// Examples: "4111-1111-1111-1111", "4111 1111 1111 1111", "4111111111111111"
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

/**
 * Validates if a matched numeric string passes the Luhn algorithm.
 * This prevents false positives (e.g. tracking numbers, long phone numbers).
 */
function luhnCheck(numStr: string): boolean {
  const digits = numStr.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return (sum % 10) === 0;
}

/**
 * Scans a string and masks any credit card numbers detected.
 * Leaves the last 4 digits visible for reference.
 *
 * @param input The raw string to scan
 * @returns The string with CC numbers masked
 */
export function maskCreditCards(input: string | null | undefined): string {
  if (!input) return '';

  return input.replace(CREDIT_CARD_REGEX, (match) => {
    // Only mask if it actually looks like a credit card (Luhn check passes)
    if (luhnCheck(match)) {
      const digitsOnly = match.replace(/\D/g, '');
      const lastFour = digitsOnly.slice(-4);
      // Replace all characters except spaces/dashes with *, keeping formatting
      return match.replace(/\d/g, (d, offset, fullStr) => {
        // Keep the last 4 digits of the *original* sequence unmasked
        const numbersAfterThis = fullStr.slice(offset).replace(/\D/g, '').length;
        if (numbersAfterThis <= 4) return d;
        return '*';
      });
    }
    return match; // Not a CC, return original
  });
}

/**
 * Deep scans an object and masks any credit card strings found in its properties.
 * Useful for sanitizing complex JSON payloads before saving to Firestore.
 */
export function sanitizePayload<T>(payload: T): T {
  if (payload === null || payload === undefined) return payload;

  if (typeof payload === 'string') {
    return maskCreditCards(payload) as unknown as T;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item)) as unknown as T;
  }

  if (typeof payload === 'object') {
    // Preserve special objects like Date, Firebase Timestamps, FieldValues
    if (payload instanceof Date) return payload;

    // Check for Firebase Timestamp or FieldValue duck-typing
    if ('toDate' in payload && typeof (payload as any).toDate === 'function') return payload; // Timestamp
    if ('isEqual' in payload && typeof (payload as any).isEqual === 'function' && !('toDate' in payload)) return payload; // FieldValue

    const sanitizedObj: any = {};
    for (const [key, value] of Object.entries(payload)) {
      sanitizedObj[key] = sanitizePayload(value);
    }
    return sanitizedObj as T;
  }

  return payload;
}
