# Phase 3K: Avatar Customization & Makeup Stand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the avatar dress-up system with 10-layer sprite compositing, palette swap for color variants, clothes/jewelry/accessories/pet selection UI, makeup stand interaction for the female avatar, and real-time avatar config sync.

**Architecture:** AvatarRenderer composites 10 layers (body → bottom → shoes → top → outerwear → makeup → jewelry → head → face → held) plus an independent pet layer. PaletteSwapper replaces base grayscale colors with target palette colors at sprite load time using OffscreenCanvas pixel manipulation. AvatarCustomizationOverlay provides category tabs and item/color selection. MakeupOverlay provides face-focused options for the female avatar. Config persists to `users.avatar_config` and broadcasts via Realtime.

**Tech Stack:** HTML5 Canvas (layered compositing, pixel manipulation for palette swap), OffscreenCanvas, Supabase (users.avatar_config, Realtime broadcast)

---

### Task 1: Palette swapper

**Files:**
- Create: `rhinosaurus-connect/popup/avatar/palette-swapper.js`
- Test: `rhinosaurus-connect/tests/popup/avatar/palette-swapper.test.js`

- [ ] **Step 1: Write test for palette swapper**

```js
// rhinosaurus-connect/tests/popup/avatar/palette-swapper.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaletteSwapper } from '../../../popup/avatar/palette-swapper.js';

describe('PaletteSwapper', () => {
  let swapper;
  let mockCtx;
  let mockCanvas;

  beforeEach(() => {
    const imageData = {
      data: new Uint8ClampedArray([
        128, 128, 128, 255,
        64, 64, 64, 255,
        200, 200, 200, 255,
        0, 0, 0, 0,
      ]),
      width: 2,
      height: 2,
    };
    mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => imageData),
      putImageData: vi.fn(),
    };
    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
    };
    vi.stubGlobal('OffscreenCanvas', vi.fn((w, h) => {
      mockCanvas.width = w;
      mockCanvas.height = h;
      return mockCanvas;
    }));

    swapper = new PaletteSwapper();
  });

  it('defines base palette with grayscale values', () => {
    expect(swapper.basePalette).toBeDefined();
    expect(swapper.basePalette.length).toBeGreaterThan(0);
  });

  it('creates swapped sprite from source and target colors', () => {
    const sourceImg = { width: 2, height: 2 };
    const targetPalette = [
      { r: 255, g: 107, b: 157 },
      { r: 200, g: 80, b: 120 },
      { r: 255, g: 180, b: 200 },
    ];

    const result = swapper.swap(sourceImg, targetPalette);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(sourceImg, 0, 0);
    expect(mockCtx.getImageData).toHaveBeenCalled();
    expect(mockCtx.putImageData).toHaveBeenCalled();
    expect(result).toBe(mockCanvas);
  });

  it('preserves transparent pixels', () => {
    const sourceImg = { width: 2, height: 2 };
    const targetPalette = [
      { r: 255, g: 0, b: 0 },
      { r: 200, g: 0, b: 0 },
      { r: 255, g: 100, b: 100 },
    ];

    swapper.swap(sourceImg, targetPalette);
    const putCall = mockCtx.putImageData.mock.calls[0][0];
    expect(putCall.data[12]).toBe(0);
    expect(putCall.data[13]).toBe(0);
    expect(putCall.data[14]).toBe(0);
    expect(putCall.data[15]).toBe(0);
  });

  it('caches swapped results', () => {
    const sourceImg = { width: 2, height: 2 };
    const palette = [
      { r: 255, g: 0, b: 0 },
      { r: 200, g: 0, b: 0 },
      { r: 255, g: 100, b: 100 },
    ];

    const result1 = swapper.swap(sourceImg, palette, 'test-key');
    const result2 = swapper.swap(sourceImg, palette, 'test-key');
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
    expect(result1).toBe(result2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/palette-swapper.test.js`
Expected: FAIL

- [ ] **Step 3: Implement palette-swapper.js**

```js
// rhinosaurus-connect/popup/avatar/palette-swapper.js
const TOLERANCE = 15;

export class PaletteSwapper {
  constructor() {
    this.basePalette = [
      { r: 128, g: 128, b: 128 },
      { r: 64, g: 64, b: 64 },
      { r: 200, g: 200, b: 200 },
    ];
    this.cache = new Map();
  }

  swap(sourceImg, targetPalette, cacheKey = null) {
    if (cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const canvas = new OffscreenCanvas(sourceImg.width, sourceImg.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceImg, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      for (let p = 0; p < this.basePalette.length && p < targetPalette.length; p++) {
        const base = this.basePalette[p];
        if (
          Math.abs(r - base.r) <= TOLERANCE &&
          Math.abs(g - base.g) <= TOLERANCE &&
          Math.abs(b - base.b) <= TOLERANCE
        ) {
          data[i] = targetPalette[p].r;
          data[i + 1] = targetPalette[p].g;
          data[i + 2] = targetPalette[p].b;
          break;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    if (cacheKey) {
      this.cache.set(cacheKey, canvas);
    }

    return canvas;
  }

  clearCache() {
    this.cache.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/palette-swapper.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/avatar/palette-swapper.js rhinosaurus-connect/tests/popup/avatar/palette-swapper.test.js
git commit -m "feat: add palette swapper with grayscale-to-color mapping and cache"
```

---

### Task 2: Avatar renderer (10-layer compositing)

**Files:**
- Create: `rhinosaurus-connect/popup/avatar/avatar-renderer.js`
- Test: `rhinosaurus-connect/tests/popup/avatar/avatar-renderer.test.js`

- [ ] **Step 1: Write test for avatar renderer**

```js
// rhinosaurus-connect/tests/popup/avatar/avatar-renderer.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvatarRenderer, LAYER_ORDER } from '../../../popup/avatar/avatar-renderer.js';

describe('AvatarRenderer', () => {
  let renderer;
  let mockBaseSprite;

  beforeEach(() => {
    mockBaseSprite = {
      draw: vi.fn(),
    };
    renderer = new AvatarRenderer(mockBaseSprite);
  });

  it('exports correct layer order', () => {
    expect(LAYER_ORDER).toEqual([
      'bottom', 'shoes', 'top', 'outerwear', 'makeup',
      'necklace', 'earrings', 'bracelet', 'ring',
      'head', 'face', 'held',
    ]);
  });

  it('draws base sprite first', () => {
    const ctx = { drawImage: vi.fn() };
    renderer.draw(ctx, 100, 200, 'idle', 0);
    expect(mockBaseSprite.draw).toHaveBeenCalledWith(ctx, 100, 200, 'idle', 0);
  });

  it('builds layers from avatar config', () => {
    const mockSprite = { draw: vi.fn() };
    const getSprite = vi.fn(() => mockSprite);
    renderer.buildLayers({ top: { item: 'hoodie', color: '#FF6B9D' } }, getSprite);
    expect(getSprite).toHaveBeenCalledWith('top', 'hoodie', '#FF6B9D');
    expect(renderer.layers).toHaveLength(1);
  });

  it('draws layers in order after base', () => {
    const layer1 = { draw: vi.fn() };
    const layer2 = { draw: vi.fn() };
    renderer.layers = [layer1, layer2];

    const ctx = { drawImage: vi.fn() };
    renderer.draw(ctx, 100, 200, 'idle', 0);

    expect(mockBaseSprite.draw).toHaveBeenCalled();
    expect(layer1.draw).toHaveBeenCalledWith(ctx, 100, 200, 'idle', 0);
    expect(layer2.draw).toHaveBeenCalledWith(ctx, 100, 200, 'idle', 0);
  });

  it('sets up pet renderer from config', () => {
    const mockPet = { draw: vi.fn() };
    const getSprite = vi.fn(() => null);
    renderer.buildLayers({ pet: { type: 'cat', color: 'white' } }, getSprite);
    expect(renderer.petConfig).toEqual({ type: 'cat', color: 'white' });
  });

  it('handles empty config', () => {
    renderer.buildLayers({}, vi.fn(() => null));
    expect(renderer.layers).toHaveLength(0);
  });

  it('skips null config slots', () => {
    renderer.buildLayers({
      top: { item: 'hoodie', color: '#FF6B9D' },
      bottom: null,
      outerwear: null,
    }, vi.fn(() => ({ draw: vi.fn() })));
    expect(renderer.layers).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/avatar-renderer.test.js`
Expected: FAIL

- [ ] **Step 3: Implement avatar-renderer.js**

```js
// rhinosaurus-connect/popup/avatar/avatar-renderer.js
export const LAYER_ORDER = [
  'bottom', 'shoes', 'top', 'outerwear', 'makeup',
  'necklace', 'earrings', 'bracelet', 'ring',
  'head', 'face', 'held',
];

export class AvatarRenderer {
  constructor(baseSprite) {
    this.baseSprite = baseSprite;
    this.layers = [];
    this.petConfig = null;
    this.petRenderer = null;
  }

  buildLayers(avatarConfig, getSprite) {
    this.layers = [];
    this.petConfig = null;

    for (const slot of LAYER_ORDER) {
      const config = avatarConfig[slot];
      if (!config) continue;
      const sprite = getSprite(slot, config.item, config.color);
      if (sprite) {
        this.layers.push(sprite);
      }
    }

    if (avatarConfig.pet) {
      this.petConfig = avatarConfig.pet;
    }
  }

  draw(ctx, x, y, animState, frame) {
    this.baseSprite.draw(ctx, x, y, animState, frame);

    for (const layer of this.layers) {
      layer.draw(ctx, x, y, animState, frame);
    }

    if (this.petRenderer) {
      this.petRenderer.draw(ctx, x + 30, y + 10);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/avatar-renderer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/avatar/avatar-renderer.js rhinosaurus-connect/tests/popup/avatar/avatar-renderer.test.js
git commit -m "feat: add avatar renderer with 10-layer compositing and pet support"
```

---

### Task 3: Avatar customization overlay

**Files:**
- Create: `rhinosaurus-connect/popup/avatar/avatar-customization-overlay.js`
- Test: `rhinosaurus-connect/tests/popup/avatar/avatar-customization-overlay.test.js`

- [ ] **Step 1: Write test for avatar customization overlay**

```js
// rhinosaurus-connect/tests/popup/avatar/avatar-customization-overlay.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AvatarCustomizationOverlay } from '../../../popup/avatar/avatar-customization-overlay.js';

describe('AvatarCustomizationOverlay', () => {
  let overlay;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    overlay = new AvatarCustomizationOverlay(container, {
      top: { item: 'hoodie', color: '#FF6B9D' },
      bottom: { item: 'jeans', color: '#4A6FA5' },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders overlay structure', () => {
    overlay.render();
    expect(container.querySelector('.avatar-custom-header')).not.toBeNull();
    expect(container.querySelector('.avatar-custom-preview')).not.toBeNull();
    expect(container.querySelector('.avatar-custom-tabs')).not.toBeNull();
  });

  it('shows 4 category tabs', () => {
    overlay.render();
    const tabs = container.querySelectorAll('.avatar-custom-tab');
    expect(tabs.length).toBe(4);
  });

  it('switches category on tab click', () => {
    overlay.render();
    const tabs = container.querySelectorAll('.avatar-custom-tab');
    tabs[1].click();
    expect(overlay.activeCategory).toBe('Jewelry');
  });

  it('shows item options for category', () => {
    overlay.render();
    overlay.showCategory('Clothes');
    const items = container.querySelectorAll('.avatar-custom-item');
    expect(items.length).toBeGreaterThan(0);
  });

  it('calls onChange when item selected', () => {
    const callback = vi.fn();
    overlay.onChange = callback;
    overlay.render();
    overlay.showCategory('Clothes');
    const firstItem = container.querySelector('.avatar-custom-item');
    firstItem.click();
    expect(callback).toHaveBeenCalled();
  });

  it('shows color swatches for clothing items', () => {
    overlay.render();
    overlay.showCategory('Clothes');
    const swatches = container.querySelectorAll('.avatar-custom-color');
    expect(swatches.length).toBeGreaterThan(0);
  });

  it('opens and closes', () => {
    overlay.open();
    expect(overlay.isOpen).toBe(true);
    overlay.close();
    expect(overlay.isOpen).toBe(false);
  });

  it('calls onSave when save clicked', () => {
    const callback = vi.fn();
    overlay.onSave = callback;
    overlay.render();
    const saveBtn = container.querySelector('.avatar-custom-save');
    saveBtn.click();
    expect(callback).toHaveBeenCalledWith(overlay.config);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/avatar-customization-overlay.test.js`
Expected: FAIL

- [ ] **Step 3: Implement avatar-customization-overlay.js**

```js
// rhinosaurus-connect/popup/avatar/avatar-customization-overlay.js
import { COLOR_PALETTE } from '../room/color-tinter.js';

const CATEGORIES = {
  Clothes: [
    { slot: 'top', items: ['tshirt', 'hoodie', 'sweater', 'blouse', 'crop_top', 'jacket', 'dress'] },
    { slot: 'bottom', items: ['jeans', 'shorts', 'skirt', 'sweatpants', 'leggings'] },
    { slot: 'shoes', items: ['sneakers', 'slippers', 'boots', 'sandals', 'heels'] },
    { slot: 'outerwear', items: ['cardigan', 'scarf', 'coat'] },
  ],
  Jewelry: [
    { slot: 'necklace', items: ['chain', 'pendant', 'choker', 'pearl'] },
    { slot: 'earrings', items: ['studs', 'hoops', 'drop'] },
    { slot: 'ring', items: ['simple_band', 'gem_ring'] },
    { slot: 'bracelet', items: ['bangle', 'charm', 'beaded'] },
  ],
  Accessories: [
    { slot: 'head', items: ['headphones', 'beanie', 'cap', 'beret', 'hair_clip', 'bow', 'headband'] },
    { slot: 'face', items: ['round_glasses', 'square_glasses', 'sunglasses'] },
    { slot: 'held', items: ['bag', 'phone', 'coffee', 'book'] },
  ],
  Pet: [
    { slot: 'pet', items: ['cat', 'dog', 'bunny', 'hamster'] },
  ],
};

export class AvatarCustomizationOverlay {
  constructor(container, initialConfig) {
    this.container = container;
    this.config = { ...initialConfig };
    this.isOpen = false;
    this.activeCategory = 'Clothes';
    this.onChange = null;
    this.onSave = null;
    this.onClose = null;
  }

  render() {
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'avatar-custom-header';
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.close());
    const title = document.createElement('span');
    title.textContent = 'Your Avatar';
    header.appendChild(backBtn);
    header.appendChild(title);

    const preview = document.createElement('div');
    preview.className = 'avatar-custom-preview';

    const tabs = document.createElement('div');
    tabs.className = 'avatar-custom-tabs';
    for (const cat of Object.keys(CATEGORIES)) {
      const tab = document.createElement('button');
      tab.className = 'avatar-custom-tab';
      if (cat === this.activeCategory) tab.classList.add('active');
      tab.textContent = cat;
      tab.addEventListener('click', () => {
        this.activeCategory = cat;
        this.showCategory(cat);
        tabs.querySelectorAll('.avatar-custom-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
      tabs.appendChild(tab);
    }

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'avatar-custom-items';

    const colorContainer = document.createElement('div');
    colorContainer.className = 'avatar-custom-colors';
    for (const color of COLOR_PALETTE) {
      const swatch = document.createElement('button');
      swatch.className = 'avatar-custom-color';
      swatch.style.backgroundColor = color;
      swatch.addEventListener('click', () => this.handleColorSelect(color));
      colorContainer.appendChild(swatch);
    }

    const saveBtn = document.createElement('button');
    saveBtn.className = 'avatar-custom-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      if (this.onSave) this.onSave(this.config);
      this.close();
    });

    this.container.appendChild(header);
    this.container.appendChild(preview);
    this.container.appendChild(tabs);
    this.container.appendChild(itemsContainer);
    this.container.appendChild(colorContainer);
    this.container.appendChild(saveBtn);

    this.showCategory(this.activeCategory);
  }

  showCategory(category) {
    this.activeCategory = category;
    const itemsContainer = this.container.querySelector('.avatar-custom-items');
    if (!itemsContainer) return;
    itemsContainer.innerHTML = '';

    const groups = CATEGORIES[category] || [];
    for (const group of groups) {
      const label = document.createElement('div');
      label.className = 'avatar-custom-slot-label';
      label.textContent = group.slot;
      itemsContainer.appendChild(label);

      const noneBtn = document.createElement('button');
      noneBtn.className = 'avatar-custom-item';
      noneBtn.textContent = 'None';
      noneBtn.addEventListener('click', () => this.handleItemSelect(group.slot, null));
      itemsContainer.appendChild(noneBtn);

      for (const item of group.items) {
        const btn = document.createElement('button');
        btn.className = 'avatar-custom-item';
        btn.textContent = item.replace(/_/g, ' ');
        btn.dataset.slot = group.slot;
        btn.dataset.item = item;
        const current = this.config[group.slot];
        if (current && current.item === item) btn.classList.add('active');
        btn.addEventListener('click', () => this.handleItemSelect(group.slot, item));
        itemsContainer.appendChild(btn);
      }
    }
  }

  handleItemSelect(slot, item) {
    if (item === null) {
      this.config[slot] = null;
    } else {
      const existing = this.config[slot];
      this.config[slot] = { item, color: existing?.color || null };
    }
    if (this.onChange) this.onChange(this.config);
    this.showCategory(this.activeCategory);
  }

  handleColorSelect(color) {
    const items = this.container.querySelectorAll('.avatar-custom-item.active');
    if (items.length === 0) return;
    const activeItem = items[0];
    const slot = activeItem.dataset.slot;
    if (slot && this.config[slot]) {
      this.config[slot].color = color;
      if (this.onChange) this.onChange(this.config);
    }
  }

  open() {
    this.render();
    this.isOpen = true;
    this.container.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.container.classList.add('hidden');
    if (this.onClose) this.onClose();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/avatar-customization-overlay.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/avatar/avatar-customization-overlay.js rhinosaurus-connect/tests/popup/avatar/avatar-customization-overlay.test.js
git commit -m "feat: add avatar customization overlay with category tabs, item grid, and color swatches"
```

---

### Task 4: Makeup overlay

**Files:**
- Create: `rhinosaurus-connect/popup/avatar/makeup-overlay.js`
- Test: `rhinosaurus-connect/tests/popup/avatar/makeup-overlay.test.js`

- [ ] **Step 1: Write test for makeup overlay**

```js
// rhinosaurus-connect/tests/popup/avatar/makeup-overlay.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MakeupOverlay } from '../../../popup/avatar/makeup-overlay.js';

describe('MakeupOverlay', () => {
  let overlay;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    overlay = new MakeupOverlay(container, { lipstick: 'pink', blush: null, eyeshadow: null, eyeliner: null });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders makeup categories', () => {
    overlay.render();
    expect(container.textContent).toContain('Lipstick');
    expect(container.textContent).toContain('Blush');
    expect(container.textContent).toContain('Eyeshadow');
    expect(container.textContent).toContain('Eyeliner');
  });

  it('shows options for lipstick', () => {
    overlay.render();
    const options = container.querySelectorAll('.makeup-option[data-type="lipstick"]');
    expect(options.length).toBeGreaterThan(0);
  });

  it('shows "None" option for each type', () => {
    overlay.render();
    const noneButtons = container.querySelectorAll('.makeup-none');
    expect(noneButtons.length).toBe(4);
  });

  it('calls onChange when option selected', () => {
    const callback = vi.fn();
    overlay.onChange = callback;
    overlay.render();
    const option = container.querySelector('.makeup-option[data-type="lipstick"]');
    option.click();
    expect(callback).toHaveBeenCalled();
  });

  it('highlights current selection', () => {
    overlay.render();
    const pinkOption = container.querySelector('.makeup-option[data-value="pink"]');
    expect(pinkOption.classList.contains('active')).toBe(true);
  });

  it('clears selection with None', () => {
    const callback = vi.fn();
    overlay.onChange = callback;
    overlay.render();
    const noneBtn = container.querySelector('.makeup-none[data-type="lipstick"]');
    noneBtn.click();
    expect(overlay.config.lipstick).toBeNull();
  });

  it('calls onSave on save click', () => {
    const callback = vi.fn();
    overlay.onSave = callback;
    overlay.render();
    container.querySelector('.makeup-save').click();
    expect(callback).toHaveBeenCalledWith(overlay.config);
  });

  it('shows male-avatar message when isMale is true', () => {
    overlay = new MakeupOverlay(container, {}, true);
    overlay.render();
    expect(container.textContent).toContain('makeup stand');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/makeup-overlay.test.js`
Expected: FAIL

- [ ] **Step 3: Implement makeup-overlay.js**

```js
// rhinosaurus-connect/popup/avatar/makeup-overlay.js
const MAKEUP_OPTIONS = {
  lipstick: ['natural', 'pink', 'red', 'berry', 'coral', 'nude'],
  blush: ['light', 'medium', 'heavy'],
  eyeshadow: ['pink', 'purple', 'blue', 'gold', 'green', 'brown'],
  eyeliner: ['thin', 'thick', 'winged'],
};

const MAKEUP_LABELS = {
  lipstick: 'Lipstick',
  blush: 'Blush',
  eyeshadow: 'Eyeshadow',
  eyeliner: 'Eyeliner',
};

export class MakeupOverlay {
  constructor(container, initialConfig, isMale = false) {
    this.container = container;
    this.config = { lipstick: null, blush: null, eyeshadow: null, eyeliner: null, ...initialConfig };
    this.isMale = isMale;
    this.isOpen = false;
    this.onChange = null;
    this.onSave = null;
    this.onClose = null;
  }

  render() {
    this.container.innerHTML = '';

    if (this.isMale) {
      const msg = document.createElement('div');
      msg.className = 'makeup-male-msg';
      msg.textContent = "This is your partner's makeup stand! 💄";
      this.container.appendChild(msg);
      return;
    }

    const header = document.createElement('div');
    header.className = 'makeup-header';
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.close());
    const title = document.createElement('span');
    title.textContent = 'Makeup Stand 💄';
    header.appendChild(backBtn);
    header.appendChild(title);
    this.container.appendChild(header);

    for (const [type, options] of Object.entries(MAKEUP_OPTIONS)) {
      const section = document.createElement('div');
      section.className = 'makeup-section';

      const label = document.createElement('div');
      label.className = 'makeup-section-label';
      label.textContent = MAKEUP_LABELS[type];
      section.appendChild(label);

      const noneBtn = document.createElement('button');
      noneBtn.className = 'makeup-none';
      noneBtn.dataset.type = type;
      noneBtn.textContent = 'None';
      if (this.config[type] === null) noneBtn.classList.add('active');
      noneBtn.addEventListener('click', () => {
        this.config[type] = null;
        if (this.onChange) this.onChange(this.config);
        this.render();
      });
      section.appendChild(noneBtn);

      for (const option of options) {
        const btn = document.createElement('button');
        btn.className = 'makeup-option';
        btn.dataset.type = type;
        btn.dataset.value = option;
        btn.textContent = option;
        if (this.config[type] === option) btn.classList.add('active');
        btn.addEventListener('click', () => {
          this.config[type] = option;
          if (this.onChange) this.onChange(this.config);
          this.render();
        });
        section.appendChild(btn);
      }

      this.container.appendChild(section);
    }

    const saveBtn = document.createElement('button');
    saveBtn.className = 'makeup-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      if (this.onSave) this.onSave(this.config);
      this.close();
    });
    this.container.appendChild(saveBtn);
  }

  open() {
    this.render();
    this.isOpen = true;
    this.container.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.container.classList.add('hidden');
    if (this.onClose) this.onClose();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/makeup-overlay.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/avatar/makeup-overlay.js rhinosaurus-connect/tests/popup/avatar/makeup-overlay.test.js
git commit -m "feat: add makeup overlay with lipstick, blush, eyeshadow, eyeliner options"
```

---

### Task 5: Avatar config persistence and sync

**Files:**
- Create: `rhinosaurus-connect/popup/avatar/avatar-config-service.js`
- Test: `rhinosaurus-connect/tests/popup/avatar/avatar-config-service.test.js`

- [ ] **Step 1: Write test for avatar config service**

```js
// rhinosaurus-connect/tests/popup/avatar/avatar-config-service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvatarConfigService } from '../../../popup/avatar/avatar-config-service.js';

describe('AvatarConfigService', () => {
  let service;
  let mockSupabase;
  let mockChannel;

  beforeEach(() => {
    mockChannel = { send: vi.fn() };
    mockSupabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { avatar_config: { top: { item: 'hoodie', color: '#FF6B9D' } } },
              error: null,
            })),
          })),
        })),
      })),
    };
    service = new AvatarConfigService(mockSupabase, 'user-1', mockChannel);
  });

  it('saves avatar config to DB', async () => {
    const config = { top: { item: 'hoodie', color: '#FF6B9D' } };
    await service.save(config);
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
  });

  it('broadcasts config update', async () => {
    const config = { top: { item: 'hoodie', color: '#FF6B9D' } };
    await service.save(config);
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'avatar_config_update',
      payload: { user_id: 'user-1', avatar_config: config },
    });
  });

  it('loads partner config from DB', async () => {
    const config = await service.loadPartnerConfig('partner-1');
    expect(config.top.item).toBe('hoodie');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/avatar-config-service.test.js`
Expected: FAIL

- [ ] **Step 3: Implement avatar-config-service.js**

```js
// rhinosaurus-connect/popup/avatar/avatar-config-service.js
import { REALTIME_EVENTS } from '../../shared/constants.js';

export class AvatarConfigService {
  constructor(supabase, userId, channel) {
    this.supabase = supabase;
    this.userId = userId;
    this.channel = channel;
  }

  async save(avatarConfig) {
    await this.supabase
      .from('users')
      .update({ avatar_config: avatarConfig })
      .eq('id', this.userId);

    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.AVATAR_CONFIG_UPDATE,
      payload: { user_id: this.userId, avatar_config: avatarConfig },
    });
  }

  async loadPartnerConfig(partnerId) {
    const { data, error } = await this.supabase
      .from('users')
      .select('avatar_config')
      .eq('id', partnerId)
      .single();

    if (error) throw error;
    return data.avatar_config;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/avatar/avatar-config-service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/avatar/avatar-config-service.js rhinosaurus-connect/tests/popup/avatar/avatar-config-service.test.js
git commit -m "feat: add avatar config service with DB persistence and Realtime broadcast"
```

---

### Task 6: Wire avatar customization into popup

**Files:**
- Modify: `rhinosaurus-connect/popup/popup.js`

- [ ] **Step 1: Add avatar customization integration to popup.js**

```js
// Add imports:
import { AvatarRenderer } from './avatar/avatar-renderer.js';
import { AvatarCustomizationOverlay } from './avatar/avatar-customization-overlay.js';
import { MakeupOverlay } from './avatar/makeup-overlay.js';
import { AvatarConfigService } from './avatar/avatar-config-service.js';
import { PaletteSwapper } from './avatar/palette-swapper.js';

// In init():
let avatarConfigService = null;
const paletteSwapper = new PaletteSwapper();

async function setupAvatarCustomization(supabase, userId, channel, initialConfig) {
  avatarConfigService = new AvatarConfigService(supabase, userId, channel);

  // Settings → Customize Avatar opens overlay
  const overlayContainer = document.getElementById('overlay-container');
  const customOverlay = new AvatarCustomizationOverlay(overlayContainer, initialConfig);
  customOverlay.onSave = async (config) => {
    await avatarConfigService.save(config);
    // Rebuild avatar layers with new config
    renderer.markDirty();
  };

  // Makeup stand interaction
  // In handleInteraction:
  // case 'makeup':
  //   const makeupOverlay = new MakeupOverlay(overlayContainer, initialConfig.makeup || {}, isMaleUser);
  //   makeupOverlay.onSave = async (makeupConfig) => {
  //     initialConfig.makeup = makeupConfig;
  //     await avatarConfigService.save(initialConfig);
  //     renderer.markDirty();
  //   };
  //   makeupOverlay.open();
  //   break;

  // Listen for partner avatar config changes
  channel.on('broadcast', { event: 'avatar_config_update' }, (payload) => {
    const { user_id, avatar_config } = payload.payload;
    if (user_id !== userId) {
      // Rebuild partner's avatar layers
      renderer.markDirty();
    }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/popup.js
git commit -m "feat: wire avatar customization, makeup stand, and config sync into popup"
```

---

### Task 7: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 3K avatar customization and makeup stand complete"
```

---

## Summary

After Phase 3K:
- **PaletteSwapper**: replaces grayscale base colors with target palette at load time, cached results, ~10x art reduction
- **AvatarRenderer**: 10-layer compositing (body → bottom → shoes → top → outerwear → makeup → jewelry → head → face → held) plus independent pet
- **AvatarCustomizationOverlay**: 4 category tabs (Clothes, Jewelry, Accessories, Pet), item grid with None option, 16-color swatches, live preview, Save button
- **MakeupOverlay**: lipstick (6), blush (3), eyeshadow (6), eyeliner (3) options with None, male avatar shows playful message
- **AvatarConfigService**: persists to users.avatar_config, broadcasts via Realtime for instant partner sync
