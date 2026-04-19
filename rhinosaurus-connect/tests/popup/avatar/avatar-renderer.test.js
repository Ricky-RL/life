import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvatarRenderer, LAYER_ORDER } from '../../../popup/avatar/avatar-renderer.js';

describe('AvatarRenderer', () => {
  let renderer, mockBaseSprite;
  beforeEach(() => { mockBaseSprite = { draw: vi.fn() }; renderer = new AvatarRenderer(mockBaseSprite); });

  it('exports correct layer order', () => { expect(LAYER_ORDER).toEqual(['bottom','shoes','top','outerwear','makeup','necklace','earrings','bracelet','ring','head','face','held']); });
  it('draws base sprite first', () => { const ctx = { drawImage: vi.fn() }; renderer.draw(ctx, 100, 200, 'idle', 0); expect(mockBaseSprite.draw).toHaveBeenCalledWith(ctx, 100, 200, 'idle', 0); });
  it('builds layers from avatar config', () => { const ms = { draw: vi.fn() }; const gs = vi.fn(() => ms); renderer.buildLayers({ top: { item: 'hoodie', color: '#FF6B9D' } }, gs); expect(gs).toHaveBeenCalledWith('top', 'hoodie', '#FF6B9D'); expect(renderer.layers).toHaveLength(1); });
  it('draws layers in order after base', () => { const l1 = { draw: vi.fn() }; const l2 = { draw: vi.fn() }; renderer.layers = [l1, l2]; const ctx = { drawImage: vi.fn() }; renderer.draw(ctx, 100, 200, 'idle', 0); expect(mockBaseSprite.draw).toHaveBeenCalled(); expect(l1.draw).toHaveBeenCalledWith(ctx, 100, 200, 'idle', 0); expect(l2.draw).toHaveBeenCalledWith(ctx, 100, 200, 'idle', 0); });
  it('sets up pet renderer from config', () => { renderer.buildLayers({ pet: { type: 'cat', color: 'white' } }, vi.fn(() => null)); expect(renderer.petConfig).toEqual({ type: 'cat', color: 'white' }); });
  it('handles empty config', () => { renderer.buildLayers({}, vi.fn(() => null)); expect(renderer.layers).toHaveLength(0); });
  it('skips null config slots', () => { renderer.buildLayers({ top: { item: 'hoodie', color: '#FF6B9D' }, bottom: null, outerwear: null }, vi.fn(() => ({ draw: vi.fn() }))); expect(renderer.layers).toHaveLength(1); });
});
