import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MakeupOverlay } from '../../../popup/avatar/makeup-overlay.js';

describe('MakeupOverlay', () => {
  let overlay, container;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); overlay = new MakeupOverlay(container, { lipstick: 'pink', blush: null, eyeshadow: null, eyeliner: null }); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders makeup categories', () => { overlay.render(); expect(container.textContent).toContain('Lipstick'); expect(container.textContent).toContain('Blush'); expect(container.textContent).toContain('Eyeshadow'); expect(container.textContent).toContain('Eyeliner'); });
  it('shows options for lipstick', () => { overlay.render(); expect(container.querySelectorAll('.makeup-option[data-type="lipstick"]').length).toBeGreaterThan(0); });
  it('shows "None" option for each type', () => { overlay.render(); expect(container.querySelectorAll('.makeup-none').length).toBe(4); });
  it('calls onChange when option selected', () => { const cb = vi.fn(); overlay.onChange = cb; overlay.render(); container.querySelector('.makeup-option[data-type="lipstick"]').click(); expect(cb).toHaveBeenCalled(); });
  it('highlights current selection', () => { overlay.render(); expect(container.querySelector('.makeup-option[data-value="pink"]').classList.contains('active')).toBe(true); });
  it('clears selection with None', () => { const cb = vi.fn(); overlay.onChange = cb; overlay.render(); container.querySelector('.makeup-none[data-type="lipstick"]').click(); expect(overlay.config.lipstick).toBeNull(); });
  it('calls onSave on save click', () => { const cb = vi.fn(); overlay.onSave = cb; overlay.render(); container.querySelector('.makeup-save').click(); expect(cb).toHaveBeenCalledWith(overlay.config); });
  it('shows male-avatar message when isMale is true', () => { overlay = new MakeupOverlay(container, {}, true); overlay.render(); expect(container.textContent).toContain('makeup stand'); });
});
