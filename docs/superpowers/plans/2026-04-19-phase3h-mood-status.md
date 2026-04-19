# Phase 3H: Mood Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement mood selection (7 moods) with a toolbar dropdown, pixel-art mood bubble above avatars, real-time sync via Realtime broadcast, and database persistence on the users table.

**Architecture:** MoodDropdown renders the emoji grid as an HTML overlay triggered by the toolbar mood button. MoodBubble draws a pixel-art bubble above the avatar on canvas using pre-rendered mood sprites (not system emoji). MoodHandler coordinates DB writes, Realtime broadcasts, and dropdown/bubble state.

**Tech Stack:** HTML5 Canvas (mood bubble rendering), Supabase (users.mood column, Realtime broadcast)

---

### Task 1: Mood dropdown UI

**Files:**
- Create: `rhinosaurus-connect/popup/mood/mood-dropdown.js`
- Test: `rhinosaurus-connect/tests/popup/mood/mood-dropdown.test.js`

- [ ] **Step 1: Write test for mood dropdown**

```js
// rhinosaurus-connect/tests/popup/mood/mood-dropdown.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MoodDropdown } from '../../../popup/mood/mood-dropdown.js';

describe('MoodDropdown', () => {
  let dropdown;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dropdown = new MoodDropdown(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts closed', () => {
    expect(dropdown.isOpen).toBe(false);
  });

  it('renders 7 mood options', () => {
    dropdown.render();
    const buttons = container.querySelectorAll('.mood-option');
    expect(buttons.length).toBe(7);
  });

  it('opens and shows dropdown', () => {
    dropdown.render();
    dropdown.open();
    expect(dropdown.isOpen).toBe(true);
    expect(container.querySelector('.mood-dropdown').classList.contains('hidden')).toBe(false);
  });

  it('closes dropdown', () => {
    dropdown.render();
    dropdown.open();
    dropdown.close();
    expect(dropdown.isOpen).toBe(false);
  });

  it('toggles open/close', () => {
    dropdown.render();
    dropdown.toggle();
    expect(dropdown.isOpen).toBe(true);
    dropdown.toggle();
    expect(dropdown.isOpen).toBe(false);
  });

  it('calls onSelect when mood is clicked', () => {
    const callback = vi.fn();
    dropdown.onSelect = callback;
    dropdown.render();
    dropdown.open();
    const firstOption = container.querySelector('.mood-option');
    firstOption.click();
    expect(callback).toHaveBeenCalledWith('happy');
  });

  it('clears mood when same mood is clicked', () => {
    const callback = vi.fn();
    dropdown.onSelect = callback;
    dropdown.currentMood = 'happy';
    dropdown.render();
    dropdown.open();
    const happyBtn = container.querySelector('[data-mood="happy"]');
    happyBtn.click();
    expect(callback).toHaveBeenCalledWith(null);
  });

  it('highlights current mood', () => {
    dropdown.currentMood = 'sad';
    dropdown.render();
    const sadBtn = container.querySelector('[data-mood="sad"]');
    expect(sadBtn.classList.contains('mood-option-active')).toBe(true);
  });

  it('closes on Escape key', () => {
    dropdown.render();
    dropdown.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dropdown.isOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/mood/mood-dropdown.test.js`
Expected: FAIL

- [ ] **Step 3: Implement mood-dropdown.js**

```js
// rhinosaurus-connect/popup/mood/mood-dropdown.js
import { MOOD_OPTIONS } from '../../shared/constants.js';

export class MoodDropdown {
  constructor(container) {
    this.container = container;
    this.isOpen = false;
    this.currentMood = null;
    this.onSelect = null;
    this.dropdownEl = null;
    this.escHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
  }

  render() {
    if (this.dropdownEl) this.dropdownEl.remove();

    this.dropdownEl = document.createElement('div');
    this.dropdownEl.className = 'mood-dropdown hidden';

    const grid = document.createElement('div');
    grid.className = 'mood-grid';

    for (const mood of MOOD_OPTIONS) {
      const btn = document.createElement('button');
      btn.className = 'mood-option';
      btn.dataset.mood = mood.key;
      btn.textContent = mood.emoji;
      btn.title = mood.label;

      if (this.currentMood === mood.key) {
        btn.classList.add('mood-option-active');
      }

      btn.addEventListener('click', () => {
        const newMood = this.currentMood === mood.key ? null : mood.key;
        this.currentMood = newMood;
        if (this.onSelect) this.onSelect(newMood);
        this.close();
      });

      grid.appendChild(btn);
    }

    this.dropdownEl.appendChild(grid);
    this.container.appendChild(this.dropdownEl);
  }

  open() {
    if (!this.dropdownEl) this.render();
    this.isOpen = true;
    this.dropdownEl.classList.remove('hidden');
    document.addEventListener('keydown', this.escHandler);
  }

  close() {
    this.isOpen = false;
    if (this.dropdownEl) this.dropdownEl.classList.add('hidden');
    document.removeEventListener('keydown', this.escHandler);
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setCurrentMood(mood) {
    this.currentMood = mood;
    if (this.dropdownEl) {
      this.render();
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.escHandler);
    if (this.dropdownEl) this.dropdownEl.remove();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/mood/mood-dropdown.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/mood/mood-dropdown.js rhinosaurus-connect/tests/popup/mood/mood-dropdown.test.js
git commit -m "feat: add mood dropdown with emoji grid, toggle, and Escape dismiss"
```

---

### Task 2: Mood bubble renderer (canvas)

**Files:**
- Create: `rhinosaurus-connect/popup/mood/mood-bubble.js`
- Test: `rhinosaurus-connect/tests/popup/mood/mood-bubble.test.js`

- [ ] **Step 1: Write test for mood bubble**

```js
// rhinosaurus-connect/tests/popup/mood/mood-bubble.test.js
import { describe, it, expect, vi } from 'vitest';
import { MoodBubble } from '../../../popup/mood/mood-bubble.js';

describe('MoodBubble', () => {
  it('does not draw when mood is null', () => {
    const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn() };
    const bubble = new MoodBubble();
    bubble.draw(ctx, 100, 200, null);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('draws bubble background at correct position', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      globalAlpha: 1,
    };
    const bubble = new MoodBubble();
    bubble.draw(ctx, 100, 200, 'happy');
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('draws mood sprite when available', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      globalAlpha: 1,
    };
    const mockSheet = { width: 112, height: 16 };
    const bubble = new MoodBubble();
    bubble.setSpriteSheet(mockSheet);
    bubble.draw(ctx, 100, 200, 'happy');
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('calculates bubble position above avatar', () => {
    const bubble = new MoodBubble();
    const pos = bubble.getPosition(100, 200);
    expect(pos.x).toBe(110);
    expect(pos.y).toBe(180);
  });

  it('animates transition with fade', () => {
    const bubble = new MoodBubble();
    bubble.setMood('happy');
    expect(bubble.transitioning).toBe(true);
    expect(bubble.opacity).toBeLessThan(1);
  });

  it('completes transition over time', () => {
    const bubble = new MoodBubble();
    bubble.setMood('happy');
    for (let i = 0; i < 10; i++) bubble.update(50);
    expect(bubble.opacity).toBeCloseTo(1, 0);
    expect(bubble.transitioning).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/mood/mood-bubble.test.js`
Expected: FAIL

- [ ] **Step 3: Implement mood-bubble.js**

```js
// rhinosaurus-connect/popup/mood/mood-bubble.js
import { MOOD_OPTIONS } from '../../shared/constants.js';

const BUBBLE_WIDTH = 20;
const BUBBLE_HEIGHT = 16;
const SPRITE_SIZE = 16;
const FADE_DURATION_MS = 300;

export class MoodBubble {
  constructor() {
    this.spriteSheet = null;
    this.currentMood = null;
    this.opacity = 1;
    this.transitioning = false;
    this.fadeElapsed = 0;
  }

  setSpriteSheet(sheet) {
    this.spriteSheet = sheet;
  }

  setMood(mood) {
    this.currentMood = mood;
    if (mood) {
      this.transitioning = true;
      this.fadeElapsed = 0;
      this.opacity = 0;
    }
  }

  update(deltaMs) {
    if (!this.transitioning) return;
    this.fadeElapsed += deltaMs;
    this.opacity = Math.min(1, this.fadeElapsed / FADE_DURATION_MS);
    if (this.fadeElapsed >= FADE_DURATION_MS) {
      this.transitioning = false;
      this.opacity = 1;
    }
  }

  getPosition(avatarX, avatarY) {
    return {
      x: avatarX + 10,
      y: avatarY - 20,
    };
  }

  draw(ctx, avatarX, avatarY, mood) {
    if (!mood) return;

    const pos = this.getPosition(avatarX, avatarY);
    ctx.save();
    ctx.globalAlpha = this.opacity;

    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(pos.x, pos.y, BUBBLE_WIDTH, BUBBLE_HEIGHT);

    if (this.spriteSheet) {
      const moodIndex = MOOD_OPTIONS.findIndex(m => m.key === mood);
      if (moodIndex >= 0) {
        ctx.drawImage(
          this.spriteSheet,
          moodIndex * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE,
          pos.x + 2, pos.y, SPRITE_SIZE, SPRITE_SIZE
        );
      }
    }

    ctx.restore();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/mood/mood-bubble.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/mood/mood-bubble.js rhinosaurus-connect/tests/popup/mood/mood-bubble.test.js
git commit -m "feat: add mood bubble renderer with sprite sheet and fade transition"
```

---

### Task 3: Mood handler (DB + Realtime)

**Files:**
- Create: `rhinosaurus-connect/popup/mood/mood-handler.js`
- Test: `rhinosaurus-connect/tests/popup/mood/mood-handler.test.js`

- [ ] **Step 1: Write test for mood handler**

```js
// rhinosaurus-connect/tests/popup/mood/mood-handler.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MoodHandler } from '../../../popup/mood/mood-handler.js';

describe('MoodHandler', () => {
  let handler;
  let mockSupabase;
  let mockChannel;

  beforeEach(() => {
    mockChannel = { send: vi.fn() };
    mockSupabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    };
    handler = new MoodHandler(mockSupabase, 'user-1', mockChannel);
  });

  it('starts with no mood', () => {
    expect(handler.currentMood).toBeNull();
  });

  it('sets mood and updates DB', async () => {
    await handler.setMood('happy');
    expect(handler.currentMood).toBe('happy');
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
  });

  it('broadcasts mood update', async () => {
    await handler.setMood('sad');
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'mood_update',
      payload: { user_id: 'user-1', mood: 'sad' },
    });
  });

  it('clears mood with null', async () => {
    await handler.setMood('happy');
    await handler.setMood(null);
    expect(handler.currentMood).toBeNull();
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'mood_update',
      payload: { user_id: 'user-1', mood: null },
    });
  });

  it('handles partner mood update', () => {
    const callback = vi.fn();
    handler.onPartnerMoodChange = callback;
    handler.handlePartnerMood('partner-1', 'excited');
    expect(callback).toHaveBeenCalledWith('partner-1', 'excited');
  });

  it('loads initial mood', () => {
    handler.loadInitialMood('cozy');
    expect(handler.currentMood).toBe('cozy');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/mood/mood-handler.test.js`
Expected: FAIL

- [ ] **Step 3: Implement mood-handler.js**

```js
// rhinosaurus-connect/popup/mood/mood-handler.js
import { REALTIME_EVENTS } from '../../shared/constants.js';

export class MoodHandler {
  constructor(supabase, userId, channel) {
    this.supabase = supabase;
    this.userId = userId;
    this.channel = channel;
    this.currentMood = null;
    this.onPartnerMoodChange = null;
  }

  loadInitialMood(mood) {
    this.currentMood = mood;
  }

  async setMood(mood) {
    this.currentMood = mood;

    await this.supabase
      .from('users')
      .update({ mood })
      .eq('id', this.userId);

    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.MOOD_UPDATE,
      payload: { user_id: this.userId, mood },
    });
  }

  handlePartnerMood(partnerId, mood) {
    if (this.onPartnerMoodChange) {
      this.onPartnerMoodChange(partnerId, mood);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/mood/mood-handler.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/mood/mood-handler.js rhinosaurus-connect/tests/popup/mood/mood-handler.test.js
git commit -m "feat: add mood handler with DB persistence and Realtime broadcast"
```

---

### Task 4: Wire mood into popup

**Files:**
- Modify: `rhinosaurus-connect/popup/popup.js`

- [ ] **Step 1: Add mood integration to popup.js**

```js
// Add imports:
import { MoodDropdown } from './mood/mood-dropdown.js';
import { MoodBubble } from './mood/mood-bubble.js';
import { MoodHandler } from './mood/mood-handler.js';
import { MOOD_OPTIONS } from '../shared/constants.js';

// In init():
let moodDropdown = null;
let moodHandler = null;
const moodBubbles = new Map(); // userId → MoodBubble

async function setupMood(supabase, userId, channel, initialMood) {
  moodHandler = new MoodHandler(supabase, userId, channel);
  moodHandler.loadInitialMood(initialMood);

  const moodBtnContainer = document.getElementById('toolbar');
  moodDropdown = new MoodDropdown(moodBtnContainer);
  moodDropdown.currentMood = initialMood;
  moodDropdown.render();

  moodDropdown.onSelect = async (mood) => {
    await moodHandler.setMood(mood);
    const moodIcon = document.getElementById('mood-icon');
    const moodOption = MOOD_OPTIONS.find(m => m.key === mood);
    moodIcon.textContent = moodOption ? moodOption.emoji : '😶';

    const myBubble = moodBubbles.get(userId);
    if (myBubble) myBubble.setMood(mood);
    renderer.markDirty();
  };

  moodHandler.onPartnerMoodChange = (partnerId, mood) => {
    let bubble = moodBubbles.get(partnerId);
    if (!bubble) {
      bubble = new MoodBubble();
      moodBubbles.set(partnerId, bubble);
    }
    bubble.setMood(mood);
    renderer.markDirty();
  };

  channel.on('broadcast', { event: 'mood_update' }, (payload) => {
    const { user_id, mood } = payload.payload;
    if (user_id !== userId) {
      moodHandler.handlePartnerMood(user_id, mood);
    }
  });
}

// Mood button handler:
document.getElementById('mood-btn').addEventListener('click', () => {
  if (moodDropdown) moodDropdown.toggle();
});
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/popup.js
git commit -m "feat: wire mood dropdown, bubble, and handler into popup"
```

---

### Task 5: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 3H mood status complete"
```

---

## Summary

After Phase 3H:
- **MoodDropdown**: 7-emoji grid overlay, toggle open/close, Escape dismiss, current mood highlight, click-to-toggle-off
- **MoodBubble**: pixel-art bubble above avatar using sprite sheet (16x16 per mood), 300ms fade-in transition
- **MoodHandler**: updates users.mood in DB, broadcasts via Realtime, handles partner mood changes
- **Popup integration**: toolbar mood button with emoji icon, dropdown wired to handler, Realtime listener for partner updates
