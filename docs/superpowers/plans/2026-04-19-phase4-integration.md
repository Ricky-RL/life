# Phase 4: Integration & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire together all Phase 1-3 features into a cohesive experience: corner popup notifications with real avatars, offline message queue with batch delivery, sound effects, and final polish.

**Architecture:** This phase connects the dots between independently-built features. NotificationManager in the service worker decides which notification channel to use (corner popup via content script, or Chrome native). MessageQueue processes offline messages on login with batched animations. Sound effects are triggered by reactions and messages. Final polish includes animation tuning and edge case handling.

**Tech Stack:** Chrome Notifications API, Chrome Runtime messaging, HTML5 Canvas, Web Audio (short clips)

---

## Prerequisites

All Phase 1-3 worktrees must be merged into main before starting Phase 4:
- Phase 1: Auth, Shared Bedroom, Avatars, Activity Tracking
- Phase 2: Messaging, Reactions, Watch Together
- Phase 3: Mood, Date Tracker, Room Customization, Avatar Customization

---

### Task 1: Corner popup notifications with real avatars

**Files:**
- Modify: `rhinosaurus-connect/content/content.js`
- Modify: `rhinosaurus-connect/background/notification-manager.js`
- Create: `rhinosaurus-connect/content/avatar-mini-renderer.js`
- Test: `rhinosaurus-connect/tests/content/avatar-mini-renderer.test.js`

- [ ] **Step 1: Write test for mini avatar renderer**

```js
// rhinosaurus-connect/tests/content/avatar-mini-renderer.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvatarMiniRenderer } from '../../content/avatar-mini-renderer.js';

function createMockCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    imageSmoothingEnabled: true,
  };
  return {
    canvas: { width: 64, height: 96, getContext: vi.fn(() => ctx) },
    ctx,
  };
}

describe('AvatarMiniRenderer', () => {
  it('initializes with canvas dimensions', () => {
    const { canvas } = createMockCanvas();
    const renderer = new AvatarMiniRenderer(canvas);
    expect(renderer.scale).toBe(2);
  });

  it('renders static idle frame for basic notification', () => {
    const { canvas, ctx } = createMockCanvas();
    const renderer = new AvatarMiniRenderer(canvas);
    const mockSpriteSheet = { width: 256, height: 384 };

    renderer.renderStatic(mockSpriteSheet, 'idle', 0);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('renders animated frame for reaction notification', () => {
    const { canvas, ctx } = createMockCanvas();
    const renderer = new AvatarMiniRenderer(canvas);
    const mockSpriteSheet = { width: 256, height: 384 };

    renderer.renderFrame(mockSpriteSheet, 'heart_eyes', 3);
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/content/avatar-mini-renderer.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement avatar-mini-renderer.js**

```js
// rhinosaurus-connect/content/avatar-mini-renderer.js
import { AVATAR_SIZE, ANIMATION_STATES } from '../shared/constants.js';

export class AvatarMiniRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.scale = 2;
    this.animationTimer = null;
  }

  renderStatic(spriteSheet, state, frame) {
    const stateData = ANIMATION_STATES[state];
    if (!stateData) return;

    const frameIndex = Math.min(frame, stateData.frames - 1);
    this.drawFrame(spriteSheet, state, frameIndex);
  }

  renderFrame(spriteSheet, state, frame) {
    this.drawFrame(spriteSheet, state, frame);
  }

  renderAnimated(spriteSheet, state, onComplete) {
    const stateData = ANIMATION_STATES[state];
    if (!stateData) return;

    let frame = 0;
    const frameInterval = 33;

    this.stopAnimation();

    this.animationTimer = setInterval(() => {
      this.drawFrame(spriteSheet, state, frame);
      frame++;

      if (frame >= stateData.frames) {
        if (stateData.looping) {
          frame = 0;
        } else {
          this.stopAnimation();
          if (onComplete) onComplete();
        }
      }
    }, frameInterval);
  }

  drawFrame(spriteSheet, state, frameIndex) {
    const { width: fw, height: fh } = AVATAR_SIZE;
    const stateIndex = Object.keys(ANIMATION_STATES).indexOf(state);
    const sx = frameIndex * fw;
    const sy = stateIndex * fh;
    const dw = fw * this.scale;
    const dh = fh * this.scale;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(spriteSheet, sx, sy, fw, fh, 0, 0, dw, dh);
  }

  stopAnimation() {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/content/avatar-mini-renderer.test.js`
Expected: PASS

- [ ] **Step 5: Upgrade content.js to use real avatar rendering**

```js
// rhinosaurus-connect/content/content.js
import { AvatarMiniRenderer } from './avatar-mini-renderer.js';

let spriteSheetCache = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_NOTIFICATION') {
    showCornerPopup(message.data);
    sendResponse({ ok: true });
  }
  if (message.type === 'LOAD_SPRITE_SHEET') {
    loadSpriteSheet(message.url);
    sendResponse({ ok: true });
  }
});

async function loadSpriteSheet(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      spriteSheetCache = img;
      resolve();
    };
    img.src = url;
  });
}

function showCornerPopup(data) {
  const existing = document.getElementById('rhinosaurus-notification');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'rhinosaurus-notification';

  const inner = document.createElement('div');
  inner.className = 'rhino-notif-container';

  const canvas = document.createElement('canvas');
  canvas.className = 'rhino-avatar';
  canvas.width = 64;
  canvas.height = 96;

  const bubble = document.createElement('div');
  bubble.className = 'rhino-speech-bubble';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'rhino-message';
  msgSpan.textContent = data.preview || '';

  bubble.appendChild(msgSpan);
  inner.appendChild(canvas);
  inner.appendChild(bubble);
  container.appendChild(inner);
  document.body.appendChild(container);

  if (spriteSheetCache) {
    const miniRenderer = new AvatarMiniRenderer(canvas);
    const animState = data.animation || 'idle';
    miniRenderer.renderAnimated(spriteSheetCache, animState, () => {
      miniRenderer.renderStatic(spriteSheetCache, 'idle', 0);
    });
  }

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

- [ ] **Step 6: Commit**

```bash
git add rhinosaurus-connect/content/ rhinosaurus-connect/tests/content/
git commit -m "feat: upgrade corner popup to render real avatar sprites with animation"
```

---

### Task 2: Notification manager (orchestration)

**Files:**
- Modify: `rhinosaurus-connect/background/notification-manager.js`
- Test: `rhinosaurus-connect/tests/background/notification-manager.test.js`

- [ ] **Step 1: Write test for notification routing**

```js
// rhinosaurus-connect/tests/background/notification-manager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChrome = {
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  notifications: {
    create: vi.fn(),
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://abc123/${path}`),
  },
};

vi.stubGlobal('chrome', mockChrome);

const { NotificationManager } = await import(
  '../../background/notification-manager.js'
);

describe('NotificationManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new NotificationManager();
  });

  it('sends corner popup to active tab content script', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ id: 42, url: 'https://example.com' }]);
    mockChrome.tabs.sendMessage.mockResolvedValue({ ok: true });

    await manager.notify({
      type: 'text',
      senderName: 'Partner',
      preview: 'miss you!',
      animation: 'speaking',
    });

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: 'SHOW_NOTIFICATION',
      data: expect.objectContaining({ preview: 'miss you!' }),
    });
  });

  it('falls back to Chrome native notification for chrome:// pages', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ id: 42, url: 'chrome://settings' }]);

    await manager.notify({
      type: 'text',
      senderName: 'Partner',
      preview: 'hello!',
      animation: 'speaking',
    });

    expect(mockChrome.notifications.create).toHaveBeenCalled();
    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('falls back to Chrome native when content script fails', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ id: 42, url: 'https://example.com' }]);
    mockChrome.tabs.sendMessage.mockRejectedValue(new Error('no listener'));

    await manager.notify({
      type: 'text',
      senderName: 'Partner',
      preview: 'hi!',
      animation: 'speaking',
    });

    expect(mockChrome.notifications.create).toHaveBeenCalled();
  });

  it('formats heart reaction preview', () => {
    const preview = manager.formatPreview({ type: 'heart' });
    expect(preview).toBe('❤️');
  });

  it('formats kiss reaction preview', () => {
    const preview = manager.formatPreview({ type: 'kiss' });
    expect(preview).toBe('💋');
  });

  it('formats image message preview', () => {
    const preview = manager.formatPreview({ type: 'image' });
    expect(preview).toBe('Sent you a photo 📷');
  });

  it('truncates long text messages to 80 chars', () => {
    const longText = 'a'.repeat(100);
    const preview = manager.formatPreview({ type: 'text', content: longText });
    expect(preview.length).toBeLessThanOrEqual(83);
    expect(preview.endsWith('...')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/notification-manager.test.js`
Expected: FAIL

- [ ] **Step 3: Implement notification-manager.js**

```js
// rhinosaurus-connect/background/notification-manager.js
export class NotificationManager {
  async notify(messageData) {
    const { senderName, animation } = messageData;
    const preview = this.formatPreview(messageData);

    const canUseContentScript = await this.tryContentScriptNotification({
      preview,
      animation: animation || 'speaking',
    });

    if (!canUseContentScript) {
      this.showChromeNotification(senderName, preview);
    }
  }

  async tryContentScriptNotification(data) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
        return false;
      }

      await chrome.tabs.sendMessage(activeTab.id, {
        type: 'SHOW_NOTIFICATION',
        data,
      });
      return true;
    } catch {
      return false;
    }
  }

  showChromeNotification(senderName, preview) {
    const notifId = `rhino-${Date.now()}`;
    chrome.notifications.create(notifId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon-48.png'),
      title: senderName || 'Rhinosaurus Connect',
      message: preview,
      priority: 2,
    });
  }

  formatPreview(messageData) {
    const { type, content } = messageData;
    switch (type) {
      case 'heart':
        return '❤️';
      case 'kiss':
        return '💋';
      case 'image':
        return 'Sent you a photo 📷';
      case 'text':
      default:
        if (!content) return '';
        if (content.length <= 80) return content;
        return content.substring(0, 80) + '...';
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/notification-manager.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/background/notification-manager.js rhinosaurus-connect/tests/background/notification-manager.test.js
git commit -m "feat: add notification manager with corner popup and Chrome native fallback"
```

---

### Task 3: Offline message queue with batch delivery

**Files:**
- Modify: `rhinosaurus-connect/background/message-queue.js`
- Test: `rhinosaurus-connect/tests/background/message-queue.test.js`

- [ ] **Step 1: Write test for message queue**

```js
// rhinosaurus-connect/tests/background/message-queue.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageQueue } from '../../background/message-queue.js';

describe('MessageQueue', () => {
  let queue;
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            neq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      { id: '1', type: 'text', content: 'hi', sender_id: 'partner-1', created_at: '2026-04-19T10:00:00Z' },
                      { id: '2', type: 'heart', content: null, sender_id: 'partner-1', created_at: '2026-04-19T10:01:00Z' },
                      { id: '3', type: 'heart', content: null, sender_id: 'partner-1', created_at: '2026-04-19T10:02:00Z' },
                      { id: '4', type: 'kiss', content: null, sender_id: 'partner-1', created_at: '2026-04-19T10:03:00Z' },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          })),
        })),
      })),
    };
    queue = new MessageQueue(mockSupabase);
  });

  it('fetches unread messages for a pair', async () => {
    const messages = await queue.fetchUnread('pair-1', 'user-1');
    expect(messages).toHaveLength(4);
  });

  it('separates text messages from reactions', () => {
    const messages = [
      { id: '1', type: 'text', content: 'hi' },
      { id: '2', type: 'heart', content: null },
      { id: '3', type: 'heart', content: null },
      { id: '4', type: 'kiss', content: null },
    ];
    const { textMessages, reactions } = queue.categorize(messages);
    expect(textMessages).toHaveLength(1);
    expect(reactions).toHaveLength(3);
  });

  it('formats batch reaction summary', () => {
    const reactions = [
      { type: 'heart' },
      { type: 'heart' },
      { type: 'heart' },
      { type: 'kiss' },
      { type: 'kiss' },
    ];
    const summary = queue.formatReactionSummary(reactions);
    expect(summary).toBe('She sent you 3 ❤️ and 2 💋 while you were away');
  });

  it('formats summary with only hearts', () => {
    const reactions = [{ type: 'heart' }, { type: 'heart' }];
    const summary = queue.formatReactionSummary(reactions);
    expect(summary).toBe('She sent you 2 ❤️ while you were away');
  });

  it('formats summary with only kisses', () => {
    const reactions = [{ type: 'kiss' }];
    const summary = queue.formatReactionSummary(reactions);
    expect(summary).toBe('She sent you 1 💋 while you were away');
  });

  it('caps particle count at 10', () => {
    const reactions = Array(25).fill({ type: 'heart' });
    const particleCount = queue.getParticleCount(reactions);
    expect(particleCount).toBe(10);
  });

  it('returns actual count when under cap', () => {
    const reactions = [{ type: 'heart' }, { type: 'kiss' }, { type: 'heart' }];
    const particleCount = queue.getParticleCount(reactions);
    expect(particleCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/message-queue.test.js`
Expected: FAIL

- [ ] **Step 3: Implement message-queue.js**

```js
// rhinosaurus-connect/background/message-queue.js
const MAX_PARTICLES = 10;

export class MessageQueue {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async fetchUnread(pairId, userId) {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('pair_id', pairId)
      .neq('sender_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  categorize(messages) {
    const textMessages = messages.filter(m => m.type === 'text' || m.type === 'image');
    const reactions = messages.filter(m => m.type === 'heart' || m.type === 'kiss');
    return { textMessages, reactions };
  }

  formatReactionSummary(reactions) {
    const hearts = reactions.filter(r => r.type === 'heart').length;
    const kisses = reactions.filter(r => r.type === 'kiss').length;

    const parts = [];
    if (hearts > 0) parts.push(`${hearts} ❤️`);
    if (kisses > 0) parts.push(`${kisses} 💋`);

    return `She sent you ${parts.join(' and ')} while you were away`;
  }

  getParticleCount(reactions) {
    return Math.min(reactions.length, MAX_PARTICLES);
  }

  async markAsRead(messageIds) {
    if (messageIds.length === 0) return;

    const { error } = await this.supabase
      .from('messages')
      .update({ is_read: true })
      .in('id', messageIds);

    if (error) throw error;
  }

  async processQueue(pairId, userId) {
    const messages = await this.fetchUnread(pairId, userId);
    if (messages.length === 0) return null;

    const { textMessages, reactions } = this.categorize(messages);

    const result = {
      textMessages,
      textCount: textMessages.length,
      reactions,
      reactionSummary: reactions.length > 0 ? this.formatReactionSummary(reactions) : null,
      particleCount: this.getParticleCount(reactions),
      totalUnread: messages.length,
    };

    return result;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/message-queue.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/background/message-queue.js rhinosaurus-connect/tests/background/message-queue.test.js
git commit -m "feat: add offline message queue with batch reaction summaries"
```

---

### Task 4: Sound effects

**Files:**
- Create: `rhinosaurus-connect/shared/sound-manager.js`
- Test: `rhinosaurus-connect/tests/shared/sound-manager.test.js`

- [ ] **Step 1: Write test for sound manager**

```js
// rhinosaurus-connect/tests/shared/sound-manager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundManager } from '../../shared/sound-manager.js';

const mockAudioContext = {
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  decodeAudioData: vi.fn(() => Promise.resolve({})),
  destination: {},
};

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));

const mockChrome = {
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({ sound_enabled: true })),
      set: vi.fn(() => Promise.resolve()),
    },
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://abc/${path}`),
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('SoundManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SoundManager();
  });

  it('initializes with sound enabled by default', async () => {
    await manager.init();
    expect(manager.enabled).toBe(true);
  });

  it('can be toggled off', async () => {
    await manager.init();
    await manager.setEnabled(false);
    expect(manager.enabled).toBe(false);
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ sound_enabled: false });
  });

  it('does not play when disabled', async () => {
    await manager.init();
    manager.enabled = false;
    manager.play('heart');
    expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
  });

  it('maps sound names to file paths', () => {
    expect(manager.getSoundPath('heart')).toBe('assets/sounds/heart-chime.mp3');
    expect(manager.getSoundPath('kiss')).toBe('assets/sounds/kiss-mwah.mp3');
    expect(manager.getSoundPath('message')).toBe('assets/sounds/message-ding.mp3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/sound-manager.test.js`
Expected: FAIL

- [ ] **Step 3: Implement sound-manager.js**

```js
// rhinosaurus-connect/shared/sound-manager.js
const SOUND_FILES = {
  heart: 'assets/sounds/heart-chime.mp3',
  kiss: 'assets/sounds/kiss-mwah.mp3',
  message: 'assets/sounds/message-ding.mp3',
  milestone: 'assets/sounds/celebration.mp3',
};

export class SoundManager {
  constructor() {
    this.enabled = true;
    this.audioContext = null;
    this.bufferCache = {};
  }

  async init() {
    const { sound_enabled } = await chrome.storage.local.get(['sound_enabled']);
    this.enabled = sound_enabled !== false;
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
    await chrome.storage.local.set({ sound_enabled: enabled });
  }

  getSoundPath(name) {
    return SOUND_FILES[name] || null;
  }

  async loadBuffer(name) {
    if (this.bufferCache[name]) return this.bufferCache[name];

    const path = this.getSoundPath(name);
    if (!path) return null;

    try {
      const url = chrome.runtime.getURL(path);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.bufferCache[name] = buffer;
      return buffer;
    } catch {
      return null;
    }
  }

  async play(name) {
    if (!this.enabled) return;

    const buffer = await this.loadBuffer(name);
    if (!buffer || !this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    gain.gain.value = 0.5;

    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.audioContext.destination);
    source.start(0);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/sound-manager.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/shared/sound-manager.js rhinosaurus-connect/tests/shared/sound-manager.test.js
git commit -m "feat: add sound manager with caching and toggle support"
```

---

### Task 5: Wire popup lifecycle — full integration

**Files:**
- Modify: `rhinosaurus-connect/popup/popup.js`

- [ ] **Step 1: Update popup.js with full lifecycle**

```js
// rhinosaurus-connect/popup/popup.js
import { RoomRenderer } from './room/room-renderer.js';
import { RoomState } from './room/room-state.js';
import { SoundManager } from '../shared/sound-manager.js';

const screens = {
  login: document.getElementById('login-screen'),
  pairing: document.getElementById('pairing-screen'),
  room: document.getElementById('room-screen'),
};

const soundManager = new SoundManager();

function showScreen(name) {
  for (const screen of Object.values(screens)) {
    screen.classList.add('hidden');
  }
  screens[name].classList.remove('hidden');
}

async function init() {
  await soundManager.init();

  const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });

  if (!response || !response.user) {
    showScreen('login');
    return;
  }

  if (!response.pair) {
    showScreen('pairing');
    return;
  }

  await initRoom(response);
}

async function initRoom(sessionData) {
  const canvas = document.getElementById('room-canvas');
  const roomState = new RoomState();

  if (sessionData.roomState) {
    roomState.loadFromDb(sessionData.roomState);
  }

  const renderer = new RoomRenderer(canvas, roomState);

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const hit = renderer.hitTest(x, y);
    if (hit) handleInteraction(hit);
  });

  showScreen('room');
  renderer.startRenderLoop();

  const queueData = await chrome.runtime.sendMessage({ type: 'PROCESS_QUEUE' });
  if (queueData && queueData.totalUnread > 0) {
    handleOfflineQueue(queueData, renderer);
  }

  window.addEventListener('unload', () => {
    chrome.runtime.sendMessage({ type: 'POPUP_CLOSED', roomState: roomState.toDbRecord() });
  });
}

function handleOfflineQueue(queueData, renderer) {
  if (queueData.reactionSummary) {
    console.log('Offline reactions:', queueData.reactionSummary);
  }
  if (queueData.textCount > 0) {
    console.log(`You missed ${queueData.textCount} messages!`);
  }
}

function handleInteraction(item) {
  const overlayContainer = document.getElementById('overlay-container');

  switch (item.interaction) {
    case 'chat':
      overlayContainer.classList.remove('hidden');
      break;
    case 'activity':
      overlayContainer.classList.remove('hidden');
      break;
    case 'dates':
      overlayContainer.classList.remove('hidden');
      break;
    case 'makeup':
      overlayContainer.classList.remove('hidden');
      break;
  }
}

document.getElementById('heart-btn')?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'SEND_REACTION', reaction: 'heart' });
  await soundManager.play('heart');
});

document.getElementById('kiss-btn')?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'SEND_REACTION', reaction: 'kiss' });
  await soundManager.play('kiss');
});

init();
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/popup.js
git commit -m "feat: integrate full popup lifecycle with auth, queue, sound, and interactions"
```

---

### Task 6: Service worker message routing — full integration

**Files:**
- Modify: `rhinosaurus-connect/background/service-worker.js`

- [ ] **Step 1: Update service-worker.js with full message routing**

```js
// rhinosaurus-connect/background/service-worker.js
import { supabase, restoreSession, storeTokens, clearTokens } from './supabase-client.js';
import { NotificationManager } from './notification-manager.js';
import { MessageQueue } from './message-queue.js';

const notificationManager = new NotificationManager();
const messageQueue = new MessageQueue(supabase);

let currentSession = null;
let currentPair = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Rhinosaurus Connect installed');
});

chrome.runtime.onStartup.addListener(async () => {
  currentSession = await restoreSession();
  if (currentSession) {
    await loadPairData();
  }
});

async function loadPairData() {
  if (!currentSession) return;

  const { data: pairs } = await supabase
    .from('pairs')
    .select('*')
    .or(`user_a.eq.${currentSession.user.id},user_b.eq.${currentSession.user.id}`)
    .limit(1);

  currentPair = pairs?.[0] || null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_SESSION': {
      if (!currentSession) {
        currentSession = await restoreSession();
      }
      if (currentSession && !currentPair) {
        await loadPairData();
      }

      let roomState = null;
      if (currentPair) {
        const { data } = await supabase
          .from('room_state')
          .select('*')
          .eq('pair_id', currentPair.id)
          .single();
        roomState = data;
      }

      return {
        user: currentSession?.user || null,
        pair: currentPair,
        roomState,
      };
    }

    case 'PROCESS_QUEUE': {
      if (!currentPair || !currentSession) return null;
      return messageQueue.processQueue(currentPair.id, currentSession.user.id);
    }

    case 'SEND_REACTION': {
      if (!currentPair || !currentSession) return { error: 'Not paired' };
      const { error } = await supabase.from('messages').insert({
        pair_id: currentPair.id,
        sender_id: currentSession.user.id,
        type: message.reaction,
        content: null,
      });
      return { error: error?.message || null };
    }

    case 'POPUP_CLOSED': {
      if (currentPair && message.roomState) {
        await supabase
          .from('room_state')
          .update(message.roomState)
          .eq('pair_id', currentPair.id);
      }
      await supabase
        .from('users')
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq('id', currentSession?.user?.id);
      return { ok: true };
    }

    case 'TRACKING_TOGGLED': {
      if (currentSession) {
        await supabase
          .from('users')
          .update({ tracking_enabled: message.enabled })
          .eq('id', currentSession.user.id);
      }
      return { ok: true };
    }

    case 'OPEN_POPUP': {
      chrome.action.openPopup?.();
      return { ok: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/background/service-worker.js
git commit -m "feat: integrate service worker with full message routing and lifecycle"
```

---

### Task 7: Run all tests and final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass across all modules.

- [ ] **Step 2: Manual verification in Chrome**

1. Load extension in `chrome://extensions` (Developer mode → Load unpacked)
2. Click extension icon → popup opens
3. Verify: login screen shows initially
4. Verify: toolbar buttons are visible and clickable
5. Verify: canvas renders room with placeholder furniture
6. Open Chrome DevTools on the popup → verify no console errors
7. Open a random website → verify no errors from content script

- [ ] **Step 3: Final commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 4 integration complete - all features connected"
```

---

## Summary

Phase 4 connects all independently-built features:
- **Corner popup notifications** now render real avatar sprites with animation
- **Notification routing** falls back from content script → Chrome native gracefully
- **Offline message queue** batches reactions with summaries and caps particles at 10
- **Sound effects** with toggle support for hearts, kisses, messages, and milestones
- **Popup lifecycle** handles auth check → room load → queue processing → interaction dispatch
- **Service worker** routes all messages between popup, content script, and Supabase
