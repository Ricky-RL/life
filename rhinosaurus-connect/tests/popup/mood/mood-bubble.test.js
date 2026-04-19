import { describe, it, expect, vi } from 'vitest';
import { MoodBubble } from '../../../popup/mood/mood-bubble.js';

describe('MoodBubble', () => {
  it('does not draw when mood is null', () => { const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn() }; const b = new MoodBubble(); b.draw(ctx, 100, 200, null); expect(ctx.fillRect).not.toHaveBeenCalled(); });
  it('draws bubble background at correct position', () => { const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), globalAlpha: 1 }; const b = new MoodBubble(); b.draw(ctx, 100, 200, 'happy'); expect(ctx.fillRect).toHaveBeenCalled(); });
  it('draws mood sprite when available', () => { const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), globalAlpha: 1 }; const b = new MoodBubble(); b.setSpriteSheet({ width: 112, height: 16 }); b.draw(ctx, 100, 200, 'happy'); expect(ctx.drawImage).toHaveBeenCalled(); });
  it('calculates bubble position above avatar', () => { const b = new MoodBubble(); const pos = b.getPosition(100, 200); expect(pos.x).toBe(110); expect(pos.y).toBe(180); });
  it('animates transition with fade', () => { const b = new MoodBubble(); b.setMood('happy'); expect(b.transitioning).toBe(true); expect(b.opacity).toBeLessThan(1); });
  it('completes transition over time', () => { const b = new MoodBubble(); b.setMood('happy'); for (let i = 0; i < 10; i++) b.update(50); expect(b.opacity).toBeCloseTo(1, 0); expect(b.transitioning).toBe(false); });
});
