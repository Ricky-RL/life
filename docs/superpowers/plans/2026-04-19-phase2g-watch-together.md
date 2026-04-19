# Phase 2G: Watch Together Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Watch Together detection when both partners watch the same YouTube video, a Join flow to open a partner's video, avatar positioning at the TV, and a "Watching Together" badge with celebration effects.

**Architecture:** WatchTogetherManager in the service worker tracks both users' YouTube states and detects same-video matches. When matched (or joined), it broadcasts events via Realtime. The popup's TVDisplay (from Phase 1D) is extended with a "Watching Together" badge and Join button. Avatars auto-move to TV seats using AvatarController.

**Tech Stack:** chrome.tabs API, Supabase Realtime (broadcast), HTML5 Canvas

---

### Task 1: Watch Together manager (service worker)

**Files:**
- Create: `rhinosaurus-connect/background/watch-together.js`
- Test: `rhinosaurus-connect/tests/background/watch-together.test.js`

- [ ] **Step 1: Write test for watch together manager**

```js
// rhinosaurus-connect/tests/background/watch-together.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WatchTogetherManager } from '../../background/watch-together.js';

describe('WatchTogetherManager', () => {
  let manager;
  let mockChannel;

  beforeEach(() => {
    mockChannel = { send: vi.fn() };
    manager = new WatchTogetherManager('user-1', mockChannel);
  });

  it('starts inactive', () => {
    expect(manager.state.active).toBe(false);
    expect(manager.state.videoId).toBeNull();
  });

  it('detects same video match', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'Cool Vid' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'Cool Vid' });
    manager.check();
    expect(manager.state.active).toBe(true);
    expect(manager.state.videoId).toBe('abc123');
  });

  it('does not match different videos', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=xyz789', title: 'B' });
    manager.check();
    expect(manager.state.active).toBe(false);
  });

  it('does not match non-YouTube URLs', () => {
    manager.setMyActivity({ url: 'https://reddit.com', title: 'Reddit' });
    manager.setPartnerActivity({ url: 'https://reddit.com', title: 'Reddit' });
    manager.check();
    expect(manager.state.active).toBe(false);
  });

  it('handles youtu.be short links', () => {
    manager.setMyActivity({ url: 'https://youtu.be/abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    expect(manager.state.active).toBe(true);
  });

  it('ignores extra query params when comparing', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123&t=120', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    expect(manager.state.active).toBe(true);
  });

  it('deactivates when partner leaves video', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    expect(manager.state.active).toBe(true);

    manager.setPartnerActivity({ url: 'https://reddit.com', title: 'Reddit' });
    manager.check();
    expect(manager.state.active).toBe(false);
  });

  it('broadcasts watch_together_joined on activation', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'broadcast',
      event: 'watch_together_joined',
    }));
  });

  it('broadcasts watch_together_ended on deactivation', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    mockChannel.send.mockClear();

    manager.setPartnerActivity({ url: 'https://reddit.com', title: 'Reddit' });
    manager.check();
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'broadcast',
      event: 'watch_together_ended',
    }));
  });

  it('generates join URL from partner activity', () => {
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=xyz789', title: 'B' });
    expect(manager.getJoinUrl()).toBe('https://www.youtube.com/watch?v=xyz789');
  });

  it('returns null join URL when partner is not on YouTube', () => {
    manager.setPartnerActivity({ url: 'https://reddit.com', title: 'Reddit' });
    expect(manager.getJoinUrl()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/watch-together.test.js`
Expected: FAIL

- [ ] **Step 3: Implement watch-together.js**

```js
// rhinosaurus-connect/background/watch-together.js
function isYouTubeVideo(url) {
  try {
    const parsed = new URL(url);
    const ytHosts = ['www.youtube.com', 'youtube.com', 'm.youtube.com'];
    if (parsed.hostname === 'youtu.be') return true;
    if (!ytHosts.includes(parsed.hostname)) return false;
    return (parsed.pathname === '/watch' && parsed.searchParams.has('v'))
      || parsed.pathname.startsWith('/shorts/')
      || parsed.pathname.startsWith('/live/');
  } catch {
    return false;
  }
}

function getVideoId(url) {
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

export class WatchTogetherManager {
  constructor(userId, channel) {
    this.userId = userId;
    this.channel = channel;
    this.myActivity = null;
    this.partnerActivity = null;
    this.state = {
      active: false,
      videoId: null,
      videoTitle: null,
      videoUrl: null,
      participants: [],
    };
  }

  setMyActivity(activity) {
    this.myActivity = activity;
  }

  setPartnerActivity(activity) {
    this.partnerActivity = activity;
  }

  check() {
    const myVideoId = this.myActivity && isYouTubeVideo(this.myActivity.url)
      ? getVideoId(this.myActivity.url)
      : null;
    const partnerVideoId = this.partnerActivity && isYouTubeVideo(this.partnerActivity.url)
      ? getVideoId(this.partnerActivity.url)
      : null;

    const wasActive = this.state.active;

    if (myVideoId && partnerVideoId && myVideoId === partnerVideoId) {
      if (!this.state.active) {
        this.state = {
          active: true,
          videoId: myVideoId,
          videoTitle: this.myActivity.title,
          videoUrl: this.myActivity.url,
          participants: [this.userId],
        };
        this.channel.send({
          type: 'broadcast',
          event: 'watch_together_joined',
          payload: {
            user_id: this.userId,
            video_id: myVideoId,
            video_url: this.myActivity.url,
          },
        });
      }
    } else {
      if (wasActive) {
        this.channel.send({
          type: 'broadcast',
          event: 'watch_together_ended',
          payload: { user_id: this.userId },
        });
        this.state = {
          active: false,
          videoId: null,
          videoTitle: null,
          videoUrl: null,
          participants: [],
        };
      }
    }
  }

  getJoinUrl() {
    if (!this.partnerActivity || !isYouTubeVideo(this.partnerActivity.url)) {
      return null;
    }
    return this.partnerActivity.url;
  }

  getState() {
    return { ...this.state };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/watch-together.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/background/watch-together.js rhinosaurus-connect/tests/background/watch-together.test.js
git commit -m "feat: add watch together manager with same-video detection and join URL"
```

---

### Task 2: TV display Watch Together mode

**Files:**
- Modify: `rhinosaurus-connect/popup/room/tv-display.js`
- Test: `rhinosaurus-connect/tests/popup/room/tv-display-wt.test.js`

- [ ] **Step 1: Write test for Watch Together TV display**

```js
// rhinosaurus-connect/tests/popup/room/tv-display-wt.test.js
import { describe, it, expect, vi } from 'vitest';
import { TVDisplay } from '../../../popup/room/tv-display.js';

describe('TVDisplay - Watch Together', () => {
  it('shows watching together state', () => {
    const tv = new TVDisplay();
    tv.setWatchTogether(true, 'Cool Video', 'abc123');
    expect(tv.getDisplayState()).toBe('watch_together');
  });

  it('returns to partner youtube state when watch together ends', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ site: 'YouTube', title: 'Cool Video', url: 'https://youtube.com/watch?v=abc', isYouTube: true });
    tv.setWatchTogether(true, 'Cool Video', 'abc123');
    expect(tv.getDisplayState()).toBe('watch_together');
    tv.setWatchTogether(false);
    expect(tv.getDisplayState()).toBe('youtube');
  });

  it('provides seat positions for avatars', () => {
    const tv = new TVDisplay();
    const seats = tv.getWatchTogetherSeats(240, 180);
    expect(seats.left).toEqual({ x: 220, y: 240 });
    expect(seats.right).toEqual({ x: 260, y: 240 });
    expect(seats.solo).toEqual({ x: 240, y: 240 });
  });

  it('draws watch together badge', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1,
    };
    const tv = new TVDisplay();
    tv.setWatchTogether(true, 'Cool Video', 'abc123');
    tv.draw(ctx, 240, 180);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/tv-display-wt.test.js`
Expected: FAIL

- [ ] **Step 3: Add Watch Together support to tv-display.js**

Add to TVDisplay class:

```js
// Add to constructor:
this.watchTogether = false;
this.watchTogetherTitle = null;
this.watchTogetherVideoId = null;

// Add method:
setWatchTogether(active, title = null, videoId = null) {
  this.watchTogether = active;
  this.watchTogetherTitle = title;
  this.watchTogetherVideoId = videoId;
}

// Modify getDisplayState to check watch_together first:
getDisplayState() {
  if (this.watchTogether) return 'watch_together';
  // ... existing logic
}

// Add method:
getWatchTogetherSeats(tvX, tvY) {
  return {
    left: { x: tvX - 20, y: tvY + 60 },
    right: { x: tvX + 20, y: tvY + 60 },
    solo: { x: tvX, y: tvY + 60 },
  };
}

// Add to draw method, handle 'watch_together' state:
drawWatchTogether(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#2a1a3e';
  ctx.fillRect(x, y, 48, 36);
  ctx.fillStyle = '#FFD700';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Watching', x + 24, y + 12);
  ctx.fillText('Together!', x + 24, y + 22);
  ctx.fillStyle = '#ff6b9d';
  ctx.fillText('🎬', x + 24, y + 32);
  ctx.restore();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/tv-display-wt.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/tv-display.js rhinosaurus-connect/tests/popup/room/tv-display-wt.test.js
git commit -m "feat: add Watch Together mode to TV display with seats and badge"
```

---

### Task 3: TV overlay with Join button

**Files:**
- Modify: `rhinosaurus-connect/popup/room/tv-overlay.js`

- [ ] **Step 1: Add Join button to TV overlay**

Extend TVOverlay to show a "Join & Watch Together" button when partner is on YouTube:

```js
// Add to tv-overlay.js render method:

renderJoinButton(partnerActivity) {
  if (!partnerActivity || !partnerActivity.isYouTube) return;

  const joinBtn = document.createElement('button');
  joinBtn.className = 'tv-overlay-join-btn';
  joinBtn.textContent = 'Join & Watch Together';
  joinBtn.addEventListener('click', () => {
    if (this.onJoin) {
      this.onJoin(partnerActivity.url);
    }
  });
  this.container.appendChild(joinBtn);
}

// Add callback:
this.onJoin = null;

// Set from popup.js:
// tvOverlay.onJoin = async (url) => {
//   chrome.runtime.sendMessage({ type: 'JOIN_WATCH_TOGETHER', url });
// };
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/room/tv-overlay.js
git commit -m "feat: add Join & Watch Together button to TV overlay"
```

---

### Task 4: Service worker integration

**Files:**
- Modify: `rhinosaurus-connect/background/service-worker.js`

- [ ] **Step 1: Add Watch Together handling to service worker**

```js
// Add import:
import { WatchTogetherManager } from './watch-together.js';

// In service worker setup (after channel is created):
let watchTogetherManager = null;

function initWatchTogether(userId, channel) {
  watchTogetherManager = new WatchTogetherManager(userId, channel);
}

// Add message handler:
// case 'JOIN_WATCH_TOGETHER':
//   chrome.tabs.create({ url: message.url });
//   break;

// In tab tracker's onActivityChange callback:
// if (watchTogetherManager) {
//   watchTogetherManager.setMyActivity(activity);
//   watchTogetherManager.check();
// }

// In Realtime partner activity handler:
// if (watchTogetherManager) {
//   watchTogetherManager.setPartnerActivity(partnerActivity);
//   watchTogetherManager.check();
// }
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/background/service-worker.js
git commit -m "feat: integrate watch together manager into service worker"
```

---

### Task 5: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 2G watch together complete"
```

---

## Summary

After Phase 2G:
- **WatchTogetherManager**: detects same-video by comparing YouTube video IDs (handles youtu.be, /shorts/, /live/, extra query params), broadcasts join/end events
- **TVDisplay**: "Watching Together!" badge, seat positions for avatar auto-move (left/right/solo)
- **TVOverlay**: "Join & Watch Together" button opens partner's video in new tab
- **Service worker**: routes JOIN_WATCH_TOGETHER to chrome.tabs.create, updates manager on activity changes
