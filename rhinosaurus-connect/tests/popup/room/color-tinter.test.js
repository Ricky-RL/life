import { describe, it, expect, vi } from 'vitest';
import { ColorTinter, COLOR_PALETTE } from '../../../popup/room/color-tinter.js';

describe('ColorTinter', () => {
  it('exports a palette of 16 colors', () => {
    expect(COLOR_PALETTE).toHaveLength(16);
  });

  it('applies tint to canvas context', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      globalAlpha: 1,
    };
    const tinter = new ColorTinter();
    tinter.applyTint(ctx, '#FF6B9D', 10, 10, 40, 30);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 10, 40, 30);
  });

  it('uses 0.4 alpha for subtle tint', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      globalAlpha: 1,
    };
    const tinter = new ColorTinter();
    tinter.applyTint(ctx, '#FF6B9D', 0, 0, 10, 10);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('skips tint when color is null', () => {
    const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn() };
    const tinter = new ColorTinter();
    tinter.applyTint(ctx, null, 0, 0, 10, 10);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
