# Phase 1D: Activity Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement tab activity tracking in the service worker with privacy-safe broadcasting, idle detection via chrome.alarms, and TV display rendering in the room showing partner's current activity.

**Architecture:** TabTracker in the service worker monitors active tabs, extracts site names, debounces broadcasts, and detects YouTube for Watch Together. TVDisplay in the popup renders the partner's activity on the TV furniture sprite with multiple display states. Activity is ephemeral (Realtime only, never persisted to DB).

**Tech Stack:** Chrome Tabs API, Chrome Alarms API, Supabase Realtime (broadcast + presence)

---

## File Structure

```
rhinosaurus-connect/
├── background/
│   ├── tab-tracker.js            # Tab monitoring, site extraction, broadcast, idle, YouTube detection
│   └── service-worker.js         # (modify) Import tab-tracker, wire alarms
├── popup/
│   └── room/
│       └── tv-display.js         # TV rendering states, activity display, TV overlay
├── tests/
│   ├── background/
│   │   └── tab-tracker.test.js
│   └── popup/
│       └── room/
│           └── tv-display.test.js
```

---

### Task 1: Site name extraction and tab change handling

**Files:**
- Create: `rhinosaurus-connect/background/tab-tracker.js`
- Test: `rhinosaurus-connect/tests/background/tab-tracker.test.js`

- [ ] **Step 1: Write test for site name extraction and tab filtering**

```js
// rhinosaurus-connect/tests/background/tab-tracker.test.js
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

describe('TabTracker', () => {
  let tracker;
  let mockBroadcast;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBroadcast = vi.fn();
    tracker = new TabTracker(mockBroadcast);
  });

  describe('extractSiteName', () => {
    it('maps known hostnames to friendly names', () => {
      expect(tracker.extractSiteName('www.youtube.com')).toBe('YouTube');
      expect(tracker.extractSiteName('youtube.com')).toBe('YouTube');
      expect(tracker.extractSiteName('m.youtube.com')).toBe('YouTube');
      expect(tracker.extractSiteName('open.spotify.com')).toBe('Spotify');
      expect(tracker.extractSiteName('www.netflix.com')).toBe('Netflix');
      expect(tracker.extractSiteName('netflix.com')).toBe('Netflix');
      expect(tracker.extractSiteName('www.reddit.com')).toBe('Reddit');
      expect(tracker.extractSiteName('reddit.com')).toBe('Reddit');
      expect(tracker.extractSiteName('twitter.com')).toBe('Twitter');
      expect(tracker.extractSiteName('x.com')).toBe('Twitter');
      expect(tracker.extractSiteName('www.instagram.com')).toBe('Instagram');
      expect(tracker.extractSiteName('instagram.com')).toBe('Instagram');
      expect(tracker.extractSiteName('www.twitch.tv')).toBe('Twitch');
      expect(tracker.extractSiteName('twitch.tv')).toBe('Twitch');
    });

    it('strips www. from unknown hostnames', () => {
      expect(tracker.extractSiteName('www.example.com')).toBe('example.com');
    });

    it('returns hostname as-is for unknown without www', () => {
      expect(tracker.extractSiteName('docs.google.com')).toBe('docs.google.com');
    });
  });

  describe('shouldSkipTab', () => {
    it('skips incognito tabs', () => {
      expect(tracker.shouldSkipTab({ incognito: true, url: 'https://example.com' })).toBe(true);
    });

    it('skips chrome:// URLs', () => {
      expect(tracker.shouldSkipTab({ incognito: false, url: 'chrome://settings' })).toBe(true);
    });

    it('skips chrome-extension:// URLs', () => {
      expect(tracker.shouldSkipTab({ incognito: false, url: 'chrome-extension://abc/popup.html' })).toBe(true);
    });

    it('skips about: URLs', () => {
      expect(tracker.shouldSkipTab({ incognito: false, url: 'about:blank' })).toBe(true);
    });

    it('does not skip normal URLs', () => {
      expect(tracker.shouldSkipTab({ incognito: false, url: 'https://example.com' })).toBe(false);
    });

    it('skips when tracking is disabled', () => {
      tracker.trackingEnabled = false;
      expect(tracker.shouldSkipTab({ incognito: false, url: 'https://example.com' })).toBe(true);
    });
  });

  describe('isYouTubeVideo', () => {
    it('detects youtube.com/watch URLs', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    });

    it('detects youtu.be short links', () => {
      expect(tracker.isYouTubeVideo('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('detects /shorts/ URLs', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/shorts/abc123')).toBe(true);
    });

    it('detects /live/ URLs', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/live/xyz789')).toBe(true);
    });

    it('rejects YouTube homepage', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/')).toBe(false);
    });

    it('rejects YouTube search', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/results?search_query=cats')).toBe(false);
    });

    it('rejects YouTube channel pages', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/@MrBeast')).toBe(false);
    });

    it('rejects non-YouTube URLs', () => {
      expect(tracker.isYouTubeVideo('https://www.google.com')).toBe(false);
    });

    it('rejects YouTube Music', () => {
      expect(tracker.isYouTubeVideo('https://music.youtube.com/watch?v=abc')).toBe(false);
    });
  });

  describe('getYouTubeVideoId', () => {
    it('extracts from standard watch URL', () => {
      expect(tracker.getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts from youtu.be', () => {
      expect(tracker.getYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts from /shorts/', () => {
      expect(tracker.getYouTubeVideoId('https://www.youtube.com/shorts/abc123')).toBe('abc123');
    });

    it('extracts from /live/', () => {
      expect(tracker.getYouTubeVideoId('https://www.youtube.com/live/xyz789')).toBe('xyz789');
    });

    it('ignores extra query params', () => {
      expect(tracker.getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe('dQw4w9WgXcQ');
    });
  });

  describe('handleTabChange', () => {
    it('broadcasts activity for normal tabs', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.reddit.com/r/programming',
        title: 'r/programming - Reddit',
      });

      // Wait for debounce
      vi.advanceTimersByTime(600);

      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          site: 'Reddit',
          title: 'r/programming - Reddit',
        })
      );
    });

    it('does not broadcast URL in activity payload', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.reddit.com/r/secrets',
        title: 'Secrets',
      });

      vi.advanceTimersByTime(600);

      const broadcastedPayload = mockBroadcast.mock.calls[0]?.[0];
      if (broadcastedPayload) {
        expect(broadcastedPayload.url).toBeUndefined();
      }
    });

    it('skips duplicate activity', () => {
      tracker.trackingEnabled = true;
      const tab = {
        incognito: false,
        url: 'https://www.reddit.com/r/programming',
        title: 'r/programming',
      };

      tracker.handleTabChange(tab);
      vi.advanceTimersByTime(600);
      mockBroadcast.mockClear();

      tracker.handleTabChange(tab);
      vi.advanceTimersByTime(600);

      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/tab-tracker.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement tab-tracker.js**

```js
// rhinosaurus-connect/background/tab-tracker.js
import { SITE_NAMES, IDLE_THRESHOLD_MS } from '../shared/constants.js';

export class TabTracker {
  constructor(broadcastFn) {
    this.broadcast = broadcastFn;
    this.trackingEnabled = true;
    this.lastActivity = null;
    this.lastActivityTimestamp = Date.now();
    this.wasOnYouTube = false;
    this.localActivity = null;
    this.debounceTimer = null;
    this.onYouTubeChange = null;
  }

  async init() {
    const stored = await chrome.storage.local.get(['tracking_enabled', 'wasOnYouTube']);
    this.trackingEnabled = stored.tracking_enabled !== false;
    this.wasOnYouTube = stored.wasOnYouTube || false;

    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        this.handleTabChange(tab);
      } catch {
        // Tab may have been closed
      }
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (tab.active && (changeInfo.url || changeInfo.title)) {
        this.handleTabChange(tab);
      }
    });

    chrome.alarms.create('idle-check', { periodInMinutes: 1 });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'idle-check') {
        this.checkIdle();
      }
    });
  }

  extractSiteName(hostname) {
    return SITE_NAMES[hostname] || hostname.replace('www.', '');
  }

  shouldSkipTab(tab) {
    if (!this.trackingEnabled) return true;
    if (tab.incognito) return true;
    if (!tab.url) return true;

    const url = tab.url;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
      return true;
    }

    return false;
  }

  isYouTubeVideo(url) {
    try {
      const parsed = new URL(url);
      const ytHosts = ['www.youtube.com', 'youtube.com', 'm.youtube.com'];

      if (!ytHosts.includes(parsed.hostname)) {
        if (parsed.hostname === 'youtu.be') return true;
        return false;
      }

      return (
        (parsed.pathname === '/watch' && parsed.searchParams.has('v')) ||
        parsed.pathname.startsWith('/shorts/') ||
        parsed.pathname.startsWith('/live/')
      );
    } catch {
      return false;
    }
  }

  getYouTubeVideoId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2];
      if (parsed.pathname.startsWith('/live/')) return parsed.pathname.split('/')[2];
      return parsed.searchParams.get('v');
    } catch {
      return null;
    }
  }

  handleTabChange(tab) {
    if (this.shouldSkipTab(tab)) return;

    let hostname;
    try {
      hostname = new URL(tab.url).hostname;
    } catch {
      return;
    }

    const siteName = this.extractSiteName(hostname);

    const activity = {
      site: siteName,
      title: tab.title || '',
      timestamp: Date.now(),
    };

    this.localActivity = { ...activity, url: tab.url };

    if (
      this.lastActivity &&
      this.lastActivity.site === activity.site &&
      this.lastActivity.title === activity.title
    ) {
      this.lastActivityTimestamp = Date.now();
      return;
    }

    this.lastActivity = activity;
    this.lastActivityTimestamp = Date.now();

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.broadcast(activity);
    }, 500);

    const isYT = this.isYouTubeVideo(tab.url);
    if (isYT && !this.wasOnYouTube) {
      this.wasOnYouTube = true;
      chrome.storage.local.set({ wasOnYouTube: true });
      if (this.onYouTubeChange) this.onYouTubeChange('entered', this.localActivity);
    } else if (!isYT && this.wasOnYouTube) {
      this.wasOnYouTube = false;
      chrome.storage.local.set({ wasOnYouTube: false });
      if (this.onYouTubeChange) this.onYouTubeChange('left', null);
    }
  }

  checkIdle() {
    if (Date.now() - this.lastActivityTimestamp > IDLE_THRESHOLD_MS) {
      this.broadcast({ site: null, title: null, idle: true, timestamp: Date.now() });
    }
  }

  setTrackingEnabled(enabled) {
    this.trackingEnabled = enabled;
    chrome.storage.local.set({ tracking_enabled: enabled });
    if (!enabled) {
      this.broadcast({ site: null, title: null, trackingPaused: true, timestamp: Date.now() });
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/tab-tracker.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/background/tab-tracker.js rhinosaurus-connect/tests/background/tab-tracker.test.js
git commit -m "feat: add tab tracker with site extraction, YouTube detection, and idle check"
```

---

### Task 2: TV display rendering

**Files:**
- Create: `rhinosaurus-connect/popup/room/tv-display.js`
- Test: `rhinosaurus-connect/tests/popup/room/tv-display.test.js`

- [ ] **Step 1: Write test for TV display states**

```js
// rhinosaurus-connect/tests/popup/room/tv-display.test.js
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
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
  };
}

describe('TVDisplay', () => {
  it('returns offline state when partner is offline', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: false });
    expect(tv.getDisplayState()).toBe('offline');
  });

  it('returns tracking_paused when partner has tracking off', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, trackingPaused: true });
    expect(tv.getDisplayState()).toBe('tracking_paused');
  });

  it('returns idle when partner is idle', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, idle: true });
    expect(tv.getDisplayState()).toBe('idle');
  });

  it('returns youtube when partner is on YouTube video', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, activity: { site: 'YouTube', title: 'Funny Cat Video' } });
    expect(tv.getDisplayState()).toBe('youtube');
  });

  it('returns browsing for normal activity', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, activity: { site: 'Reddit', title: 'r/programming' } });
    expect(tv.getDisplayState()).toBe('browsing');
  });

  it('returns watch_together when both watching same video', () => {
    const tv = new TVDisplay();
    tv.setWatchTogether(true);
    expect(tv.getDisplayState()).toBe('watch_together');
  });

  it('tracks last 5 activities', () => {
    const tv = new TVDisplay();
    for (let i = 0; i < 7; i++) {
      tv.addToHistory({ site: `Site ${i}`, title: `Page ${i}`, timestamp: Date.now() + i });
    }
    expect(tv.history).toHaveLength(5);
    expect(tv.history[0].site).toBe('Site 6');
  });

  it('draws on canvas context without error', () => {
    const tv = new TVDisplay();
    const ctx = createMockCtx();
    tv.setPartnerState({ isOnline: true, activity: { site: 'Reddit', title: 'r/programming' } });
    tv.draw(ctx, 240, 180, 48, 36);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/tv-display.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement tv-display.js**

```js
// rhinosaurus-connect/popup/room/tv-display.js
export class TVDisplay {
  constructor() {
    this.partnerState = { isOnline: false };
    this.watchTogether = false;
    this.history = [];
    this.scrollOffset = 0;
    this.staticFrame = 0;
    this.staticTimer = 0;
  }

  setPartnerState(state) {
    this.partnerState = state;
    if (state.activity && !state.idle && !state.trackingPaused) {
      this.addToHistory(state.activity);
    }
  }

  setWatchTogether(active) {
    this.watchTogether = active;
  }

  addToHistory(activity) {
    if (!activity.site) return;
    if (this.history.length > 0 && this.history[0].site === activity.site && this.history[0].title === activity.title) {
      return;
    }
    this.history.unshift({ ...activity, timestamp: activity.timestamp || Date.now() });
    if (this.history.length > 5) {
      this.history.length = 5;
    }
  }

  getDisplayState() {
    if (this.watchTogether) return 'watch_together';
    if (!this.partnerState.isOnline) return 'offline';
    if (this.partnerState.trackingPaused) return 'tracking_paused';
    if (this.partnerState.idle) return 'idle';
    if (this.partnerState.activity?.site === 'YouTube') return 'youtube';
    if (this.partnerState.activity) return 'browsing';
    return 'offline';
  }

  draw(ctx, x, y, width, height) {
    const state = this.getDisplayState();

    ctx.save();

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = '#4a4a6a';
    ctx.strokeRect(x, y, width, height);

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    switch (state) {
      case 'offline':
        this.drawOffline(ctx, centerX, centerY);
        break;
      case 'tracking_paused':
        this.drawTrackingPaused(ctx, centerX, centerY);
        break;
      case 'idle':
        this.drawIdle(ctx, x, y, width, height);
        break;
      case 'youtube':
        this.drawYouTube(ctx, x, y, width, height);
        break;
      case 'browsing':
        this.drawBrowsing(ctx, x, y, width, height);
        break;
      case 'watch_together':
        this.drawWatchTogether(ctx, centerX, centerY);
        break;
    }

    ctx.restore();
  }

  drawOffline(ctx, cx, cy) {
    ctx.fillStyle = '#333';
    ctx.font = '6px monospace';
    ctx.fillText('OFF', cx, cy);
  }

  drawTrackingPaused(ctx, cx, cy) {
    ctx.fillStyle = '#888';
    ctx.font = '5px monospace';
    ctx.fillText('Tracking', cx, cy - 4);
    ctx.fillText('paused', cx, cy + 4);
  }

  drawIdle(ctx, x, y, width, height) {
    this.staticTimer++;
    if (this.staticTimer % 10 === 0) {
      this.staticFrame = (this.staticFrame + 1) % 3;
    }
    const colors = ['#2a2a4a', '#3a3a5a', '#1a1a3a'];
    for (let py = 0; py < height; py += 2) {
      for (let px = 0; px < width; px += 2) {
        ctx.fillStyle = colors[Math.floor(Math.random() * 3)];
        ctx.fillRect(x + px, y + py, 2, 2);
      }
    }
  }

  drawYouTube(ctx, x, y, width, height) {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x + 2, y + 2, 10, 7);

    ctx.fillStyle = '#FFF';
    ctx.beginPath?.();
    ctx.fillRect(x + 5, y + 4, 4, 3);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = '5px monospace';
    ctx.textAlign = 'left';
    const title = this.partnerState.activity?.title || '';
    const truncated = title.length > 15 ? title.substring(0, 15) + '..' : title;
    ctx.fillText(truncated, x + 14, y + 8);

    ctx.fillStyle = '#4CAF50';
    ctx.font = '4px monospace';
    ctx.fillText('Join', x + width - 14, y + height - 4);
  }

  drawBrowsing(ctx, x, y, width, height) {
    const activity = this.partnerState.activity;
    if (!activity) return;

    ctx.fillStyle = '#88ccff';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(activity.site, x + width / 2, y + 10);

    ctx.fillStyle = '#aaa';
    ctx.font = '4px monospace';
    const title = activity.title || '';
    const truncated = title.length > 20 ? title.substring(0, 20) + '..' : title;
    ctx.fillText(truncated, x + width / 2, y + 20);
  }

  drawWatchTogether(ctx, cx, cy) {
    ctx.fillStyle = '#FFD700';
    ctx.font = '5px monospace';
    ctx.fillText('Watching', cx, cy - 4);
    ctx.fillText('Together!', cx, cy + 4);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/tv-display.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/tv-display.js rhinosaurus-connect/tests/popup/room/tv-display.test.js
git commit -m "feat: add TV display with browsing, YouTube, idle, and watch-together states"
```

---

### Task 3: Wire tab tracker into service worker

**Files:**
- Modify: `rhinosaurus-connect/background/service-worker.js`

- [ ] **Step 1: Import and initialize TabTracker in service worker**

Add the following to `rhinosaurus-connect/background/service-worker.js` after existing imports:

```js
import { TabTracker } from './tab-tracker.js';
import { REALTIME_EVENTS } from '../shared/constants.js';
import { getEventsChannelName } from '../shared/supabase-helpers.js';

let tabTracker = null;
let eventsChannel = null;

function initTabTracker() {
  tabTracker = new TabTracker((activity) => {
    if (eventsChannel) {
      eventsChannel.send({
        type: 'broadcast',
        event: REALTIME_EVENTS.ACTIVITY_UPDATE,
        payload: {
          user_id: currentSession?.user?.id,
          activity,
        },
      });
    }
  });

  tabTracker.onYouTubeChange = (action, localActivity) => {
    if (eventsChannel) {
      eventsChannel.send({
        type: 'broadcast',
        event: 'avatar_auto_move',
        payload: {
          user_id: currentSession?.user?.id,
          target: action === 'entered' ? 'tv' : 'previous',
        },
      });
    }
  };

  tabTracker.init();
}
```

- [ ] **Step 2: Initialize tracker after session restore**

In the `onStartup` listener, after `loadPairData()`, add:

```js
if (currentPair) {
  eventsChannel = supabase.channel(getEventsChannelName(currentPair.id));
  eventsChannel.subscribe();
  initTabTracker();
}
```

- [ ] **Step 3: Handle TRACKING_TOGGLED message to update tracker**

In the `handleMessage` switch, update the TRACKING_TOGGLED case:

```js
case 'TRACKING_TOGGLED': {
  if (tabTracker) {
    tabTracker.setTrackingEnabled(message.enabled);
  }
  if (currentSession) {
    await supabase
      .from('users')
      .update({ tracking_enabled: message.enabled })
      .eq('id', currentSession.user.id);
  }
  return { ok: true };
}
```

- [ ] **Step 4: Commit**

```bash
git add rhinosaurus-connect/background/service-worker.js
git commit -m "feat: wire tab tracker into service worker with Realtime broadcasting"
```

---

### Task 4: TV overlay (click interaction)

**Files:**
- Create: `rhinosaurus-connect/popup/room/tv-overlay.js`

- [ ] **Step 1: Create TV overlay for click interaction**

```js
// rhinosaurus-connect/popup/room/tv-overlay.js
export class TVOverlay {
  constructor(container, tvDisplay, onJoinWatch, onToggleTracking) {
    this.container = container;
    this.tvDisplay = tvDisplay;
    this.onJoinWatch = onJoinWatch;
    this.onToggleTracking = onToggleTracking;
    this.element = null;
  }

  show() {
    this.hide();

    this.element = document.createElement('div');
    this.element.className = 'tv-overlay';

    const header = document.createElement('div');
    header.className = 'tv-overlay-header';

    const backBtn = document.createElement('button');
    backBtn.className = 'tv-overlay-back';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.hide());

    const title = document.createElement('span');
    title.textContent = 'Activity';

    header.appendChild(backBtn);
    header.appendChild(title);
    this.element.appendChild(header);

    const state = this.tvDisplay.getDisplayState();
    const activity = this.tvDisplay.partnerState.activity;

    if (activity) {
      const activitySection = document.createElement('div');
      activitySection.className = 'tv-overlay-activity';

      const siteName = document.createElement('div');
      siteName.className = 'tv-overlay-site';
      siteName.textContent = activity.site || 'Unknown';

      const pageTitle = document.createElement('div');
      pageTitle.className = 'tv-overlay-title';
      pageTitle.textContent = activity.title || '';

      activitySection.appendChild(siteName);
      activitySection.appendChild(pageTitle);
      this.element.appendChild(activitySection);
    }

    if (state === 'youtube') {
      const joinBtn = document.createElement('button');
      joinBtn.className = 'tv-overlay-join';
      joinBtn.textContent = 'Join & Watch Together';
      joinBtn.addEventListener('click', () => {
        if (this.onJoinWatch) this.onJoinWatch();
        this.hide();
      });
      this.element.appendChild(joinBtn);
    }

    if (this.tvDisplay.history.length > 0) {
      const historySection = document.createElement('div');
      historySection.className = 'tv-overlay-history';

      const historyTitle = document.createElement('div');
      historyTitle.className = 'tv-overlay-history-title';
      historyTitle.textContent = 'Recent Activity';
      historySection.appendChild(historyTitle);

      for (const entry of this.tvDisplay.history) {
        const item = document.createElement('div');
        item.className = 'tv-overlay-history-item';

        const name = document.createElement('span');
        name.textContent = entry.site;

        const time = document.createElement('span');
        time.className = 'tv-overlay-time';
        const mins = Math.floor((Date.now() - entry.timestamp) / 60000);
        time.textContent = mins < 1 ? 'just now' : `${mins}m ago`;

        item.appendChild(name);
        item.appendChild(time);
        historySection.appendChild(item);
      }

      this.element.appendChild(historySection);
    }

    this.container.innerHTML = '';
    this.container.appendChild(this.element);
    this.container.classList.remove('hidden');
  }

  hide() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    this.container.classList.add('hidden');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/room/tv-overlay.js
git commit -m "feat: add TV overlay with activity details, history, and Join button"
```

---

### Task 5: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass including tab-tracker and tv-display.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 1D activity tracking complete"
```

---

## Summary

After Phase 1D, the following activity tracking exists:
- **TabTracker** monitors active tabs with 500ms debounce, skips incognito/chrome:// tabs
- **Privacy-safe broadcasting**: only site name + page title, never full URL
- **YouTube detection** for Watch Together (all URL formats: watch, shorts, live, youtu.be)
- **Idle detection** via chrome.alarms every 1 minute, 5-minute threshold
- **TV display** renders 6 states: offline, tracking paused, idle (static), browsing, YouTube, Watch Together
- **TV overlay** shows full activity details, recent history (last 5), and Join button for YouTube
- **wasOnYouTube** persisted in chrome.storage.local for service worker restart survival
- **Avatar auto-move** events broadcast when YouTube entered/left
