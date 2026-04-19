/** Ordered list of avatar clothing/accessory layers from bottom to top. */
export const LAYER_ORDER = [
  'bottom', 'shoes', 'top', 'outerwear', 'makeup',
  'necklace', 'earrings', 'bracelet', 'ring', 'head', 'face', 'held',
];

export class AvatarRenderer {
  /**
   * @param {object} baseSprite - Sprite with a draw(ctx, x, y, animState, frame) method.
   */
  constructor(baseSprite) {
    this.baseSprite = baseSprite;
    this.layers = [];
    this.petConfig = null;
    this.petRenderer = null;
  }

  /**
   * Builds the layered sprite list from an avatar config object.
   * @param {object} avatarConfig - Map of slot names to { item, color } configs.
   * @param {Function} getSprite - (slot, item, color) => sprite | null
   */
  buildLayers(avatarConfig, getSprite) {
    this.layers = [];
    this.petConfig = null;

    for (const slot of LAYER_ORDER) {
      const config = avatarConfig[slot];
      if (!config) continue;
      const sprite = getSprite(slot, config.item, config.color);
      if (sprite) this.layers.push(sprite);
    }

    if (avatarConfig.pet) this.petConfig = avatarConfig.pet;
  }

  /**
   * Draws the avatar (base + all layers + optional pet) onto a canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {string} animState
   * @param {number} frame
   */
  draw(ctx, x, y, animState, frame) {
    this.baseSprite.draw(ctx, x, y, animState, frame);
    for (const layer of this.layers) {
      layer.draw(ctx, x, y, animState, frame);
    }
    if (this.petRenderer) {
      this.petRenderer.draw(ctx, x + 30, y + 10);
    }
  }
}
