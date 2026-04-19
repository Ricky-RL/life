import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateService } from '../../../popup/calendar/date-service.js';

describe('DateService', () => {
  let service;
  let mockSupabase;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { id: 'td-1', label: 'Test', date: '2025-12-25', is_recurring: false },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    };
    service = new DateService(mockSupabase, 'pair-1', 'user-1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches tracked dates', async () => {
    const dates = await service.fetchDates();
    expect(dates).toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledWith('tracked_dates');
  });

  it('adds a tracked date', async () => {
    const result = await service.addDate('Christmas', '2025-12-25', true, false);
    expect(result.label).toBe('Test');
  });

  it('deletes a tracked date', async () => {
    await service.deleteDate('td-1');
    expect(mockSupabase.from).toHaveBeenCalledWith('tracked_dates');
  });

  it('calculates anniversary days', () => {
    const days = service.getAnniversaryDays('2024-06-15');
    expect(days).toBe(365);
  });

  it('returns null anniversary days when no date', () => {
    expect(service.getAnniversaryDays(null)).toBeNull();
  });

  it('checks for milestone on exact anniversary day count', () => {
    const milestones = service.checkAnniversaryMilestones('2024-06-15');
    expect(milestones).toContain('Day 365 together!');
  });

  it('detects 100-day milestones', () => {
    vi.setSystemTime(new Date('2024-09-23T12:00:00Z'));
    const milestones = service.checkAnniversaryMilestones('2024-06-15');
    expect(milestones).toContain('Day 100 together!');
  });

  it('detects recurring date milestone', () => {
    const dates = [
      { label: 'Birthday', date: '2024-06-15', is_recurring: true },
    ];
    const milestones = service.checkDateMilestones(dates);
    expect(milestones).toContain('Birthday');
  });

  it('does not flag non-matching recurring dates', () => {
    const dates = [
      { label: 'Birthday', date: '2024-12-25', is_recurring: true },
    ];
    const milestones = service.checkDateMilestones(dates);
    expect(milestones).toHaveLength(0);
  });

  it('sorts dates into upcoming and past', () => {
    const dates = [
      { label: 'A', date: '2025-12-25', is_countdown: true, is_recurring: false },
      { label: 'B', date: '2025-01-01', is_countdown: false, is_recurring: false },
    ];
    const sorted = service.sortDates(dates);
    expect(sorted.upcoming[0].label).toBe('A');
    expect(sorted.past[0].label).toBe('B');
  });
});
