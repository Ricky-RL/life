import { getDaysDifference, getNextOccurrence, normalizeToMidnightUTC } from '../../shared/date-utils.js';

const STORAGE_KEY = 'tracked_dates';

export class DateService {
  constructor() {}

  async fetchDates() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  }

  async addDate(label, date, isCountdown, isRecurring) {
    const dates = await this.fetchDates();
    const newDate = {
      id: crypto.randomUUID(),
      label,
      date,
      is_countdown: isCountdown,
      is_recurring: isRecurring,
      created_at: new Date().toISOString(),
    };
    dates.push(newDate);
    await chrome.storage.local.set({ [STORAGE_KEY]: dates });
    return newDate;
  }

  async updateDate(dateId, changes) {
    const dates = await this.fetchDates();
    const idx = dates.findIndex(d => d.id === dateId);
    if (idx !== -1) {
      Object.assign(dates[idx], changes);
      await chrome.storage.local.set({ [STORAGE_KEY]: dates });
    }
  }

  async deleteDate(dateId) {
    const dates = await this.fetchDates();
    const filtered = dates.filter(d => d.id !== dateId);
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
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
