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

describe('TVDisplay', () => {
  it('returns offline state when partner is offline', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: false });
    expect(tv.getDisplayState()).toBe('offline');
  });

  it('returns tracking_paused when partner has tracking off', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, trackingPaused: true });
    expect(tv.getDisplayState()).toBe('tracking_paused');
  });

  it('returns idle when partner is idle', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, idle: true });
    expect(tv.getDisplayState()).toBe('idle');
  });

  it('returns youtube when partner is on YouTube video', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, activity: { site: 'YouTube', title: 'Funny Cat Video' } });
    expect(tv.getDisplayState()).toBe('youtube');
  });

  it('returns browsing for normal activity', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, activity: { site: 'Reddit', title: 'r/programming' } });
    expect(tv.getDisplayState()).toBe('browsing');
  });

  it('returns watch_together when both watching same video', () => {
    const tv = new TVDisplay();
    tv.setWatchTogether(true);
    expect(tv.getDisplayState()).toBe('watch_together');
  });

  it('tracks last 5 activities', () => {
    const tv = new TVDisplay();
    for (let i = 0; i < 7; i++) {
      tv.addToHistory({ site: `Site ${i}`, title: `Page ${i}`, timestamp: Date.now() + i });
    }
    expect(tv.history).toHaveLength(5);
    expect(tv.history[0].site).toBe('Site 6');
  });

  it('deduplicates consecutive same-site history entries', () => {
    const tv = new TVDisplay();
    tv.addToHistory({ site: 'Reddit', title: 'Page A', timestamp: Date.now() });
    tv.addToHistory({ site: 'Reddit', title: 'Page A', timestamp: Date.now() + 1 });
    expect(tv.history).toHaveLength(1);
  });

  it('does not add entries with no site to history', () => {
    const tv = new TVDisplay();
    tv.addToHistory({ site: null, title: 'test', timestamp: Date.now() });
    expect(tv.history).toHaveLength(0);
  });

  it('adds activity to history when setting partner state', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, activity: { site: 'Reddit', title: 'r/programming' } });
    expect(tv.history).toHaveLength(1);
    expect(tv.history[0].site).toBe('Reddit');
  });

  it('does not add to history when idle', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ isOnline: true, idle: true, activity: { site: 'Reddit', title: 'test' } });
    expect(tv.history).toHaveLength(0);
  });

  it('draws on canvas context without error', () => {
    const tv = new TVDisplay();
    const ctx = createMockCtx();
    tv.setPartnerState({ isOnline: true, activity: { site: 'Reddit', title: 'r/programming' } });
    tv.draw(ctx, 240, 180, 48, 36);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('draws offline state', () => {
    const tv = new TVDisplay();
    const ctx = createMockCtx();
    tv.setPartnerState({ isOnline: false });
    tv.draw(ctx, 0, 0, 48, 36);
    expect(ctx.fillText).toHaveBeenCalledWith('OFF', expect.any(Number), expect.any(Number));
  });

  it('draws YouTube state', () => {
    const tv = new TVDisplay();
    const ctx = createMockCtx();
    tv.setPartnerState({ isOnline: true, activity: { site: 'YouTube', title: 'Cool Video' } });
    tv.draw(ctx, 0, 0, 48, 36);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
