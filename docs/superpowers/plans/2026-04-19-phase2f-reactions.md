# Phase 2F: Reactions (Hearts & Kisses) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one-tap heart and kiss reactions with avatar animations, particle effects, speech bubbles, throttling, and offline batch delivery.

**Architecture:** ReactionHandler coordinates sending (throttled), receiving (animation trigger), and offline batch summary. ReactionParticle and ReactionParticleSystem handle the floating heart/kiss pixel art effects. The toolbar buttons fire reactions through MessageService (type: heart/kiss), broadcast via Realtime for instant delivery, and persist to the messages table for offline queuing.

**Tech Stack:** HTML5 Canvas (particle system), Supabase (messages table, Realtime broadcast)

---

### Task 1: Reaction particle system

**Files:**
- Create: `rhinosaurus-connect/popup/room/reaction-particles.js`
- Test: `rhinosaurus-connect/tests/popup/room/reaction-particles.test.js`

- [ ] **Step 1: Write test for reaction particles**

```js
// rhinosaurus-connect/tests/popup/room/reaction-particles.test.js
import { describe, it, expect, vi } from 'vitest';
import { ReactionParticle, ReactionParticleSystem } from '../../../popup/room/reaction-particles.js';

describe('ReactionParticle', () => {
  it('initializes with position and type', () => {
    const p = new ReactionParticle('heart', 100, 200);
    expect(p.type).toBe('heart');
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
    expect(p.opacity).toBe(1);
  });

  it('moves upward and drifts on update', () => {
    const p = new ReactionParticle('heart', 100, 200);
    const startY = p.y;
    p.update();
    expect(p.y).toBeLessThan(startY);
    expect(p.opacity).toBeLessThan(1);
  });

  it('is dead when opacity reaches zero', () => {
    const p = new ReactionParticle('heart', 100, 200);
    p.opacity = 0.01;
    p.update();
    expect(p.isDead()).toBe(true);
  });

  it('draws to canvas context', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      globalAlpha: 1,
      font: '',
      textAlign: '',
    };
    const p = new ReactionParticle('heart', 100, 200);
    p.draw(ctx);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe('ReactionParticleSystem', () => {
  it('starts with no particles', () => {
    const sys = new ReactionParticleSystem();
    expect(sys.particles).toHaveLength(0);
  });

  it('spawns 3-5 particles for heart', () => {
    const sys = new ReactionParticleSystem();
    sys.spawnHearts(100, 200);
    expect(sys.particles.length).toBeGreaterThanOrEqual(3);
    expect(sys.particles.length).toBeLessThanOrEqual(5);
  });

  it('spawns 1 particle for kiss', () => {
    const sys = new ReactionParticleSystem();
    sys.spawnKiss(100, 200, 200, 200);
    expect(sys.particles.length).toBe(1);
  });

  it('removes dead particles on update', () => {
    const sys = new ReactionParticleSystem();
    sys.spawnHearts(100, 200);
    for (const p of sys.particles) p.opacity = 0;
    sys.update();
    expect(sys.particles).toHaveLength(0);
  });

  it('caps particles at 10', () => {
    const sys = new ReactionParticleSystem();
    for (let i = 0; i < 20; i++) sys.spawnHearts(100, 200);
    expect(sys.particles.length).toBeLessThanOrEqual(10);
  });

  it('reports active state', () => {
    const sys = new ReactionParticleSystem();
    expect(sys.isActive()).toBe(false);
    sys.spawnHearts(100, 200);
    expect(sys.isActive()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/reaction-particles.test.js`
Expected: FAIL

- [ ] **Step 3: Implement reaction-particles.js**

```js
// rhinosaurus-connect/popup/room/reaction-particles.js
const MAX_PARTICLES = 10;
const HEART_SPAWN_MIN = 3;
const HEART_SPAWN_MAX = 5;

export class ReactionParticle {
  constructor(type, startX, startY) {
    this.type = type;
    this.x = startX;
    this.y = startY;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = -1.5;
    this.opacity = 1;
    this.scale = 0.5 + Math.random() * 0.5;
    this.targetX = null;
    this.targetY = null;
    this.t = 0;
    this.startX = startX;
    this.startY = startY;
  }

  setTarget(tx, ty) {
    this.targetX = tx;
    this.targetY = ty;
  }

  update() {
    if (this.targetX !== null && this.targetY !== null) {
      this.t += 0.03;
      const t = Math.min(this.t, 1);
      const cpY = Math.min(this.startY, this.targetY) - 40;
      this.x = (1 - t) * (1 - t) * this.startX + 2 * (1 - t) * t * ((this.startX + this.targetX) / 2) + t * t * this.targetX;
      this.y = (1 - t) * (1 - t) * this.startY + 2 * (1 - t) * t * cpY + t * t * this.targetY;
      if (t >= 1) this.opacity = 0;
    } else {
      this.x += this.vx;
      this.y += this.vy;
      this.opacity -= 0.02;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.font = `${Math.round(12 * this.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(this.type === 'heart' ? '❤️' : '💋', this.x, this.y);
    ctx.restore();
  }

  isDead() {
    return this.opacity <= 0;
  }
}

export class ReactionParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawnHearts(x, y) {
    const count = HEART_SPAWN_MIN + Math.floor(Math.random() * (HEART_SPAWN_MAX - HEART_SPAWN_MIN + 1));
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      this.particles.push(new ReactionParticle('heart', x + (Math.random() - 0.5) * 20, y));
    }
  }

  spawnKiss(fromX, fromY, toX, toY) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const p = new ReactionParticle('kiss', fromX, fromY);
    p.setTarget(toX, toY);
    this.particles.push(p);
  }

  update() {
    for (const p of this.particles) p.update();
    this.particles = this.particles.filter(p => !p.isDead());
  }

  draw(ctx) {
    for (const p of this.particles) p.draw(ctx);
  }

  isActive() {
    return this.particles.length > 0;
  }

  clear() {
    this.particles = [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/reaction-particles.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/reaction-particles.js rhinosaurus-connect/tests/popup/room/reaction-particles.test.js
git commit -m "feat: add reaction particle system with floating hearts and bezier kiss"
```

---

### Task 2: Reaction handler (throttle, send, receive)

**Files:**
- Create: `rhinosaurus-connect/popup/room/reaction-handler.js`
- Test: `rhinosaurus-connect/tests/popup/room/reaction-handler.test.js`

- [ ] **Step 1: Write test for reaction handler**

```js
// rhinosaurus-connect/tests/popup/room/reaction-handler.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactionHandler } from '../../../popup/room/reaction-handler.js';

describe('ReactionHandler', () => {
  let handler;
  let mockService;
  let mockParticles;
  let mockAnimator;
  let mockBubbleQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    mockService = {
      sendReaction: vi.fn(() => Promise.resolve({ id: 'msg-1' })),
    };
    mockParticles = {
      spawnHearts: vi.fn(),
      spawnKiss: vi.fn(),
    };
    mockAnimator = {
      setState: vi.fn(),
    };
    mockBubbleQueue = {
      add: vi.fn(),
    };
    handler = new ReactionHandler(mockService, mockParticles);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends heart reaction', async () => {
    await handler.sendHeart();
    expect(mockService.sendReaction).toHaveBeenCalledWith('heart');
  });

  it('sends kiss reaction', async () => {
    await handler.sendKiss();
    expect(mockService.sendReaction).toHaveBeenCalledWith('kiss');
  });

  it('throttles to 1 per second per type', async () => {
    await handler.sendHeart();
    await handler.sendHeart();
    expect(mockService.sendReaction).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1100);
    await handler.sendHeart();
    expect(mockService.sendReaction).toHaveBeenCalledTimes(2);
  });

  it('allows different types simultaneously', async () => {
    await handler.sendHeart();
    await handler.sendKiss();
    expect(mockService.sendReaction).toHaveBeenCalledTimes(2);
  });

  it('triggers heart animation on receive', () => {
    handler.onReceiveReaction('heart', mockAnimator, mockBubbleQueue, 100, 200);
    expect(mockAnimator.setState).toHaveBeenCalledWith('heart_eyes');
    expect(mockBubbleQueue.add).toHaveBeenCalledWith('❤️', 100, 200);
    expect(mockParticles.spawnHearts).toHaveBeenCalledWith(100, 200);
  });

  it('triggers kiss animation on receive', () => {
    handler.onReceiveReaction('kiss', mockAnimator, mockBubbleQueue, 100, 200, 200, 200);
    expect(mockAnimator.setState).toHaveBeenCalledWith('kiss_face');
    expect(mockBubbleQueue.add).toHaveBeenCalledWith('💋', 100, 200);
    expect(mockParticles.spawnKiss).toHaveBeenCalledWith(100, 200, 200, 200);
  });

  it('formats batch summary for offline delivery', () => {
    const summary = handler.formatBatchSummary(3, 2);
    expect(summary).toContain('3');
    expect(summary).toContain('❤️');
    expect(summary).toContain('2');
    expect(summary).toContain('💋');
  });

  it('formats hearts-only batch', () => {
    const summary = handler.formatBatchSummary(5, 0);
    expect(summary).toContain('5');
    expect(summary).toContain('❤️');
    expect(summary).not.toContain('💋');
  });

  it('caps particle count at 10 for batch', () => {
    const count = handler.getBatchParticleCount(50);
    expect(count).toBeLessThanOrEqual(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/reaction-handler.test.js`
Expected: FAIL

- [ ] **Step 3: Implement reaction-handler.js**

```js
// rhinosaurus-connect/popup/room/reaction-handler.js
const THROTTLE_MS = 1000;
const MAX_BATCH_PARTICLES = 10;

export class ReactionHandler {
  constructor(messageService, particleSystem) {
    this.service = messageService;
    this.particles = particleSystem;
    this.lastSent = { heart: 0, kiss: 0 };
  }

  async sendHeart() {
    if (!this.canSend('heart')) return;
    this.lastSent.heart = Date.now();
    await this.service.sendReaction('heart');
  }

  async sendKiss() {
    if (!this.canSend('kiss')) return;
    this.lastSent.kiss = Date.now();
    await this.service.sendReaction('kiss');
  }

  canSend(type) {
    return Date.now() - this.lastSent[type] >= THROTTLE_MS;
  }

  onReceiveReaction(type, animator, bubbleQueue, avatarX, avatarY, myAvatarX, myAvatarY) {
    if (type === 'heart') {
      animator.setState('heart_eyes');
      bubbleQueue.add('❤️', avatarX, avatarY);
      this.particles.spawnHearts(avatarX, avatarY);
    } else if (type === 'kiss') {
      animator.setState('kiss_face');
      bubbleQueue.add('💋', avatarX, avatarY);
      this.particles.spawnKiss(avatarX, avatarY, myAvatarX, myAvatarY);
    }
  }

  formatBatchSummary(heartCount, kissCount) {
    const parts = [];
    if (heartCount > 0) parts.push(`${heartCount} ❤️`);
    if (kissCount > 0) parts.push(`${kissCount} 💋`);
    return `Sent you ${parts.join(' and ')} while you were away`;
  }

  getBatchParticleCount(totalReactions) {
    return Math.min(totalReactions, MAX_BATCH_PARTICLES);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/reaction-handler.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/reaction-handler.js rhinosaurus-connect/tests/popup/room/reaction-handler.test.js
git commit -m "feat: add reaction handler with throttle, animation triggers, and batch summary"
```

---

### Task 3: Wire reactions into popup toolbar

**Files:**
- Modify: `rhinosaurus-connect/popup/popup.js`

- [ ] **Step 1: Add reaction handler integration to popup.js**

Add to popup.js:

```js
// Add imports at top:
import { ReactionHandler } from './room/reaction-handler.js';
import { ReactionParticleSystem } from './room/reaction-particles.js';

// In init(), after renderer setup:
const particleSystem = new ReactionParticleSystem();
let reactionHandler = null;

async function setupReactions(messageService) {
  reactionHandler = new ReactionHandler(messageService, particleSystem);
}

// Add particle system as effect layer:
renderer.addEffect({
  draw(ctx) {
    particleSystem.update();
    particleSystem.draw(ctx);
    if (particleSystem.isActive()) renderer.markDirty();
  },
});

// Heart button handler:
document.getElementById('heart-btn').addEventListener('click', async () => {
  if (!reactionHandler) return;
  const btn = document.getElementById('heart-btn');
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => { btn.style.transform = ''; }, 150);
  await reactionHandler.sendHeart();
});

// Kiss button handler:
document.getElementById('kiss-btn').addEventListener('click', async () => {
  if (!reactionHandler) return;
  const btn = document.getElementById('kiss-btn');
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => { btn.style.transform = ''; }, 150);
  await reactionHandler.sendKiss();
});

// In the Realtime channel subscription, add reaction handling:
// channel.on('broadcast', { event: 'reaction' }, (payload) => {
//   const { reaction, user_id } = payload.payload;
//   const partnerAvatar = avatars.get(user_id);
//   if (partnerAvatar) {
//     reactionHandler.onReceiveReaction(
//       reaction,
//       partnerAvatar.animator,
//       partnerAvatar.bubbleQueue,
//       partnerAvatar.controller.x,
//       partnerAvatar.controller.y,
//       myController.x,
//       myController.y
//     );
//     renderer.markDirty();
//   }
// });
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/popup.js
git commit -m "feat: wire reaction buttons with particle effects and animation triggers"
```

---

### Task 4: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 2F reactions complete"
```

---

## Summary

After Phase 2F:
- **ReactionParticle**: floating hearts (upward drift + fade) and bezier-curve kiss marks
- **ReactionParticleSystem**: spawn 3-5 hearts or 1 kiss, max 10 particles cap
- **ReactionHandler**: 1-per-second throttle per type, avatar animation + speech bubble triggers, batch summary for offline delivery
- **Toolbar integration**: heart/kiss buttons with scale feedback, particle effects in render loop
