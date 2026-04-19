import { describe, it, expect, vi } from 'vitest';
import { CalendarGlow } from '../../../popup/room/calendar-glow.js';

describe('CalendarGlow', () => {
  it('starts inactive', () => {
    const glow = new CalendarGlow();
    expect(glow.isActive).toBe(false);
  });

  it('activates with milestones', () => {
    const glow = new CalendarGlow();
    glow.setMilestones(['Day 100 together!']);
    expect(glow.isActive).toBe(true);
    expect(glow.milestones).toHaveLength(1);
  });

  it('draws sparkle when active', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
    };
    const glow = new CalendarGlow();
    glow.setMilestones(['Test']);
    glow.draw(ctx, 270, 30, 0);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('does not draw when inactive', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
    };
    const glow = new CalendarGlow();
    glow.draw(ctx, 270, 30, 0);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
