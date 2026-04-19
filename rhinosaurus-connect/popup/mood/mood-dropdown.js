import { MOOD_OPTIONS } from '../../shared/constants.js';

export class MoodDropdown {
  constructor(container) {
    this.container = container;
    this.isOpen = false;
    this.currentMood = null;
    this.onSelect = null;
    this.dropdownEl = null;
    this.escHandler = (e) => { if (e.key === 'Escape') this.close(); };
  }

  render() {
    if (this.dropdownEl) this.dropdownEl.remove();
    this.dropdownEl = document.createElement('div');
    this.dropdownEl.className = 'mood-dropdown hidden';
    const grid = document.createElement('div');
    grid.className = 'mood-grid';
    for (const mood of MOOD_OPTIONS) {
      const btn = document.createElement('button');
      btn.className = 'mood-option';
      btn.dataset.mood = mood.key;
      btn.textContent = mood.emoji;
      btn.title = mood.label;
      if (this.currentMood === mood.key) btn.classList.add('mood-option-active');
      btn.addEventListener('click', () => {
        const newMood = this.currentMood === mood.key ? null : mood.key;
        this.currentMood = newMood;
        if (this.onSelect) this.onSelect(newMood);
        this.close();
      });
      grid.appendChild(btn);
    }
    this.dropdownEl.appendChild(grid);
    this.container.appendChild(this.dropdownEl);
  }

  open() {
    if (!this.dropdownEl) this.render();
    this.isOpen = true;
    this.dropdownEl.classList.remove('hidden');
    document.addEventListener('keydown', this.escHandler);
  }

  close() {
    this.isOpen = false;
    if (this.dropdownEl) this.dropdownEl.classList.add('hidden');
    document.removeEventListener('keydown', this.escHandler);
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  setCurrentMood(mood) {
    this.currentMood = mood;
    if (this.dropdownEl) this.render();
  }

  destroy() {
    document.removeEventListener('keydown', this.escHandler);
    if (this.dropdownEl) this.dropdownEl.remove();
  }
}
