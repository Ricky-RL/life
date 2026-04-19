import { describe, it, expect, vi } from 'vitest';
import { TVOverlay } from '../../../popup/room/tv-overlay.js';

function makeTvDisplay(overrides = {}) {
  return {
    getDisplayState: vi.fn(() => 'offline'),
    partnerState: { activity: null },
    history: [],
    ...overrides,
  };
}

describe('TVOverlay - renderJoinButton', () => {
  it('creates a join button when partnerActivity.isYouTube is true', () => {
    const container = document.createElement('div');
    const tvDisplay = makeTvDisplay();
    const overlay = new TVOverlay(container, tvDisplay, null, null);
    const partnerActivity = { isYouTube: true, url: 'https://www.youtube.com/watch?v=abc123', title: 'Cool Vid' };
    const btn = overlay.renderJoinButton(partnerActivity);
    expect(btn).not.toBeNull();
    expect(btn.tagName).toBe('BUTTON');
  });

  it('returns null when partnerActivity.isYouTube is false', () => {
    const container = document.createElement('div');
    const overlay = new TVOverlay(container, makeTvDisplay(), null, null);
    const btn = overlay.renderJoinButton({ isYouTube: false, url: 'https://reddit.com', title: 'Reddit' });
    expect(btn).toBeNull();
  });

  it('returns null when partnerActivity is null', () => {
    const container = document.createElement('div');
    const overlay = new TVOverlay(container, makeTvDisplay(), null, null);
    expect(overlay.renderJoinButton(null)).toBeNull();
  });

  it('invokes onJoin callback when join button is clicked', () => {
    const container = document.createElement('div');
    const onJoin = vi.fn();
    const overlay = new TVOverlay(container, makeTvDisplay(), null, null);
    overlay.onJoin = onJoin;
    const partnerActivity = { isYouTube: true, url: 'https://www.youtube.com/watch?v=abc123', title: 'A' };
    const btn = overlay.renderJoinButton(partnerActivity);
    btn.click();
    expect(onJoin).toHaveBeenCalledWith(partnerActivity);
  });

  it('exposes onJoin as a settable property', () => {
    const container = document.createElement('div');
    const overlay = new TVOverlay(container, makeTvDisplay(), null, null);
    const cb = vi.fn();
    overlay.onJoin = cb;
    expect(overlay.onJoin).toBe(cb);
  });
});
