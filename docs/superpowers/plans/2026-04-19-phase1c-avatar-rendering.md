# Phase 1C: Avatar Rendering & Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the avatar animation system with 8 states, drag-to-move, auto-movement to room positions, and speech bubble rendering with queue management.

**Architecture:** AvatarAnimator handles sprite sheet frame selection and state transitions. AvatarController manages drag input and auto-movement interpolation. SpeechBubble renders pixel-art bubbles with fade timing and queuing. All integrate into RoomRenderer's depth-sorted draw loop.

**Tech Stack:** HTML5 Canvas, sprite sheet animation

---

### Task 1: Avatar animator (state machine + frame advancement)

**Files:**
- Create: `rhinosaurus-connect/popup/room/avatar-animator.js`
- Test: `rhinosaurus-connect/tests/popup/room/avatar-animator.test.js`

- [ ] **Step 1: Write test for avatar animator**

```js
// rhinosaurus-connect/tests/popup/room/avatar-animator.test.js
import { describe, it, expect, vi } from 'vitest';
import { AvatarAnimator } from '../../../popup/room/avatar-animator.js';

describe('AvatarAnimator', () => {
  it('starts in idle state', () => {
    const animator = new AvatarAnimator();
    expect(animator.currentState).toBe('idle');
    expect(animator.currentFrame).toBe(0);
  });

  it('sets state and resets frame', () => {
    const animator = new AvatarAnimator();
    animator.setState('heart_eyes');
    expect(animator.currentState).toBe('heart_eyes');
    expect(animator.currentFrame).toBe(0);
  });

  it('advances frames on update', () => {
    const animator = new AvatarAnimator();
    animator.setState('idle');
    animator.update(34); // ~1 frame at 30fps
    expect(animator.currentFrame).toBe(1);
  });

  it('loops looping animations', () => {
    const animator = new AvatarAnimator();
    animator.setState('idle'); // 4 frames, looping
    for (let i = 0; i < 5; i++) animator.update(34);
    expect(animator.currentFrame).toBe(1); // wraps 4→0→1
  });

  it('returns to idle after non-looping animation completes', () => {
    const animator = new AvatarAnimator();
    animator.setState('heart_eyes'); // 6 frames, not looping
    for (let i = 0; i < 7; i++) animator.update(34);
    expect(animator.currentState).toBe('idle');
  });

  it('calls onComplete callback for non-looping animations', () => {
    const animator = new AvatarAnimator();
    const callback = vi.fn();
    animator.onAnimationComplete = callback;
    animator.setState('waving'); // 6 frames, not looping
    for (let i = 0; i < 7; i++) animator.update(34);
    expect(callback).toHaveBeenCalledWith('waving');
  });

  it('draws current frame from sprite sheet', () => {
    const ctx = { drawImage: vi.fn() };
    const animator = new AvatarAnimator();
    const mockSheet = { width: 256, height: 384 };
    animator.spriteSheet = mockSheet;
    animator.draw(ctx, 100, 200, 3);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('reports correct animation state info', () => {
    const animator = new AvatarAnimator();
    expect(animator.isLooping()).toBe(true);
    animator.setState('heart_eyes');
    expect(animator.isLooping()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/avatar-animator.test.js`
Expected: FAIL

- [ ] **Step 3: Implement avatar-animator.js**

```js
// rhinosaurus-connect/popup/room/avatar-animator.js
import { ANIMATION_STATES, AVATAR_SIZE } from '../../shared/constants.js';

const FRAME_DURATION_MS = 33; // ~30fps

export class AvatarAnimator {
  constructor() {
    this.spriteSheet = null;
    this.currentState = 'idle';
    this.currentFrame = 0;
    this.elapsed = 0;
    this.onAnimationComplete = null;
  }

  setState(state) {
    if (!ANIMATION_STATES[state]) return;
    this.currentState = state;
    this.currentFrame = 0;
    this.elapsed = 0;
  }

  isLooping() {
    return ANIMATION_STATES[this.currentState]?.looping ?? true;
  }

  update(deltaMs) {
    this.elapsed += deltaMs;
    if (this.elapsed < FRAME_DURATION_MS) return;

    this.elapsed -= FRAME_DURATION_MS;
    const stateData = ANIMATION_STATES[this.currentState];
    if (!stateData) return;

    this.currentFrame++;

    if (this.currentFrame >= stateData.frames) {
      if (stateData.looping) {
        this.currentFrame = 0;
      } else {
        const completedState = this.currentState;
        this.setState('idle');
        if (this.onAnimationComplete) {
          this.onAnimationComplete(completedState);
        }
      }
    }
  }

  draw(ctx, x, y, scale) {
    if (!this.spriteSheet) return;

    const { width: fw, height: fh } = AVATAR_SIZE;
    const stateIndex = Object.keys(ANIMATION_STATES).indexOf(this.currentState);
    const sx = this.currentFrame * fw;
    const sy = stateIndex * fh;

    ctx.drawImage(this.spriteSheet, sx, sy, fw, fh, x, y, fw * scale, fh * scale);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/avatar-animator.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/avatar-animator.js rhinosaurus-connect/tests/popup/room/avatar-animator.test.js
git commit -m "feat: add avatar animator with 8-state machine and frame advancement"
```

---

### Task 2: Avatar controller (drag + auto-movement)

**Files:**
- Create: `rhinosaurus-connect/popup/room/avatar-controller.js`
- Test: `rhinosaurus-connect/tests/popup/room/avatar-controller.test.js`

- [ ] **Step 1: Write test for avatar controller**

```js
// rhinosaurus-connect/tests/popup/room/avatar-controller.test.js
import { describe, it, expect, vi } from 'vitest';
import { AvatarController } from '../../../popup/room/avatar-controller.js';

describe('AvatarController', () => {
  it('stores current position', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    expect(ctrl.x).toBe(100);
    expect(ctrl.y).toBe(200);
  });

  it('calculates movement towards target', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(0, 0);
    ctrl.moveTo(100, 0);
    expect(ctrl.isMoving).toBe(true);
    ctrl.update();
    expect(ctrl.x).toBeGreaterThan(0);
  });

  it('stops when reaching target', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(0, 0);
    ctrl.moveTo(4, 0);
    for (let i = 0; i < 10; i++) ctrl.update();
    expect(ctrl.isMoving).toBe(false);
    expect(ctrl.x).toBe(4);
    expect(ctrl.y).toBe(0);
  });

  it('moves at 2px per update', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(0, 0);
    ctrl.moveTo(100, 0);
    ctrl.update();
    expect(ctrl.x).toBeCloseTo(2, 0);
  });

  it('saves previous position for return', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    ctrl.moveTo(50, 50, true);
    expect(ctrl.previousPosition).toEqual({ x: 100, y: 200 });
  });

  it('returns to previous position', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    ctrl.moveTo(50, 50, true);
    ctrl.returnToPrevious();
    expect(ctrl.targetX).toBe(100);
    expect(ctrl.targetY).toBe(200);
  });

  it('handles drag start/move/end', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    ctrl.startDrag(100, 200);
    expect(ctrl.isDragging).toBe(true);
    ctrl.drag(120, 220);
    expect(ctrl.x).toBe(120);
    expect(ctrl.y).toBe(220);
    ctrl.endDrag();
    expect(ctrl.isDragging).toBe(false);
  });

  it('checks if a point hits the avatar', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    expect(ctrl.hitTest(110, 210, 3)).toBe(true);
    expect(ctrl.hitTest(0, 0, 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/avatar-controller.test.js`
Expected: FAIL

- [ ] **Step 3: Implement avatar-controller.js**

```js
// rhinosaurus-connect/popup/room/avatar-controller.js
import { AVATAR_SIZE } from '../../shared/constants.js';

const MOVE_SPEED = 2;

export class AvatarController {
  constructor(userId) {
    this.userId = userId;
    this.x = 0;
    this.y = 0;
    this.targetX = null;
    this.targetY = null;
    this.isMoving = false;
    this.isDragging = false;
    this.previousPosition = null;
    this.onPositionChange = null;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  moveTo(x, y, savePrevious = false) {
    if (savePrevious) {
      this.previousPosition = { x: this.x, y: this.y };
    }
    this.targetX = x;
    this.targetY = y;
    this.isMoving = true;
  }

  returnToPrevious() {
    if (this.previousPosition) {
      this.moveTo(this.previousPosition.x, this.previousPosition.y);
      this.previousPosition = null;
    }
  }

  update() {
    if (!this.isMoving || this.isDragging) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= MOVE_SPEED) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.isMoving = false;
      this.targetX = null;
      this.targetY = null;
      if (this.onPositionChange) this.onPositionChange(this.x, this.y);
      return;
    }

    this.x += (dx / dist) * MOVE_SPEED;
    this.y += (dy / dist) * MOVE_SPEED;
  }

  startDrag(x, y) {
    this.isDragging = true;
    this.isMoving = false;
  }

  drag(x, y) {
    if (!this.isDragging) return;
    this.x = x;
    this.y = y;
  }

  endDrag() {
    this.isDragging = false;
    if (this.onPositionChange) this.onPositionChange(this.x, this.y);
  }

  hitTest(px, py, scale) {
    const w = AVATAR_SIZE.width * scale;
    const h = AVATAR_SIZE.height * scale;
    return px >= this.x && px <= this.x + w && py >= this.y && py <= this.y + h;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/avatar-controller.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/avatar-controller.js rhinosaurus-connect/tests/popup/room/avatar-controller.test.js
git commit -m "feat: add avatar controller with drag, auto-movement, and return-to-previous"
```

---

### Task 3: Speech bubble renderer

**Files:**
- Create: `rhinosaurus-connect/popup/room/speech-bubble.js`
- Test: `rhinosaurus-connect/tests/popup/room/speech-bubble.test.js`

- [ ] **Step 1: Write test for speech bubble**

```js
// rhinosaurus-connect/tests/popup/room/speech-bubble.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechBubble, SpeechBubbleQueue } from '../../../popup/room/speech-bubble.js';

describe('SpeechBubble', () => {
  it('starts in fade-in phase', () => {
    const bubble = new SpeechBubble('hello', 100, 200);
    expect(bubble.phase).toBe('fade_in');
    expect(bubble.opacity).toBe(0);
  });

  it('transitions through phases: fade_in → visible → fade_out → done', () => {
    const bubble = new SpeechBubble('hello', 100, 200);
    bubble.update(250); // past 200ms fade in
    expect(bubble.phase).toBe('visible');

    bubble.update(5100); // past 5s visible
    expect(bubble.phase).toBe('fade_out');

    bubble.update(600); // past 500ms fade out
    expect(bubble.isDone()).toBe(true);
  });

  it('calculates opacity during fade_in', () => {
    const bubble = new SpeechBubble('hello', 100, 200);
    bubble.update(100); // halfway through 200ms fade
    expect(bubble.opacity).toBeCloseTo(0.5, 1);
  });

  it('truncates long text', () => {
    const longText = 'a'.repeat(100);
    const bubble = new SpeechBubble(longText, 100, 200);
    expect(bubble.displayText.length).toBeLessThanOrEqual(53);
  });

  it('draws to canvas context', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 40 })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      globalAlpha: 1,
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    const bubble = new SpeechBubble('hello', 100, 200);
    bubble.phase = 'visible';
    bubble.opacity = 1;
    bubble.draw(ctx);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

describe('SpeechBubbleQueue', () => {
  it('starts empty', () => {
    const queue = new SpeechBubbleQueue();
    expect(queue.active).toBeNull();
    expect(queue.pending).toHaveLength(0);
  });

  it('immediately shows first bubble', () => {
    const queue = new SpeechBubbleQueue();
    queue.add('hello', 100, 200);
    expect(queue.active).not.toBeNull();
    expect(queue.active.text).toBe('hello');
  });

  it('queues subsequent bubbles', () => {
    const queue = new SpeechBubbleQueue();
    queue.add('hello', 100, 200);
    queue.add('world', 100, 200);
    expect(queue.pending).toHaveLength(1);
  });

  it('shows next bubble after gap when current finishes', () => {
    vi.useFakeTimers();
    const queue = new SpeechBubbleQueue();
    queue.add('hello', 100, 200);
    queue.add('world', 100, 200);

    // Finish first bubble
    queue.active.phase = 'done';
    queue.update(0);

    // Wait for 1s gap
    vi.advanceTimersByTime(1100);
    queue.update(0);

    expect(queue.active).not.toBeNull();
    expect(queue.active.text).toBe('world');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/speech-bubble.test.js`
Expected: FAIL

- [ ] **Step 3: Implement speech-bubble.js**

```js
// rhinosaurus-connect/popup/room/speech-bubble.js
const FADE_IN_MS = 200;
const VISIBLE_MS = 5000;
const FADE_OUT_MS = 500;
const MAX_TEXT_LENGTH = 50;
const GAP_MS = 1000;

export class SpeechBubble {
  constructor(text, x, y) {
    this.text = text;
    this.displayText = text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) + '...' : text;
    this.x = x;
    this.y = y;
    this.phase = 'fade_in';
    this.opacity = 0;
    this.phaseElapsed = 0;
  }

  update(deltaMs) {
    this.phaseElapsed += deltaMs;

    switch (this.phase) {
      case 'fade_in':
        this.opacity = Math.min(1, this.phaseElapsed / FADE_IN_MS);
        if (this.phaseElapsed >= FADE_IN_MS) {
          this.phase = 'visible';
          this.phaseElapsed = 0;
        }
        break;
      case 'visible':
        this.opacity = 1;
        if (this.phaseElapsed >= VISIBLE_MS) {
          this.phase = 'fade_out';
          this.phaseElapsed = 0;
        }
        break;
      case 'fade_out':
        this.opacity = Math.max(0, 1 - this.phaseElapsed / FADE_OUT_MS);
        if (this.phaseElapsed >= FADE_OUT_MS) {
          this.phase = 'done';
        }
        break;
    }
  }

  isDone() {
    return this.phase === 'done';
  }

  draw(ctx) {
    if (this.phase === 'done') return;

    ctx.save();
    ctx.globalAlpha = this.opacity;

    const padding = 6;
    ctx.font = '8px monospace';
    const textWidth = ctx.measureText(this.displayText).width;
    const bubbleWidth = Math.min(textWidth + padding * 2, 120);
    const bubbleHeight = 18;
    const bx = this.x + 10;
    const by = this.y - 20;

    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(bx, by, bubbleWidth, bubbleHeight);

    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(bx + 8, by + bubbleHeight);
    ctx.lineTo(bx + 4, by + bubbleHeight + 6);
    ctx.lineTo(bx + 14, by + bubbleHeight);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.displayText, bx + padding, by + bubbleHeight / 2);

    ctx.restore();
  }
}

export class SpeechBubbleQueue {
  constructor() {
    this.active = null;
    this.pending = [];
    this.gapTimer = 0;
    this.waitingForGap = false;
  }

  add(text, x, y) {
    const bubble = new SpeechBubble(text, x, y);
    if (!this.active) {
      this.active = bubble;
    } else {
      this.pending.push(bubble);
    }
  }

  update(deltaMs) {
    if (this.active) {
      this.active.update(deltaMs);
      if (this.active.isDone()) {
        this.active = null;
        if (this.pending.length > 0) {
          this.waitingForGap = true;
          this.gapTimer = 0;
        }
      }
    }

    if (this.waitingForGap) {
      this.gapTimer += deltaMs;
      if (this.gapTimer >= GAP_MS && this.pending.length > 0) {
        this.active = this.pending.shift();
        this.waitingForGap = false;
      }
    }
  }

  draw(ctx) {
    if (this.active) this.active.draw(ctx);
  }

  clear() {
    this.active = null;
    this.pending = [];
    this.waitingForGap = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/speech-bubble.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/speech-bubble.js rhinosaurus-connect/tests/popup/room/speech-bubble.test.js
git commit -m "feat: add speech bubble with fade timing, truncation, and queue management"
```

---

### Task 4: Integrate avatars into room renderer

**Files:**
- Modify: `rhinosaurus-connect/popup/room/room-renderer.js`

- [ ] **Step 1: Add avatar drawing to render loop**

Add to RoomRenderer:

```js
// In constructor:
this.avatars = new Map(); // userId → { animator, controller, bubbleQueue }

// New method:
addAvatar(userId, animator, controller) {
  this.avatars.set(userId, {
    animator,
    controller,
    bubbleQueue: new SpeechBubbleQueue(),
  });
}

// Modify renderFrame to include avatars in depth sort:
renderFrame() {
  if (!this.dirty) return;
  this.dirty = false;

  const { width, height } = ROOM_DIMENSIONS;
  this.ctx.clearRect(0, 0, width, height);

  this.drawFloor();
  this.drawWalls();

  // Merge furniture and avatars for depth sorting
  const drawables = [];
  for (const item of this.roomState.furniture) {
    drawables.push({ type: 'furniture', data: item, y: item.y });
  }
  for (const [userId, avatar] of this.avatars) {
    drawables.push({ type: 'avatar', data: avatar, userId, y: avatar.controller.y });
  }
  drawables.sort((a, b) => a.y - b.y);

  for (const d of drawables) {
    if (d.type === 'furniture') {
      this.drawFurnitureItem(d.data);
    } else {
      this.drawAvatar(d.data);
    }
  }

  for (const effect of this.effectLayers) {
    effect.draw(this.ctx);
  }
}

drawAvatar(avatar) {
  const { animator, controller, bubbleQueue } = avatar;
  const scale = 3;
  animator.draw(this.ctx, controller.x, controller.y, scale);
  bubbleQueue.draw(this.ctx);
}
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/room/room-renderer.js
git commit -m "feat: integrate avatars into room renderer with depth-sorted drawing"
```

---

### Task 5: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 1C avatar rendering and animations complete"
```

---

## Summary

After Phase 1C:
- **AvatarAnimator**: 8-state machine, frame advancement at 30fps, auto-return to idle for non-looping
- **AvatarController**: drag-to-move, auto-movement at 2px/frame, save/return previous position
- **SpeechBubble**: pixel-art bubble with fade in/visible/fade out phases, 50-char truncation
- **SpeechBubbleQueue**: sequential display with 1-second gap between bubbles
- **Room renderer**: depth-sorted rendering of furniture + avatars together
