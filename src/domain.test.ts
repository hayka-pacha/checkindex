import { describe, it, expect } from 'vitest';
import { normalizeDomain } from './domain.js';

describe('normalizeDomain', () => {
  it('extracts hostname from a full URL', () => {
    expect(normalizeDomain('https://example.com/page')).toBe('example.com');
  });

  it('extracts hostname and strips www from URL', () => {
    expect(normalizeDomain('https://www.example.com/page')).toBe('example.com');
  });

  it('strips www from a bare domain', () => {
    expect(normalizeDomain('www.foo.org')).toBe('foo.org');
  });

  it('lowercases the domain', () => {
    expect(normalizeDomain('BAR.NET')).toBe('bar.net');
  });

  it('lowercases and strips www from a URL with mixed case', () => {
    expect(normalizeDomain('https://www.EXAMPLE.COM/Page')).toBe('example.com');
  });

  it('returns a bare domain unchanged', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
  });

  it('handles domain with port by stripping port', () => {
    expect(normalizeDomain('https://example.com:8080/path')).toBe('example.com');
  });

  it('returns invalid input as-is (lowercased)', () => {
    expect(normalizeDomain('not a domain')).toBe('not a domain');
  });

  it('returns empty string as-is', () => {
    expect(normalizeDomain('')).toBe('');
  });

  it('handles domain with subdomain correctly', () => {
    expect(normalizeDomain('blog.example.com')).toBe('blog.example.com');
  });

  it('only strips www prefix, not www in the middle', () => {
    expect(normalizeDomain('notwww.example.com')).toBe('notwww.example.com');
  });
});
