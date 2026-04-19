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
