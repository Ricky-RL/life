import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeToMidnightUTC,
  getDaysDifference,
  formatDateDistance,
  getNextOccurrence,
} from '../../shared/date-utils.js';

describe('normalizeToMidnightUTC', () => {
  it('strips time component', () => {
    const d = normalizeToMidnightUTC(new Date('2025-06-15T14:30:00Z'));
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });

  it('handles date string input', () => {
    const d = normalizeToMidnightUTC('2025-06-15');
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(5);
    expect(d.getUTCDate()).toBe(15);
  });
});

describe('getDaysDifference', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns positive for future dates', () => {
    expect(getDaysDifference('2025-06-20')).toBe(5);
  });

  it('returns negative for past dates', () => {
    expect(getDaysDifference('2025-06-10')).toBe(-5);
  });

  it('returns 0 for today', () => {
    expect(getDaysDifference('2025-06-15')).toBe(0);
  });
});

describe('formatDateDistance', () => {
  it('formats future days', () => {
    expect(formatDateDistance(5)).toBe('5 days');
  });

  it('formats singular day', () => {
    expect(formatDateDistance(1)).toBe('1 day');
  });

  it('formats today', () => {
    expect(formatDateDistance(0)).toBe('Today!');
  });

  it('formats past days', () => {
    expect(formatDateDistance(-3)).toBe('3 days ago');
  });

  it('formats singular past day', () => {
    expect(formatDateDistance(-1)).toBe('1 day ago');
  });
});

describe('getNextOccurrence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns this year if date has not passed', () => {
    const next = getNextOccurrence('2024-12-25');
    expect(next).toBe('2025-12-25');
  });

  it('returns next year if date has passed', () => {
    const next = getNextOccurrence('2024-03-10');
    expect(next).toBe('2026-03-10');
  });

  it('returns today if month/day matches', () => {
    const next = getNextOccurrence('2024-06-15');
    expect(next).toBe('2025-06-15');
  });
});
