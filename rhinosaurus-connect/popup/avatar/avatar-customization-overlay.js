import { COLOR_PALETTE } from '../room/color-tinter.js';

const CATEGORIES = ['Clothes', 'Jewelry', 'Accessories', 'Pet'];

const CATEGORY_ITEMS = {
  Clothes: [
    { slot: 'top',       item: 'hoodie',    label: 'Hoodie' },
    { slot: 'top',       item: 'tshirt',    label: 'T-Shirt' },
    { slot: 'top',       item: 'blouse',    label: 'Blouse' },
    { slot: 'bottom',    item: 'jeans',     label: 'Jeans' },
    { slot: 'bottom',    item: 'skirt',     label: 'Skirt' },
    { slot: 'outerwear', item: 'jacket',    label: 'Jacket' },
    { slot: 'shoes',     item: 'sneakers',  label: 'Sneakers' },
    { slot: 'shoes',     item: 'boots',     label: 'Boots' },
  ],
  Jewelry: [
    { slot: 'necklace', item: 'pearl',    label: 'Pearl' },
    { slot: 'necklace', item: 'chain',    label: 'Chain' },
    { slot: 'earrings', item: 'studs',    label: 'Studs' },
    { slot: 'earrings', item: 'hoops',    label: 'Hoops' },
    { slot: 'bracelet', item: 'gold',     label: 'Gold' },
    { slot: 'ring',     item: 'diamond',  label: 'Diamond' },
  ],
  Accessories: [
    { slot: 'head', item: 'beanie',   label: 'Beanie' },
    { slot: 'head', item: 'beret',    label: 'Beret' },
    { slot: 'face', item: 'glasses',  label: 'Glasses' },
    { slot: 'held', item: 'umbrella', label: 'Umbrella' },
    { slot: 'held', item: 'bag',      label: 'Bag' },
  ],
  Pet: [
    { slot: 'pet', item: 'cat',    label: 'Cat' },
    { slot: 'pet', item: 'dog',    label: 'Dog' },
    { slot: 'pet', item: 'bunny',  label: 'Bunny' },
  ],
};

export class AvatarCustomizationOverlay {
  /**
   * @param {HTMLElement} container - DOM element to render into.
   * @param {object} initialConfig - Current avatar configuration.
   */
  constructor(container, initialConfig = {}) {
    this.container = container;
    this.config = { ...initialConfig };
    this.activeCategory = CATEGORIES[0];
    this.isOpen = false;
    this.onChange = null;
    this.onSave = null;
    this._panelEl = null;
  }

  /** Renders the full overlay into the container. */
  render() {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'avatar-custom-overlay';

    // Header
    const header = document.createElement('div');
    header.className = 'avatar-custom-header';
    header.textContent = 'Customize Avatar';
    wrapper.appendChild(header);

    // Preview placeholder
    const preview = document.createElement('div');
    preview.className = 'avatar-custom-preview';
    wrapper.appendChild(preview);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'avatar-custom-tabs';
    for (const cat of CATEGORIES) {
      const tab = document.createElement('button');
      tab.className = 'avatar-custom-tab';
      tab.textContent = cat;
      tab.addEventListener('click', () => {
        this.activeCategory = cat;
        this.showCategory(cat);
      });
      tabs.appendChild(tab);
    }
    wrapper.appendChild(tabs);

    // Item panel
    const panel = document.createElement('div');
    panel.className = 'avatar-custom-panel';
    wrapper.appendChild(panel);
    this._panelEl = panel;

    // Save button
    const save = document.createElement('button');
    save.className = 'avatar-custom-save';
    save.textContent = 'Save';
    save.addEventListener('click', () => {
      if (this.onSave) this.onSave(this.config);
    });
    wrapper.appendChild(save);

    this.container.appendChild(wrapper);
    this.showCategory(this.activeCategory);
  }

  /**
   * Renders items for the given category into the panel.
   * @param {string} category
   */
  showCategory(category) {
    this.activeCategory = category;
    if (!this._panelEl) return;

    this._panelEl.innerHTML = '';
    const items = CATEGORY_ITEMS[category] ?? [];

    for (const entry of items) {
      const itemBtn = document.createElement('button');
      itemBtn.className = 'avatar-custom-item';
      itemBtn.textContent = entry.label;
      itemBtn.dataset.slot = entry.slot;
      itemBtn.dataset.item = entry.item;
      itemBtn.addEventListener('click', () => {
        this._selectItem(entry.slot, entry.item);
      });
      this._panelEl.appendChild(itemBtn);

      // Color swatches for non-pet clothing slots
      if (category !== 'Pet') {
        const swatchRow = document.createElement('div');
        swatchRow.className = 'avatar-custom-swatch-row';
        for (const hex of COLOR_PALETTE) {
          const swatch = document.createElement('button');
          swatch.className = 'avatar-custom-color';
          swatch.dataset.color = hex;
          swatch.dataset.slot = entry.slot;
          swatch.dataset.item = entry.item;
          swatch.style.backgroundColor = hex;
          swatch.addEventListener('click', () => {
            this._selectItem(entry.slot, entry.item, hex);
          });
          swatchRow.appendChild(swatch);
        }
        this._panelEl.appendChild(swatchRow);
      }
    }
  }

  /**
   * Updates config for a slot and fires onChange.
   * @param {string} slot
   * @param {string} item
   * @param {string|null} color
   */
  _selectItem(slot, item, color = null) {
    this.config[slot] = { item, color };
    if (this.onChange) this.onChange(this.config);
  }

  /** Opens the overlay. */
  open() {
    this.isOpen = true;
    if (this.container) this.container.style.display = '';
  }

  /** Closes the overlay. */
  close() {
    this.isOpen = false;
    if (this.container) this.container.style.display = 'none';
  }
}
