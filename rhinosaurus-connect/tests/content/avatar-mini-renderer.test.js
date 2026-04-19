import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvatarMiniRenderer } from '../../content/avatar-mini-renderer.js';

function createMockCanvas() {
  const ctx = { clearRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), imageSmoothingEnabled: true };
  return { canvas: { width: 64, height: 96, getContext: vi.fn(() => ctx) }, ctx };
}

describe('AvatarMiniRenderer', () => {
  it('initializes with canvas dimensions', () => { const { canvas } = createMockCanvas(); const r = new AvatarMiniRenderer(canvas); expect(r.scale).toBe(2); });
  it('renders static idle frame for basic notification', () => { const { canvas, ctx } = createMockCanvas(); const r = new AvatarMiniRenderer(canvas); r.renderStatic({ width: 256, height: 384 }, 'idle', 0); expect(ctx.drawImage).toHaveBeenCalled(); });
  it('renders animated frame for reaction notification', () => { const { canvas, ctx } = createMockCanvas(); const r = new AvatarMiniRenderer(canvas); r.renderFrame({ width: 256, height: 384 }, 'heart_eyes', 3); expect(ctx.drawImage).toHaveBeenCalled(); });
});
