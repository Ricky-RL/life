export class MusicIndicator {
  constructor() {
    this.active = false;
    this.trackUrl = null;
    this.lastDrawX = 0;
    this.lastDrawY = 0;
  }

  setActive(active, trackUrl = null) {
    this.active = active;
    this.trackUrl = active ? trackUrl : null;
  }

  draw(ctx, avatarX, avatarY, timestamp) {
    if (!this.active) return;

    const bobOffset = Math.sin(timestamp / 400) * 3;
    const x = avatarX + 2;
    const y = avatarY - 12 + bobOffset;

    this.lastDrawX = x;
    this.lastDrawY = y;

    ctx.save();
    ctx.fillStyle = '#1DB954';
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9;
    ctx.fillText('\u266a', x, y);
    ctx.restore();
  }

  hitTest(clickX, clickY) {
    if (!this.active) return false;
    const dx = clickX - this.lastDrawX;
    const dy = clickY - this.lastDrawY;
    return Math.abs(dx) < 12 && Math.abs(dy) < 12;
  }
}
