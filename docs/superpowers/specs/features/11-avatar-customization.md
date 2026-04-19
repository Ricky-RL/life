# Feature 11: Avatar Customization & Makeup Stand

## Summary
Avatars have a fixed base (face, hair, body) crafted from reference photos, with dress-up customization for clothes, accessories, and jewelry. The female avatar can additionally apply makeup via the interactive makeup stand in the room.

---

## Dress-Up Customization

### How to Access
- ⚙️ Settings → "Customize Avatar"
- Opens a full overlay with the avatar displayed large in the center and category tabs around it

### Customization Categories

#### Clothes
| Slot | Options |
|------|---------|
| Top | T-shirt, hoodie, sweater, blouse, crop top, jacket, dress (replaces top+bottom) |
| Bottom | Jeans, shorts, skirt, sweatpants, leggings |
| Shoes | Sneakers, slippers, boots, sandals, heels |
| Outerwear (optional) | Cardigan, scarf, coat |

Each item comes in multiple colors from the room color palette (12-16 options).

#### Jewelry
| Slot | Options |
|------|---------|
| Necklace | Chain, pendant, choker, pearl |
| Earrings | Studs, hoops, drop earrings |
| Ring | Simple band, gem ring (subtle, barely visible at pixel scale) |
| Bracelet | Bangle, charm bracelet, beaded |

#### Accessories
| Slot | Options |
|------|---------|
| Head | Headphones, hat (beanie, cap, beret), hair clip, bow, headband |
| Face | Glasses (round, square, sunglasses) |
| Held item | Bag, phone, coffee cup, book |

#### Pet Companion
- Optional pet that follows the avatar around the room
- Options: cat, dog, bunny, hamster
- Each pet has idle and walking animations (4 frames each)
- Pet sits next to avatar when idle, follows when avatar walks
- Only one pet at a time

---

## Avatar Customization UI

```
┌──────────────────────────────────┐
│  [← Back]   Your Avatar          │
│──────────────────────────────────│
│                                  │
│        [Large Avatar Preview]    │  ← Shows current outfit live
│        (128x192 rendered)        │
│                                  │
│  [Clothes] [Jewelry] [Acc] [Pet] │  ← Category tabs
│──────────────────────────────────│
│  Tops:                           │
│  [👕] [🧥] [👔] [👗] ...       │  ← Pixel art item thumbnails
│                                  │
│  Color:                          │
│  [🔴][🟠][🟡][🟢][🔵][🟣]     │  ← Color swatches
│                                  │
│              [Save]              │
└──────────────────────────────────┘
```

### Live Preview
- As user selects items, the large avatar preview updates immediately
- No need to "try on" — selection IS the preview
- Save button persists to database

---

## Sprite Layering System

Avatars are rendered as layered sprites, composited in order:

```
Layer 0: Body (base — skin, face, hair)        ← Fixed, from reference photos
Layer 1: Bottom (pants, skirt, etc.)
Layer 2: Shoes
Layer 3: Top (shirt, hoodie, etc.)
Layer 4: Outerwear (cardigan, scarf — optional)
Layer 5: Makeup (lipstick, blush, eyeshadow — female avatar only, applied before face accessories)
Layer 6: Jewelry (necklace, earrings, bracelet, ring)
Layer 7: Head accessory (hat, headphones, hair clip)
Layer 8: Face accessory (glasses)
Layer 9: Held item (bag, coffee — positioned at hand)
Layer 10: Pet (positioned relative to avatar, independent animation)
```

### Implementation
```js
class AvatarRenderer {
  constructor(baseSprite, config) {
    this.baseSprite = baseSprite; // fixed base layer
    this.layers = []; // additional layers from config
    this.petRenderer = null;
  }

  buildLayers(avatarConfig) {
    this.layers = [];

    if (avatarConfig.bottom) this.layers.push(getSprite('bottom', avatarConfig.bottom));
    if (avatarConfig.shoes) this.layers.push(getSprite('shoes', avatarConfig.shoes));
    if (avatarConfig.top) this.layers.push(getSprite('top', avatarConfig.top));
    if (avatarConfig.outerwear) this.layers.push(getSprite('outerwear', avatarConfig.outerwear));
    if (avatarConfig.necklace) this.layers.push(getSprite('necklace', avatarConfig.necklace));
    if (avatarConfig.earrings) this.layers.push(getSprite('earrings', avatarConfig.earrings));
    if (avatarConfig.ring) this.layers.push(getSprite('ring', avatarConfig.ring));
    if (avatarConfig.bracelet) this.layers.push(getSprite('bracelet', avatarConfig.bracelet));
    if (avatarConfig.head) this.layers.push(getSprite('head', avatarConfig.head));
    if (avatarConfig.face) this.layers.push(getSprite('face', avatarConfig.face));
    if (avatarConfig.held) this.layers.push(getSprite('held', avatarConfig.held));
    if (avatarConfig.makeup) this.layers.push(getSprite('makeup', avatarConfig.makeup));
    if (avatarConfig.pet) this.petRenderer = new PetRenderer(avatarConfig.pet);
  }

  draw(ctx, x, y, animState, frame) {
    // Draw base sprite (current animation frame)
    this.baseSprite.draw(ctx, x, y, animState, frame);

    // Draw each layer on top (same animation frame for alignment)
    for (const layer of this.layers) {
      layer.draw(ctx, x, y, animState, frame);
    }

    // Draw pet (independent position and animation)
    if (this.petRenderer) {
      this.petRenderer.draw(ctx, x + 30, y + 10);
    }
  }
}
```

### Sprite Sheet Organization
Each customization item needs frames matching the avatar's animation states:
- Clothes/accessories must be drawn for: idle (4f), speaking (4f), heart_eyes (6f), kiss_face (6f), sleeping (4f), waving (6f), walking (8f), sitting (2f)
- Items are drawn to align perfectly with the base avatar's body positions in each frame

**Art Production Strategy — Palette Swaps:**
Creating unique sprites for every item × every color × every animation frame is infeasible. Instead:
- Each clothing/accessory item is drawn ONCE in grayscale (or a base color)
- Color variants are generated programmatically via **palette swap**: replace a known set of base colors with the target palette at load time
- This reduces art production by ~10x (1 sprite per item instead of 1 per item × 16 colors)
- Implementation: at sprite load time, iterate pixels on an offscreen canvas, map base palette → target palette, cache the result
- Jewelry and small items with metallic/textured colors may need hand-drawn variants (gold, silver, rose gold) — max 3 per item

---

## Makeup Stand

### Interaction
1. Female avatar user clicks the makeup stand object in the room
2. Makeup overlay opens (similar to avatar customization but focused on face)

### Makeup Options
| Type | Options |
|------|---------|
| Lipstick | Natural, pink, red, berry, coral, nude (color applied to lips area) |
| Blush | Light, medium, heavy (pink tint on cheeks — already present in Stardew style, this intensifies it) |
| Eyeshadow | Pink, purple, blue, gold, green, brown (color on eyelid area) |
| Eyeliner | Thin, thick, winged (dark line above eye) |

### Makeup UI
```
┌──────────────────────────────────┐
│  [← Back]    Makeup Stand 💄    │
│──────────────────────────────────│
│                                  │
│     [Close-up Avatar Face]       │  ← Zoomed in on face for detail
│     (large pixel art face)       │
│                                  │
│  💋 Lipstick:                    │
│  [Natural] [Pink] [Red] [None]   │
│                                  │
│  🌸 Blush:                       │
│  [Light] [Medium] [Heavy] [None] │
│                                  │
│  ✨ Eyeshadow:                   │
│  [Pink] [Purple] [Blue] [None]   │
│                                  │
│  🖊️ Eyeliner:                   │
│  [Thin] [Thick] [Winged] [None]  │
│                                  │
│              [Save]              │
└──────────────────────────────────┘
```

### Makeup Rendering
- Makeup is rendered as a semi-transparent overlay on the face area of the base sprite
- Stored as part of `avatar_config.makeup`:
  ```json
  {
    "lipstick": "pink",
    "blush": "medium",
    "eyeshadow": "purple",
    "eyeliner": "winged"
  }
  ```
- Makeup sprites are tiny (just the affected face pixels) and composited at Layer 9

---

## Avatar Config Storage

### Database
```js
// users.avatar_config (jsonb)
{
  "top": { "item": "hoodie", "color": "#FF6B9D" },
  "bottom": { "item": "jeans", "color": "#4A6FA5" },
  "shoes": { "item": "sneakers", "color": "#FFFFFF" },
  "outerwear": null,
  "necklace": { "item": "pendant" },
  "earrings": { "item": "studs" },
  "ring": null,
  "bracelet": null,
  "head": { "item": "headphones", "color": "#FFFFFF" },
  "face": null,
  "held": null,
  "pet": { "type": "cat", "color": "white" },
  "makeup": {
    "lipstick": "pink",
    "blush": "light",
    "eyeshadow": null,
    "eyeliner": null
  }
}
```

### Syncing
- Avatar config saved to `users.avatar_config` on Save
- Broadcast `avatar_config_update` event so partner sees the change immediately
- Partner's room re-renders the avatar with new layers

---

## Realtime
- Broadcast on `pair:{pair_id}:events`:
  - `{ type: 'avatar_config_update', user_id, avatar_config }`

---

## Edge Cases
- **Male avatar clicks makeup stand**: stand shows a playful message "This is [partner name]'s makeup stand! 💄" and is not interactive for the male avatar. Makeup is exclusive to the female avatar.
- **Missing sprite for animation state**: fall back to idle frame for that layer. Log warning.
- **Too many layers impacting performance**: unlikely at 32x48 pixel resolution, but if needed, pre-composite common outfit combinations into single sprites.
- **Pet pathfinding**: pet follows avatar with a slight delay (0.5s), takes the same path. If avatar stops, pet catches up and sits beside them.
- **Changing outfit while offline**: changes saved locally and synced on next connection.
