import { describe, it, expect } from 'vitest';
import { isPrivateIP, validateSafeUrl } from './securityUtils';

describe('securityUtils', () => {
  describe('isPrivateIP', () => {
    it('should identify private IPv4 addresses', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
    });

    it('should identify loopback and link-local addresses', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('169.254.1.1')).toBe(true);
      expect(isPrivateIP('0.0.0.0')).toBe(true);
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('should return false for public IP addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('208.67.222.222')).toBe(false);
    });
  });

  describe('validateSafeUrl', () => {
    it('should allow safe public URLs', async () => {
      expect(await validateSafeUrl('https://www.google.com')).toBe(true);
      expect(await validateSafeUrl('http://example.com/page')).toBe(true);
    });

    it('should block URLs with private IP hostnames', async () => {
      expect(await validateSafeUrl('http://127.0.0.1')).toBe(false);
      expect(await validateSafeUrl('http://192.168.1.100/admin')).toBe(false);
      expect(await validateSafeUrl('http://10.0.0.1')).toBe(false);
    });

    it('should block non-http/https protocols', async () => {
      expect(await validateSafeUrl('ftp://example.com')).toBe(false);
      expect(await validateSafeUrl('file:///etc/passwd')).toBe(false);
      expect(await validateSafeUrl('javascript:alert(1)')).toBe(false);
    });

    it('should block hostnames that resolve to private IPs', async () => {
      // localhost usually resolves to 127.0.0.1
      expect(await validateSafeUrl('http://localhost')).toBe(false);
    });
  });
});
