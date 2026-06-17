
import { expect, test } from 'vitest';
import { isPrivateIP } from './securityUtils';

test('isPrivateIP strictly blocks internal networks', () => {
  // Localhost
  expect(isPrivateIP('http://localhost')).toBe(true);
  expect(isPrivateIP('http://127.0.0.1')).toBe(true);
  expect(isPrivateIP('http://[::1]')).toBe(true);

  // Private IPv4 ranges
  expect(isPrivateIP('http://10.0.0.1')).toBe(true);
  expect(isPrivateIP('http://172.16.0.1')).toBe(true);
  expect(isPrivateIP('http://172.31.255.255')).toBe(true);
  expect(isPrivateIP('http://192.168.1.1')).toBe(true);

  // Cloud metadata
  expect(isPrivateIP('http://169.254.169.254')).toBe(true);

  // Private TLDs
  expect(isPrivateIP('http://service.internal')).toBe(true);
  expect(isPrivateIP('http://router.local')).toBe(true);
  expect(isPrivateIP('http://database.lan')).toBe(true);

  // Public
  expect(isPrivateIP('https://google.com')).toBe(false);
  expect(isPrivateIP('https://8.8.8.8')).toBe(false);
  expect(isPrivateIP('https://yardworx.com/about')).toBe(false);
});

test('isPrivateIP handles invalid URLs', () => {
  expect(isPrivateIP('not-a-url')).toBe(true);
  expect(isPrivateIP('')).toBe(true);
});
