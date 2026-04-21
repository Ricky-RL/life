import { describe, it, expect, vi } from 'vitest';
import { TVDisplay } from '../../../popup/room/tv-display.js';

function createMockCtx() {
  return {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    beginPath: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
  };
}

describe('TVDisplay - Spotify', () => {
  it('returns spotify state when partner is on Spotify', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Spotify', title: 'Song · Artist', spotifySong: 'Song', spotifyArtist: 'Artist' },
    });
    expect(tv.getDisplayState()).toBe('spotify');
  });

  it('returns browsing for non-Spotify non-YouTube sites', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Reddit', title: 'r/programming' },
    });
    expect(tv.getDisplayState()).toBe('browsing');
  });

  it('draws spotify state without error', () => {
    const tv = new TVDisplay();
    const ctx = createMockCtx();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Spotify', title: 'Song · Artist', spotifySong: 'Song', spotifyArtist: 'Artist' },
    });
    tv.draw(ctx, 0, 0, 48, 36);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe('TVDisplay - Listen Together', () => {
  it('returns listen_together state', () => {
    const tv = new TVDisplay();
    tv.setListenTogether(true, 'Cool Song', 'Cool Artist');
    expect(tv.getDisplayState()).toBe('listen_together');
  });

  it('listen_together takes priority over spotify', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Spotify', title: 'Song · Artist' },
    });
    tv.setListenTogether(true, 'Song', 'Artist');
    expect(tv.getDisplayState()).toBe('listen_together');
  });

  it('listen_together takes priority over watch_together', () => {
    const tv = new TVDisplay();
    tv.setWatchTogether(true, 'Video', 'vid123');
    tv.setListenTogether(true, 'Song', 'Artist');
    expect(tv.getDisplayState()).toBe('listen_together');
  });

  it('returns to spotify state when listen together ends', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({
      isOnline: true,
      activity: { site: 'Spotify', title: 'Song · Artist', spotifySong: 'Song', spotifyArtist: 'Artist' },
    });
    tv.setListenTogether(true, 'Song', 'Artist');
    expect(tv.getDisplayState()).toBe('listen_together');
    tv.setListenTogether(false);
    expect(tv.getDisplayState()).toBe('spotify');
  });

  it('draws listen_together state without error', () => {
    const tv = new TVDisplay();
    const ctx = createMockCtx();
    tv.setListenTogether(true, 'Cool Song', 'Cool Artist');
    tv.draw(ctx, 0, 0, 48, 36);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});
