# Feature 06: Reactions (Hearts & Kisses)

## Summary
One-tap "Send Your Heart" and "Send a Kiss" buttons that trigger instant, expressive avatar animations and speech bubbles. These are lightweight, emotional micro-interactions — not chat messages, but they are persisted for offline queuing.

---

## User Flow

### Sending
1. User taps ❤️ or 💋 button in the bottom toolbar
2. Immediate haptic-style feedback (button briefly scales up)
3. Message inserted into `messages` table with type `heart` or `kiss`
4. Broadcast via Realtime for instant delivery

### Receiving — In the Room (Popup Open)
1. Partner's avatar plays the matching animation:
   - **Heart**: `heart_eyes` animation — eyes become hearts, small hearts float up
   - **Kiss**: `kiss_face` animation — puckered lips, a kiss mark floats toward your avatar
2. Speech bubble appears next to their avatar containing the emoji (❤️ or 💋)
3. Floating particle effects in the room:
   - Hearts: 3-5 small pixel hearts float upward and fade
   - Kiss: a pixel kiss mark travels from their avatar to yours
4. Phone on desk does NOT glow (this bypasses the phone — it's instant and visual)

### Receiving — Browsing (Popup Closed)
1. Corner popup slides in from bottom-right
2. Partner's avatar displayed with matching animation (heart_eyes or kiss_face)
3. Speech bubble shows ❤️ or 💋
4. Stays 5 seconds, fades out

### Receiving — Offline
1. Stored in `messages` table
2. On next login, batched delivery:
   - "She sent you 3 ❤️ and 2 💋 while you were away!"
   - Partner's avatar plays a special burst animation: rapid heart_eyes → kiss_face → waving
   - Multiple hearts/kisses float up simultaneously

---

## Animations & Effects

### Heart Animation Sequence
```
Frame 0-5:   Avatar transitions from idle to heart_eyes
Frame 6-15:  Heart_eyes loop (eyes are hearts, slight bouncing)
Frame 16-20: Return to idle

Concurrent effects:
- Speech bubble with ❤️ appears (fade in 200ms)
- 3-5 small pixel hearts spawn above avatar, float upward with slight random horizontal drift
- Hearts fade out over 1 second
- Optional: subtle pink tint/glow on room for 500ms
```

### Kiss Animation Sequence
```
Frame 0-5:   Avatar transitions from idle to kiss_face
Frame 6-10:  Kiss face hold (puckered lips)
Frame 11-20: A pixel kiss mark (💋) travels from sender avatar to receiver avatar in an arc
Frame 21-25: Return to idle

Concurrent effects:
- Speech bubble with 💋 appears (fade in 200ms)
- Kiss mark sprite follows a bezier curve from sender to receiver
- Small sparkle effect on receiver when kiss "lands"
- Optional: receiver avatar does a small happy bounce
```

### Particle System
```js
class ReactionParticle {
  constructor(type, startX, startY) {
    this.type = type; // 'heart' or 'kiss'
    this.x = startX;
    this.y = startY;
    this.vx = (Math.random() - 0.5) * 1.5; // slight horizontal drift
    this.vy = -1.5; // float upward
    this.opacity = 1;
    this.scale = 0.5 + Math.random() * 0.5;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.opacity -= 0.02;
  }

  draw(ctx) {
    // Draw pixel heart or kiss sprite at (x, y) with opacity and scale
  }

  isDead() {
    return this.opacity <= 0;
  }
}
```

---

## Distinction from Chat Messages

Reactions are NOT regular chat messages in the UI sense:
- They don't appear in the chat overlay's message list (they're in the `messages` table for persistence/queuing, but filtered out of the chat view)
- They trigger visual effects in the room and corner popups
- They're accessed via the toolbar, not the chat input
- They're meant to be quick, impulsive, emotional — not conversational

However, they ARE stored in the `messages` table because:
- They need to be queued for offline delivery
- The batched "while you were away" summary needs to count them
- Consistent data model

---

## Database
- `messages` table with `type = 'heart'` or `type = 'kiss'`, `content = null`

## Realtime
- Broadcast on `pair:{pair_id}:events`:
  - `{ type: 'reaction', user_id, reaction: 'heart' | 'kiss' }`
- This is used for instant delivery; the `messages` table insert is for persistence

---

## Edge Cases
- **Rapid tapping**: throttle to max 1 reaction per second per type. Queue excess for sequential animation.
- **Both send simultaneously**: both avatars animate at the same time — this is fine and cute.
- **Popup opens during animation**: if a queued reaction is being displayed and user opens popup, continue the animation in the room.
- **Sound effects**: optional notification sound for receiving (a soft chime for heart, a "mwah" for kiss). Default on, can be disabled in settings. Sounds should be short (<1 second) and pleasant.
