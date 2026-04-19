export const COLOR_PALETTE = [
  '#FFB6C1', '#FF6B9D', '#E6E6FA', '#87CEEB',
  '#98FB98', '#8FBC8F', '#FFFDD0', '#FFF8E7',
  '#FF7F50', '#FFDAB9', '#FFFACD', '#D3D3D3',
  '#A0522D', '#654321', '#36454F', '#000000',
];

const TINT_ALPHA = 0.4;

export class ColorTinter {
  applyTint(ctx, color, x, y, w, h) {
    if (!color) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color;
    ctx.globalAlpha = TINT_ALPHA;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}
