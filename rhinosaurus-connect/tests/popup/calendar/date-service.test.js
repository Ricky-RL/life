import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateService } from '../../../popup/calendar/date-service.js';

describe('DateService', () => {
  let service;
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

    storage = {};
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn((key) => {
            const k = typeof key === 'string' ? key : key[0];
            return Promise.resolve({ [k]: storage[k] });
          }),
          set: vi.fn((obj) => {
            Object.assign(storage, obj);
            return Promise.resolve();
          }),
        },
      },
    };
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-1');

    service = new DateService();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.chrome;
  });

  it('fetches tracked dates from chrome.storage.local', async () => {
    const dates = await service.fetchDates();
    expect(dates).toEqual([]);
    expect(chrome.storage.local.get).toHaveBeenCalledWith('tracked_dates');
  });

  it('returns stored dates', async () => {
    storage.tracked_dates = [{ id: '1', label: 'Test', date: '2025-12-25' }];
    const dates = await service.fetchDates();
    expect(dates).toHaveLength(1);
    expect(dates[0].label).toBe('Test');
  });

  it('adds a tracked date to storage', async () => {
    const result = await service.addDate('Christmas', '2025-12-25', true, false);
    expect(result.label).toBe('Christmas');
    expect(result.id).toBe('test-uuid-1');
    expect(chrome.storage.local.set).toHaveBeenCalled();
    expect(storage.tracked_dates).toHaveLength(1);
    expect(storage.tracked_dates[0].label).toBe('Christmas');
  });

  it('deletes a tracked date from storage', async () => {
    storage.tracked_dates = [
      { id: 'td-1', label: 'Test', date: '2025-12-25' },
      { id: 'td-2', label: 'Other', date: '2025-01-01' },
    ];
    await service.deleteDate('td-1');
    expect(storage.tracked_dates).toHaveLength(1);
    expect(storage.tracked_dates[0].id).toBe('td-2');
  });

  it('updates a tracked date in storage', async () => {
    storage.tracked_dates = [{ id: 'td-1', label: 'Old', date: '2025-12-25' }];
    await service.updateDate('td-1', { label: 'New' });
    expect(storage.tracked_dates[0].label).toBe('New');
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
