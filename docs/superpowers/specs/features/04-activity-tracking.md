# Feature 04: Activity Tracking

## Summary
Tracks the active tab's site name and page title and shares it with the partner in real-time. Activity is displayed on the TV object in the shared bedroom. Tracking can be toggled on/off. Incognito tabs are always excluded.

---

## How It Works

### Tab Tracking (Service Worker)
The service worker monitors the active tab using Chrome's `tabs` API:

```js
// Listen for tab activation changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleTabChange(tab);
});

// Listen for tab URL/title updates (e.g., navigating within YouTube)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title)) {
    handleTabChange(tab);
  }
});

function handleTabChange(tab) {
  // Skip incognito
  if (tab.incognito) return;

  // Skip if tracking is disabled
  if (!trackingEnabled) return;

  // Extract site name from URL
  const url = new URL(tab.url);
  const siteName = extractSiteName(url.hostname); // 'youtube.com' → 'YouTube'

  const activity = {
    site: siteName,
    title: tab.title,
    timestamp: Date.now()
  };

  // NOTE: full URL is intentionally NOT included in the activity payload.
  // Only site name and page title are shared to protect privacy.
  // The URL is only used locally for YouTube detection (Watch Together).
  const localActivity = { ...activity, url: tab.url }; // kept in-memory only

  // Broadcast via Realtime
  broadcastActivity(activity);

  // Update database (debounced)
  updateActivityInDb(activity);
}
```

### Site Name Extraction
Map common hostnames to friendly names:
```js
const SITE_NAMES = {
  'youtube.com': 'YouTube',
  'www.youtube.com': 'YouTube',
  'open.spotify.com': 'Spotify',
  'netflix.com': 'Netflix',
  'www.netflix.com': 'Netflix',
  'reddit.com': 'Reddit',
  'www.reddit.com': 'Reddit',
  'twitter.com': 'Twitter',
  'x.com': 'Twitter',
  'instagram.com': 'Instagram',
  'www.instagram.com': 'Instagram',
  'twitch.tv': 'Twitch',
  'www.twitch.tv': 'Twitch',
  // ... more common sites
};

function extractSiteName(hostname) {
  return SITE_NAMES[hostname] || hostname.replace('www.', '');
}
```

### Debouncing
- **Realtime broadcast**: debounced 500ms — waits for tab to "settle" before broadcasting (prevents noise from rapid tab switching)
- **Database write**: NOT used — activity is ephemeral and only exists in Realtime presence, not persisted to DB (see main spec "Source of Truth" section)
- If the same site+title is already broadcast, skip the duplicate

---

## TV Display in Room

### Visual Design
- Pixel art TV object in the room
- When partner has activity: TV screen shows a miniature representation:
  - Site favicon/logo as a pixel art icon (pre-made sprites for common sites)
  - Site name text rendered on the TV screen
  - Page title scrolling if too long
- When partner has no activity or tracking off: TV shows static/snow animation
- When partner is offline: TV is turned off (dark screen)

### TV States
| Partner State | TV Display |
|---------------|------------|
| Online, tracking on, browsing | Site icon + name + title on screen |
| Online, tracking off | "Tracking paused" message |
| Online, idle (no tab activity for 5+ min) | Screen saver animation |
| Offline | TV off (dark) |
| Watching YouTube | Special YouTube icon + video title, "Join" button hint |

**Idle detection**: the service worker uses `chrome.alarms` API (not `setInterval`, which doesn't survive MV3 service worker suspension) to check idle state:

```js
// Create a repeating alarm every 1 minute
chrome.alarms.create('idle-check', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'idle-check') {
    const idleThreshold = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - lastActivityTimestamp > idleThreshold) {
      broadcastIdleState();
    }
  }
});
```

The partner's TV transitions to the screen saver state. When the user switches tabs again, a normal activity update resumes and clears the idle state.

### Interaction
- Click on TV → opens an overlay panel showing:
  - Full site name and page title
  - If YouTube: "Join & Watch Together" button
  - Activity history (last 5 sites visited, with timestamps)
  - Toggle to enable/disable your own tracking

---

## Toggle Tracking

### In Room
- Toggle available in TV overlay and in settings
- Visual indicator in room: a small lamp or indicator light on the TV
  - Green/on: tracking enabled
  - Off: tracking disabled

### State
- Stored in `users.tracking_enabled` column
- Also stored in `chrome.storage.local` for fast access in service worker
- When disabled:
  - Stop broadcasting activity
  - Set `current_activity` to null in database
  - Partner's TV shows "Tracking paused"

---

## Incognito Handling
- Chrome extensions cannot access incognito tabs by default
- Even if "Allow in Incognito" is enabled, the extension explicitly skips tabs where `tab.incognito === true`
- No activity is tracked, broadcast, or stored during incognito browsing
- Partner sees the last known non-incognito activity (stale but not revealing)

---

## Avatar Auto-Movement

When the current user is watching YouTube:
- Their avatar automatically walks to sit in front of the TV
- Avatar switches to `sitting` animation state
- When they navigate away from YouTube, avatar walks back to previous position

This is triggered locally:
```js
function handleTabChange(tab) {
  const isYouTube = tab.url?.includes('youtube.com/watch');

  if (isYouTube && !wasOnYouTube) {
    // Move avatar to TV
    broadcastAvatarAutoMove('tv');
  } else if (!isYouTube && wasOnYouTube) {
    // Move avatar back
    broadcastAvatarAutoMove('previous');
  }

  wasOnYouTube = isYouTube;
}
```

---

## Database
- `users.tracking_enabled`: `boolean` — persisted preference
- `current_activity` is NOT stored in the database — it exists only in Realtime presence (ephemeral)
- `wasOnYouTube` state: stored in `chrome.storage.local` to survive service worker restarts

## Realtime
- Broadcast on `pair:{pair_id}:events`:
  - `{ type: 'activity_update', user_id, activity: { site, title, url } }`
  - `{ type: 'avatar_auto_move', user_id, target: 'tv' | 'previous' }`

---

## Edge Cases
- **Chrome internal pages** (`chrome://`, `chrome-extension://`): skip, don't broadcast. Show last known external activity.
- **New tab page**: skip, treat as idle.
- **Rapid tab switching**: 500ms debounce before broadcasting.
- **Service worker goes idle**: Chrome may suspend the service worker. On wake, re-check active tab and broadcast if changed.
- **Partner not paired yet**: don't track/broadcast anything.
