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
