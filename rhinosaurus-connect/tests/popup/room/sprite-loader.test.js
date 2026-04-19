import { describe, it, expect, vi } from 'vitest';
import { SpriteLoader, SpriteFrame } from '../../../popup/room/sprite-loader.js';

describe('SpriteFrame', () => {
  it('stores source rectangle from sprite sheet', () => {
    const frame = new SpriteFrame('sheet1', 0, 0, 32, 48);
    expect(frame.sheet).toBe('sheet1');
    expect(frame.sx).toBe(0);
    expect(frame.sy).toBe(0);
    expect(frame.sw).toBe(32);
    expect(frame.sh).toBe(48);
  });

  it('draws to canvas context with explicit dimensions', () => {
    const ctx = { drawImage: vi.fn() };
    const mockSheet = { width: 256, height: 256 };
    const frame = new SpriteFrame(mockSheet, 32, 0, 32, 48);
    frame.draw(ctx, 100, 200, 64, 96);
    expect(ctx.drawImage).toHaveBeenCalledWith(mockSheet, 32, 0, 32, 48, 100, 200, 64, 96);
  });

  it('draws to canvas context with default dimensions', () => {
    const ctx = { drawImage: vi.fn() };
    const mockSheet = { width: 256, height: 256 };
    const frame = new SpriteFrame(mockSheet, 0, 0, 32, 48);
    frame.draw(ctx, 10, 20);
    expect(ctx.drawImage).toHaveBeenCalledWith(mockSheet, 0, 0, 32, 48, 10, 20, 32, 48);
  });
});

describe('SpriteLoader', () => {
  it('registers sprite definitions', () => {
    const loader = new SpriteLoader();
    loader.register('bed', 'double-wood', { sheet: 'room', sx: 0, sy: 0, sw: 64, sh: 48 });
    const def = loader.getDefinition('bed', 'double-wood');
    expect(def).toBeDefined();
    expect(def.sw).toBe(64);
  });

  it('returns null for unregistered sprite', () => {
    const loader = new SpriteLoader();
    expect(loader.getDefinition('nonexistent', 'variant')).toBeNull();
  });

  it('creates SpriteFrame from definition and loaded sheet', () => {
    const loader = new SpriteLoader();
    const mockSheet = { width: 256, height: 256 };
    loader.sheets.set('room', mockSheet);
    loader.register('bed', 'double-wood', { sheet: 'room', sx: 0, sy: 0, sw: 64, sh: 48 });

    const frame = loader.getFrame('bed', 'double-wood');
    expect(frame).toBeInstanceOf(SpriteFrame);
    expect(frame.sheet).toBe(mockSheet);
  });

  it('returns null when sheet is not loaded', () => {
    const loader = new SpriteLoader();
    loader.register('bed', 'double-wood', { sheet: 'room', sx: 0, sy: 0, sw: 64, sh: 48 });
    const frame = loader.getFrame('bed', 'double-wood');
    expect(frame).toBeNull();
  });

  it('returns null when definition does not exist', () => {
    const loader = new SpriteLoader();
    const frame = loader.getFrame('nonexistent', 'variant');
    expect(frame).toBeNull();
  });

  it('loads a sprite sheet image', async () => {
    const loader = new SpriteLoader();
    let instance;
    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.src = '';
        instance = this;
      }
    };

    const promise = loader.loadSheet('room', 'sprites/room.png');
    instance.onload();
    await promise;

    expect(loader.sheets.get('room')).toBe(instance);
    expect(instance.src).toBe('sprites/room.png');

    globalThis.Image = OrigImage;
  });

  it('rejects when sheet image fails to load', async () => {
    const loader = new SpriteLoader();
    let instance;
    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.src = '';
        instance = this;
      }
    };

    const promise = loader.loadSheet('room', 'sprites/room.png');
    const error = new Error('load failed');
    instance.onerror(error);

    await expect(promise).rejects.toThrow('load failed');

    globalThis.Image = OrigImage;
  });
});
