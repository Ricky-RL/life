# Feature 09: Date Tracker

## Summary
A wall calendar in the shared room that tracks the couple's anniversary, milestones, and custom dates. Both partners can add, edit, and remove dates. Shows countdowns for future dates and "X days since" for past dates.

---

## User Flow

### Viewing Dates
1. Click the wall calendar object in the room
2. Calendar overlay opens showing:
   - **Anniversary counter** at the top: "Day 847 together ❤️" (large, prominent)
   - **Upcoming dates** section: sorted by nearest first, showing countdown ("12 days until Next Visit")
   - **Past dates** section: sorted by most recent, showing "X days since" ("142 days since First Trip")
3. Close overlay to return to room

### Adding a Date
1. In the calendar overlay, click "+ Add Date" button
2. Form appears:
   - **Label** (text input): e.g., "First Date", "Next Visit", "Her Birthday"
   - **Date** (date picker)
   - **Type toggle**: "Countdown" (future) or "Memory" (past) — auto-detected from date but overridable
3. Save → date appears in the list

### Editing a Date
1. Click on any existing date in the list
2. Same form as adding, pre-filled with current values
3. Save or Delete buttons

### Deleting a Date
1. Edit a date → click "Delete"
2. Confirmation: "Remove this date?"
3. Confirmed → date removed

---

## Calendar Object in Room

### Visual Design
- Pixel art paper calendar pinned to the wall
- Shows the current month and day number
- Subtle glow animation on milestone days

### Milestone Detection
When the current date matches a tracked date (anniversary, birthday, etc.):
- Calendar glows with sparkle animation
- Both users get a special notification on popup open:
  - Avatar does a celebration animation (jumping, confetti)
  - Speech bubble: "Happy 1 Year Anniversary! 🎉" or "It's her birthday! 🎂"
- Small confetti particle effect in the room

### Anniversary Counter
- Always displayed on the calendar object as a tiny number
- Calculated from `pairs.anniversary_date`:
  ```js
  const daysTogether = Math.floor(
    (Date.now() - new Date(pair.anniversary_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  ```
- Also shown prominently in the calendar overlay

---

## Calendar Overlay UI

```
┌──────────────────────────────────┐
│  [← Back]     Calendar           │
│──────────────────────────────────│
│                                  │
│     ❤️ Day 847 Together ❤️      │  ← Anniversary counter
│     Since June 15, 2024          │
│                                  │
│  ── Upcoming ──────────────────  │
│  🗓️ Next Visit          12 days │
│  🎂 Her Birthday         45 days │
│                                  │
│  ── Memories ──────────────────  │
│  💕 First Date       142 days ago│
│  ✈️ First Trip       98 days ago │
│  🎄 First Christmas  120 days ago│
│                                  │
│         [+ Add Date]             │
└──────────────────────────────────┘
```

---

## Technical Implementation

### Date Calculations
All date math normalizes to UTC midnight to prevent off-by-one errors:

```js
function normalizeToMidnightUTC(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function getDaysDifference(targetDate) {
  const now = normalizeToMidnightUTC(new Date());
  const target = normalizeToMidnightUTC(targetDate);
  const diffTime = target.getTime() - now.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24)); // positive = future, negative = past
}

function formatDateDistance(days) {
  const absDays = Math.abs(days);
  if (days > 0) return `${absDays} day${absDays !== 1 ? 's' : ''}`;
  if (days === 0) return 'Today!';
  return `${absDays} day${absDays !== 1 ? 's' : ''} ago`;
}
```

### Milestone Check (on popup open)
```js
async function checkMilestones(pair, trackedDates) {
  const today = normalizeToMidnightUTC(new Date()).toISOString().split('T')[0];

  // Check tracked dates (including recurring — compare month+day)
  for (const td of trackedDates) {
    if (td.is_recurring) {
      // Recurring: match month and day regardless of year (birthdays, yearly events)
      const tdMonthDay = td.date.slice(5); // "MM-DD"
      const todayMonthDay = today.slice(5);
      if (tdMonthDay === todayMonthDay) {
        showMilestoneNotification(td.label);
      }
    } else if (td.date === today) {
      showMilestoneNotification(td.label);
    }
  }

  // Check anniversary milestones (generative rule: every 100 days, every 365 days)
  if (pair.anniversary_date) {
    const days = Math.abs(getDaysDifference(pair.anniversary_date));
    const isMilestone = (days % 100 === 0) || (days % 365 === 0);
    if (isMilestone && days > 0) {
      showMilestoneNotification(`Day ${days} together!`);
    }
  }
}
```

---

## Database
- `tracked_dates` table: `id, pair_id, label, date, is_countdown, is_recurring, created_by, created_at`
- `pairs.anniversary_date`: set during initial setup or via calendar
- `is_recurring`: true for birthdays, yearly anniversaries — display shows "X days until [label]" using next occurrence of the month+day

## Realtime
- Subscribe to changes on `tracked_dates` table filtered by `pair_id`
- When partner adds/edits/deletes a date, the calendar overlay updates in real-time if open

---

## Edge Cases
- **No anniversary date set**: calendar shows "Set your anniversary!" prompt instead of the counter
- **Anniversary date in the future**: show as countdown ("X days until our anniversary")
- **Time zones**: use UTC for date comparison. Dates are dates (no time component), so timezone differences of a few hours don't cause "off by one day" issues.
- **Both editing the same date simultaneously**: last write wins. Unlikely scenario for two people.
- **Many dates**: scroll within the overlay. No practical limit, but UI optimized for ~10-20 dates.
