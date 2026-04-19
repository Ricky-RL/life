import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressImage, MAX_IMAGE_SIZE, MAX_DIMENSION } from '../../shared/image-compressor.js';

describe('compressImage', () => {
  let mockBitmap, mockCanvas, mockCtx, mockBlob;

  beforeEach(() => {
    mockBitmap = { width: 2400, height: 1800, close: vi.fn() };
    mockBlob = new Blob(['fake'], { type: 'image/jpeg' });
    mockCtx = { drawImage: vi.fn() };
    mockCanvas = {
      width: 0, height: 0,
      getContext: vi.fn(() => mockCtx),
      convertToBlob: vi.fn(() => Promise.resolve(mockBlob)),
    };
    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.resolve(mockBitmap)));
    vi.stubGlobal('OffscreenCanvas', vi.fn((w, h) => { mockCanvas.width = w; mockCanvas.height = h; return mockCanvas; }));
  });

  it('scales down images larger than MAX_DIMENSION', async () => {
    const file = new Blob(['test'], { type: 'image/png' });
    await compressImage(file);
    expect(mockCanvas.width).toBe(MAX_DIMENSION);
    expect(mockCanvas.height).toBe(900);
  });

  it('does not scale up small images', async () => {
    mockBitmap.width = 800; mockBitmap.height = 600;
    const file = new Blob(['test'], { type: 'image/png' });
    await compressImage(file);
    expect(mockCanvas.width).toBe(800);
    expect(mockCanvas.height).toBe(600);
  });

  it('returns a JPEG blob', async () => {
    const file = new Blob(['test'], { type: 'image/png' });
    const result = await compressImage(file);
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({ type: 'image/jpeg', quality: 0.8 });
    expect(result).toBe(mockBlob);
  });

  it('closes the bitmap after use', async () => {
    const file = new Blob(['test'], { type: 'image/png' });
    await compressImage(file);
    expect(mockBitmap.close).toHaveBeenCalled();
  });

  it('exports MAX_IMAGE_SIZE as 1MB', () => { expect(MAX_IMAGE_SIZE).toBe(1024 * 1024); });
  it('exports MAX_DIMENSION as 1200', () => { expect(MAX_DIMENSION).toBe(1200); });
});
