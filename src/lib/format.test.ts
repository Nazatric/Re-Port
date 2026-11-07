import { describe, expect, it } from 'vitest';
import { formatBytes, formatCount, formatDate, hashString, initials, plural, timeAgo } from './format';

describe('formatDate', () => {
  it('formats full dates and month-only dates', () => {
    expect(formatDate('2026-10-23')).toBe('Oct 23, 2026');
    expect(formatDate('2026-07-01')).toBe('Jul 2026');
  });
  it('handles empty and invalid values', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});

describe('formatCount, formatBytes, plural', () => {
  it('abbreviates large counts', () => {
    expect(formatCount(7)).toBe('7');
    expect(formatCount(1250)).toBe('1.3k');
    expect(formatCount(2000)).toBe('2k');
    expect(formatCount(48000)).toBe('48k');
  });
  it('formats file sizes', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(48 * 1024 * 1024)).toBe('48.0 MB');
    expect(formatBytes(NaN)).toBe('');
  });
  it('pluralises', () => {
    expect(plural(1, 'game')).toBe('1 game');
    expect(plural(1200, 'game')).toBe('1,200 games');
    expect(plural(0, 'result')).toBe('0 results');
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  it('describes recent and old dates', () => {
    expect(timeAgo('2026-11-06', now)).toBe('today');
    expect(timeAgo('2026-11-05', now)).toBe('yesterday');
    expect(timeAgo('2026-11-01', now)).toBe('5 days ago');
    expect(timeAgo('2026-10-01', now)).toBe('5 weeks ago');
    expect(timeAgo('2026-06-01', now)).toBe('5 months ago');
    expect(timeAgo('2024-06-01', now)).toBe('2 years ago');
    expect(timeAgo('', now)).toBe('');
  });
});

describe('initials and hashing', () => {
  it('builds short initials', () => {
    expect(initials('The Legend of Zelda')).toBe('LZ');
    expect(initials('Doom')).toBe('DO');
    expect(initials('Super Mario 64')).toBe('SM6');
    expect(initials('!!!')).toBe('!!');
  });
  it('hashes deterministically', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});
