const MAKEUP_TYPES = [
  { key: 'lipstick',  label: 'Lipstick'  },
  { key: 'blush',     label: 'Blush'     },
  { key: 'eyeshadow', label: 'Eyeshadow' },
  { key: 'eyeliner',  label: 'Eyeliner'  },
];

const MAKEUP_OPTIONS = {
  lipstick:  ['pink', 'red', 'coral', 'berry', 'nude'],
  blush:     ['rose', 'peach', 'mauve', 'coral'],
  eyeshadow: ['smoky', 'natural', 'glitter', 'pastel'],
  eyeliner:  ['black', 'brown', 'navy', 'green'],
};

export class MakeupOverlay {
  /**
   * @param {HTMLElement} container - DOM element to render into.
   * @param {object} initialConfig - Current makeup config with lipstick/blush/eyeshadow/eyeliner keys.
   * @param {boolean} isMale - When true, show a placeholder instead of the makeup UI.
   */
  constructor(container, initialConfig = {}, isMale = false) {
    this.container = container;
    this.config = { lipstick: null, blush: null, eyeshadow: null, eyeliner: null, ...initialConfig };
    this.isMale = isMale;
    this.onChange = null;
    this.onSave = null;
  }

  /** Renders the makeup overlay into the container. */
  render() {
    this.container.innerHTML = '';

    if (this.isMale) {
      const msg = document.createElement('p');
      msg.className = 'makeup-male-msg';
      msg.textContent = 'Your partner is at the makeup stand.';
      this.container.appendChild(msg);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'makeup-overlay';

    for (const { key, label } of MAKEUP_TYPES) {
      // Section heading
      const heading = document.createElement('h3');
      heading.className = 'makeup-heading';
      heading.textContent = label;
      wrapper.appendChild(heading);

      // None button
      const noneBtn = document.createElement('button');
      noneBtn.className = 'makeup-none';
      noneBtn.dataset.type = key;
      noneBtn.textContent = 'None';
      noneBtn.addEventListener('click', () => {
        this.config[key] = null;
        this._refreshActive(wrapper);
        if (this.onChange) this.onChange(this.config);
      });
      wrapper.appendChild(noneBtn);

      // Option buttons
      for (const value of (MAKEUP_OPTIONS[key] ?? [])) {
        const btn = document.createElement('button');
        btn.className = 'makeup-option' + (this.config[key] === value ? ' active' : '');
        btn.dataset.type = key;
        btn.dataset.value = value;
        btn.textContent = value;
        btn.addEventListener('click', () => {
          this.config[key] = value;
          this._refreshActive(wrapper);
          if (this.onChange) this.onChange(this.config);
        });
        wrapper.appendChild(btn);
      }
    }

    // Save button
    const save = document.createElement('button');
    save.className = 'makeup-save';
    save.textContent = 'Save';
    save.addEventListener('click', () => {
      if (this.onSave) this.onSave(this.config);
    });
    wrapper.appendChild(save);

    this.container.appendChild(wrapper);
  }

  /**
   * Refreshes active class on all option buttons to reflect current config.
   * @param {HTMLElement} wrapper
   */
  _refreshActive(wrapper) {
    for (const btn of wrapper.querySelectorAll('.makeup-option')) {
      const type = btn.dataset.type;
      const value = btn.dataset.value;
      btn.classList.toggle('active', this.config[type] === value);
    }
  }
}
