const SOUND_FILES = {
  heart: 'assets/sounds/heart-chime.mp3',
  kiss: 'assets/sounds/kiss-mwah.mp3',
  message: 'assets/sounds/message-ding.mp3',
  milestone: 'assets/sounds/celebration.mp3',
};

export class SoundManager {
  constructor() {
    this.enabled = true;
    this.audioContext = null;
    this.bufferCache = {};
  }

  async init() {
    const { sound_enabled } = await chrome.storage.local.get(['sound_enabled']);
    this.enabled = sound_enabled !== false;
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
    await chrome.storage.local.set({ sound_enabled: enabled });
  }

  getSoundPath(name) {
    return SOUND_FILES[name] || null;
  }

  async loadBuffer(name) {
    if (this.bufferCache[name]) return this.bufferCache[name];
    const path = this.getSoundPath(name);
    if (!path) return null;
    try {
      const url = chrome.runtime.getURL(path);
      const resp = await fetch(url);
      const ab = await resp.arrayBuffer();
      if (!this.audioContext) this.audioContext = new AudioContext();
      const buf = await this.audioContext.decodeAudioData(ab);
      this.bufferCache[name] = buf;
      return buf;
    } catch {
      return null;
    }
  }

  async play(name) {
    if (!this.enabled) return;
    const buffer = await this.loadBuffer(name);
    if (!buffer || !this.audioContext) return;
    const src = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    gain.gain.value = 0.5;
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(this.audioContext.destination);
    src.start(0);
  }
}
