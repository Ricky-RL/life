import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CalendarOverlay } from '../../../popup/calendar/calendar-overlay.js';

describe('CalendarOverlay', () => {
  let overlay;
  let container;
  let mockService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    container = document.createElement('div');
    document.body.appendChild(container);
    mockService = {
      fetchDates: vi.fn(() => Promise.resolve([])),
      addDate: vi.fn(() => Promise.resolve({ id: 'td-1', label: 'Test', date: '2025-12-25' })),
      deleteDate: vi.fn(() => Promise.resolve()),
      updateDate: vi.fn(() => Promise.resolve()),
      getAnniversaryDays: vi.fn(() => 365),
      sortDates: vi.fn(() => ({ upcoming: [], past: [] })),
    };
    overlay = new CalendarOverlay(container, mockService, '2024-06-15');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('renders overlay structure', () => {
    overlay.render();
    expect(container.querySelector('.calendar-header')).not.toBeNull();
    expect(container.querySelector('.calendar-anniversary')).not.toBeNull();
    expect(container.querySelector('.calendar-dates')).not.toBeNull();
  });

  it('shows anniversary counter', () => {
    overlay.render();
    const counter = container.querySelector('.calendar-anniversary');
    expect(counter.textContent).toContain('365');
  });

  it('shows "Set your anniversary" when no date', () => {
    overlay = new CalendarOverlay(container, mockService, null);
    mockService.getAnniversaryDays.mockReturnValue(null);
    overlay.render();
    const counter = container.querySelector('.calendar-anniversary');
    expect(counter.textContent).toContain('Set your anniversary');
  });

  it('opens and loads dates', async () => {
    await overlay.open();
    expect(overlay.isOpen).toBe(true);
    expect(mockService.fetchDates).toHaveBeenCalled();
  });

  it('shows add date form', () => {
    overlay.render();
    const addBtn = container.querySelector('.calendar-add-btn');
    addBtn.click();
    expect(container.querySelector('.calendar-form')).not.toBeNull();
  });

  it('adds a date via form', async () => {
    overlay.render();
    overlay.showAddForm();
    const labelInput = container.querySelector('.calendar-label-input');
    const dateInput = container.querySelector('.calendar-date-input');
    labelInput.value = 'Christmas';
    dateInput.value = '2025-12-25';
    await overlay.handleSave();
    expect(mockService.addDate).toHaveBeenCalledWith('Christmas', '2025-12-25', true, false);
  });

  it('closes overlay', () => {
    overlay.render();
    overlay.isOpen = true;
    overlay.close();
    expect(overlay.isOpen).toBe(false);
  });
});
