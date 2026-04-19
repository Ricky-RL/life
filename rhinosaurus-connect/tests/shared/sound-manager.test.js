import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundManager } from '../../shared/sound-manager.js';

const mockAudioContext = { createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn() })), createBufferSource: vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() })), decodeAudioData: vi.fn(() => Promise.resolve({})), destination: {} };
vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
const mockChrome = { storage: { local: { get: vi.fn(() => Promise.resolve({ sound_enabled: true })), set: vi.fn(() => Promise.resolve()) } }, runtime: { getURL: vi.fn((path) => `chrome-extension://abc/${path}`) } };
vi.stubGlobal('chrome', mockChrome);

describe('SoundManager', () => {
  let manager;
  beforeEach(() => { vi.clearAllMocks(); manager = new SoundManager(); });

  it('initializes with sound enabled by default', async () => { await manager.init(); expect(manager.enabled).toBe(true); });
  it('can be toggled off', async () => { await manager.init(); await manager.setEnabled(false); expect(manager.enabled).toBe(false); expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ sound_enabled: false }); });
  it('does not play when disabled', async () => { await manager.init(); manager.enabled = false; manager.play('heart'); expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled(); });
  it('maps sound names to file paths', () => { expect(manager.getSoundPath('heart')).toBe('assets/sounds/heart-chime.mp3'); expect(manager.getSoundPath('kiss')).toBe('assets/sounds/kiss-mwah.mp3'); expect(manager.getSoundPath('message')).toBe('assets/sounds/message-ding.mp3'); });
});
