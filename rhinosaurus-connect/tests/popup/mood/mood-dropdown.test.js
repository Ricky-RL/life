import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MoodDropdown } from '../../../popup/mood/mood-dropdown.js';

describe('MoodDropdown', () => {
  let dropdown, container;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); dropdown = new MoodDropdown(container); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('starts closed', () => { expect(dropdown.isOpen).toBe(false); });
  it('renders 7 mood options', () => { dropdown.render(); expect(container.querySelectorAll('.mood-option').length).toBe(7); });
  it('opens and shows dropdown', () => { dropdown.render(); dropdown.open(); expect(dropdown.isOpen).toBe(true); expect(container.querySelector('.mood-dropdown').classList.contains('hidden')).toBe(false); });
  it('closes dropdown', () => { dropdown.render(); dropdown.open(); dropdown.close(); expect(dropdown.isOpen).toBe(false); });
  it('toggles open/close', () => { dropdown.render(); dropdown.toggle(); expect(dropdown.isOpen).toBe(true); dropdown.toggle(); expect(dropdown.isOpen).toBe(false); });
  it('calls onSelect when mood is clicked', () => { const cb = vi.fn(); dropdown.onSelect = cb; dropdown.render(); dropdown.open(); container.querySelector('.mood-option').click(); expect(cb).toHaveBeenCalledWith('happy'); });
  it('clears mood when same mood is clicked', () => { const cb = vi.fn(); dropdown.onSelect = cb; dropdown.currentMood = 'happy'; dropdown.render(); dropdown.open(); container.querySelector('[data-mood="happy"]').click(); expect(cb).toHaveBeenCalledWith(null); });
  it('highlights current mood', () => { dropdown.currentMood = 'sad'; dropdown.render(); expect(container.querySelector('[data-mood="sad"]').classList.contains('mood-option-active')).toBe(true); });
  it('closes on Escape key', () => { dropdown.render(); dropdown.open(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); expect(dropdown.isOpen).toBe(false); });
});
