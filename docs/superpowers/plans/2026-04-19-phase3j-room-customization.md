# Phase 3J: Room Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement edit mode for the shared bedroom — drag furniture to move, swap variants, change colors with a limited palette, add/remove decorative items (30-item cap, essential protection), color tinting, and real-time sync of all changes.

**Architecture:** EditModeController manages enter/exit edit mode, furniture selection, and drag state. CustomizationPanel renders variant thumbnails and color swatches as an HTML panel below the canvas. ColorTinter applies palette tints to sprite regions using `globalCompositeOperation`. FurnitureCatalog provides available items for the "Add Item" browser. All changes broadcast via RoomSync immediately and debounce DB writes.

**Tech Stack:** HTML5 Canvas (tinting, drag preview), Supabase Realtime (broadcast), Supabase Database (room_state)

---

### Task 1: Edit mode controller

**Files:**
- Create: `rhinosaurus-connect/popup/room/edit-mode.js`
- Test: `rhinosaurus-connect/tests/popup/room/edit-mode.test.js`

- [ ] **Step 1: Write test for edit mode controller**

```js
// rhinosaurus-connect/tests/popup/room/edit-mode.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditModeController } from '../../../popup/room/edit-mode.js';

describe('EditModeController', () => {
  let controller;
  let mockRoomState;
  let mockSync;

  beforeEach(() => {
    mockRoomState = {
      furniture: [
        { id: 'bed-1', type: 'bed', x: 40, y: 80 },
        { id: 'rug-1', type: 'rug', x: 130, y: 160 },
      ],
      updateFurniture: vi.fn(() => true),
      addFurniture: vi.fn(() => true),
      removeFurniture: vi.fn(() => true),
      isEssential: vi.fn((id) => id === 'bed-1'),
    };
    mockSync = {
      broadcastFurnitureMove: vi.fn(),
      broadcastFurnitureChange: vi.fn(),
      scheduleSave: vi.fn(),
    };
    controller = new EditModeController(mockRoomState, mockSync);
  });

  it('starts not in edit mode', () => {
    expect(controller.isEditMode).toBe(false);
  });

  it('enters edit mode', () => {
    controller.enter();
    expect(controller.isEditMode).toBe(true);
  });

  it('exits edit mode and saves', () => {
    controller.enter();
    controller.exit();
    expect(controller.isEditMode).toBe(false);
    expect(mockSync.scheduleSave).toHaveBeenCalled();
  });

  it('selects furniture item', () => {
    controller.enter();
    controller.select('bed-1');
    expect(controller.selectedId).toBe('bed-1');
  });

  it('deselects on second click', () => {
    controller.enter();
    controller.select('bed-1');
    controller.select('bed-1');
    expect(controller.selectedId).toBeNull();
  });

  it('starts drag on selected item', () => {
    controller.enter();
    controller.select('bed-1');
    controller.startDrag(50, 90);
    expect(controller.isDragging).toBe(true);
  });

  it('moves item during drag', () => {
    controller.enter();
    controller.select('bed-1');
    controller.startDrag(50, 90);
    controller.drag(70, 110);
    expect(mockRoomState.updateFurniture).toHaveBeenCalledWith('bed-1', { x: 70, y: 110 });
  });

  it('broadcasts move on drag end', () => {
    controller.enter();
    controller.select('bed-1');
    controller.startDrag(50, 90);
    controller.drag(70, 110);
    controller.endDrag();
    expect(controller.isDragging).toBe(false);
    expect(mockSync.broadcastFurnitureMove).toHaveBeenCalledWith('bed-1', { x: 70, y: 110 });
  });

  it('changes variant and broadcasts', () => {
    controller.enter();
    controller.select('bed-1');
    controller.changeVariant('double-metal');
    expect(mockRoomState.updateFurniture).toHaveBeenCalledWith('bed-1', { variant: 'double-metal' });
    expect(mockSync.broadcastFurnitureChange).toHaveBeenCalled();
  });

  it('changes color and broadcasts', () => {
    controller.enter();
    controller.select('bed-1');
    controller.changeColor('#9D6BFF');
    expect(mockRoomState.updateFurniture).toHaveBeenCalledWith('bed-1', { color: '#9D6BFF' });
    expect(mockSync.broadcastFurnitureChange).toHaveBeenCalled();
  });

  it('prevents removing essential items', () => {
    controller.enter();
    const result = controller.removeItem('bed-1');
    expect(result).toBe(false);
    expect(mockRoomState.removeFurniture).not.toHaveBeenCalled();
  });

  it('removes non-essential items', () => {
    controller.enter();
    const result = controller.removeItem('rug-1');
    expect(result).toBe(true);
    expect(mockRoomState.removeFurniture).toHaveBeenCalledWith('rug-1');
  });

  it('adds new item', () => {
    controller.enter();
    const item = { id: 'plant-1', type: 'plant', variant: 'potted', x: 100, y: 200 };
    const result = controller.addItem(item);
    expect(result).toBe(true);
    expect(mockRoomState.addFurniture).toHaveBeenCalledWith(item);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/edit-mode.test.js`
Expected: FAIL

- [ ] **Step 3: Implement edit-mode.js**

```js
// rhinosaurus-connect/popup/room/edit-mode.js
export class EditModeController {
  constructor(roomState, roomSync) {
    this.roomState = roomState;
    this.sync = roomSync;
    this.isEditMode = false;
    this.selectedId = null;
    this.isDragging = false;
    this.lastDragPos = null;
    this.onSelectionChange = null;
    this.onModeChange = null;
  }

  enter() {
    this.isEditMode = true;
    this.selectedId = null;
    if (this.onModeChange) this.onModeChange(true);
  }

  exit() {
    this.isEditMode = false;
    this.selectedId = null;
    this.isDragging = false;
    this.sync.scheduleSave(this.roomState.toDbRecord());
    if (this.onModeChange) this.onModeChange(false);
  }

  select(furnitureId) {
    if (this.selectedId === furnitureId) {
      this.selectedId = null;
    } else {
      this.selectedId = furnitureId;
    }
    if (this.onSelectionChange) this.onSelectionChange(this.selectedId);
  }

  startDrag(x, y) {
    if (!this.selectedId) return;
    this.isDragging = true;
    this.lastDragPos = { x, y };
  }

  drag(x, y) {
    if (!this.isDragging || !this.selectedId) return;
    this.roomState.updateFurniture(this.selectedId, { x, y });
    this.lastDragPos = { x, y };
  }

  endDrag() {
    if (!this.isDragging || !this.selectedId) return;
    this.isDragging = false;
    if (this.lastDragPos) {
      this.sync.broadcastFurnitureMove(this.selectedId, this.lastDragPos);
      this.sync.scheduleSave(this.roomState.toDbRecord());
    }
    this.lastDragPos = null;
  }

  changeVariant(variant) {
    if (!this.selectedId) return;
    this.roomState.updateFurniture(this.selectedId, { variant });
    this.sync.broadcastFurnitureChange(this.selectedId, { variant });
    this.sync.scheduleSave(this.roomState.toDbRecord());
  }

  changeColor(color) {
    if (!this.selectedId) return;
    this.roomState.updateFurniture(this.selectedId, { color });
    this.sync.broadcastFurnitureChange(this.selectedId, { color });
    this.sync.scheduleSave(this.roomState.toDbRecord());
  }

  removeItem(furnitureId) {
    if (this.roomState.isEssential(furnitureId)) return false;
    const removed = this.roomState.removeFurniture(furnitureId);
    if (removed) {
      this.sync.broadcastFurnitureChange(furnitureId, { removed: true });
      this.sync.scheduleSave(this.roomState.toDbRecord());
      if (this.selectedId === furnitureId) this.selectedId = null;
    }
    return removed;
  }

  addItem(item) {
    const added = this.roomState.addFurniture(item);
    if (added) {
      this.sync.broadcastFurnitureChange(item.id, { added: true, ...item });
      this.sync.scheduleSave(this.roomState.toDbRecord());
    }
    return added;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/edit-mode.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/edit-mode.js rhinosaurus-connect/tests/popup/room/edit-mode.test.js
git commit -m "feat: add edit mode controller with drag, variant/color change, and add/remove"
```

---

### Task 2: Color tinter

**Files:**
- Create: `rhinosaurus-connect/popup/room/color-tinter.js`
- Test: `rhinosaurus-connect/tests/popup/room/color-tinter.test.js`

- [ ] **Step 1: Write test for color tinter**

```js
// rhinosaurus-connect/tests/popup/room/color-tinter.test.js
import { describe, it, expect, vi } from 'vitest';
import { ColorTinter, COLOR_PALETTE } from '../../../popup/room/color-tinter.js';

describe('ColorTinter', () => {
  it('exports a palette of 16 colors', () => {
    expect(COLOR_PALETTE).toHaveLength(16);
  });

  it('applies tint to canvas context', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      globalAlpha: 1,
    };
    const tinter = new ColorTinter();
    tinter.applyTint(ctx, '#FF6B9D', 10, 10, 40, 30);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 10, 40, 30);
  });

  it('uses 0.4 alpha for subtle tint', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      globalAlpha: 1,
    };
    const tinter = new ColorTinter();
    tinter.applyTint(ctx, '#FF6B9D', 0, 0, 10, 10);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('skips tint when color is null', () => {
    const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn() };
    const tinter = new ColorTinter();
    tinter.applyTint(ctx, null, 0, 0, 10, 10);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/color-tinter.test.js`
Expected: FAIL

- [ ] **Step 3: Implement color-tinter.js**

```js
// rhinosaurus-connect/popup/room/color-tinter.js
export const COLOR_PALETTE = [
  '#FFB6C1', '#FF6B9D', '#E6E6FA', '#87CEEB',
  '#98FB98', '#8FBC8F', '#FFFDD0', '#FFF8E7',
  '#FF7F50', '#FFDAB9', '#FFFACD', '#D3D3D3',
  '#A0522D', '#654321', '#36454F', '#000000',
];

const TINT_ALPHA = 0.4;

export class ColorTinter {
  applyTint(ctx, color, x, y, w, h) {
    if (!color) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color;
    ctx.globalAlpha = TINT_ALPHA;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/color-tinter.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/color-tinter.js rhinosaurus-connect/tests/popup/room/color-tinter.test.js
git commit -m "feat: add color tinter with 16-color palette and source-atop blending"
```

---

### Task 3: Customization panel (HTML overlay)

**Files:**
- Create: `rhinosaurus-connect/popup/room/customization-panel.js`
- Test: `rhinosaurus-connect/tests/popup/room/customization-panel.test.js`

- [ ] **Step 1: Write test for customization panel**

```js
// rhinosaurus-connect/tests/popup/room/customization-panel.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomizationPanel } from '../../../popup/room/customization-panel.js';

describe('CustomizationPanel', () => {
  let panel;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    panel = new CustomizationPanel(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts hidden', () => {
    expect(panel.isVisible).toBe(false);
  });

  it('shows for selected item', () => {
    panel.show({ id: 'bed-1', type: 'bed', variant: 'double-wood', color: '#FF6B9D' }, false);
    expect(panel.isVisible).toBe(true);
    expect(container.querySelector('.custom-panel')).not.toBeNull();
  });

  it('displays item name', () => {
    panel.show({ id: 'bed-1', type: 'bed', variant: 'double-wood', color: '#FF6B9D' }, false);
    expect(container.textContent).toContain('bed');
  });

  it('shows color swatches', () => {
    panel.show({ id: 'bed-1', type: 'bed', variant: 'double-wood', color: '#FF6B9D' }, false);
    const swatches = container.querySelectorAll('.custom-color-swatch');
    expect(swatches.length).toBe(16);
  });

  it('calls onColorChange when swatch clicked', () => {
    const callback = vi.fn();
    panel.onColorChange = callback;
    panel.show({ id: 'bed-1', type: 'bed', variant: 'double-wood', color: '#FF6B9D' }, false);
    const swatch = container.querySelector('.custom-color-swatch');
    swatch.click();
    expect(callback).toHaveBeenCalled();
  });

  it('shows remove button for non-essential items', () => {
    panel.show({ id: 'rug-1', type: 'rug', variant: 'round', color: '#D4A5C9' }, false);
    expect(container.querySelector('.custom-remove-btn')).not.toBeNull();
  });

  it('disables remove button for essential items', () => {
    panel.show({ id: 'bed-1', type: 'bed', variant: 'double-wood', color: '#FF6B9D' }, true);
    const removeBtn = container.querySelector('.custom-remove-btn');
    expect(removeBtn.disabled).toBe(true);
  });

  it('calls onRemove when remove clicked', () => {
    const callback = vi.fn();
    panel.onRemove = callback;
    panel.show({ id: 'rug-1', type: 'rug', variant: 'round', color: '#D4A5C9' }, false);
    container.querySelector('.custom-remove-btn').click();
    expect(callback).toHaveBeenCalledWith('rug-1');
  });

  it('hides panel', () => {
    panel.show({ id: 'bed-1', type: 'bed', variant: 'double-wood' }, false);
    panel.hide();
    expect(panel.isVisible).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/customization-panel.test.js`
Expected: FAIL

- [ ] **Step 3: Implement customization-panel.js**

```js
// rhinosaurus-connect/popup/room/customization-panel.js
import { COLOR_PALETTE } from './color-tinter.js';

export class CustomizationPanel {
  constructor(container) {
    this.container = container;
    this.isVisible = false;
    this.onColorChange = null;
    this.onVariantChange = null;
    this.onRemove = null;
    this.panelEl = null;
  }

  show(item, isEssential) {
    this.hide();
    this.isVisible = true;

    this.panelEl = document.createElement('div');
    this.panelEl.className = 'custom-panel';

    const title = document.createElement('div');
    title.className = 'custom-panel-title';
    title.textContent = `Customizing: ${item.type}`;

    const colorSection = document.createElement('div');
    colorSection.className = 'custom-color-section';
    for (const color of COLOR_PALETTE) {
      const swatch = document.createElement('button');
      swatch.className = 'custom-color-swatch';
      swatch.style.backgroundColor = color;
      if (item.color === color) swatch.classList.add('custom-color-active');
      swatch.addEventListener('click', () => {
        if (this.onColorChange) this.onColorChange(color);
      });
      colorSection.appendChild(swatch);
    }

    const actions = document.createElement('div');
    actions.className = 'custom-actions';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'custom-remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.disabled = isEssential;
    if (isEssential) removeBtn.title = "This item can't be removed";
    removeBtn.addEventListener('click', () => {
      if (!isEssential && this.onRemove) this.onRemove(item.id);
    });

    const doneBtn = document.createElement('button');
    doneBtn.className = 'custom-done-btn';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => this.hide());

    actions.appendChild(removeBtn);
    actions.appendChild(doneBtn);

    this.panelEl.appendChild(title);
    this.panelEl.appendChild(colorSection);
    this.panelEl.appendChild(actions);
    this.container.appendChild(this.panelEl);
  }

  hide() {
    this.isVisible = false;
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/customization-panel.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/customization-panel.js rhinosaurus-connect/tests/popup/room/customization-panel.test.js
git commit -m "feat: add customization panel with color swatches and remove button"
```

---

### Task 4: Furniture catalog (Add Item browser)

**Files:**
- Create: `rhinosaurus-connect/popup/room/furniture-catalog.js`
- Test: `rhinosaurus-connect/tests/popup/room/furniture-catalog.test.js`

- [ ] **Step 1: Write test for furniture catalog**

```js
// rhinosaurus-connect/tests/popup/room/furniture-catalog.test.js
import { describe, it, expect } from 'vitest';
import { FurnitureCatalog } from '../../../popup/room/furniture-catalog.js';

describe('FurnitureCatalog', () => {
  it('has categories', () => {
    const catalog = new FurnitureCatalog();
    const categories = catalog.getCategories();
    expect(categories).toContain('Furniture');
    expect(categories).toContain('Decorations');
    expect(categories).toContain('Plants');
    expect(categories).toContain('Misc');
  });

  it('returns items for a category', () => {
    const catalog = new FurnitureCatalog();
    const items = catalog.getItems('Plants');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].type).toBeDefined();
    expect(items[0].variant).toBeDefined();
  });

  it('generates unique IDs for new items', () => {
    const catalog = new FurnitureCatalog();
    const id1 = catalog.generateId('plant');
    const id2 = catalog.generateId('plant');
    expect(id1).not.toBe(id2);
  });

  it('creates a placeable item from catalog entry', () => {
    const catalog = new FurnitureCatalog();
    const items = catalog.getItems('Plants');
    const placed = catalog.createPlaceable(items[0]);
    expect(placed.id).toBeDefined();
    expect(placed.x).toBe(160);
    expect(placed.y).toBe(200);
    expect(placed.interactive).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/furniture-catalog.test.js`
Expected: FAIL

- [ ] **Step 3: Implement furniture-catalog.js**

```js
// rhinosaurus-connect/popup/room/furniture-catalog.js
const CATALOG = {
  Furniture: [
    { type: 'nightstand', variant: 'wooden', label: 'Wooden Nightstand' },
    { type: 'nightstand', variant: 'modern', label: 'Modern Nightstand' },
    { type: 'nightstand', variant: 'cute', label: 'Heart Nightstand' },
    { type: 'lamp', variant: 'floor', label: 'Floor Lamp' },
    { type: 'lamp', variant: 'desk', label: 'Desk Lamp' },
    { type: 'rug', variant: 'round', label: 'Round Rug' },
    { type: 'rug', variant: 'rectangular', label: 'Rectangle Rug' },
    { type: 'curtains', variant: 'solid', label: 'Solid Curtains' },
    { type: 'curtains', variant: 'patterned', label: 'Patterned Curtains' },
  ],
  Decorations: [
    { type: 'wall_art', variant: 'fairy_lights', label: 'Fairy Lights' },
    { type: 'wall_art', variant: 'poster', label: 'Poster' },
    { type: 'wall_art', variant: 'photo_frame', label: 'Photo Frame' },
    { type: 'wall_art', variant: 'shelf', label: 'Wall Shelf' },
  ],
  Plants: [
    { type: 'plant', variant: 'potted', label: 'Potted Plant' },
    { type: 'plant', variant: 'hanging', label: 'Hanging Plant' },
    { type: 'plant', variant: 'succulent', label: 'Succulent' },
  ],
  Misc: [
    { type: 'misc', variant: 'plushie', label: 'Plushie' },
    { type: 'misc', variant: 'books', label: 'Book Stack' },
    { type: 'misc', variant: 'pet_bed', label: 'Pet Bed' },
    { type: 'misc', variant: 'candles', label: 'Candles' },
  ],
};

let idCounter = 0;

export class FurnitureCatalog {
  getCategories() {
    return Object.keys(CATALOG);
  }

  getItems(category) {
    return CATALOG[category] || [];
  }

  generateId(type) {
    idCounter++;
    return `${type}-${Date.now()}-${idCounter}`;
  }

  createPlaceable(catalogEntry) {
    return {
      id: this.generateId(catalogEntry.type),
      type: catalogEntry.type,
      variant: catalogEntry.variant,
      color: null,
      x: 160,
      y: 200,
      interactive: false,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/furniture-catalog.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/furniture-catalog.js rhinosaurus-connect/tests/popup/room/furniture-catalog.test.js
git commit -m "feat: add furniture catalog with categories and placeable item creation"
```

---

### Task 5: Wire customization into popup

**Files:**
- Modify: `rhinosaurus-connect/popup/popup.js`

- [ ] **Step 1: Add edit mode integration to popup.js**

```js
// Add imports:
import { EditModeController } from './room/edit-mode.js';
import { CustomizationPanel } from './room/customization-panel.js';
import { FurnitureCatalog } from './room/furniture-catalog.js';
import { ColorTinter } from './room/color-tinter.js';

// In init():
let editMode = null;
let customPanel = null;
const catalog = new FurnitureCatalog();
const tinter = new ColorTinter();

async function setupCustomization(roomState, roomSync) {
  editMode = new EditModeController(roomState, roomSync);

  const panelContainer = document.createElement('div');
  panelContainer.id = 'customization-panel';
  document.getElementById('room-screen').appendChild(panelContainer);
  customPanel = new CustomizationPanel(panelContainer);

  editMode.onSelectionChange = (selectedId) => {
    if (!selectedId) {
      customPanel.hide();
      return;
    }
    const item = roomState.furniture.find(f => f.id === selectedId);
    if (item) {
      customPanel.show(item, roomState.isEssential(selectedId));
    }
    renderer.markDirty();
  };

  customPanel.onColorChange = (color) => {
    editMode.changeColor(color);
    renderer.markDirty();
  };

  customPanel.onRemove = (id) => {
    editMode.removeItem(id);
    customPanel.hide();
    renderer.markDirty();
  };
}

// Settings button → Customize Room:
document.getElementById('settings-btn').addEventListener('click', () => {
  if (editMode) {
    if (editMode.isEditMode) {
      editMode.exit();
      customPanel.hide();
    } else {
      editMode.enter();
    }
    renderer.markDirty();
  }
});

// Canvas mouse handlers for edit mode drag:
// canvas.addEventListener('mousedown', (e) => { ... startDrag });
// canvas.addEventListener('mousemove', (e) => { ... drag });
// canvas.addEventListener('mouseup', (e) => { ... endDrag });
```

- [ ] **Step 2: Commit**

```bash
git add rhinosaurus-connect/popup/popup.js
git commit -m "feat: wire edit mode, customization panel, and furniture catalog into popup"
```

---

### Task 6: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 3J room customization complete"
```

---

## Summary

After Phase 3J:
- **EditModeController**: enter/exit edit mode, select furniture, drag-to-move, variant/color change, add/remove with essential protection
- **ColorTinter**: 16-color pixel-art palette, source-atop blending at 0.4 alpha
- **CustomizationPanel**: HTML panel with item name, color swatches, remove button (disabled for essentials), done button
- **FurnitureCatalog**: 4 categories (Furniture, Decorations, Plants, Misc), unique ID generation, placeable item creation at center
- **Popup integration**: settings button toggles edit mode, canvas drag handlers, real-time sync of all changes
