import { COLOR_PALETTE } from './color-tinter.js';

export class CustomizationPanel {
  constructor(container) {
    this.container = container;
    this.isVisible = false;
    this.onColorChange = null;
    this.onVariantChange = null;
    this.onRemove = null;
    this.onAddItem = null;
    this.panelEl = null;
    this.catalog = null;
  }

  setCatalog(catalog) {
    this.catalog = catalog;
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

    const addBtn = document.createElement('button');
    addBtn.className = 'custom-add-btn';
    addBtn.textContent = '+ Add Item';
    addBtn.addEventListener('click', () => this.showCatalog());

    actions.appendChild(removeBtn);
    actions.appendChild(addBtn);
    actions.appendChild(doneBtn);

    this.panelEl.appendChild(title);
    this.panelEl.appendChild(colorSection);
    this.panelEl.appendChild(actions);
    this.container.appendChild(this.panelEl);
  }

  showAddOnly() {
    this.hide();
    this.isVisible = true;
    this.showCatalog();
  }

  showCatalog() {
    if (!this.catalog) return;

    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }

    this.panelEl = document.createElement('div');
    this.panelEl.className = 'catalog-panel';

    const categories = this.catalog.getCategories();
    const tabs = document.createElement('div');
    tabs.className = 'catalog-tabs';

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'catalog-items';

    const renderCategory = (category) => {
      itemsContainer.innerHTML = '';
      tabs.querySelectorAll('.catalog-tab').forEach(t => t.classList.remove('catalog-tab-active'));
      tabs.querySelector(`[data-cat="${category}"]`)?.classList.add('catalog-tab-active');

      for (const entry of this.catalog.getItems(category)) {
        const btn = document.createElement('button');
        btn.className = 'catalog-item';
        btn.textContent = entry.label;
        btn.addEventListener('click', () => {
          const placeable = this.catalog.createPlaceable(entry);
          if (this.onAddItem) this.onAddItem(placeable);
          this.hide();
        });
        itemsContainer.appendChild(btn);
      }
    };

    for (const cat of categories) {
      const tab = document.createElement('button');
      tab.className = 'catalog-tab';
      tab.textContent = cat;
      tab.dataset.cat = cat;
      tab.addEventListener('click', () => renderCategory(cat));
      tabs.appendChild(tab);
    }

    const backBtn = document.createElement('button');
    backBtn.className = 'catalog-back-btn';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => this.hide());

    this.panelEl.appendChild(tabs);
    this.panelEl.appendChild(itemsContainer);
    this.panelEl.appendChild(backBtn);
    this.container.appendChild(this.panelEl);

    renderCategory(categories[0]);
  }

  hide() {
    this.isVisible = false;
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
  }
}
