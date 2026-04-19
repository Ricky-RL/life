import { describe, it, expect, vi } from 'vitest';
import { TVDisplay } from '../../../popup/room/tv-display.js';

describe('TVDisplay - Watch Together', () => {
  it('shows watching together state', () => {
    const tv = new TVDisplay();
    tv.setWatchTogether(true, 'Cool Video', 'abc123');
    expect(tv.getDisplayState()).toBe('watch_together');
  });

  it('returns to partner youtube state when watch together ends', () => {
    const tv = new TVDisplay();
    tv.setPartnerState({ site: 'YouTube', title: 'Cool Video', url: 'https://youtube.com/watch?v=abc', isYouTube: true });
    tv.setWatchTogether(true, 'Cool Video', 'abc123');
    expect(tv.getDisplayState()).toBe('watch_together');
    tv.setWatchTogether(false);
    expect(tv.getDisplayState()).toBe('youtube');
  });

  it('provides seat positions for avatars', () => {
    const tv = new TVDisplay();
    const seats = tv.getWatchTogetherSeats(240, 180);
    expect(seats.left).toEqual({ x: 220, y: 240 });
    expect(seats.right).toEqual({ x: 260, y: 240 });
    expect(seats.solo).toEqual({ x: 240, y: 240 });
  });

  it('draws watch together badge', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(),
      fillStyle: '', font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
    };
    const tv = new TVDisplay();
    tv.setWatchTogether(true, 'Cool Video', 'abc123');
    tv.draw(ctx, 240, 180);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});
