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
