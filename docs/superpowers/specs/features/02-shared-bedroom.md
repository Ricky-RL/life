# Feature 02: Shared Bedroom (Room)

## Summary
The core UI of Rhinosaurus Connect is a shared pixel art bedroom rendered on HTML5 Canvas inside the Chrome extension popup. Both avatars live in the room. Interactive objects (TV, phone/desk, calendar, makeup stand) open feature overlays. Room state syncs in real-time between both users.

---

## Room Design

### Visual Style
- Stardew Valley-inspired 16-bit pixel art
- Warm, cozy color palette: soft pinks, warm browns, muted blues, golden yellows
- Viewed from a slightly elevated front-facing perspective (not isometric — more like Stardew's interior rooms)
- Soft ambient lighting with optional lamp glow
- Room dimensions: approximately 320x400px canvas (fits Chrome popup default width of ~400px)

### Default Room Layout
```
┌──────────────────────────────────┐
│  [Window/Curtains]    [Calendar] │  ← Wall
│                                  │
│  [Bed - shared]     [Makeup     │
│                      Stand]      │
│                                  │
│  [Rug in center]                 │
│                                  │
│  [Desk+Phone]         [TV]      │
│                                  │
│  [Nightstand]    [Nightstand]   │
│                                  │
│  [Avatar 1]       [Avatar 2]    │
│──────────────────────────────────│
│  [Chat] [❤️] [💋] [Mood] [⚙️]  │  ← Toolbar
└──────────────────────────────────┘
```

### Default Furniture Set
| Object | Type | Interactive | Description |
|--------|------|-------------|-------------|
| Bed | furniture | No (avatars auto-placed when sleeping) | Shared double bed, customizable bedding color/pattern |
| TV | interactive | Yes → shows partner activity, Watch Together | Pixel art CRT/flat screen on a stand |
| Desk + Phone | interactive | Yes → opens chat overlay | Desk with a phone that glows when messages arrive |
| Wall Calendar | interactive | Yes → opens date tracker overlay | Paper calendar pinned to wall, shows current date |
| Makeup Stand | interactive | Yes → opens makeup overlay (female avatar) | Vanity mirror with cosmetics |
| Window + Curtains | furniture | No | Customizable curtain color/pattern, shows day/night based on local time |
| Rug | furniture | No | Customizable color/pattern |
| Nightstand x2 | furniture | No | One per side of bed |
| Wall Decorations | furniture | No | Fairy lights, posters, photos — customizable |

---

## Canvas Rendering

### Render Loop
```js
class RoomRenderer {
  constructor(canvas, roomState, avatarStates) { ... }

  render() {
    this.clear();
    this.drawFloor();
    this.drawWalls();
    this.drawFurniture();      // sorted by y-position for depth
    this.drawAvatars();         // sorted by y-position for depth
    this.drawEffects();         // hearts, sparkles, speech bubbles
    this.drawInteractionHints(); // subtle glow on hoverable objects
    requestAnimationFrame(() => this.render());
  }
}
```

### Sprite System
- Sprite sheets loaded as Image objects
- Each furniture item has a sprite definition: `{ sheet, x, y, width, height, frames? }`
- Animated objects (TV static, phone glow, fairy lights) have multiple frames
- Render at native pixel size, scale up with `image-rendering: pixelated` on canvas

### Depth Sorting
- Objects and avatars sorted by y-position before rendering
- Objects closer to the bottom of the screen render on top (in front)
- Avatars can walk behind/in front of furniture naturally

### Interaction Detection
- On canvas click, check hit boxes of interactive objects
- Hit boxes stored as `{ x, y, width, height }` in room state
- **Hitbox priority**: when objects overlap, check from highest y-position (front) to lowest (back). First hit wins. This matches visual depth — the object you see "on top" is the one you click.
- Cursor changes to pointer on hover over interactive objects
- Subtle glow/highlight animation on hover

---

## Room State Management

### Local State
```js
const roomState = {
  furniture: [
    { id: 'bed', type: 'bed', x: 40, y: 80, variant: 'default', color: '#FF6B9D' },
    { id: 'tv', type: 'tv', x: 240, y: 180, variant: 'crt', color: null },
    // ...
  ],
  avatarPositions: {
    'user-id-1': { x: 100, y: 260 },
    'user-id-2': { x: 200, y: 260 }
  },
  theme: 'default'
};
```

### Syncing
- Room state loaded from `room_state` table on popup open
- Changes **broadcast immediately** via Supabase Realtime channel `pair:{pair_id}:events` (partner sees changes instantly)
- **Database writes are debounced** to every 2 seconds during active editing (reduces DB load)
- On popup close, a final save ensures all pending changes are persisted
- If the popup closes before a debounced write, the partner still has the latest state via broadcast — the DB catches up on next popup open
- Events:
  - `room_update`: `{ type: 'furniture_move', furniture_id, x, y }` or `{ type: 'furniture_change', furniture_id, variant, color }`
  - `avatar_move`: `{ user_id, x, y }`
- On receive, apply change to local state → canvas re-renders automatically

### Avatar Auto-Movement
Avatars automatically move to specific locations based on context:
- **Watching YouTube**: avatar moves to sit in front of the TV
- **Offline/sleeping**: avatar moves to lie on the bed, plays sleeping animation
- **Coming online**: avatar moves from bed to last known position, plays waving animation

---

## Bottom Toolbar

Fixed bar below the canvas, always visible. HTML elements (not canvas-rendered) for easier interaction.

```
[💬 Chat (3)] [❤️] [💋] [😊 Mood ▾] [⚙️]
```

| Button | Action |
|--------|--------|
| Chat | Opens chat overlay. Badge shows unread count. |
| ❤️ Heart | Sends heart reaction instantly |
| 💋 Kiss | Sends kiss reaction instantly |
| Mood | Dropdown to set mood status |
| ⚙️ Settings | Opens settings (tracking toggle, unpair, avatar customization, room customization) |

---

## Popup Lifecycle

### On Open
1. Check auth state → redirect to login if needed
2. Load pair data
3. Load room state from database
4. Subscribe to Realtime channels (presence + events)
5. Initialize canvas renderer
6. Start render loop
7. Update presence: `is_online = true`
8. Process any queued messages (show "You missed X messages" if applicable)

### On Close
1. Update presence: `is_online = false`
2. Save current room state to database
3. Unsubscribe from Realtime channels

### Popup Sizing
- Width: 400px (Chrome default)
- Height: 500px (room canvas: ~420px, toolbar: ~50px, padding: ~30px)
- Set via CSS on popup body

---

## Edge Cases
- **Both users editing furniture at the same time**: last write wins, broadcast ensures both see the same state. Furniture moves are debounced to reduce conflicts.
- **Popup opened while offline**: show cached room state from `chrome.storage.local`, display "offline" badge, queue any changes for sync when back online.
- **Canvas performance**: limit to 30fps for the render loop. Most frames are static — only re-render dirty regions if performance becomes an issue.
- **Window day/night cycle**: use `new Date().getHours()` to determine if window shows day or night sky. Updates every minute.
