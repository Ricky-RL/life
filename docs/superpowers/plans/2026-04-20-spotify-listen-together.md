# Spotify Listen Together Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Spotify activity display and "Listen Together" functionality so partners can see what each other is listening to and open the same track.

**Architecture:** Hybrid approach — parse Spotify tab titles in TabTracker for song/artist, inject a lightweight content script on open.spotify.com to extract track URLs, and add a ListenTogetherManager (mirroring WatchTogetherManager) to detect when both users are on the same track. UI updates span the TV display (new spotify/listen_together states), TV overlay (Listen Together button), and a floating music note indicator near the partner avatar.

**Tech Stack:** Chrome Extension Manifest V3, Supabase Realtime (broadcast events), HTML5 Canvas, Vitest

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `rhinosaurus-connect/background/listen-together.js` | ListenTogetherManager — compares both users' Spotify track IDs, broadcasts listen_together_joined/ended events |
| `rhinosaurus-connect/content/spotify-content.js` | Content script injected on open.spotify.com — extracts current track URL from the now-playing bar DOM |
| `rhinosaurus-connect/popup/room/music-indicator.js` | Floating music note (♪) rendered on canvas near partner avatar when they're on Spotify |
| `rhinosaurus-connect/tests/background/listen-together.test.js` | Tests for ListenTogetherManager |
| `rhinosaurus-connect/tests/background/tab-tracker-spotify.test.js` | Tests for Spotify title parsing in TabTracker |
| `rhinosaurus-connect/tests/popup/room/music-indicator.test.js` | Tests for MusicIndicator |
| `rhinosaurus-connect/tests/popup/room/tv-display-lt.test.js` | Tests for TV display listen_together and spotify states |

### Modified Files

| File | Changes |
|------|---------|
| `rhinosaurus-connect/shared/constants.js` | Add LISTEN_TOGETHER_JOINED, LISTEN_TOGETHER_ENDED to REALTIME_EVENTS |
| `rhinosaurus-connect/background/tab-tracker.js` | Add isSpotifyTrack(), parseSpotifyTitle(), enrich activity with spotifySong/spotifyArtist, add onSpotifyChange callback |
| `rhinosaurus-connect/background/service-worker.js` | Handle SPOTIFY_TRACK_URL messages, instantiate ListenTogetherManager, wire listen-together events |
| `rhinosaurus-connect/popup/room/tv-display.js` | Add spotify/listen_together display states, drawSpotify(), drawListenTogether(), setListenTogether() |
| `rhinosaurus-connect/popup/room/tv-overlay.js` | Add Spotify activity section with Listen Together button, listen_together badge |
| `rhinosaurus-connect/popup/popup.js` | Wire MusicIndicator, handle listen-together events, handle music indicator click |
| `rhinosaurus-connect/manifest.json` | Add content_scripts entry for spotify-content.js on open.spotify.com, add host_permissions for open.spotify.com |
| `rhinosaurus-connect/scripts/build.js` | Add spotify-content.js to esbuild entry points |

---

### Task 1: Add Constants

**Files:**
- Modify: `rhinosaurus-connect/shared/constants.js:34-45`
- Test: `rhinosaurus-connect/tests/shared/constants.test.js`

- [ ] **Step 1: Write the failing test**

Create a test that checks for the new constants. Add this to `rhinosaurus-connect/tests/shared/constants.test.js` (append to existing file):

```js
import { describe, it, expect } from 'vitest';
import { REALTIME_EVENTS } from '../../shared/constants.js';

describe('REALTIME_EVENTS - Listen Together', () => {
  it('exports LISTEN_TOGETHER_JOINED', () => {
    expect(REALTIME_EVENTS.LISTEN_TOGETHER_JOINED).toBe('listen_together_joined');
  });

  it('exports LISTEN_TOGETHER_ENDED', () => {
    expect(REALTIME_EVENTS.LISTEN_TOGETHER_ENDED).toBe('listen_together_ended');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/constants.test.js`
Expected: FAIL — `LISTEN_TOGETHER_JOINED` is undefined

- [ ] **Step 3: Add the new constants**

In `rhinosaurus-connect/shared/constants.js`, add two entries to the `REALTIME_EVENTS` object after `WATCH_TOGETHER_ENDED`:

```js
export const REALTIME_EVENTS = {
  ACTIVITY_UPDATE: 'activity_update',
  REACTION: 'reaction',
  ROOM_UPDATE: 'room_update',
  AVATAR_MOVE: 'avatar_move',
  WATCH_TOGETHER_INVITE: 'watch_together_invite',
  WATCH_TOGETHER_JOINED: 'watch_together_joined',
  WATCH_TOGETHER_ENDED: 'watch_together_ended',
  LISTEN_TOGETHER_JOINED: 'listen_together_joined',
  LISTEN_TOGETHER_ENDED: 'listen_together_ended',
  MOOD_UPDATE: 'mood_update',
  TYPING: 'typing',
  AVATAR_CONFIG_UPDATE: 'avatar_config_update',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/constants.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/shared/constants.js rhinosaurus-connect/tests/shared/constants.test.js
git commit -m "feat: add listen together realtime event constants"
```

---

### Task 2: ListenTogetherManager

**Files:**
- Create: `rhinosaurus-connect/background/listen-together.js`
- Test: `rhinosaurus-connect/tests/background/listen-together.test.js`

- [ ] **Step 1: Write the failing tests**

Create `rhinosaurus-connect/tests/background/listen-together.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListenTogetherManager } from '../../background/listen-together.js';

describe('ListenTogetherManager', () => {
  let manager, mockChannel;

  beforeEach(() => {
    mockChannel = { send: vi.fn() };
    manager = new ListenTogetherManager('user-1', mockChannel);
  });

  it('starts inactive', () => {
    expect(manager.getState().active).toBe(false);
    expect(manager.getState().trackId).toBeNull();
  });

  it('detects same track match', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    expect(manager.getState().active).toBe(true);
    expect(manager.getState().trackId).toBe('abc123');
  });

  it('does not match different tracks', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/xyz789' });
    manager.check();
    expect(manager.getState().active).toBe(false);
  });

  it('strips query params when comparing', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123?si=foo' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123?si=bar' });
    manager.check();
    expect(manager.getState().active).toBe(true);
  });

  it('does not match when one user has no track URL', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: null });
    manager.check();
    expect(manager.getState().active).toBe(false);
  });

  it('does not match non-track URLs', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/playlist/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/playlist/abc123' });
    manager.check();
    expect(manager.getState().active).toBe(false);
  });

  it('deactivates when partner leaves', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    expect(manager.getState().active).toBe(true);

    manager.setPartnerActivity({ spotifyTrackUrl: null });
    manager.check();
    expect(manager.getState().active).toBe(false);
  });

  it('broadcasts listen_together_joined on activation', () => {
    manager.setMyActivity({
      spotifyTrackUrl: 'https://open.spotify.com/track/abc123',
      spotifySong: 'Cool Song',
      spotifyArtist: 'Cool Artist',
    });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'listen_together_joined',
      payload: {
        user_id: 'user-1',
        spotifyTrackUrl: 'https://open.spotify.com/track/abc123',
        spotifySong: 'Cool Song',
        spotifyArtist: 'Cool Artist',
      },
    });
  });

  it('broadcasts listen_together_ended on deactivation', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    mockChannel.send.mockClear();

    manager.setPartnerActivity({ spotifyTrackUrl: null });
    manager.check();
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'listen_together_ended',
      payload: { user_id: 'user-1' },
    });
  });

  it('does not broadcast again if already active on same track', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    mockChannel.send.mockClear();

    manager.check();
    expect(mockChannel.send).not.toHaveBeenCalled();
  });

  it('returns partner track URL from getJoinUrl', () => {
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/xyz789' });
    expect(manager.getJoinUrl()).toBe('https://open.spotify.com/track/xyz789');
  });

  it('returns null from getJoinUrl when partner has no track', () => {
    manager.setPartnerActivity({ spotifyTrackUrl: null });
    expect(manager.getJoinUrl()).toBeNull();
  });

  it('returns null from getJoinUrl when partner has non-track URL', () => {
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/playlist/abc' });
    expect(manager.getJoinUrl()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/listen-together.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ListenTogetherManager**

Create `rhinosaurus-connect/background/listen-together.js`:

```js
function extractTrackId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'open.spotify.com') return null;
    const match = parsed.pathname.match(/^\/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export class ListenTogetherManager {
  constructor(userId, channel) {
    this.userId = userId;
    this.channel = channel;
    this.myActivity = null;
    this.partnerActivity = null;
    this.state = {
      active: false,
      trackId: null,
      spotifySong: null,
      spotifyArtist: null,
      spotifyTrackUrl: null,
    };
  }

  setMyActivity(activity) {
    this.myActivity = activity;
  }

  setPartnerActivity(activity) {
    this.partnerActivity = activity;
  }

  check() {
    const myTrackId = extractTrackId(this.myActivity?.spotifyTrackUrl);
    const partnerTrackId = extractTrackId(this.partnerActivity?.spotifyTrackUrl);

    const wasActive = this.state.active;

    if (myTrackId && partnerTrackId && myTrackId === partnerTrackId) {
      if (!wasActive) {
        this.state = {
          active: true,
          trackId: myTrackId,
          spotifySong: this.myActivity.spotifySong || null,
          spotifyArtist: this.myActivity.spotifyArtist || null,
          spotifyTrackUrl: this.myActivity.spotifyTrackUrl,
        };
        this.channel.send({
          type: 'broadcast',
          event: 'listen_together_joined',
          payload: {
            user_id: this.userId,
            spotifyTrackUrl: this.myActivity.spotifyTrackUrl,
            spotifySong: this.myActivity.spotifySong || null,
            spotifyArtist: this.myActivity.spotifyArtist || null,
          },
        });
      }
    } else if (wasActive) {
      this.channel.send({
        type: 'broadcast',
        event: 'listen_together_ended',
        payload: { user_id: this.userId },
      });
      this.state = {
        active: false,
        trackId: null,
        spotifySong: null,
        spotifyArtist: null,
        spotifyTrackUrl: null,
      };
    }
  }

  getJoinUrl() {
    if (!this.partnerActivity?.spotifyTrackUrl) return null;
    const trackId = extractTrackId(this.partnerActivity.spotifyTrackUrl);
    if (!trackId) return null;
    return this.partnerActivity.spotifyTrackUrl;
  }

  getState() {
    return { ...this.state };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/listen-together.test.js`
Expected: All 13 tests PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/background/listen-together.js rhinosaurus-connect/tests/background/listen-together.test.js
git commit -m "feat: add ListenTogetherManager for Spotify sync detection"
```

---

### Task 3: TabTracker Spotify Title Parsing

**Files:**
- Modify: `rhinosaurus-connect/background/tab-tracker.js:92-152`
- Test: `rhinosaurus-connect/tests/background/tab-tracker-spotify.test.js`

- [ ] **Step 1: Write the failing tests**

Create `rhinosaurus-connect/tests/background/tab-tracker-spotify.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChrome = {
  tabs: {
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    get: vi.fn(),
  },
  alarms: {
    create: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({ tracking_enabled: true, wasOnYouTube: false })),
      set: vi.fn(() => Promise.resolve()),
    },
  },
};

vi.stubGlobal('chrome', mockChrome);

const { TabTracker } = await import('../../background/tab-tracker.js');

describe('TabTracker - Spotify', () => {
  let tracker;
  let mockBroadcast;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockBroadcast = vi.fn();
    tracker = new TabTracker(mockBroadcast);
  });

  describe('parseSpotifyTitle', () => {
    it('parses "Song · Artist" format', () => {
      const result = tracker.parseSpotifyTitle('Bohemian Rhapsody · Queen');
      expect(result).toEqual({ song: 'Bohemian Rhapsody', artist: 'Queen' });
    });

    it('handles extra whitespace around separator', () => {
      const result = tracker.parseSpotifyTitle('Song Name  ·  Artist Name');
      expect(result).toEqual({ song: 'Song Name', artist: 'Artist Name' });
    });

    it('returns null for titles without separator', () => {
      expect(tracker.parseSpotifyTitle('Spotify - Web Player')).toBeNull();
    });

    it('returns null for empty titles', () => {
      expect(tracker.parseSpotifyTitle('')).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(tracker.parseSpotifyTitle(null)).toBeNull();
      expect(tracker.parseSpotifyTitle(undefined)).toBeNull();
    });

    it('handles multiple separators by splitting on the first one', () => {
      const result = tracker.parseSpotifyTitle('Song · Artist · Extra');
      expect(result).toEqual({ song: 'Song', artist: 'Artist · Extra' });
    });
  });

  describe('isSpotifyTrack', () => {
    it('returns true for open.spotify.com', () => {
      expect(tracker.isSpotifyTrack('https://open.spotify.com/track/abc123')).toBe(true);
    });

    it('returns false for non-Spotify URLs', () => {
      expect(tracker.isSpotifyTrack('https://www.youtube.com/watch?v=abc')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(tracker.isSpotifyTrack('not-a-url')).toBe(false);
    });
  });

  describe('handleTabChange with Spotify', () => {
    it('enriches activity with spotifySong and spotifyArtist', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://open.spotify.com/track/abc123',
        title: 'Bohemian Rhapsody · Queen',
      });

      vi.advanceTimersByTime(600);

      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          site: 'Spotify',
          spotifySong: 'Bohemian Rhapsody',
          spotifyArtist: 'Queen',
        })
      );
    });

    it('does not add spotify fields for non-Spotify sites', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.reddit.com/',
        title: 'Reddit',
      });

      vi.advanceTimersByTime(600);

      const payload = mockBroadcast.mock.calls[0]?.[0];
      expect(payload?.spotifySong).toBeUndefined();
      expect(payload?.spotifyArtist).toBeUndefined();
    });

    it('handles Spotify pages without track title (e.g. search)', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://open.spotify.com/search',
        title: 'Spotify - Search',
      });

      vi.advanceTimersByTime(600);

      const payload = mockBroadcast.mock.calls[0]?.[0];
      expect(payload?.spotifySong).toBeUndefined();
      expect(payload?.spotifyArtist).toBeUndefined();
    });

    it('fires onSpotifyChange callback when entering Spotify', () => {
      tracker.trackingEnabled = true;
      const spotifyCallback = vi.fn();
      tracker.onSpotifyChange = spotifyCallback;

      tracker.handleTabChange({
        incognito: false,
        url: 'https://open.spotify.com/track/abc123',
        title: 'Song · Artist',
      });

      expect(spotifyCallback).toHaveBeenCalledWith('entered', expect.objectContaining({
        url: 'https://open.spotify.com/track/abc123',
      }));
    });

    it('fires onSpotifyChange callback when leaving Spotify', () => {
      tracker.trackingEnabled = true;
      tracker.wasOnSpotify = true;
      const spotifyCallback = vi.fn();
      tracker.onSpotifyChange = spotifyCallback;

      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.reddit.com/',
        title: 'Reddit',
      });

      expect(spotifyCallback).toHaveBeenCalledWith('left', null);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/tab-tracker-spotify.test.js`
Expected: FAIL — `parseSpotifyTitle` is not a function

- [ ] **Step 3: Implement Spotify parsing in TabTracker**

In `rhinosaurus-connect/background/tab-tracker.js`, add the following changes:

Add `wasOnSpotify` and `onSpotifyChange` to the constructor (after `this.onYouTubeChange = null;` on line 13):

```js
    this.wasOnSpotify = false;
    this.onSpotifyChange = null;
```

Add `isSpotifyTrack` method (after the `getYouTubeVideoId` method, around line 91):

```js
  isSpotifyTrack(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'open.spotify.com';
    } catch {
      return false;
    }
  }

  parseSpotifyTitle(title) {
    if (!title) return null;
    const idx = title.indexOf(' \u00b7 ');
    if (idx === -1) return null;
    const song = title.substring(0, idx).trim();
    const artist = title.substring(idx + 3).trim();
    if (!song || !artist) return null;
    return { song, artist };
  }
```

In `handleTabChange`, after the YouTube video ID enrichment block (around line 118-121), add Spotify enrichment:

```js
    const isSpotify = this.isSpotifyTrack(tab.url);
    if (isSpotify) {
      const parsed = this.parseSpotifyTitle(tab.title);
      if (parsed) {
        activity.spotifySong = parsed.song;
        activity.spotifyArtist = parsed.artist;
      }
    }
```

At the end of `handleTabChange`, after the YouTube change detection block (around lines 143-151), add Spotify change detection:

```js
    if (isSpotify && !this.wasOnSpotify) {
      this.wasOnSpotify = true;
      if (this.onSpotifyChange) this.onSpotifyChange('entered', this.localActivity);
    } else if (!isSpotify && this.wasOnSpotify) {
      this.wasOnSpotify = false;
      if (this.onSpotifyChange) this.onSpotifyChange('left', null);
    }
```

Also update the early-return skipped-tab block (around lines 94-100) to handle Spotify leave, matching the YouTube pattern:

```js
  handleTabChange(tab) {
    if (this.shouldSkipTab(tab)) {
      if (this.wasOnYouTube) {
        this.wasOnYouTube = false;
        chrome.storage.local.set({ wasOnYouTube: false });
        if (this.onYouTubeChange) this.onYouTubeChange('left', null);
      }
      if (this.wasOnSpotify) {
        this.wasOnSpotify = false;
        if (this.onSpotifyChange) this.onSpotifyChange('left', null);
      }
      return;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/tab-tracker-spotify.test.js`
Expected: All tests PASS

- [ ] **Step 5: Run all existing tab-tracker tests to check for regressions**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/tab-tracker.test.js`
Expected: All existing tests still PASS

- [ ] **Step 6: Commit**

```bash
git add rhinosaurus-connect/background/tab-tracker.js rhinosaurus-connect/tests/background/tab-tracker-spotify.test.js
git commit -m "feat: add Spotify title parsing and change detection to TabTracker"
```

---

### Task 4: Spotify Content Script

**Files:**
- Create: `rhinosaurus-connect/content/spotify-content.js`
- Modify: `rhinosaurus-connect/manifest.json`
- Modify: `rhinosaurus-connect/scripts/build.js:53-58`

- [ ] **Step 1: Create the content script**

Create `rhinosaurus-connect/content/spotify-content.js`:

```js
function extractTrackUrl() {
  const links = document.querySelectorAll('[data-testid="now-playing-widget"] a[href*="/track/"]');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href && href.includes('/track/')) {
      return href.startsWith('http') ? href : `https://open.spotify.com${href}`;
    }
  }
  const fallbackLinks = document.querySelectorAll('a[href*="/track/"]');
  for (const link of fallbackLinks) {
    const parent = link.closest('[data-testid]');
    if (parent && parent.dataset.testid.includes('now-playing')) {
      const href = link.getAttribute('href');
      return href.startsWith('http') ? href : `https://open.spotify.com${href}`;
    }
  }
  return null;
}

let lastSentUrl = null;

function checkAndSend() {
  const url = extractTrackUrl();
  if (url !== lastSentUrl) {
    lastSentUrl = url;
    if (url) {
      chrome.runtime.sendMessage({ type: 'SPOTIFY_TRACK_URL', url }).catch(() => {});
    }
  }
}

const observer = new MutationObserver(() => {
  checkAndSend();
});

function init() {
  checkAndSend();
  const target = document.querySelector('[data-testid="now-playing-widget"]') || document.body;
  observer.observe(target, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 2: Update manifest.json**

Add a new content_scripts entry and host_permissions for Spotify. In `rhinosaurus-connect/manifest.json`:

Add `"https://open.spotify.com/*"` to the `host_permissions` array:

```json
  "host_permissions": [
    "https://*.youtube.com/*",
    "https://*.supabase.co/*",
    "https://open.spotify.com/*"
  ],
```

Add a new content_scripts entry after the existing one:

```json
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/corner-popup.css"]
    },
    {
      "matches": ["https://open.spotify.com/*"],
      "js": ["content/spotify-content.js"]
    }
  ],
```

- [ ] **Step 3: Update build.js**

In `rhinosaurus-connect/scripts/build.js`, add `spotify-content.js` to the entry points array (around line 53-58):

```js
    entryPoints: [
      resolve(ROOT, 'background/service-worker.js'),
      resolve(ROOT, 'popup/popup.js'),
      resolve(ROOT, 'content/content.js'),
      resolve(ROOT, 'content/spotify-content.js'),
      resolve(ROOT, 'options/options.js'),
    ],
```

- [ ] **Step 4: Verify build succeeds**

Run: `cd rhinosaurus-connect && npm run build`
Expected: Build complete without errors

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/content/spotify-content.js rhinosaurus-connect/manifest.json rhinosaurus-connect/scripts/build.js
git commit -m "feat: add Spotify content script for track URL extraction"
```

---

### Task 5: TV Display — Spotify & Listen Together States

**Files:**
- Modify: `rhinosaurus-connect/popup/room/tv-display.js:54-103`
- Test: `rhinosaurus-connect/tests/popup/room/tv-display-lt.test.js`

- [ ] **Step 1: Write the failing tests**

Create `rhinosaurus-connect/tests/popup/room/tv-display-lt.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { TVDisplay } from '../../../popup/room/tv-display.js';

function createMockCtx() {
  return {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    beginPath: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
  };
}

describe('TVDisplay - Spotify', () => {
  it('returns spotify state when partner is on Spotify', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Spotify', title: 'Song · Artist', spotifySong: 'Song', spotifyArtist: 'Artist' },
    });
    expect(tv.getDisplayState()).toBe('spotify');
  });

  it('returns browsing for non-Spotify non-YouTube sites', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Reddit', title: 'r/programming' },
    });
    expect(tv.getDisplayState()).toBe('browsing');
  });

  it('draws spotify state without error', () => {
    const tv = new TVDisplay();
    const ctx = createMockCtx();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Spotify', title: 'Song · Artist', spotifySong: 'Song', spotifyArtist: 'Artist' },
    });
    tv.draw(ctx, 0, 0, 48, 36);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe('TVDisplay - Listen Together', () => {
  it('returns listen_together state', () => {
    const tv = new TVDisplay();
    tv.setListenTogether(true, 'Cool Song', 'Cool Artist');
    expect(tv.getDisplayState()).toBe('listen_together');
  });

  it('listen_together takes priority over spotify', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Spotify', title: 'Song · Artist' },
    });
    tv.setListenTogether(true, 'Song', 'Artist');
    expect(tv.getDisplayState()).toBe('listen_together');
  });

  it('listen_together takes priority over watch_together', () => {
    const tv = new TVDisplay();
    tv.setWatchTogether(true, 'Video', 'vid123');
    tv.setListenTogether(true, 'Song', 'Artist');
    expect(tv.getDisplayState()).toBe('listen_together');
  });

  it('returns to spotify state when listen together ends', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Spotify', title: 'Song · Artist', spotifySong: 'Song', spotifyArtist: 'Artist' },
    });
    tv.setListenTogether(true, 'Song', 'Artist');
    expect(tv.getDisplayState()).toBe('listen_together');
    tv.setListenTogether(false);
    expect(tv.getDisplayState()).toBe('spotify');
  });

  it('draws listen_together state without error', () => {
    const tv = new TVDisplay();
    const ctx = createMockCtx();
    tv.setListenTogether(true, 'Cool Song', 'Cool Artist');
    tv.draw(ctx, 0, 0, 48, 36);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/tv-display-lt.test.js`
Expected: FAIL — `setListenTogether` is not a function, `getDisplayState` doesn't return `'spotify'`

- [ ] **Step 3: Implement TV display changes**

In `rhinosaurus-connect/popup/room/tv-display.js`:

Add `listenTogether` state to the constructor (after `this.staticTimer = 0;`):

```js
    this.listenTogether = false;
    this.listenTogetherSong = null;
    this.listenTogetherArtist = null;
```

Add `setListenTogether` method (after `setWatchTogether`):

```js
  setListenTogether(active, song = null, artist = null) {
    this.listenTogether = active;
    this.listenTogetherSong = active ? song : null;
    this.listenTogetherArtist = active ? artist : null;
  }
```

Replace `getDisplayState()` with updated priority:

```js
  getDisplayState() {
    if (this.listenTogether) return 'listen_together';
    if (this.watchTogether) return 'watch_together';
    if (!this.partnerState.isOnline) return 'offline';
    if (this.partnerState.trackingPaused) return 'tracking_paused';
    if (this.partnerState.idle) return 'idle';
    if (this.partnerState.activity?.site === 'Spotify') return 'spotify';
    if (this.partnerState.isYouTube) return 'youtube';
    if (this.partnerState.activity?.site === 'YouTube') return 'youtube';
    if (this.partnerState.activity) return 'browsing';
    return 'offline';
  }
```

Add `drawSpotify` and `drawListenTogether` methods (after `drawWatchTogether`):

```js
  drawSpotify(ctx, x, y, width, height) {
    ctx.fillStyle = '#1DB954';
    ctx.fillRect(x + 2, y + 2, 8, 8);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = '5px monospace';
    ctx.textAlign = 'left';
    const song = this.partnerState.activity?.spotifySong || '';
    const truncSong = song.length > 12 ? song.substring(0, 12) + '..' : song;
    ctx.fillText(truncSong, x + 12, y + 8);

    ctx.fillStyle = '#aaa';
    ctx.font = '4px monospace';
    const artist = this.partnerState.activity?.spotifyArtist || '';
    const truncArtist = artist.length > 15 ? artist.substring(0, 15) + '..' : artist;
    ctx.fillText(truncArtist, x + 12, y + 16);

    ctx.fillStyle = '#1DB954';
    ctx.font = '4px monospace';
    ctx.fillText('Listen', x + width - 18, y + height - 4);
  }

  drawListenTogether(ctx, cx, cy) {
    ctx.fillStyle = '#1DB954';
    ctx.font = '5px monospace';
    ctx.fillText('Listening', cx, cy - 4);
    ctx.fillText('Together!', cx, cy + 4);
  }
```

Add the new cases to the `draw` method's switch statement (after `case 'watch_together':` block):

```js
      case 'spotify':
        this.drawSpotify(ctx, x, y, width, height);
        break;
      case 'listen_together':
        this.drawListenTogether(ctx, x + width / 2, y + height / 2);
        break;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/tv-display-lt.test.js`
Expected: All tests PASS

- [ ] **Step 5: Run all existing TV display tests for regressions**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/tv-display.test.js tests/popup/room/tv-display-wt.test.js`
Expected: All existing tests still PASS

- [ ] **Step 6: Commit**

```bash
git add rhinosaurus-connect/popup/room/tv-display.js rhinosaurus-connect/tests/popup/room/tv-display-lt.test.js
git commit -m "feat: add Spotify and Listen Together states to TV display"
```

---

### Task 6: TV Overlay — Spotify Section & Listen Together Button

**Files:**
- Modify: `rhinosaurus-connect/popup/room/tv-overlay.js:33-56`

- [ ] **Step 1: Update the TV overlay show() method**

In `rhinosaurus-connect/popup/room/tv-overlay.js`, within the `show()` method, after the YouTube join button block (after line 63 `this.element.appendChild(joinBtn);`), add the Spotify section:

```js
    if (state === 'spotify') {
      const activity = this.tvDisplay.partnerState.activity;
      if (activity) {
        const spotifySection = document.createElement('div');
        spotifySection.className = 'tv-overlay-spotify';

        if (activity.spotifySong) {
          const songEl = document.createElement('div');
          songEl.className = 'tv-overlay-spotify-song';
          songEl.textContent = activity.spotifySong;
          spotifySection.appendChild(songEl);
        }

        if (activity.spotifyArtist) {
          const artistEl = document.createElement('div');
          artistEl.className = 'tv-overlay-spotify-artist';
          artistEl.textContent = activity.spotifyArtist;
          spotifySection.appendChild(artistEl);
        }

        this.element.appendChild(spotifySection);
      }

      if (this.tvDisplay.partnerState.activity?.spotifyTrackUrl) {
        const listenBtn = document.createElement('button');
        listenBtn.className = 'tv-overlay-join tv-overlay-listen';
        listenBtn.textContent = 'Listen Together';
        listenBtn.addEventListener('click', () => {
          window.open(this.tvDisplay.partnerState.activity.spotifyTrackUrl, '_blank');
          this.hide();
        });
        this.element.appendChild(listenBtn);
      }
    }

    if (state === 'listen_together') {
      const ltSection = document.createElement('div');
      ltSection.className = 'tv-overlay-listen-together';

      const badge = document.createElement('div');
      badge.className = 'tv-overlay-lt-badge';
      badge.textContent = 'Listening Together!';
      ltSection.appendChild(badge);

      if (this.tvDisplay.listenTogetherSong) {
        const songEl = document.createElement('div');
        songEl.className = 'tv-overlay-spotify-song';
        songEl.textContent = this.tvDisplay.listenTogetherSong;
        ltSection.appendChild(songEl);
      }

      if (this.tvDisplay.listenTogetherArtist) {
        const artistEl = document.createElement('div');
        artistEl.className = 'tv-overlay-spotify-artist';
        artistEl.textContent = this.tvDisplay.listenTogetherArtist;
        ltSection.appendChild(artistEl);
      }

      this.element.appendChild(ltSection);
    }
```

- [ ] **Step 2: Add CSS for the new overlay elements**

In `rhinosaurus-connect/popup/popup.css`, append these styles at the end of the TV overlay section (after the `.tv-overlay-time` block):

```css
/* ── TV Overlay - Spotify ── */
.tv-overlay-spotify {
  text-align: center;
  padding: 16px 16px 12px;
  background:
    radial-gradient(ellipse at 50% 50%, rgba(29, 185, 84, 0.08) 0%, transparent 70%),
    var(--cream);
  border-bottom: 2px dashed var(--ink-faint);
}

.tv-overlay-spotify-song {
  font-family: 'Patrick Hand', cursive;
  font-size: 18px;
  color: var(--ink);
  margin-bottom: 4px;
}

.tv-overlay-spotify-artist {
  font-family: 'Silkscreen', monospace;
  font-size: 10px;
  color: var(--ink-light);
  letter-spacing: 0.5px;
}

.tv-overlay-listen {
  background: #1DB954;
  border-color: #158a3e;
}

.tv-overlay-listen:hover {
  background: #1aa34a;
}

.tv-overlay-listen-together {
  text-align: center;
  padding: 20px 16px;
  background:
    radial-gradient(ellipse at 50% 50%, rgba(29, 185, 84, 0.12) 0%, transparent 70%),
    var(--cream);
  border-bottom: 2px dashed var(--ink-faint);
}

.tv-overlay-lt-badge {
  font-family: 'Silkscreen', monospace;
  font-size: 12px;
  color: #1DB954;
  letter-spacing: 1px;
  margin-bottom: 8px;
  text-shadow: 1px 1px 0 rgba(29, 185, 84, 0.15);
}
```

- [ ] **Step 3: Verify build succeeds**

Run: `cd rhinosaurus-connect && npm run build`
Expected: Build complete without errors

- [ ] **Step 4: Commit**

```bash
git add rhinosaurus-connect/popup/room/tv-overlay.js rhinosaurus-connect/popup/popup.css
git commit -m "feat: add Spotify activity and Listen Together sections to TV overlay"
```

---

### Task 7: Music Indicator

**Files:**
- Create: `rhinosaurus-connect/popup/room/music-indicator.js`
- Test: `rhinosaurus-connect/tests/popup/room/music-indicator.test.js`

- [ ] **Step 1: Write the failing tests**

Create `rhinosaurus-connect/tests/popup/room/music-indicator.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { MusicIndicator } from '../../../popup/room/music-indicator.js';

describe('MusicIndicator', () => {
  it('starts inactive', () => {
    const indicator = new MusicIndicator();
    expect(indicator.active).toBe(false);
    expect(indicator.trackUrl).toBeNull();
  });

  it('activates with a track URL', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    expect(indicator.active).toBe(true);
    expect(indicator.trackUrl).toBe('https://open.spotify.com/track/abc123');
  });

  it('deactivates and clears URL', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    indicator.setActive(false);
    expect(indicator.active).toBe(false);
    expect(indicator.trackUrl).toBeNull();
  });

  it('draws without error when active', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1,
    };
    indicator.draw(ctx, 100, 200, 1000);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('does not draw when inactive', () => {
    const indicator = new MusicIndicator();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1,
    };
    indicator.draw(ctx, 100, 200, 1000);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('hitTest returns true when clicking on indicator position', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    indicator.draw({ save: vi.fn(), restore: vi.fn(), fillText: vi.fn(), fillStyle: '', font: '', textAlign: '', textBaseline: '', globalAlpha: 1 }, 100, 200, 1000);
    expect(indicator.hitTest(100, 190)).toBe(true);
  });

  it('hitTest returns false when inactive', () => {
    const indicator = new MusicIndicator();
    expect(indicator.hitTest(100, 190)).toBe(false);
  });

  it('hitTest returns false when clicking far away', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    indicator.draw({ save: vi.fn(), restore: vi.fn(), fillText: vi.fn(), fillStyle: '', font: '', textAlign: '', textBaseline: '', globalAlpha: 1 }, 100, 200, 1000);
    expect(indicator.hitTest(500, 500)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/music-indicator.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MusicIndicator**

Create `rhinosaurus-connect/popup/room/music-indicator.js`:

```js
export class MusicIndicator {
  constructor() {
    this.active = false;
    this.trackUrl = null;
    this.lastDrawX = 0;
    this.lastDrawY = 0;
  }

  setActive(active, trackUrl = null) {
    this.active = active;
    this.trackUrl = active ? trackUrl : null;
  }

  draw(ctx, avatarX, avatarY, timestamp) {
    if (!this.active) return;

    const bobOffset = Math.sin(timestamp / 400) * 3;
    const x = avatarX + 2;
    const y = avatarY - 12 + bobOffset;

    this.lastDrawX = x;
    this.lastDrawY = y;

    ctx.save();
    ctx.fillStyle = '#1DB954';
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9;
    ctx.fillText('\u266a', x, y);
    ctx.restore();
  }

  hitTest(clickX, clickY) {
    if (!this.active) return false;
    const dx = clickX - this.lastDrawX;
    const dy = clickY - this.lastDrawY;
    return Math.abs(dx) < 12 && Math.abs(dy) < 12;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/music-indicator.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/music-indicator.js rhinosaurus-connect/tests/popup/room/music-indicator.test.js
git commit -m "feat: add MusicIndicator for floating music note near avatar"
```

---

### Task 8: Service Worker — Wire Listen Together

**Files:**
- Modify: `rhinosaurus-connect/background/service-worker.js`

- [ ] **Step 1: Import ListenTogetherManager**

At the top of `rhinosaurus-connect/background/service-worker.js`, add the import after the existing imports (after line 6):

```js
import { ListenTogetherManager } from './listen-together.js';
```

- [ ] **Step 2: Add state variables**

After `let partnerActivity = null;` (line 18), add:

```js
let listenTogetherManager = null;
let spotifyTrackUrl = null;
```

- [ ] **Step 3: Wire up ListenTogetherManager in initTabTracker**

In the `initTabTracker` function, after the `tabTracker.onYouTubeChange` block (after line 137), add ListenTogetherManager setup and Spotify change handler:

```js
  listenTogetherManager = new ListenTogetherManager(currentSession.user.id, eventsChannel);

  tabTracker.onSpotifyChange = (action, activity) => {
    if (action === 'entered' && activity) {
      const enriched = { ...activity };
      if (spotifyTrackUrl) enriched.spotifyTrackUrl = spotifyTrackUrl;
      listenTogetherManager.setMyActivity(enriched);
      listenTogetherManager.check();
    } else {
      listenTogetherManager.setMyActivity(null);
      listenTogetherManager.check();
    }
  };
```

- [ ] **Step 4: Handle SPOTIFY_TRACK_URL in the message listener**

In the `handleMessage` function, before the `default:` case, add a new case:

```js
    case 'SPOTIFY_TRACK_URL': {
      spotifyTrackUrl = message.url;
      if (listenTogetherManager && tabTracker?.localActivity) {
        const enriched = { ...tabTracker.localActivity, spotifyTrackUrl: message.url };
        listenTogetherManager.setMyActivity(enriched);
        listenTogetherManager.check();
      }
      return { ok: true };
    }
```

- [ ] **Step 5: Update activity broadcast to include spotifyTrackUrl**

In the TabTracker broadcast callback (around line 112-124), update the broadcast to include `spotifyTrackUrl` when on Spotify:

```js
  tabTracker = new TabTracker((activity) => {
    if (eventsChannel) {
      const enrichedActivity = { ...activity };
      if (spotifyTrackUrl && activity.site === 'Spotify') {
        enrichedActivity.spotifyTrackUrl = spotifyTrackUrl;
      }
      console.log('[SW] Broadcasting:', enrichedActivity.site, enrichedActivity.title);
      eventsChannel.send({
        type: 'broadcast',
        event: REALTIME_EVENTS.ACTIVITY_UPDATE,
        payload: {
          user_id: currentSession?.user?.id,
          activity: enrichedActivity,
        },
      });
    }
  });
```

- [ ] **Step 6: Update partner activity handler to feed ListenTogetherManager**

In the channel's `ACTIVITY_UPDATE` handler (around line 67-73), add ListenTogetherManager update:

```js
    .on('broadcast', { event: REALTIME_EVENTS.ACTIVITY_UPDATE }, (msg) => {
      const payload = msg.payload;
      console.log('[SW] Received activity:', payload.user_id, payload.activity?.site);
      if (payload.user_id === currentSession?.user?.id) return;
      partnerActivity = payload.activity;
      sendToPopup({ type: 'PARTNER_ACTIVITY_UPDATE', activity: partnerActivity });
      if (listenTogetherManager) {
        listenTogetherManager.setPartnerActivity(partnerActivity);
        listenTogetherManager.check();
      }
    })
```

- [ ] **Step 7: Add listen-together event handlers on the channel**

After the existing `MOOD_UPDATE` handler (around line 101), add handlers for listen-together events:

```js
    .on('broadcast', { event: 'listen_together_joined' }, (msg) => {
      const payload = msg.payload;
      if (payload.user_id === currentSession?.user?.id) return;
      sendToPopup({ type: 'LISTEN_TOGETHER_JOINED', data: payload });
    })
    .on('broadcast', { event: 'listen_together_ended' }, (msg) => {
      const payload = msg.payload;
      if (payload.user_id === currentSession?.user?.id) return;
      sendToPopup({ type: 'LISTEN_TOGETHER_ENDED', data: payload });
    })
```

- [ ] **Step 8: Clear spotifyTrackUrl on unpair**

In the `UNPAIR` case (around line 261-270), add `spotifyTrackUrl = null;` and `listenTogetherManager = null;`:

```js
    case 'UNPAIR': {
      if (currentPair) {
        await authManager.unpair(currentPair.id);
        currentPair = null;
        if (eventsChannel) {
          eventsChannel.unsubscribe();
          eventsChannel = null;
        }
        tabTracker = null;
        listenTogetherManager = null;
        spotifyTrackUrl = null;
      }
      return { ok: true };
    }
```

- [ ] **Step 9: Verify build succeeds**

Run: `cd rhinosaurus-connect && npm run build`
Expected: Build complete without errors

- [ ] **Step 10: Commit**

```bash
git add rhinosaurus-connect/background/service-worker.js
git commit -m "feat: wire ListenTogetherManager and Spotify track URL in service worker"
```

---

### Task 9: Popup — Wire MusicIndicator & Listen Together Events

**Files:**
- Modify: `rhinosaurus-connect/popup/popup.js`

- [ ] **Step 1: Import MusicIndicator**

At the top of `rhinosaurus-connect/popup/popup.js`, add the import after the existing imports (after line 15):

```js
import { MusicIndicator } from './room/music-indicator.js';
```

- [ ] **Step 2: Add MusicIndicator instance**

After `const phoneGlow = new PhoneGlow();` (line 45), add:

```js
const musicIndicator = new MusicIndicator();
```

- [ ] **Step 3: Register MusicIndicator as a renderer effect**

In the `init` function, after the phone glow effect registration (around line 454), add:

```js
  renderer.addEffect({
    draw(ctx) {
      const partnerAvatarData = renderer.avatars.get('partner');
      if (partnerAvatarData) {
        musicIndicator.draw(ctx, partnerAvatarData.controller.x, partnerAvatarData.controller.y, performance.now());
        if (musicIndicator.active) renderer.markDirty();
      }
    },
  });
```

- [ ] **Step 4: Update the PARTNER_ACTIVITY_UPDATE handler**

In the existing `chrome.runtime.onMessage` listener within `init` (around line 174-178), update the handler to also manage the music indicator:

```js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PARTNER_ACTIVITY_UPDATE') {
      applyActivity(message.activity);
      if (message.activity?.site === 'Spotify' && message.activity?.spotifyTrackUrl) {
        musicIndicator.setActive(true, message.activity.spotifyTrackUrl);
      } else {
        musicIndicator.setActive(false);
      }
      renderer.markDirty();
    }
  });
```

- [ ] **Step 5: Add listen-together event handlers**

In the `setupChat` function's `chrome.runtime.onMessage.addListener` block (around line 517-557), add handlers for listen-together events:

```js
    if (message.type === 'LISTEN_TOGETHER_JOINED') {
      const { spotifySong, spotifyArtist } = message.data;
      if (tvDisplay) {
        tvDisplay.setListenTogether(true, spotifySong, spotifyArtist);
        renderer.markDirty();
      }
    }
    if (message.type === 'LISTEN_TOGETHER_ENDED') {
      if (tvDisplay) {
        tvDisplay.setListenTogether(false);
        renderer.markDirty();
      }
    }
```

- [ ] **Step 6: Add music indicator click handling**

In the canvas click handler (around line 306-323), add music indicator hit test before the existing interaction handling:

```js
  canvas.addEventListener('click', (e) => {
    const { x, y } = canvasCoords(e);

    if (editMode && editMode.isEditMode) {
      const hit = renderer.hitTestAll(x, y);
      if (hit) {
        editMode.select(hit.id);
      } else {
        editMode.select(null);
      }
      return;
    }

    if (musicIndicator.hitTest(x, y) && musicIndicator.trackUrl) {
      window.open(musicIndicator.trackUrl, '_blank');
      return;
    }

    const hit = renderer.hitTest(x, y);
    if (hit) {
      handleInteraction(hit);
    }
  });
```

- [ ] **Step 7: Verify build succeeds**

Run: `cd rhinosaurus-connect && npm run build`
Expected: Build complete without errors

- [ ] **Step 8: Commit**

```bash
git add rhinosaurus-connect/popup/popup.js
git commit -m "feat: wire MusicIndicator and listen-together events in popup"
```

---

### Task 10: Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests PASS, including:
- `tests/background/listen-together.test.js` (13 tests)
- `tests/background/tab-tracker-spotify.test.js` (11 tests)
- `tests/popup/room/music-indicator.test.js` (7 tests)
- `tests/popup/room/tv-display-lt.test.js` (6 tests)
- `tests/shared/constants.test.js` (existing + 2 new)
- All pre-existing tests still pass

- [ ] **Step 2: Verify full build**

Run: `cd rhinosaurus-connect && npm run build`
Expected: Build complete, `dist/` contains `content/spotify-content.js`

- [ ] **Step 3: Verify manifest in dist**

Run: `cat rhinosaurus-connect/dist/manifest.json | python3 -m json.tool | grep -A 5 spotify`
Expected: Shows the spotify content script entry and host permission
