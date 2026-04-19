export class PhoneGlow {
  constructor() { this.isActive = false; this.unreadCount = 0; }
  onNewMessage() { this.isActive = true; this.unreadCount++; }
  dismiss() { this.isActive = false; this.unreadCount = 0; }
  getPulseOpacity(timestamp) { return 0.3 + 0.7 * Math.abs(Math.sin(timestamp / 500)); }
  draw(ctx, deskX, deskY, timestamp) {
    if (!this.isActive) return;
    ctx.save();
    const opacity = this.getPulseOpacity(timestamp);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(deskX - 2, deskY - 2, 52, 52);
    ctx.globalAlpha = 1;
    if (this.unreadCount > 0) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(deskX + 36, deskY - 4, 16, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.unreadCount), deskX + 44, deskY + 3);
    }
    ctx.restore();
  }
}
