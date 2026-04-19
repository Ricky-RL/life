# Phase 0: Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Chrome extension skeleton, Supabase backend (tables, RLS, storage, realtime), shared utilities, and a basic canvas rendering loop in the popup — the foundation all feature worktrees build on.

**Architecture:** Manifest V3 Chrome extension with a service worker (background), popup (HTML5 Canvas room), content script (notifications), and options page. Supabase provides auth (Google OAuth), Postgres database with RLS, Realtime (presence + broadcast), and Storage. The popup renders a Stardew Valley-style pixel art bedroom on canvas with a dirty-flag optimization pattern. All shared code lives in `shared/`.

**Tech Stack:** Chrome Extension Manifest V3, Supabase JS client v2, HTML5 Canvas, vanilla JS (ES modules)

---

## File Structure

```
rhinosaurus-connect/
├── manifest.json                    # MV3 manifest with permissions
├── background/
│   ├── service-worker.js            # Main service worker entry, imports modules
│   └── supabase-client.js           # Supabase client init + session management
├── popup/
│   ├── popup.html                   # Popup shell with canvas + toolbar container
│   ├── popup.css                    # Popup styles (sizing, toolbar, overlays)
│   ├── popup.js                     # Entry point: auth check, canvas mount, realtime setup
│   └── room/
│       ├── room-renderer.js         # Canvas render loop with dirty-flag pattern
│       └── room-state.js            # Local room state management
├── content/
│   ├── content.js                   # Content script shell (message listener)
│   └── corner-popup.css             # Corner popup notification styles
├── shared/
│   ├── constants.js                 # Shared constants (mood options, animation states, etc.)
│   └── supabase-helpers.js          # Supabase URL/key, channel name helpers
├── assets/
│   ├── icons/
│   │   ├── icon-16.png              # Extension icon 16x16
│   │   ├── icon-48.png              # Extension icon 48x48
│   │   └── icon-128.png             # Extension icon 128x128
│   └── sprites/                     # Empty dir, populated by art tasks later
├── options/
│   ├── options.html                 # Options page shell
│   └── options.js                   # Options page entry
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # All tables, RLS, functions
└── tests/
    ├── shared/
    │   └── constants.test.js
    ├── background/
    │   └── supabase-client.test.js
    └── popup/
        └── room/
            ├── room-renderer.test.js
            └── room-state.test.js
```

---

### Task 1: Initialize project and manifest

**Files:**
- Create: `rhinosaurus-connect/manifest.json`
- Create: `rhinosaurus-connect/package.json`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p rhinosaurus-connect
```

```json
// rhinosaurus-connect/package.json
{
  "name": "rhinosaurus-connect",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.1.0",
    "jsdom": "^26.0.0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0"
  }
}
```

- [ ] **Step 2: Create manifest.json**

```json
// rhinosaurus-connect/manifest.json
{
  "manifest_version": 3,
  "name": "Rhinosaurus Connect",
  "version": "0.1.0",
  "description": "A shared pixel art bedroom for long-distance couples",
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "notifications",
    "identity",
    "alarms"
  ],
  "host_permissions": [
    "https://*.youtube.com/*",
    "https://*.supabase.co/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon-16.png",
      "48": "assets/icons/icon-48.png",
      "128": "assets/icons/icon-128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/corner-popup.css"]
    }
  ],
  "options_page": "options/options.html",
  "icons": {
    "16": "assets/icons/icon-16.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd rhinosaurus-connect && npm install`
Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 4: Create vitest config**

```js
// rhinosaurus-connect/vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/manifest.json rhinosaurus-connect/package.json rhinosaurus-connect/package-lock.json rhinosaurus-connect/vitest.config.js
git commit -m "feat: initialize Chrome extension project with MV3 manifest"
```

---

### Task 2: Shared constants and helpers

**Files:**
- Create: `rhinosaurus-connect/shared/constants.js`
- Create: `rhinosaurus-connect/shared/supabase-helpers.js`
- Test: `rhinosaurus-connect/tests/shared/constants.test.js`

- [ ] **Step 1: Write test for constants**

```js
// rhinosaurus-connect/tests/shared/constants.test.js
import { describe, it, expect } from 'vitest';
import {
  MOOD_OPTIONS,
  ANIMATION_STATES,
  MESSAGE_TYPES,
  ROOM_DIMENSIONS,
  REALTIME_EVENTS,
} from '../../shared/constants.js';

describe('constants', () => {
  it('defines all 7 mood options', () => {
    expect(MOOD_OPTIONS).toHaveLength(7);
    expect(MOOD_OPTIONS.map(m => m.key)).toEqual([
      'happy', 'sad', 'missing_you', 'stressed', 'sleepy', 'excited', 'cozy',
    ]);
  });

  it('defines all 8 animation states', () => {
    expect(Object.keys(ANIMATION_STATES)).toEqual([
      'idle', 'speaking', 'heart_eyes', 'kiss_face', 'sleeping', 'waving', 'walking', 'sitting',
    ]);
    expect(ANIMATION_STATES.idle).toEqual({ frames: 4, looping: true });
    expect(ANIMATION_STATES.heart_eyes).toEqual({ frames: 6, looping: false });
  });

  it('defines message types', () => {
    expect(MESSAGE_TYPES).toEqual(['text', 'image', 'heart', 'kiss']);
  });

  it('defines room dimensions', () => {
    expect(ROOM_DIMENSIONS.width).toBe(320);
    expect(ROOM_DIMENSIONS.height).toBe(400);
  });

  it('defines realtime event names', () => {
    expect(REALTIME_EVENTS.ACTIVITY_UPDATE).toBe('activity_update');
    expect(REALTIME_EVENTS.REACTION).toBe('reaction');
    expect(REALTIME_EVENTS.ROOM_UPDATE).toBe('room_update');
    expect(REALTIME_EVENTS.AVATAR_MOVE).toBe('avatar_move');
    expect(REALTIME_EVENTS.WATCH_TOGETHER_INVITE).toBe('watch_together_invite');
    expect(REALTIME_EVENTS.WATCH_TOGETHER_JOINED).toBe('watch_together_joined');
    expect(REALTIME_EVENTS.WATCH_TOGETHER_ENDED).toBe('watch_together_ended');
    expect(REALTIME_EVENTS.MOOD_UPDATE).toBe('mood_update');
    expect(REALTIME_EVENTS.TYPING).toBe('typing');
    expect(REALTIME_EVENTS.AVATAR_CONFIG_UPDATE).toBe('avatar_config_update');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/constants.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement constants**

```js
// rhinosaurus-connect/shared/constants.js
export const MOOD_OPTIONS = [
  { key: 'happy', emoji: '😊', label: 'happy' },
  { key: 'sad', emoji: '😢', label: 'sad' },
  { key: 'missing_you', emoji: '🥺', label: 'missing you' },
  { key: 'stressed', emoji: '😩', label: 'stressed' },
  { key: 'sleepy', emoji: '😴', label: 'sleepy' },
  { key: 'excited', emoji: '🤩', label: 'excited' },
  { key: 'cozy', emoji: '🥰', label: 'cozy' },
];

export const ANIMATION_STATES = {
  idle: { frames: 4, looping: true },
  speaking: { frames: 4, looping: true },
  heart_eyes: { frames: 6, looping: false },
  kiss_face: { frames: 6, looping: false },
  sleeping: { frames: 4, looping: true },
  waving: { frames: 6, looping: false },
  walking: { frames: 8, looping: true },
  sitting: { frames: 2, looping: true },
};

export const MESSAGE_TYPES = ['text', 'image', 'heart', 'kiss'];

export const ROOM_DIMENSIONS = {
  width: 320,
  height: 400,
};

export const POPUP_DIMENSIONS = {
  width: 400,
  height: 500,
};

export const REALTIME_EVENTS = {
  ACTIVITY_UPDATE: 'activity_update',
  REACTION: 'reaction',
  ROOM_UPDATE: 'room_update',
  AVATAR_MOVE: 'avatar_move',
  WATCH_TOGETHER_INVITE: 'watch_together_invite',
  WATCH_TOGETHER_JOINED: 'watch_together_joined',
  WATCH_TOGETHER_ENDED: 'watch_together_ended',
  MOOD_UPDATE: 'mood_update',
  TYPING: 'typing',
  AVATAR_CONFIG_UPDATE: 'avatar_config_update',
};

export const PAIR_CODE_LENGTH = 6;
export const PAIR_CODE_EXPIRY_MINUTES = 10;

export const AVATAR_SIZE = { width: 32, height: 48 };
export const AVATAR_RENDER_SCALE = 3;

export const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

export const SITE_NAMES = {
  'youtube.com': 'YouTube',
  'www.youtube.com': 'YouTube',
  'm.youtube.com': 'YouTube',
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
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/constants.test.js`
Expected: PASS

- [ ] **Step 5: Create supabase-helpers.js**

```js
// rhinosaurus-connect/shared/supabase-helpers.js
export const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export function getPresenceChannelName(pairId) {
  return `pair:${pairId}`;
}

export function getEventsChannelName(pairId) {
  return `pair:${pairId}:events`;
}
```

- [ ] **Step 6: Commit**

```bash
git add rhinosaurus-connect/shared/ rhinosaurus-connect/tests/shared/
git commit -m "feat: add shared constants and supabase helpers"
```

---

### Task 3: Supabase client in service worker

**Files:**
- Create: `rhinosaurus-connect/background/supabase-client.js`
- Create: `rhinosaurus-connect/background/service-worker.js`
- Test: `rhinosaurus-connect/tests/background/supabase-client.test.js`

- [ ] **Step 1: Write test for supabase client session management**

```js
// rhinosaurus-connect/tests/background/supabase-client.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage = {};
const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys) => Promise.resolve(
        keys.reduce((acc, k) => ({ ...acc, [k]: mockStorage[k] }), {})
      )),
      set: vi.fn((items) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
    },
    session: {
      get: vi.fn((keys) => Promise.resolve(
        keys.reduce((acc, k) => ({ ...acc, [k]: mockStorage[`session_${k}`] }), {})
      )),
      set: vi.fn((items) => {
        for (const [k, v] of Object.entries(items)) {
          mockStorage[`session_${k}`] = v;
        }
        return Promise.resolve();
      }),
    },
  },
};

vi.stubGlobal('chrome', mockChrome);

const { storeTokens, getStoredTokens, clearTokens } = await import(
  '../../background/supabase-client.js'
);

describe('supabase-client token storage', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
    vi.clearAllMocks();
  });

  it('stores access token in session and refresh token in local', async () => {
    await storeTokens('access_123', 'refresh_456');

    expect(mockChrome.storage.session.set).toHaveBeenCalledWith({
      access_token: 'access_123',
    });
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
      refresh_token: 'refresh_456',
    });
  });

  it('retrieves stored tokens', async () => {
    mockStorage['session_access_token'] = 'access_123';
    mockStorage['refresh_token'] = 'refresh_456';

    const tokens = await getStoredTokens();
    expect(tokens.accessToken).toBe('access_123');
    expect(tokens.refreshToken).toBe('refresh_456');
  });

  it('clears all tokens', async () => {
    await clearTokens();
    expect(mockChrome.storage.session.set).toHaveBeenCalledWith({
      access_token: null,
    });
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
      refresh_token: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/supabase-client.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement supabase-client.js**

```js
// rhinosaurus-connect/background/supabase-client.js
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/supabase-helpers.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
  },
});

export async function storeTokens(accessToken, refreshToken) {
  await chrome.storage.session.set({ access_token: accessToken });
  await chrome.storage.local.set({ refresh_token: refreshToken });
}

export async function getStoredTokens() {
  const sessionData = await chrome.storage.session.get(['access_token']);
  const localData = await chrome.storage.local.get(['refresh_token']);
  return {
    accessToken: sessionData.access_token || null,
    refreshToken: localData.refresh_token || null,
  };
}

export async function clearTokens() {
  await chrome.storage.session.set({ access_token: null });
  await chrome.storage.local.set({ refresh_token: null });
}

export async function restoreSession() {
  const { accessToken, refreshToken } = await getStoredTokens();
  if (!accessToken && !refreshToken) return null;

  if (refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken || '',
      refresh_token: refreshToken,
    });
    if (error) {
      await clearTokens();
      return null;
    }
    if (data.session) {
      await storeTokens(data.session.access_token, data.session.refresh_token);
    }
    return data.session;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/supabase-client.test.js`
Expected: PASS

- [ ] **Step 5: Create service-worker.js entry point**

```js
// rhinosaurus-connect/background/service-worker.js
import { restoreSession } from './supabase-client.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Rhinosaurus Connect installed');
});

chrome.runtime.onStartup.addListener(async () => {
  await restoreSession();
});
```

- [ ] **Step 6: Commit**

```bash
git add rhinosaurus-connect/background/
git commit -m "feat: add supabase client with token storage for service worker"
```

---

### Task 4: Room state management

**Files:**
- Create: `rhinosaurus-connect/popup/room/room-state.js`
- Test: `rhinosaurus-connect/tests/popup/room/room-state.test.js`

- [ ] **Step 1: Write test for room state**

```js
// rhinosaurus-connect/tests/popup/room/room-state.test.js
import { describe, it, expect, vi } from 'vitest';
import { RoomState } from '../../../popup/room/room-state.js';

describe('RoomState', () => {
  it('initializes with default furniture', () => {
    const state = new RoomState();
    expect(state.furniture).toBeInstanceOf(Array);
    expect(state.furniture.length).toBeGreaterThan(0);
    expect(state.furniture.find(f => f.type === 'bed')).toBeDefined();
    expect(state.furniture.find(f => f.type === 'tv')).toBeDefined();
    expect(state.furniture.find(f => f.type === 'desk')).toBeDefined();
    expect(state.furniture.find(f => f.type === 'calendar')).toBeDefined();
    expect(state.furniture.find(f => f.type === 'makeup_stand')).toBeDefined();
  });

  it('initializes with empty avatar positions', () => {
    const state = new RoomState();
    expect(state.avatarPositions).toEqual({});
  });

  it('loads state from database record', () => {
    const state = new RoomState();
    const dbRecord = {
      furniture: [
        { id: 'bed-1', type: 'bed', variant: 'double-wood', color: '#FF6B9D', x: 40, y: 80 },
      ],
      avatar_positions: { 'user-1': { x: 100, y: 260 } },
      theme: 'cozy',
      version: 5,
    };
    state.loadFromDb(dbRecord);
    expect(state.furniture).toEqual(dbRecord.furniture);
    expect(state.avatarPositions).toEqual(dbRecord.avatar_positions);
    expect(state.theme).toBe('cozy');
    expect(state.version).toBe(5);
  });

  it('updates a furniture item position', () => {
    const state = new RoomState();
    state.loadFromDb({
      furniture: [
        { id: 'bed-1', type: 'bed', x: 40, y: 80 },
        { id: 'tv-1', type: 'tv', x: 240, y: 180 },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });

    const changed = state.updateFurniture('bed-1', { x: 60, y: 100 });
    expect(changed).toBe(true);
    expect(state.furniture[0].x).toBe(60);
    expect(state.furniture[0].y).toBe(100);
  });

  it('returns false when updating nonexistent furniture', () => {
    const state = new RoomState();
    const changed = state.updateFurniture('nonexistent', { x: 0 });
    expect(changed).toBe(false);
  });

  it('updates avatar position', () => {
    const state = new RoomState();
    state.setAvatarPosition('user-1', 150, 200);
    expect(state.avatarPositions['user-1']).toEqual({ x: 150, y: 200 });
  });

  it('serializes to database format', () => {
    const state = new RoomState();
    state.loadFromDb({
      furniture: [{ id: 'bed-1', type: 'bed', x: 40, y: 80 }],
      avatar_positions: { 'user-1': { x: 100, y: 260 } },
      theme: 'default',
      version: 3,
    });

    const dbFormat = state.toDbRecord();
    expect(dbFormat.furniture).toEqual(state.furniture);
    expect(dbFormat.avatar_positions).toEqual(state.avatarPositions);
    expect(dbFormat.theme).toBe('default');
    expect(dbFormat.version).toBe(4);
  });

  it('tracks dirty state', () => {
    const state = new RoomState();
    expect(state.isDirty).toBe(false);
    state.setAvatarPosition('user-1', 100, 200);
    expect(state.isDirty).toBe(true);
    state.markClean();
    expect(state.isDirty).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/room-state.test.js`
Expected: FAIL

- [ ] **Step 3: Implement room-state.js**

```js
// rhinosaurus-connect/popup/room/room-state.js
const DEFAULT_FURNITURE = [
  { id: 'bed-1', type: 'bed', variant: 'double-wood', color: '#FF6B9D', x: 40, y: 80, interactive: false },
  { id: 'tv-1', type: 'tv', variant: 'crt', color: null, x: 240, y: 180, interactive: true, interaction: 'activity' },
  { id: 'desk-1', type: 'desk', variant: 'wooden', color: null, x: 40, y: 220, interactive: true, interaction: 'chat' },
  { id: 'calendar-1', type: 'calendar', variant: 'default', color: null, x: 270, y: 30, interactive: true, interaction: 'dates' },
  { id: 'makeup-1', type: 'makeup_stand', variant: 'default', color: null, x: 240, y: 80, interactive: true, interaction: 'makeup' },
  { id: 'window-1', type: 'window', variant: 'default', color: '#E8D5E0', x: 80, y: 20, interactive: false },
  { id: 'rug-1', type: 'rug', variant: 'round', color: '#D4A5C9', x: 130, y: 160, interactive: false },
  { id: 'nightstand-1', type: 'nightstand', variant: 'wooden', color: null, x: 10, y: 130, interactive: false },
  { id: 'nightstand-2', type: 'nightstand', variant: 'wooden', color: null, x: 180, y: 130, interactive: false },
];

export class RoomState {
  constructor() {
    this.furniture = DEFAULT_FURNITURE.map(f => ({ ...f }));
    this.avatarPositions = {};
    this.theme = 'default';
    this.version = 0;
    this.isDirty = false;
  }

  loadFromDb(record) {
    this.furniture = record.furniture || [];
    this.avatarPositions = record.avatar_positions || {};
    this.theme = record.theme || 'default';
    this.version = record.version || 0;
    this.isDirty = false;
  }

  updateFurniture(furnitureId, changes) {
    const item = this.furniture.find(f => f.id === furnitureId);
    if (!item) return false;
    Object.assign(item, changes);
    this.isDirty = true;
    return true;
  }

  setAvatarPosition(userId, x, y) {
    this.avatarPositions[userId] = { x, y };
    this.isDirty = true;
  }

  toDbRecord() {
    return {
      furniture: this.furniture,
      avatar_positions: this.avatarPositions,
      theme: this.theme,
      version: this.version + 1,
    };
  }

  markClean() {
    this.isDirty = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/room-state.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/room-state.js rhinosaurus-connect/tests/popup/room/room-state.test.js
git commit -m "feat: add room state management with default furniture"
```

---

### Task 5: Room renderer (canvas rendering loop)

**Files:**
- Create: `rhinosaurus-connect/popup/room/room-renderer.js`
- Test: `rhinosaurus-connect/tests/popup/room/room-renderer.test.js`

- [ ] **Step 1: Write test for room renderer**

```js
// rhinosaurus-connect/tests/popup/room/room-renderer.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomRenderer } from '../../../popup/room/room-renderer.js';
import { RoomState } from '../../../popup/room/room-state.js';

function createMockCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    font: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
  };
  const canvas = {
    width: 320,
    height: 400,
    getContext: vi.fn(() => ctx),
    style: {},
  };
  return { canvas, ctx };
}

describe('RoomRenderer', () => {
  let renderer;
  let mockCanvas;
  let mockCtx;
  let roomState;

  beforeEach(() => {
    const mock = createMockCanvas();
    mockCanvas = mock.canvas;
    mockCtx = mock.ctx;
    roomState = new RoomState();
    renderer = new RoomRenderer(mockCanvas, roomState);
  });

  it('initializes with dirty flag set to true', () => {
    expect(renderer.dirty).toBe(true);
  });

  it('gets 2d context with imageSmoothingEnabled false', () => {
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    expect(mockCtx.imageSmoothingEnabled).toBe(false);
  });

  it('renders when dirty and clears the flag', () => {
    renderer.renderFrame();
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 320, 400);
    expect(renderer.dirty).toBe(false);
  });

  it('skips rendering when not dirty', () => {
    renderer.dirty = false;
    renderer.renderFrame();
    expect(mockCtx.clearRect).not.toHaveBeenCalled();
  });

  it('markDirty sets dirty flag', () => {
    renderer.dirty = false;
    renderer.markDirty();
    expect(renderer.dirty).toBe(true);
  });

  it('sorts furniture by y-position for depth', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'a', type: 'rug', x: 0, y: 200 },
        { id: 'b', type: 'bed', x: 0, y: 50 },
        { id: 'c', type: 'tv', x: 0, y: 150 },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    const sorted = renderer.getSortedFurniture();
    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('c');
    expect(sorted[2].id).toBe('a');
  });

  it('detects hit on interactive furniture', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'tv-1', type: 'tv', x: 100, y: 100, interactive: true, interaction: 'activity' },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    const hit = renderer.hitTest(110, 110);
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('tv-1');
  });

  it('returns null for hit on empty area', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'tv-1', type: 'tv', x: 100, y: 100, interactive: true, interaction: 'activity' },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    const hit = renderer.hitTest(5, 5);
    expect(hit).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/room-renderer.test.js`
Expected: FAIL

- [ ] **Step 3: Implement room-renderer.js**

```js
// rhinosaurus-connect/popup/room/room-renderer.js
import { ROOM_DIMENSIONS } from '../../shared/constants.js';

const DEFAULT_HITBOX_SIZE = { width: 48, height: 48 };

export class RoomRenderer {
  constructor(canvas, roomState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.roomState = roomState;
    this.dirty = true;
    this.spriteCache = {};
    this.effectLayers = [];
  }

  markDirty() {
    this.dirty = true;
  }

  getSortedFurniture() {
    return [...this.roomState.furniture].sort((a, b) => a.y - b.y);
  }

  hitTest(clickX, clickY) {
    const interactives = this.roomState.furniture
      .filter(f => f.interactive)
      .sort((a, b) => b.y - a.y);

    for (const item of interactives) {
      const hitbox = {
        x: item.x,
        y: item.y,
        width: DEFAULT_HITBOX_SIZE.width,
        height: DEFAULT_HITBOX_SIZE.height,
      };
      if (
        clickX >= hitbox.x &&
        clickX <= hitbox.x + hitbox.width &&
        clickY >= hitbox.y &&
        clickY <= hitbox.y + hitbox.height
      ) {
        return item;
      }
    }
    return null;
  }

  renderFrame() {
    if (!this.dirty) return;
    this.dirty = false;

    const { width, height } = ROOM_DIMENSIONS;
    this.ctx.clearRect(0, 0, width, height);

    this.drawFloor();
    this.drawWalls();

    const sorted = this.getSortedFurniture();
    for (const item of sorted) {
      this.drawFurnitureItem(item);
    }

    for (const effect of this.effectLayers) {
      effect.draw(this.ctx);
    }
  }

  drawFloor() {
    this.ctx.fillStyle = '#8B7355';
    this.ctx.fillRect(0, ROOM_DIMENSIONS.height * 0.15, ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height * 0.85);
  }

  drawWalls() {
    this.ctx.fillStyle = '#D4C5A9';
    this.ctx.fillRect(0, 0, ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height * 0.15);
  }

  drawFurnitureItem(item) {
    this.ctx.fillStyle = item.color || '#A0522D';
    this.ctx.fillRect(item.x, item.y, DEFAULT_HITBOX_SIZE.width, DEFAULT_HITBOX_SIZE.height);
  }

  addEffect(effect) {
    this.effectLayers.push(effect);
    this.markDirty();
  }

  removeEffect(effect) {
    this.effectLayers = this.effectLayers.filter(e => e !== effect);
    this.markDirty();
  }

  startRenderLoop() {
    const loop = () => {
      this.renderFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/room-renderer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/room-renderer.js rhinosaurus-connect/tests/popup/room/room-renderer.test.js
git commit -m "feat: add room renderer with dirty-flag canvas loop and hit testing"
```

---

### Task 6: Popup HTML, CSS, and entry point

**Files:**
- Create: `rhinosaurus-connect/popup/popup.html`
- Create: `rhinosaurus-connect/popup/popup.css`
- Create: `rhinosaurus-connect/popup/popup.js`

- [ ] **Step 1: Create popup.html**

```html
<!-- rhinosaurus-connect/popup/popup.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rhinosaurus Connect</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <!-- Login screen -->
    <div id="login-screen" class="screen hidden">
      <div class="logo-container">
        <h1>Rhinosaurus Connect</h1>
      </div>
      <button id="login-btn" class="btn-primary">Sign in with Google</button>
    </div>

    <!-- Pairing screen -->
    <div id="pairing-screen" class="screen hidden">
      <h2>Connect with your partner</h2>
      <button id="generate-code-btn" class="btn-primary">Generate Code</button>
      <div id="code-display" class="hidden">
        <span id="pair-code" class="pair-code"></span>
        <button id="copy-code-btn" class="btn-small">Copy</button>
        <p id="code-timer"></p>
      </div>
      <div class="divider">or</div>
      <input id="code-input" type="text" maxlength="6" placeholder="Enter partner's code">
      <button id="submit-code-btn" class="btn-primary">Connect</button>
      <p id="pairing-error" class="error hidden"></p>
    </div>

    <!-- Main room -->
    <div id="room-screen" class="screen hidden">
      <canvas id="room-canvas" width="320" height="400"></canvas>
      <div id="overlay-container" class="hidden"></div>
      <div id="toolbar">
        <button id="chat-btn" class="toolbar-btn" title="Chat">
          <span class="toolbar-icon">💬</span>
          <span id="unread-badge" class="badge hidden">0</span>
        </button>
        <button id="heart-btn" class="toolbar-btn" title="Send Heart">
          <span class="toolbar-icon">❤️</span>
        </button>
        <button id="kiss-btn" class="toolbar-btn" title="Send Kiss">
          <span class="toolbar-icon">💋</span>
        </button>
        <button id="mood-btn" class="toolbar-btn" title="Set Mood">
          <span id="mood-icon" class="toolbar-icon">😶</span>
        </button>
        <button id="settings-btn" class="toolbar-btn" title="Settings">
          <span class="toolbar-icon">⚙️</span>
        </button>
      </div>
    </div>
  </div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup.css**

```css
/* rhinosaurus-connect/popup/popup.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 400px;
  height: 500px;
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
}

#app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.hidden {
  display: none !important;
}

/* Login screen */
#login-screen {
  gap: 24px;
  background: linear-gradient(135deg, #1a1a2e 0%, #2d1b3e 100%);
}

.logo-container h1 {
  font-size: 20px;
  color: #ff6b9d;
  text-align: center;
}

.btn-primary {
  padding: 12px 24px;
  background: #ff6b9d;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #ff5588;
}

.btn-small {
  padding: 4px 12px;
  background: #4a4a6a;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

/* Pairing screen */
#pairing-screen {
  gap: 12px;
}

.pair-code {
  font-size: 32px;
  font-weight: bold;
  letter-spacing: 4px;
  color: #ff6b9d;
  font-family: monospace;
}

.divider {
  color: #888;
  font-size: 12px;
  margin: 8px 0;
}

#code-input {
  padding: 12px;
  font-size: 24px;
  text-align: center;
  letter-spacing: 4px;
  text-transform: uppercase;
  background: #2a2a4a;
  border: 2px solid #4a4a6a;
  border-radius: 8px;
  color: white;
  width: 200px;
  font-family: monospace;
}

.error {
  color: #ff4444;
  font-size: 12px;
}

/* Room screen */
#room-screen {
  padding: 0;
  justify-content: flex-start;
  position: relative;
}

#room-canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  width: 400px;
  height: 440px;
  background: #2a1a0a;
  cursor: default;
}

#overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: calc(100% - 50px);
  z-index: 10;
}

/* Toolbar */
#toolbar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  height: 50px;
  background: #1a1a2e;
  border-top: 1px solid #2a2a4a;
  padding: 0 8px;
}

.toolbar-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.toolbar-btn:hover {
  background: #2a2a4a;
}

.toolbar-icon {
  font-size: 20px;
}

.badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #ff4444;
  color: white;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
```

- [ ] **Step 3: Create popup.js entry point**

```js
// rhinosaurus-connect/popup/popup.js
import { RoomRenderer } from './room/room-renderer.js';
import { RoomState } from './room/room-state.js';

const screens = {
  login: document.getElementById('login-screen'),
  pairing: document.getElementById('pairing-screen'),
  room: document.getElementById('room-screen'),
};

function showScreen(name) {
  for (const screen of Object.values(screens)) {
    screen.classList.add('hidden');
  }
  screens[name].classList.remove('hidden');
}

async function init() {
  const canvas = document.getElementById('room-canvas');
  const roomState = new RoomState();
  const renderer = new RoomRenderer(canvas, roomState);

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const hit = renderer.hitTest(x, y);
    if (hit) {
      handleInteraction(hit);
    }
  });

  showScreen('room');
  renderer.startRenderLoop();
}

function handleInteraction(item) {
  console.log('Interaction:', item.interaction, item.id);
}

init();
```

- [ ] **Step 4: Commit**

```bash
git add rhinosaurus-connect/popup/
git commit -m "feat: add popup HTML shell with canvas, toolbar, and screen navigation"
```

---

### Task 7: Content script and corner popup CSS shell

**Files:**
- Create: `rhinosaurus-connect/content/content.js`
- Create: `rhinosaurus-connect/content/corner-popup.css`

- [ ] **Step 1: Create content.js**

```js
// rhinosaurus-connect/content/content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_NOTIFICATION') {
    showCornerPopup(message.data);
    sendResponse({ ok: true });
  }
});

function showCornerPopup(data) {
  const existing = document.getElementById('rhinosaurus-notification');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'rhinosaurus-notification';

  const inner = document.createElement('div');
  inner.className = 'rhino-notif-container';

  const avatarEl = document.createElement('div');
  avatarEl.className = 'rhino-avatar-placeholder';

  const bubble = document.createElement('div');
  bubble.className = 'rhino-speech-bubble';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'rhino-message';
  msgSpan.textContent = data.preview || '';

  bubble.appendChild(msgSpan);
  inner.appendChild(avatarEl);
  inner.appendChild(bubble);
  container.appendChild(inner);
  document.body.appendChild(container);

  requestAnimationFrame(() => container.classList.add('rhino-visible'));

  setTimeout(() => {
    container.classList.remove('rhino-visible');
    setTimeout(() => container.remove(), 500);
  }, 5000);

  container.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    container.remove();
  });
}
```

- [ ] **Step 2: Create corner-popup.css**

```css
/* rhinosaurus-connect/content/corner-popup.css */
#rhinosaurus-notification {
  position: fixed;
  bottom: 20px;
  right: -320px;
  z-index: 2147483647;
  transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: 'Segoe UI', system-ui, sans-serif;
}

#rhinosaurus-notification.rhino-visible {
  right: 20px;
}

.rhino-notif-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
  background: #1a1a2e;
  border: 2px solid #ff6b9d;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 300px;
  cursor: pointer;
}

.rhino-avatar-placeholder {
  width: 64px;
  height: 96px;
  background: #2a2a4a;
  border-radius: 4px;
  flex-shrink: 0;
  image-rendering: pixelated;
}

.rhino-speech-bubble {
  position: relative;
  background: #2a2a4a;
  border-radius: 8px;
  padding: 8px 12px;
  max-width: 200px;
}

.rhino-speech-bubble::before {
  content: '';
  position: absolute;
  left: -8px;
  bottom: 12px;
  border-width: 6px;
  border-style: solid;
  border-color: transparent #2a2a4a transparent transparent;
}

.rhino-message {
  color: #e0e0e0;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}
```

- [ ] **Step 3: Commit**

```bash
git add rhinosaurus-connect/content/
git commit -m "feat: add content script shell with corner popup notification"
```

---

### Task 8: Options page shell

**Files:**
- Create: `rhinosaurus-connect/options/options.html`
- Create: `rhinosaurus-connect/options/options.js`

- [ ] **Step 1: Create options.html**

```html
<!-- rhinosaurus-connect/options/options.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Rhinosaurus Connect - Settings</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
    }
    h1 { color: #ff6b9d; margin-bottom: 24px; }
    .section { margin-bottom: 24px; padding: 16px; background: #2a2a4a; border-radius: 8px; }
    .section h2 { font-size: 16px; margin-bottom: 12px; }
    .btn-danger {
      padding: 8px 16px;
      background: #ff4444;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-danger:hover { background: #cc3333; }
  </style>
</head>
<body>
  <h1>Rhinosaurus Connect</h1>
  <div class="section">
    <h2>Tracking</h2>
    <label>
      <input type="checkbox" id="tracking-toggle" checked>
      Share browsing activity with partner
    </label>
  </div>
  <div class="section">
    <h2>Account</h2>
    <p id="user-email"></p>
    <button id="unpair-btn" class="btn-danger">Unpair</button>
  </div>
  <script type="module" src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create options.js**

```js
// rhinosaurus-connect/options/options.js
document.getElementById('tracking-toggle').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ tracking_enabled: e.target.checked });
  chrome.runtime.sendMessage({ type: 'TRACKING_TOGGLED', enabled: e.target.checked });
});

document.getElementById('unpair-btn').addEventListener('click', () => {
  if (confirm('Are you sure? This will delete your shared room, chat history, and tracked dates.')) {
    chrome.runtime.sendMessage({ type: 'UNPAIR' });
  }
});

async function loadSettings() {
  const { tracking_enabled } = await chrome.storage.local.get(['tracking_enabled']);
  document.getElementById('tracking-toggle').checked = tracking_enabled !== false;
}

loadSettings();
```

- [ ] **Step 3: Commit**

```bash
git add rhinosaurus-connect/options/
git commit -m "feat: add options page shell with tracking toggle and unpair"
```

---

### Task 9: Placeholder icons and asset directories

**Files:**
- Create: `rhinosaurus-connect/assets/icons/icon-16.png`
- Create: `rhinosaurus-connect/assets/icons/icon-48.png`
- Create: `rhinosaurus-connect/assets/icons/icon-128.png`
- Create: `rhinosaurus-connect/assets/sprites/.gitkeep`
- Create: `rhinosaurus-connect/assets/sounds/.gitkeep`

- [ ] **Step 1: Create placeholder icons**

Generate simple colored square PNGs as placeholders (will be replaced with pixel art rhinoceros later):

```bash
cd rhinosaurus-connect
mkdir -p assets/icons assets/sprites assets/sounds

# Create minimal valid PNG files as placeholders using a simple python script
python3 -c "
import struct, zlib

def create_png(width, height, r, g, b, path):
    def chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(height):
        raw += b'\x00' + bytes([r, g, b]) * width
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(header + ihdr + idat + iend)

create_png(16, 16, 255, 107, 157, 'assets/icons/icon-16.png')
create_png(48, 48, 255, 107, 157, 'assets/icons/icon-48.png')
create_png(128, 128, 255, 107, 157, 'assets/icons/icon-128.png')
"

touch assets/sprites/.gitkeep
touch assets/sounds/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/assets/
git commit -m "feat: add placeholder icons and asset directory structure"
```

---

### Task 10: Supabase migration — full schema

**Files:**
- Create: `rhinosaurus-connect/supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- rhinosaurus-connect/supabase/migrations/001_initial_schema.sql
-- Rhinosaurus Connect: Initial Database Schema
-- Run this in Supabase SQL Editor or via supabase db push

-- ============================================================
-- TABLES
-- ============================================================

-- Users
create table if not exists public.users (
  id uuid primary key references auth.users(id),
  display_name text not null,
  avatar_config jsonb not null default '{}',
  mood text check (mood in ('happy', 'sad', 'missing_you', 'stressed', 'sleepy', 'excited', 'cozy')) default null,
  is_online boolean default false,
  last_seen_at timestamptz default now(),
  tracking_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pairs (LEAST/GREATEST canonical ordering prevents duplicate A/B vs B/A)
create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.users(id),
  user_b uuid not null references public.users(id),
  anniversary_date date default null,
  created_at timestamptz default now(),
  check (user_a < user_b),
  unique(user_a, user_b)
);

-- Pair Codes (temporary, for pairing flow)
create table if not exists public.pair_codes (
  code text primary key,
  user_id uuid not null references public.users(id),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  type text not null check (type in ('text', 'image', 'heart', 'kiss')),
  content text default null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Room State
create table if not exists public.room_state (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade unique,
  furniture jsonb not null default '[]',
  avatar_positions jsonb not null default '{}',
  theme text default 'default',
  version integer not null default 0,
  updated_at timestamptz default now()
);

-- Tracked Dates
create table if not exists public.tracked_dates (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  label text not null,
  date date not null,
  is_countdown boolean default false,
  is_recurring boolean default false,
  created_by uuid not null references public.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_messages_pair_id on public.messages(pair_id);
create index if not exists idx_messages_pair_unread on public.messages(pair_id, is_read) where is_read = false;
create index if not exists idx_tracked_dates_pair_id on public.tracked_dates(pair_id);
create index if not exists idx_pair_codes_expires on public.pair_codes(expires_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.pairs enable row level security;
alter table public.pair_codes enable row level security;
alter table public.messages enable row level security;
alter table public.room_state enable row level security;
alter table public.tracked_dates enable row level security;

-- Users: read/write own record, read partner's record
create policy "users_select_own" on public.users for select
  using (auth.uid() = id);
create policy "users_select_partner" on public.users for select
  using (
    id in (
      select user_a from public.pairs where user_b = auth.uid()
      union
      select user_b from public.pairs where user_a = auth.uid()
    )
  );
create policy "users_update_own" on public.users for update
  using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert
  with check (auth.uid() = id);

-- Pairs: members can read their own pair
create policy "pairs_select_member" on public.pairs for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- Pair Codes: anyone can read (for pairing), only creator can write/delete
create policy "pair_codes_select_all" on public.pair_codes for select
  using (true);
create policy "pair_codes_insert_own" on public.pair_codes for insert
  with check (auth.uid() = user_id);
create policy "pair_codes_delete_own" on public.pair_codes for delete
  using (auth.uid() = user_id);

-- Messages: pair members only
create policy "messages_select_pair" on public.messages for select
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "messages_insert_pair" on public.messages for insert
  with check (
    pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid())
    and sender_id = auth.uid()
  );
create policy "messages_update_pair" on public.messages for update
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));

-- Room State: pair members only
create policy "room_state_select_pair" on public.room_state for select
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "room_state_update_pair" on public.room_state for update
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "room_state_insert_pair" on public.room_state for insert
  with check (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));

-- Tracked Dates: pair members only
create policy "tracked_dates_select_pair" on public.tracked_dates for select
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "tracked_dates_insert_pair" on public.tracked_dates for insert
  with check (
    pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid())
    and created_by = auth.uid()
  );
create policy "tracked_dates_update_pair" on public.tracked_dates for update
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "tracked_dates_delete_pair" on public.tracked_dates for delete
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Atomic pair code claiming (prevents race conditions)
create or replace function public.claim_pair_code(p_code text, p_user_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_code_record record;
  v_pair_id uuid;
  v_user_a uuid;
  v_user_b uuid;
begin
  -- Lock the code row to prevent concurrent claims
  select * into v_code_record
  from public.pair_codes
  where code = p_code
  for update;

  if v_code_record is null then
    raise exception 'Invalid code';
  end if;

  if v_code_record.expires_at < now() then
    delete from public.pair_codes where code = p_code;
    raise exception 'Code expired';
  end if;

  if v_code_record.user_id = p_user_id then
    raise exception 'Cannot pair with yourself';
  end if;

  -- Canonical ordering: smaller UUID first
  if v_code_record.user_id < p_user_id then
    v_user_a := v_code_record.user_id;
    v_user_b := p_user_id;
  else
    v_user_a := p_user_id;
    v_user_b := v_code_record.user_id;
  end if;

  -- Check if pair already exists
  select id into v_pair_id
  from public.pairs
  where user_a = v_user_a and user_b = v_user_b;

  if v_pair_id is not null then
    raise exception 'Already paired';
  end if;

  -- Create the pair
  insert into public.pairs (user_a, user_b)
  values (v_user_a, v_user_b)
  returning id into v_pair_id;

  -- Create default room state
  insert into public.room_state (pair_id, furniture, avatar_positions)
  values (
    v_pair_id,
    '[
      {"id":"bed-1","type":"bed","variant":"double-wood","color":"#FF6B9D","x":40,"y":80,"interactive":false},
      {"id":"tv-1","type":"tv","variant":"crt","color":null,"x":240,"y":180,"interactive":true,"interaction":"activity"},
      {"id":"desk-1","type":"desk","variant":"wooden","color":null,"x":40,"y":220,"interactive":true,"interaction":"chat"},
      {"id":"calendar-1","type":"calendar","variant":"default","color":null,"x":270,"y":30,"interactive":true,"interaction":"dates"},
      {"id":"makeup-1","type":"makeup_stand","variant":"default","color":null,"x":240,"y":80,"interactive":true,"interaction":"makeup"},
      {"id":"window-1","type":"window","variant":"default","color":"#E8D5E0","x":80,"y":20,"interactive":false},
      {"id":"rug-1","type":"rug","variant":"round","color":"#D4A5C9","x":130,"y":160,"interactive":false},
      {"id":"nightstand-1","type":"nightstand","variant":"wooden","color":null,"x":10,"y":130,"interactive":false},
      {"id":"nightstand-2","type":"nightstand","variant":"wooden","color":null,"x":180,"y":130,"interactive":false}
    ]'::jsonb,
    '{}'::jsonb
  );

  -- Delete the used code
  delete from public.pair_codes where code = p_code;

  return v_pair_id;
end;
$$;

-- Cleanup expired pair codes (run via pg_cron every 5 minutes)
-- Schedule in Supabase Dashboard > Database > Cron Jobs:
-- select cron.schedule('cleanup-pair-codes', '*/5 * * * *', $$delete from public.pair_codes where expires_at < now()$$);

-- ============================================================
-- STORAGE
-- ============================================================

-- Create storage bucket for message images (run in SQL editor)
-- insert into storage.buckets (id, name, public) values ('message-images', 'message-images', false);

-- Storage RLS policies
-- create policy "message_images_select" on storage.objects for select
--   using (bucket_id = 'message-images' and (storage.foldername(name))[1] in (
--     select id::text from public.pairs where user_a = auth.uid() or user_b = auth.uid()
--   ));
-- create policy "message_images_insert" on storage.objects for insert
--   with check (bucket_id = 'message-images' and (storage.foldername(name))[1] in (
--     select id::text from public.pairs where user_a = auth.uid() or user_b = auth.uid()
--   ));

-- ============================================================
-- REALTIME
-- ============================================================

-- Enable realtime for messages table (for new message notifications)
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.tracked_dates;
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/supabase/
git commit -m "feat: add Supabase migration with full schema, RLS, and pair claiming function"
```

---

### Task 11: Run all tests and verify clean build

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass (constants, supabase-client, room-state, room-renderer).

- [ ] **Step 2: Verify extension loads in Chrome**

Manual steps:
1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `rhinosaurus-connect/` directory
4. Verify: extension icon appears in toolbar, no errors in console
5. Click icon → popup opens showing the room canvas with toolbar buttons

- [ ] **Step 3: Final commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: verify scaffolding - all tests pass, extension loads"
```

---

## Summary

After Phase 0, the following foundation exists:
- **Manifest V3** Chrome extension that loads in Chrome
- **Supabase client** with token management in service worker
- **Room state** management with default furniture, dirty tracking, and DB serialization
- **Room renderer** with dirty-flag canvas loop, depth sorting, and hit testing
- **Popup** with login/pairing/room screens and bottom toolbar
- **Content script** shell with corner popup notification system
- **Options page** with tracking toggle and unpair
- **Full database schema** with all 6 tables, RLS policies, indexes, and atomic pair claiming function
- **Shared constants** used by all feature worktrees
- **Test infrastructure** (vitest) with passing tests

Feature worktrees (Phase 1+) build on this by importing from `shared/`, extending `room-state.js`, adding overlay components, and implementing feature-specific service worker modules.
