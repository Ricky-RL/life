import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaletteSwapper } from '../../../popup/avatar/palette-swapper.js';

describe('PaletteSwapper', () => {
  let swapper, mockCtx, mockCanvas;
  beforeEach(() => {
    const imageData = { data: new Uint8ClampedArray([128,128,128,255, 64,64,64,255, 200,200,200,255, 0,0,0,0]), width: 2, height: 2 };
    mockCtx = { drawImage: vi.fn(), getImageData: vi.fn(() => imageData), putImageData: vi.fn() };
    mockCanvas = { width: 0, height: 0, getContext: vi.fn(() => mockCtx) };
    vi.stubGlobal('OffscreenCanvas', vi.fn((w, h) => { mockCanvas.width = w; mockCanvas.height = h; return mockCanvas; }));
    swapper = new PaletteSwapper();
  });

  it('defines base palette with grayscale values', () => { expect(swapper.basePalette).toBeDefined(); expect(swapper.basePalette.length).toBeGreaterThan(0); });
  it('creates swapped sprite from source and target colors', () => {
    const src = { width: 2, height: 2 }; const target = [{ r:255, g:107, b:157 }, { r:200, g:80, b:120 }, { r:255, g:180, b:200 }];
    const result = swapper.swap(src, target);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(src, 0, 0); expect(mockCtx.getImageData).toHaveBeenCalled(); expect(mockCtx.putImageData).toHaveBeenCalled(); expect(result).toBe(mockCanvas);
  });
  it('preserves transparent pixels', () => {
    const src = { width: 2, height: 2 }; const target = [{ r:255, g:0, b:0 }, { r:200, g:0, b:0 }, { r:255, g:100, b:100 }];
    swapper.swap(src, target); const put = mockCtx.putImageData.mock.calls[0][0];
    expect(put.data[12]).toBe(0); expect(put.data[13]).toBe(0); expect(put.data[14]).toBe(0); expect(put.data[15]).toBe(0);
  });
  it('caches swapped results', () => {
    const src = { width: 2, height: 2 }; const pal = [{ r:255, g:0, b:0 }, { r:200, g:0, b:0 }, { r:255, g:100, b:100 }];
    const r1 = swapper.swap(src, pal, 'test-key'); const r2 = swapper.swap(src, pal, 'test-key');
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1); expect(r1).toBe(r2);
  });
});
