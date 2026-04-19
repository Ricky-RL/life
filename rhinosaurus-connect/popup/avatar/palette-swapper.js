const TOLERANCE = 15;

export class PaletteSwapper {
  constructor() {
    this.basePalette = [
      { r: 128, g: 128, b: 128 },
      { r: 64,  g: 64,  b: 64  },
      { r: 200, g: 200, b: 200 },
    ];
    this.cache = new Map();
  }

  /**
   * Swaps grayscale base palette colors to target palette colors in a sprite.
   * @param {HTMLImageElement|ImageBitmap} sourceImg - Source image to tint.
   * @param {Array<{r:number,g:number,b:number}>} targetPalette - Replacement colors.
   * @param {string|null} cacheKey - Optional key to cache the result.
   * @returns {OffscreenCanvas} Canvas with swapped colors.
   */
  swap(sourceImg, targetPalette, cacheKey = null) {
    if (cacheKey && this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const canvas = new OffscreenCanvas(sourceImg.width, sourceImg.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceImg, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;

      for (let p = 0; p < this.basePalette.length && p < targetPalette.length; p++) {
        const base = this.basePalette[p];
        if (
          Math.abs(data[i]     - base.r) <= TOLERANCE &&
          Math.abs(data[i + 1] - base.g) <= TOLERANCE &&
          Math.abs(data[i + 2] - base.b) <= TOLERANCE
        ) {
          data[i]     = targetPalette[p].r;
          data[i + 1] = targetPalette[p].g;
          data[i + 2] = targetPalette[p].b;
          break;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    if (cacheKey) this.cache.set(cacheKey, canvas);
    return canvas;
  }

  /** Clears the swap cache. */
  clearCache() {
    this.cache.clear();
  }
}
