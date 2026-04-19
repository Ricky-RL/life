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
