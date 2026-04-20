import { describe, it, expect, vi } from 'vitest';
import { MusicIndicator } from '../../../popup/room/music-indicator.js';

describe('MusicIndicator', () => {
  it('starts inactive', () => {
    const indicator = new MusicIndicator();
    expect(indicator.active).toBe(false);
    expect(indicator.trackUrl).toBeNull();
  });

  it('activates with a track URL', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    expect(indicator.active).toBe(true);
    expect(indicator.trackUrl).toBe('https://open.spotify.com/track/abc123');
  });

  it('deactivates and clears URL', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    indicator.setActive(false);
    expect(indicator.active).toBe(false);
    expect(indicator.trackUrl).toBeNull();
  });

  it('draws without error when active', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1,
    };
    indicator.draw(ctx, 100, 200, 1000);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('does not draw when inactive', () => {
    const indicator = new MusicIndicator();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1,
    };
    indicator.draw(ctx, 100, 200, 1000);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('hitTest returns true when clicking on indicator position', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    indicator.draw({ save: vi.fn(), restore: vi.fn(), fillText: vi.fn(), fillStyle: '', font: '', textAlign: '', textBaseline: '', globalAlpha: 1 }, 100, 200, 1000);
    expect(indicator.hitTest(100, 190)).toBe(true);
  });

  it('hitTest returns false when inactive', () => {
    const indicator = new MusicIndicator();
    expect(indicator.hitTest(100, 190)).toBe(false);
  });

  it('hitTest returns false when clicking far away', () => {
    const indicator = new MusicIndicator();
    indicator.setActive(true, 'https://open.spotify.com/track/abc123');
    indicator.draw({ save: vi.fn(), restore: vi.fn(), fillText: vi.fn(), fillStyle: '', font: '', textAlign: '', textBaseline: '', globalAlpha: 1 }, 100, 200, 1000);
    expect(indicator.hitTest(500, 500)).toBe(false);
  });
});
