# Feature 10: Room Customization

## Summary
Both partners can customize the shared bedroom — move furniture, swap variants, change colors, and add/remove decorative items. All changes sync in real-time. The room is fully shared; either person can edit anything.

---

## Customization Options

### Furniture Variants
Each furniture item has multiple visual variants:

| Object | Variants |
|--------|----------|
| Bed | Single/Double, wood frame/metal frame/no frame, bedding colors (pink, blue, purple, white, patterned) |
| TV | CRT retro, flat screen, small/large |
| Desk | Wooden, modern, small table |
| Nightstand | Wooden, modern, cute (with heart cutout) |
| Rug | Round, rectangular, various colors/patterns |
| Curtains | Solid colors, patterned (polka dots, stripes, floral), sheer/opaque |
| Wall Decorations | Fairy lights (colors), posters (various pixel art scenes), framed photos, wall shelf |
| Lamp | Floor lamp, desk lamp, fairy lights (functional — affects room lighting) |
| Plants | Small potted, hanging plant, succulent |
| Misc | Plushies, books stack, pet bed, candles |

### Color Options
- Furniture with color customization has a color picker (limited palette of 12-16 pixel-art-friendly colors)
- Colors: soft pink, rose, lavender, sky blue, mint, sage green, cream, warm white, coral, peach, light yellow, light gray, wood brown, dark brown, charcoal, black

---

## User Flow

### Entering Edit Mode
1. Click ⚙️ Settings in toolbar → "Customize Room" option
   OR long-press/right-click any furniture piece
2. Room enters "edit mode":
   - Furniture items get a subtle dashed outline
   - A customization panel slides up from the bottom
   - Grid overlay appears on the room floor (optional, for alignment)

### Moving Furniture
1. In edit mode, click and drag any furniture item
2. Item follows cursor with a ghost/transparent preview
3. Release → item snaps to position
4. Broadcast `room_update` event

### Changing Variants/Colors
1. In edit mode, click a furniture item
2. Customization panel shows:
   - Item name (e.g., "Bed")
   - Variant thumbnails (click to swap)
   - Color swatches (if applicable)
   - "Remove" button (for non-essential items)
3. Changes apply immediately and sync in real-time

### Adding New Items
1. In edit mode, click "+ Add Item" in the customization panel
2. Category browser: Furniture, Decorations, Plants, Misc
3. Browse items as pixel art thumbnails
4. Click to place → item appears in center of room, user drags to position
5. Broadcast `room_update` event

### Removing Items
1. In edit mode, click an item → "Remove" button
2. Item removed from room
3. Essential items (bed, TV, desk, calendar, makeup stand) cannot be removed — remove button disabled with tooltip "This item can't be removed"

---

## Technical Implementation

### Room State Structure
```js
// room_state.furniture (jsonb array)
[
  {
    id: "bed-1",
    type: "bed",
    variant: "double-wood",
    color: "#FF6B9D",
    x: 40,
    y: 80,
    z_index: 1, // for depth sorting override
    interactive: false
  },
  {
    id: "tv-1",
    type: "tv",
    variant: "crt",
    color: null,
    x: 240,
    y: 180,
    z_index: 2,
    interactive: true,
    interaction: "activity" // what happens on click
  },
  // ...
]
```

### Sprite Definitions
```js
const FURNITURE_SPRITES = {
  bed: {
    variants: {
      'double-wood': { sheet: 'room-sprites.png', sx: 0, sy: 0, sw: 64, sh: 48 },
      'double-metal': { sheet: 'room-sprites.png', sx: 64, sy: 0, sw: 64, sh: 48 },
      // ...
    },
    colorizable: true, // can change bedding color
    colorRegion: { sx: 8, sy: 8, sw: 48, sh: 32 }, // region to tint
    hitbox: { offsetX: 0, offsetY: 0, width: 64, height: 48 },
    essential: true // cannot be removed
  },
  // ...
};
```

### Color Tinting
For colorizable items, apply a color tint to a specific region of the sprite:
```js
function tintSprite(ctx, sprite, color, region) {
  // Draw original sprite
  ctx.drawImage(sprite.sheet, sprite.sx, sprite.sy, sprite.sw, sprite.sh, x, y, w, h);

  // Apply color tint to region using globalCompositeOperation
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.4; // subtle tint, not full color replace
  ctx.fillRect(x + region.offsetX, y + region.offsetY, region.width, region.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
```

### Syncing Changes
- On any change, broadcast via Realtime:
  ```js
  channel.send({
    type: 'broadcast',
    event: 'room_update',
    payload: {
      action: 'furniture_move', // or 'furniture_change', 'furniture_add', 'furniture_remove'
      furniture_id: 'bed-1',
      changes: { x: 50, y: 90 } // or { variant: 'double-metal' } or { color: '#9D6BFF' }
    }
  });
  ```
- Debounce database writes to every 2 seconds during active editing
- On popup close, final save to database

### Edit Mode UI
The customization panel is an HTML overlay below the canvas (not rendered on canvas):
```
┌──────────────────────────────────┐
│  Customizing: Bed                │
│  [Variant 1] [Variant 2] [V3]   │  ← Pixel art thumbnails
│  [Color swatches row]            │
│  [Remove]              [Done]    │
└──────────────────────────────────┘
```

---

## Database
- `room_state.furniture`: `jsonb` array of furniture objects

## Realtime
- Broadcast on `pair:{pair_id}:events`:
  - `{ type: 'room_update', action, furniture_id, changes }`

---

## Edge Cases
- **Both editing at the same time**: changes merge at the furniture-item level. If both move the same item simultaneously, last position wins. Different items can be edited concurrently without conflict.
- **Adding too many items**: cap at 30 items to keep rendering performant. Show "Room is full! Remove an item to add a new one."
- **Overlapping furniture**: allowed — user can position items freely. Depth sorted by y-position.
- **Popup resizing**: room scales proportionally. Furniture positions are stored as absolute pixel coordinates within the room's native resolution (320x400). Canvas scales up/down as needed.
