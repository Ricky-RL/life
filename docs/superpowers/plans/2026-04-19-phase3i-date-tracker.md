# Phase 3I: Date Tracker & Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a wall calendar interaction in the room that opens an overlay showing anniversary counter, upcoming/past tracked dates with countdowns, add/edit/delete date forms, recurring date support, and milestone detection with celebration effects.

**Architecture:** DateService handles CRUD on the `tracked_dates` table and anniversary calculation. CalendarOverlay renders the date list as an HTML overlay. MilestoneChecker runs on popup open to detect today's milestones. The calendar room object glows on milestone days.

**Tech Stack:** Supabase (tracked_dates table, Realtime), HTML5 Canvas (calendar glow), Date math with UTC normalization

---

### Task 1: Date utilities (UTC normalization, countdowns)

**Files:**
- Create: `rhinosaurus-connect/shared/date-utils.js`
- Test: `rhinosaurus-connect/tests/shared/date-utils.test.js`

- [ ] **Step 1: Write test for date utilities**

```js
// rhinosaurus-connect/tests/shared/date-utils.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/date-utils.test.js`
Expected: FAIL

- [ ] **Step 3: Implement date-utils.js**

```js
// rhinosaurus-connect/shared/date-utils.js
export function normalizeToMidnightUTC(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function getDaysDifference(targetDate) {
  const now = normalizeToMidnightUTC(new Date());
  const target = normalizeToMidnightUTC(targetDate);
  const diffMs = target.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDateDistance(days) {
  const abs = Math.abs(days);
  if (days === 0) return 'Today!';
  const unit = abs === 1 ? 'day' : 'days';
  if (days > 0) return `${abs} ${unit}`;
  return `${abs} ${unit} ago`;
}

export function getNextOccurrence(dateString) {
  const now = normalizeToMidnightUTC(new Date());
  const original = normalizeToMidnightUTC(dateString);
  const month = original.getUTCMonth();
  const day = original.getUTCDate();
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), month, day));

  if (thisYear >= now) {
    return thisYear.toISOString().split('T')[0];
  }
  const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, month, day));
  return nextYear.toISOString().split('T')[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/date-utils.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/shared/date-utils.js rhinosaurus-connect/tests/shared/date-utils.test.js
git commit -m "feat: add date utilities with UTC normalization, countdowns, and recurring dates"
```

---

### Task 2: Date service (CRUD + milestone check)

**Files:**
- Create: `rhinosaurus-connect/popup/calendar/date-service.js`
- Test: `rhinosaurus-connect/tests/popup/calendar/date-service.test.js`

- [ ] **Step 1: Write test for date service**

```js
// rhinosaurus-connect/tests/popup/calendar/date-service.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/calendar/date-service.test.js`
Expected: FAIL

- [ ] **Step 3: Implement date-service.js**

```js
// rhinosaurus-connect/popup/calendar/date-service.js
import { getDaysDifference, getNextOccurrence, normalizeToMidnightUTC } from '../../shared/date-utils.js';

export class DateService {
  constructor(supabase, pairId, userId) {
    this.supabase = supabase;
    this.pairId = pairId;
    this.userId = userId;
  }

  async fetchDates() {
    const { data, error } = await this.supabase
      .from('tracked_dates')
      .select('*')
      .eq('pair_id', this.pairId)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async addDate(label, date, isCountdown, isRecurring) {
    const { data, error } = await this.supabase
      .from('tracked_dates')
      .insert({
        pair_id: this.pairId,
        label,
        date,
        is_countdown: isCountdown,
        is_recurring: isRecurring,
        created_by: this.userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateDate(dateId, changes) {
    const { error } = await this.supabase
      .from('tracked_dates')
      .update(changes)
      .eq('id', dateId);

    if (error) throw error;
  }

  async deleteDate(dateId) {
    const { error } = await this.supabase
      .from('tracked_dates')
      .delete()
      .eq('id', dateId);

    if (error) throw error;
  }

  getAnniversaryDays(anniversaryDate) {
    if (!anniversaryDate) return null;
    return Math.abs(getDaysDifference(anniversaryDate));
  }

  checkAnniversaryMilestones(anniversaryDate) {
    if (!anniversaryDate) return [];
    const days = this.getAnniversaryDays(anniversaryDate);
    if (days === 0) return [];
    const milestones = [];
    if (days % 100 === 0 || days % 365 === 0) {
      milestones.push(`Day ${days} together!`);
    }
    return milestones;
  }

  checkDateMilestones(trackedDates) {
    const today = normalizeToMidnightUTC(new Date()).toISOString().split('T')[0];
    const todayMonthDay = today.slice(5);
    const milestones = [];

    for (const td of trackedDates) {
      if (td.is_recurring) {
        const tdMonthDay = td.date.slice(5);
        if (tdMonthDay === todayMonthDay) {
          milestones.push(td.label);
        }
      } else if (td.date === today) {
        milestones.push(td.label);
      }
    }

    return milestones;
  }

  sortDates(trackedDates) {
    const upcoming = [];
    const past = [];

    for (const td of trackedDates) {
      let effectiveDate = td.date;
      if (td.is_recurring) {
        effectiveDate = getNextOccurrence(td.date);
      }
      const days = getDaysDifference(effectiveDate);
      const entry = { ...td, effectiveDate, days };

      if (days >= 0) {
        upcoming.push(entry);
      } else {
        past.push(entry);
      }
    }

    upcoming.sort((a, b) => a.days - b.days);
    past.sort((a, b) => b.days - a.days);

    return { upcoming, past };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/calendar/date-service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/calendar/date-service.js rhinosaurus-connect/tests/popup/calendar/date-service.test.js
git commit -m "feat: add date service with CRUD, milestone detection, and date sorting"
```

---

### Task 3: Calendar overlay UI

**Files:**
- Create: `rhinosaurus-connect/popup/calendar/calendar-overlay.js`
- Test: `rhinosaurus-connect/tests/popup/calendar/calendar-overlay.test.js`

- [ ] **Step 1: Write test for calendar overlay**

```js
// rhinosaurus-connect/tests/popup/calendar/calendar-overlay.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/calendar/calendar-overlay.test.js`
Expected: FAIL

- [ ] **Step 3: Implement calendar-overlay.js**

```js
// rhinosaurus-connect/popup/calendar/calendar-overlay.js
import { formatDateDistance, getDaysDifference } from '../../shared/date-utils.js';

export class CalendarOverlay {
  constructor(container, dateService, anniversaryDate) {
    this.container = container;
    this.service = dateService;
    this.anniversaryDate = anniversaryDate;
    this.isOpen = false;
    this.dates = [];
    this.onClose = null;
    this.editingId = null;
  }

  render() {
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'calendar-header';
    const backBtn = document.createElement('button');
    backBtn.className = 'calendar-back-btn';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.close());
    const title = document.createElement('span');
    title.textContent = 'Calendar';
    header.appendChild(backBtn);
    header.appendChild(title);

    const anniversary = document.createElement('div');
    anniversary.className = 'calendar-anniversary';
    const days = this.service.getAnniversaryDays(this.anniversaryDate);
    if (days !== null) {
      anniversary.textContent = `❤️ Day ${days} Together ❤️`;
    } else {
      anniversary.textContent = 'Set your anniversary!';
    }

    const datesContainer = document.createElement('div');
    datesContainer.className = 'calendar-dates';

    const addBtn = document.createElement('button');
    addBtn.className = 'calendar-add-btn';
    addBtn.textContent = '+ Add Date';
    addBtn.addEventListener('click', () => this.showAddForm());

    this.container.appendChild(header);
    this.container.appendChild(anniversary);
    this.container.appendChild(datesContainer);
    this.container.appendChild(addBtn);
  }

  async open() {
    this.render();
    this.isOpen = true;
    this.container.classList.remove('hidden');
    this.dates = await this.service.fetchDates();
    this.renderDates();
  }

  close() {
    this.isOpen = false;
    this.container.classList.add('hidden');
    if (this.onClose) this.onClose();
  }

  renderDates() {
    const datesContainer = this.container.querySelector('.calendar-dates');
    if (!datesContainer) return;
    datesContainer.innerHTML = '';

    const { upcoming, past } = this.service.sortDates(this.dates);

    if (upcoming.length > 0) {
      const section = document.createElement('div');
      section.className = 'calendar-section';
      const heading = document.createElement('h3');
      heading.textContent = 'Upcoming';
      section.appendChild(heading);
      for (const d of upcoming) {
        section.appendChild(this.createDateRow(d, formatDateDistance(d.days)));
      }
      datesContainer.appendChild(section);
    }

    if (past.length > 0) {
      const section = document.createElement('div');
      section.className = 'calendar-section';
      const heading = document.createElement('h3');
      heading.textContent = 'Memories';
      section.appendChild(heading);
      for (const d of past) {
        section.appendChild(this.createDateRow(d, formatDateDistance(d.days)));
      }
      datesContainer.appendChild(section);
    }
  }

  createDateRow(dateEntry, distanceText) {
    const row = document.createElement('div');
    row.className = 'calendar-date-row';
    row.addEventListener('click', () => this.showEditForm(dateEntry));

    const label = document.createElement('span');
    label.className = 'calendar-date-label';
    label.textContent = dateEntry.label;

    const distance = document.createElement('span');
    distance.className = 'calendar-date-distance';
    distance.textContent = distanceText;

    row.appendChild(label);
    row.appendChild(distance);
    return row;
  }

  showAddForm() {
    this.editingId = null;
    this.renderForm('', '', true, false);
  }

  showEditForm(dateEntry) {
    this.editingId = dateEntry.id;
    this.renderForm(dateEntry.label, dateEntry.date, dateEntry.is_countdown, dateEntry.is_recurring);
  }

  renderForm(label, date, isCountdown, isRecurring) {
    const existing = this.container.querySelector('.calendar-form');
    if (existing) existing.remove();

    const form = document.createElement('div');
    form.className = 'calendar-form';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'calendar-label-input';
    labelInput.placeholder = 'Label (e.g., "Next Visit")';
    labelInput.value = label;

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'calendar-date-input';
    dateInput.value = date;

    const recurringLabel = document.createElement('label');
    const recurringCheck = document.createElement('input');
    recurringCheck.type = 'checkbox';
    recurringCheck.className = 'calendar-recurring-input';
    recurringCheck.checked = isRecurring;
    recurringLabel.appendChild(recurringCheck);
    recurringLabel.appendChild(document.createTextNode(' Recurring yearly'));

    const saveBtn = document.createElement('button');
    saveBtn.className = 'calendar-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this.handleSave());

    form.appendChild(labelInput);
    form.appendChild(dateInput);
    form.appendChild(recurringLabel);
    form.appendChild(saveBtn);

    if (this.editingId) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'calendar-delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => this.handleDelete());
      form.appendChild(deleteBtn);
    }

    this.container.appendChild(form);
  }

  async handleSave() {
    const label = this.container.querySelector('.calendar-label-input')?.value.trim();
    const date = this.container.querySelector('.calendar-date-input')?.value;
    const isRecurring = this.container.querySelector('.calendar-recurring-input')?.checked || false;

    if (!label || !date) return;

    const isCountdown = getDaysDifference(date) >= 0;

    if (this.editingId) {
      await this.service.updateDate(this.editingId, { label, date, is_countdown: isCountdown, is_recurring: isRecurring });
    } else {
      await this.service.addDate(label, date, isCountdown, isRecurring);
    }

    this.dates = await this.service.fetchDates();
    this.renderDates();
    const form = this.container.querySelector('.calendar-form');
    if (form) form.remove();
  }

  async handleDelete() {
    if (!this.editingId) return;
    await this.service.deleteDate(this.editingId);
    this.dates = await this.service.fetchDates();
    this.renderDates();
    const form = this.container.querySelector('.calendar-form');
    if (form) form.remove();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/calendar/calendar-overlay.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/calendar/calendar-overlay.js rhinosaurus-connect/tests/popup/calendar/calendar-overlay.test.js
git commit -m "feat: add calendar overlay with date list, add/edit/delete forms, and anniversary counter"
```

---

### Task 4: Calendar glow effect and milestone notification

**Files:**
- Create: `rhinosaurus-connect/popup/room/calendar-glow.js`
- Test: `rhinosaurus-connect/tests/popup/room/calendar-glow.test.js`

- [ ] **Step 1: Write test for calendar glow**

```js
// rhinosaurus-connect/tests/popup/room/calendar-glow.test.js
import { describe, it, expect, vi } from 'vitest';
import { CalendarGlow } from '../../../popup/room/calendar-glow.js';

describe('CalendarGlow', () => {
  it('starts inactive', () => {
    const glow = new CalendarGlow();
    expect(glow.isActive).toBe(false);
  });

  it('activates with milestones', () => {
    const glow = new CalendarGlow();
    glow.setMilestones(['Day 100 together!']);
    expect(glow.isActive).toBe(true);
    expect(glow.milestones).toHaveLength(1);
  });

  it('draws sparkle when active', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
    };
    const glow = new CalendarGlow();
    glow.setMilestones(['Test']);
    glow.draw(ctx, 270, 30, 0);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('does not draw when inactive', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
    };
    const glow = new CalendarGlow();
    glow.draw(ctx, 270, 30, 0);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/calendar-glow.test.js`
Expected: FAIL

- [ ] **Step 3: Implement calendar-glow.js**

```js
// rhinosaurus-connect/popup/room/calendar-glow.js
export class CalendarGlow {
  constructor() {
    this.isActive = false;
    this.milestones = [];
  }

  setMilestones(milestones) {
    this.milestones = milestones;
    this.isActive = milestones.length > 0;
  }

  draw(ctx, calX, calY, timestamp) {
    if (!this.isActive) return;

    ctx.save();
    const pulse = 0.3 + 0.7 * Math.abs(Math.sin(timestamp / 400));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(calX - 2, calY - 2, 52, 52);
    ctx.restore();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/calendar-glow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/calendar-glow.js rhinosaurus-connect/tests/popup/room/calendar-glow.test.js
git commit -m "feat: add calendar glow effect for milestone days"
```

---

### Task 5: Wire calendar into popup

**Files:**
- Modify: `rhinosaurus-connect/popup/popup.js`

- [ ] **Step 1: Add calendar integration to popup.js**

```js
// Add imports:
import { DateService } from './calendar/date-service.js';
import { CalendarOverlay } from './calendar/calendar-overlay.js';
import { CalendarGlow } from './room/calendar-glow.js';

// In init():
let calendarOverlay = null;
let dateService = null;
const calendarGlow = new CalendarGlow();

async function setupCalendar(supabase, pairId, userId, anniversaryDate) {
  dateService = new DateService(supabase, pairId, userId);
  const overlayContainer = document.getElementById('overlay-container');
  calendarOverlay = new CalendarOverlay(overlayContainer, dateService, anniversaryDate);
  calendarOverlay.onClose = () => renderer.markDirty();

  const dates = await dateService.fetchDates();
  const milestones = [
    ...dateService.checkAnniversaryMilestones(anniversaryDate),
    ...dateService.checkDateMilestones(dates),
  ];
  calendarGlow.setMilestones(milestones);
}

// Add calendar glow as effect layer:
renderer.addEffect({
  draw(ctx) {
    const cal = roomState.furniture.find(f => f.type === 'calendar');
    if (cal) calendarGlow.draw(ctx, cal.x, cal.y, performance.now());
    if (calendarGlow.isActive) renderer.markDirty();
  },
});

// Modify handleInteraction for calendar:
// case 'dates':
//   if (calendarOverlay) calendarOverlay.open();
//   break;
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/popup.js
git commit -m "feat: wire calendar overlay, date service, and milestone glow into popup"
```

---

### Task 6: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 3I date tracker and calendar complete"
```

---

## Summary

After Phase 3I:
- **Date utilities**: UTC normalization, days difference, formatted distance, next recurring occurrence
- **DateService**: CRUD on tracked_dates, anniversary calculation, milestone detection (100-day/365-day + recurring month/day match)
- **CalendarOverlay**: anniversary counter, upcoming/past sorted lists, add/edit/delete forms with recurring checkbox
- **CalendarGlow**: pulsing golden glow on calendar object during milestone days
- **Popup integration**: calendar click opens overlay, milestone check on load, glow effect layer
