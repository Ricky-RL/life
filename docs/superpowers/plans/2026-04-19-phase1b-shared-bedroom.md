# Phase 1B: Shared Bedroom Rendering & Room Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the room renderer from placeholder rectangles to a sprite-based system with real-time sync, hover effects, day/night cycle, and debounced database persistence.

**Architecture:** SpriteLoader handles sprite sheet loading and frame extraction. RoomSync manages Realtime channel subscriptions and debounced DB writes. RoomRenderer is upgraded to draw sprites instead of rectangles, with hover glow and day/night window effects.

**Tech Stack:** HTML5 Canvas, Supabase Realtime (broadcast), Supabase Database

---

### Task 1: Sprite loader

**Files:**
- Create: `rhinosaurus-connect/popup/room/sprite-loader.js`
- Test: `rhinosaurus-connect/tests/popup/room/sprite-loader.test.js`

- [ ] **Step 1: Write test for sprite loader**

```js
// rhinosaurus-connect/tests/popup/room/sprite-loader.test.js
import { describe, it, expect, vi } from 'vitest';
import { SpriteLoader, SpriteFrame } from '../../../popup/room/sprite-loader.js';

describe('SpriteFrame', () => {
  it('stores source rectangle from sprite sheet', () => {
    const frame = new SpriteFrame('sheet1', 0, 0, 32, 48);
    expect(frame.sheet).toBe('sheet1');
    expect(frame.sx).toBe(0);
    expect(frame.sy).toBe(0);
    expect(frame.sw).toBe(32);
    expect(frame.sh).toBe(48);
  });

  it('draws to canvas context', () => {
    const ctx = { drawImage: vi.fn() };
    const mockSheet = { width: 256, height: 256 };
    const frame = new SpriteFrame(mockSheet, 32, 0, 32, 48);
    frame.draw(ctx, 100, 200, 64, 96);
    expect(ctx.drawImage).toHaveBeenCalledWith(mockSheet, 32, 0, 32, 48, 100, 200, 64, 96);
  });
});

describe('SpriteLoader', () => {
  it('registers sprite definitions', () => {
    const loader = new SpriteLoader();
    loader.register('bed', 'double-wood', { sheet: 'room', sx: 0, sy: 0, sw: 64, sh: 48 });
    const def = loader.getDefinition('bed', 'double-wood');
    expect(def).toBeDefined();
    expect(def.sw).toBe(64);
  });

  it('returns null for unregistered sprite', () => {
    const loader = new SpriteLoader();
    expect(loader.getDefinition('nonexistent', 'variant')).toBeNull();
  });

  it('creates SpriteFrame from definition and loaded sheet', () => {
    const loader = new SpriteLoader();
    const mockSheet = { width: 256, height: 256 };
    loader.sheets.set('room', mockSheet);
    loader.register('bed', 'double-wood', { sheet: 'room', sx: 0, sy: 0, sw: 64, sh: 48 });

    const frame = loader.getFrame('bed', 'double-wood');
    expect(frame).toBeInstanceOf(SpriteFrame);
    expect(frame.sheet).toBe(mockSheet);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/sprite-loader.test.js`
Expected: FAIL

- [ ] **Step 3: Implement sprite-loader.js**

```js
// rhinosaurus-connect/popup/room/sprite-loader.js
export class SpriteFrame {
  constructor(sheet, sx, sy, sw, sh) {
    this.sheet = sheet;
    this.sx = sx;
    this.sy = sy;
    this.sw = sw;
    this.sh = sh;
  }

  draw(ctx, dx, dy, dw, dh) {
    ctx.drawImage(this.sheet, this.sx, this.sy, this.sw, this.sh, dx, dy, dw || this.sw, dh || this.sh);
  }
}

export class SpriteLoader {
  constructor() {
    this.definitions = new Map();
    this.sheets = new Map();
  }

  register(type, variant, def) {
    const key = `${type}:${variant}`;
    this.definitions.set(key, def);
  }

  getDefinition(type, variant) {
    return this.definitions.get(`${type}:${variant}`) || null;
  }

  async loadSheet(name, url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sheets.set(name, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  getFrame(type, variant) {
    const def = this.getDefinition(type, variant);
    if (!def) return null;
    const sheet = this.sheets.get(def.sheet);
    if (!sheet) return null;
    return new SpriteFrame(sheet, def.sx, def.sy, def.sw, def.sh);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/sprite-loader.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/sprite-loader.js rhinosaurus-connect/tests/popup/room/sprite-loader.test.js
git commit -m "feat: add sprite loader with frame extraction and sheet management"
```

---

### Task 2: Room sync (Realtime + debounced DB)

**Files:**
- Create: `rhinosaurus-connect/popup/room/room-sync.js`
- Test: `rhinosaurus-connect/tests/popup/room/room-sync.test.js`

- [ ] **Step 1: Write test for room sync**

```js
// rhinosaurus-connect/tests/popup/room/room-sync.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomSync } from '../../../popup/room/room-sync.js';

describe('RoomSync', () => {
  let sync;
  let mockChannel;
  let mockSupabase;

  beforeEach(() => {
    vi.useFakeTimers();
    mockChannel = {
      send: vi.fn(),
      on: vi.fn(() => mockChannel),
      subscribe: vi.fn(() => mockChannel),
      unsubscribe: vi.fn(),
    };
    mockSupabase = {
      channel: vi.fn(() => mockChannel),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { furniture: [], avatar_positions: {}, theme: 'default', version: 1 }, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    };
    sync = new RoomSync(mockSupabase, 'pair-123');
  });

  it('broadcasts furniture move immediately', () => {
    sync.init();
    sync.broadcastFurnitureMove('bed-1', { x: 50, y: 90 });
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'room_update',
      payload: {
        action: 'furniture_move',
        furniture_id: 'bed-1',
        changes: { x: 50, y: 90 },
      },
    });
  });

  it('debounces DB writes to 2 seconds', async () => {
    sync.init();
    const roomState = { furniture: [], avatar_positions: {}, theme: 'default', version: 2 };

    sync.scheduleSave(roomState);
    expect(mockSupabase.from).not.toHaveBeenCalledWith('room_state');

    vi.advanceTimersByTime(2000);
    await vi.runAllTimersAsync();

    expect(mockSupabase.from).toHaveBeenCalled();
  });

  it('coalesces multiple saves within debounce window', () => {
    sync.init();
    const state1 = { furniture: [{ id: 'a' }], avatar_positions: {}, theme: 'default', version: 2 };
    const state2 = { furniture: [{ id: 'b' }], avatar_positions: {}, theme: 'default', version: 3 };

    sync.scheduleSave(state1);
    sync.scheduleSave(state2);

    expect(sync.pendingState).toBe(state2);
  });

  it('loads room state from database', async () => {
    const state = await sync.loadFromDb();
    expect(state).toBeDefined();
    expect(state.furniture).toEqual([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/room-sync.test.js`
Expected: FAIL

- [ ] **Step 3: Implement room-sync.js**

```js
// rhinosaurus-connect/popup/room/room-sync.js
import { getEventsChannelName } from '../../shared/supabase-helpers.js';
import { REALTIME_EVENTS } from '../../shared/constants.js';

const DB_SAVE_DEBOUNCE_MS = 2000;

export class RoomSync {
  constructor(supabase, pairId) {
    this.supabase = supabase;
    this.pairId = pairId;
    this.channel = null;
    this.saveTimer = null;
    this.pendingState = null;
    this.onRemoteUpdate = null;
  }

  init() {
    const channelName = getEventsChannelName(this.pairId);
    this.channel = this.supabase.channel(channelName);

    this.channel
      .on('broadcast', { event: REALTIME_EVENTS.ROOM_UPDATE }, (payload) => {
        if (this.onRemoteUpdate) {
          this.onRemoteUpdate(payload.payload);
        }
      })
      .subscribe();
  }

  broadcastFurnitureMove(furnitureId, changes) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.ROOM_UPDATE,
      payload: {
        action: 'furniture_move',
        furniture_id: furnitureId,
        changes,
      },
    });
  }

  broadcastFurnitureChange(furnitureId, changes) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.ROOM_UPDATE,
      payload: {
        action: 'furniture_change',
        furniture_id: furnitureId,
        changes,
      },
    });
  }

  broadcastAvatarMove(userId, x, y) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.AVATAR_MOVE,
      payload: { user_id: userId, x, y },
    });
  }

  scheduleSave(roomState) {
    this.pendingState = roomState;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveToDb(), DB_SAVE_DEBOUNCE_MS);
  }

  async saveToDb() {
    if (!this.pendingState) return;
    const state = this.pendingState;
    this.pendingState = null;

    await this.supabase
      .from('room_state')
      .update({
        furniture: state.furniture,
        avatar_positions: state.avatar_positions,
        theme: state.theme,
        version: state.version,
        updated_at: new Date().toISOString(),
      })
      .eq('pair_id', this.pairId);
  }

  async loadFromDb() {
    const { data, error } = await this.supabase
      .from('room_state')
      .select('*')
      .eq('pair_id', this.pairId)
      .single();

    if (error) throw error;
    return data;
  }

  async forceSave(roomState) {
    this.pendingState = null;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    await this.supabase
      .from('room_state')
      .update({
        furniture: roomState.furniture,
        avatar_positions: roomState.avatar_positions,
        theme: roomState.theme,
        version: roomState.version,
        updated_at: new Date().toISOString(),
      })
      .eq('pair_id', this.pairId);
  }

  destroy() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.channel) this.channel.unsubscribe();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/room-sync.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/room-sync.js rhinosaurus-connect/tests/popup/room/room-sync.test.js
git commit -m "feat: add room sync with Realtime broadcast and debounced DB saves"
```

---

### Task 3: Upgrade room renderer with sprites and hover

**Files:**
- Modify: `rhinosaurus-connect/popup/room/room-renderer.js`

- [ ] **Step 1: Add sprite-based furniture drawing and hover detection**

Replace `drawFurnitureItem` and add hover tracking:

```js
// Add to room-renderer.js constructor:
this.spriteLoader = null;
this.hoveredItem = null;

// Add method:
setSpriteLoader(loader) {
  this.spriteLoader = loader;
}

// Replace drawFurnitureItem:
drawFurnitureItem(item) {
  if (this.spriteLoader) {
    const frame = this.spriteLoader.getFrame(item.type, item.variant || 'default');
    if (frame) {
      frame.draw(this.ctx, item.x, item.y);
      if (this.hoveredItem === item && item.interactive) {
        this.drawHoverGlow(item);
      }
      return;
    }
  }
  // Fallback: colored rectangle
  this.ctx.fillStyle = item.color || '#A0522D';
  this.ctx.fillRect(item.x, item.y, DEFAULT_HITBOX_SIZE.width, DEFAULT_HITBOX_SIZE.height);
  if (this.hoveredItem === item && item.interactive) {
    this.drawHoverGlow(item);
  }
}

// Add method:
drawHoverGlow(item) {
  this.ctx.save();
  this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
  this.ctx.lineWidth = 2;
  this.ctx.strokeRect(item.x - 1, item.y - 1, DEFAULT_HITBOX_SIZE.width + 2, DEFAULT_HITBOX_SIZE.height + 2);
  this.ctx.restore();
}

// Add method:
handleMouseMove(canvasX, canvasY) {
  const hit = this.hitTest(canvasX, canvasY);
  const newHovered = hit?.interactive ? hit : null;
  if (newHovered !== this.hoveredItem) {
    this.hoveredItem = newHovered;
    this.canvas.style.cursor = newHovered ? 'pointer' : 'default';
    this.markDirty();
  }
}

// Add day/night window drawing:
drawWindow(windowItem) {
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 20;
  const isDusk = (hour >= 18 && hour < 20) || (hour >= 6 && hour < 8);

  this.ctx.fillStyle = isNight ? '#1a1a3e' : isDusk ? '#FF8C42' : '#87CEEB';
  this.ctx.fillRect(windowItem.x + 4, windowItem.y + 4, 40, 30);

  if (isNight) {
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(windowItem.x + 12, windowItem.y + 10, 2, 2);
    this.ctx.fillRect(windowItem.x + 28, windowItem.y + 16, 2, 2);
    this.ctx.fillRect(windowItem.x + 20, windowItem.y + 8, 2, 2);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/room/room-renderer.js
git commit -m "feat: upgrade room renderer with sprite drawing, hover glow, and day/night window"
```

---

### Task 4: Extend room state with add/remove

**Files:**
- Modify: `rhinosaurus-connect/popup/room/room-state.js`

- [ ] **Step 1: Add addFurniture, removeFurniture, and isEssential**

```js
// Add to RoomState class:
static ESSENTIAL_TYPES = ['bed', 'tv', 'desk', 'calendar', 'makeup_stand'];
static MAX_FURNITURE = 30;

addFurniture(item) {
  if (this.furniture.length >= RoomState.MAX_FURNITURE) {
    return false;
  }
  this.furniture.push(item);
  this.isDirty = true;
  return true;
}

removeFurniture(furnitureId) {
  const item = this.furniture.find(f => f.id === furnitureId);
  if (!item) return false;
  if (RoomState.ESSENTIAL_TYPES.includes(item.type)) return false;
  this.furniture = this.furniture.filter(f => f.id !== furnitureId);
  this.isDirty = true;
  return true;
}

isEssential(furnitureId) {
  const item = this.furniture.find(f => f.id === furnitureId);
  return item ? RoomState.ESSENTIAL_TYPES.includes(item.type) : false;
}

getFurnitureById(furnitureId) {
  return this.furniture.find(f => f.id === furnitureId) || null;
}
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/room/room-state.js
git commit -m "feat: extend room state with add/remove furniture and essential protection"
```

---

### Task 5: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 1B shared bedroom rendering and sync complete"
```

---

## Summary

After Phase 1B:
- **SpriteLoader** loads sprite sheets and extracts frames for furniture rendering
- **RoomSync** broadcasts changes instantly via Realtime, debounces DB writes every 2 seconds
- **Room renderer** draws sprites (with colored rect fallback), hover glow on interactive items, day/night window cycle
- **Room state** extended with add/remove furniture, 30-item cap, essential item protection
