import { describe, it, expect } from 'vitest';
import { isPrivateIP } from '../src/lib/securityUtils';

describe('isPrivateIP', () => {
  it('should identify private IPv4 addresses', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true);
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('192.168.1.1')).toBe(true);
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('169.254.0.1')).toBe(true);
    expect(isPrivateIP('0.0.0.0')).toBe(true);
  });

  it('should identify public IPv4 addresses', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
  });

  it('should identify private IPv6 addresses', () => {
    expect(isPrivateIP('::1')).toBe(true);
    expect(isPrivateIP('fe80::1')).toBe(true);
    expect(isPrivateIP('fc00::')).toBe(true);
    expect(isPrivateIP('fd00::')).toBe(true);
  });

  it('should identify IPv4-mapped IPv6 private addresses', () => {
    expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true);
  });
});
