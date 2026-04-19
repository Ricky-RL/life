export class CalendarGlow {
  constructor() {
    this.isActive = false;
    this.milestones = [];
  }

  setMilestones(milestones) {
    this.milestones = milestones;
    this.isActive = milestones.length > 0;
  }

  draw(ctx, calX, calY, timestamp) {
    if (!this.isActive) return;

    ctx.save();
    const pulse = 0.3 + 0.7 * Math.abs(Math.sin(timestamp / 400));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(calX - 2, calY - 2, 52, 52);
    ctx.restore();
  }
}
