import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AvatarCustomizationOverlay } from '../../../popup/avatar/avatar-customization-overlay.js';

describe('AvatarCustomizationOverlay', () => {
  let overlay, container;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); overlay = new AvatarCustomizationOverlay(container, { top: { item: 'hoodie', color: '#FF6B9D' }, bottom: { item: 'jeans', color: '#4A6FA5' } }); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders overlay structure', () => { overlay.render(); expect(container.querySelector('.avatar-custom-header')).not.toBeNull(); expect(container.querySelector('.avatar-custom-preview')).not.toBeNull(); expect(container.querySelector('.avatar-custom-tabs')).not.toBeNull(); });
  it('shows 4 category tabs', () => { overlay.render(); expect(container.querySelectorAll('.avatar-custom-tab').length).toBe(4); });
  it('switches category on tab click', () => { overlay.render(); container.querySelectorAll('.avatar-custom-tab')[1].click(); expect(overlay.activeCategory).toBe('Jewelry'); });
  it('shows item options for category', () => { overlay.render(); overlay.showCategory('Clothes'); expect(container.querySelectorAll('.avatar-custom-item').length).toBeGreaterThan(0); });
  it('calls onChange when item selected', () => { const cb = vi.fn(); overlay.onChange = cb; overlay.render(); overlay.showCategory('Clothes'); container.querySelector('.avatar-custom-item').click(); expect(cb).toHaveBeenCalled(); });
  it('shows color swatches for clothing items', () => { overlay.render(); overlay.showCategory('Clothes'); expect(container.querySelectorAll('.avatar-custom-color').length).toBeGreaterThan(0); });
  it('opens and closes', () => { overlay.open(); expect(overlay.isOpen).toBe(true); overlay.close(); expect(overlay.isOpen).toBe(false); });
  it('calls onSave when save clicked', () => { const cb = vi.fn(); overlay.onSave = cb; overlay.render(); container.querySelector('.avatar-custom-save').click(); expect(cb).toHaveBeenCalledWith(overlay.config); });
});
