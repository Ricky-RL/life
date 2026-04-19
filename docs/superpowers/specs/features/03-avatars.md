# Feature 03: Avatars

## Summary
Each partner has a custom pixel art avatar in Stardew Valley style. Base avatars are hand-crafted from reference photos provided by the user. Avatars appear in the shared bedroom, in notification popups, and in chat. They have multiple animation states that respond to in-app events.

---

## Base Avatar Design

### Creation Process
- User provides reference photos of themselves
- Avatars are hand-crafted as pixel art sprite sheets in Stardew Valley style
- Fixed features: face shape, hairstyle, hair color, skin tone, eye shape, body proportions
- These base features are NOT customizable by the user — they're the "identity" of the avatar

### Sprite Sheet Structure
Each avatar has a sprite sheet with the following animation states:

| State | Frames | Trigger |
|-------|--------|---------|
| `idle` | 4 frames, looping | Default state — subtle breathing + blinking |
| `speaking` | 4 frames, looping | When a text message speech bubble is displayed |
| `heart_eyes` | 6 frames, play once | When receiving a heart reaction |
| `kiss_face` | 6 frames, play once | When receiving a kiss reaction |
| `sleeping` | 4 frames, looping | When offline — avatar lies on bed |
| `waving` | 6 frames, play once | When partner comes online |
| `walking` | 8 frames (4 per direction), looping | When avatar is auto-moving (to TV, to bed, etc.) |
| `sitting` | 2 frames, looping | When watching TV (seated idle) |

### Sprite Dimensions
- Avatar size: 32x48px per frame (Stardew Valley character scale)
- Rendered at 2x or 3x scale on canvas depending on room size
- Each direction (left-facing, right-facing) may be separate rows or mirrored

### Animation System
```js
class AvatarAnimator {
  constructor(spriteSheet, frameData) { ... }

  setState(state) {
    // 'idle', 'speaking', 'heart_eyes', 'kiss_face', 'sleeping', 'waving', 'walking', 'sitting'
    this.currentState = state;
    this.currentFrame = 0;
    this.looping = ['idle', 'speaking', 'sleeping', 'walking', 'sitting'].includes(state);
  }

  update(deltaTime) {
    // Advance frame based on animation speed
    // For non-looping animations, return to 'idle' when done
  }

  draw(ctx, x, y, scale) {
    // Draw current frame from sprite sheet
  }
}
```

---

## Avatar Positioning

### Dragging
- Each user can drag their own avatar within the room
- Click and drag on your avatar → smoothly follows cursor
- Release → avatar snaps to position, broadcasts `avatar_move` event
- Cannot drag partner's avatar

### Auto-Movement
Avatars move automatically in response to events:

| Event | Movement |
|-------|----------|
| User opens YouTube | Avatar walks to front of TV, switches to `sitting` |
| User leaves YouTube | Avatar walks back to previous position |
| Watch Together activated | Both avatars walk to TV, sit side by side |
| User goes offline | Avatar walks to bed, switches to `sleeping` |
| User comes online | Avatar gets up from bed, plays `waving`, walks to default position |

Auto-movement uses simple pathfinding:
- Calculate direct path from current position to target (no obstacle avoidance needed — room is open)
- Avatar plays `walking` animation while moving
- Movement speed: ~2px per frame at 30fps

---

## Speech Bubbles

### In the Room (Popup)
When a message/reaction is sent or received, a speech bubble appears next to the sender's avatar:
- **Text message**: bubble contains the message text (truncated to ~50 chars if long)
- **Emoji/heart**: bubble contains the emoji, avatar plays matching animation
- **Kiss**: bubble contains 💋, avatar plays `kiss_face`
- **Image**: bubble shows a small thumbnail

Speech bubble rendering:
- Pixel art style bubble (rounded rectangle with a tail pointing to the avatar)
- Appears above and slightly to the right of the avatar
- Fade in over 200ms, stay for 5 seconds, fade out over 500ms
- Max width: 120px, text wraps inside

### In Corner Popup Notifications (Content Script)
When browsing other tabs, the sender's avatar appears in the corner popup:
- Avatar rendered at 2x scale
- Matching animation plays (speaking, heart eyes, kiss face)
- Speech bubble appears next to the avatar with the message content
- Same timing: fade in, 5 second display, fade out

---

## Rendering in Different Contexts

| Context | Size | Animation | Speech Bubbles |
|---------|------|-----------|----------------|
| Room (popup) | 32x48 @ 2-3x scale | Full animation | Yes |
| Corner popup (content script) | 32x48 @ 2x scale | Matching animation | Yes |
| Chrome notification icon | 16x16 static | No | No |
| Chat message avatar | 24x24 static (idle frame 1) | No | No |
| Toolbar/header | 20x20 static | No | No |

---

## Edge Cases
- **Both avatars at TV simultaneously**: position them side by side with a small gap
- **Avatar at bed + message received**: phone on desk glows, avatar stays sleeping (they're offline)
- **Rapid messages**: queue speech bubbles, show one at a time with 1 second gap
- **Long text in bubble**: truncate with "..." and show full text in chat
- **Walking interrupted**: if avatar is auto-walking and a new auto-move triggers, smoothly redirect to new target
