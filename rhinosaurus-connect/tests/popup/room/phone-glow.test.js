import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhoneGlow } from '../../../popup/room/phone-glow.js';

describe('PhoneGlow', () => {
  let glow;
  beforeEach(() => { vi.useFakeTimers(); glow = new PhoneGlow(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts inactive', () => { expect(glow.isActive).toBe(false); expect(glow.unreadCount).toBe(0); });
  it('activates on new message', () => { glow.onNewMessage(); expect(glow.isActive).toBe(true); expect(glow.unreadCount).toBe(1); });
  it('increments unread count', () => { glow.onNewMessage(); glow.onNewMessage(); expect(glow.unreadCount).toBe(2); });
  it('deactivates and resets on dismiss', () => { glow.onNewMessage(); glow.onNewMessage(); glow.dismiss(); expect(glow.isActive).toBe(false); expect(glow.unreadCount).toBe(0); });
  it('calculates pulse opacity for draw', () => { glow.onNewMessage(); const opacity = glow.getPulseOpacity(0); expect(opacity).toBeGreaterThanOrEqual(0.3); expect(opacity).toBeLessThanOrEqual(1); });
  it('draws glow around desk position', () => {
    const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), fillStyle: '', globalAlpha: 1, font: '', textAlign: '', textBaseline: '' };
    glow.onNewMessage();
    glow.draw(ctx, 40, 220, 0);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
