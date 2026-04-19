const MAX_PARTICLES = 10;
const HEART_SPAWN_MIN = 3;
const HEART_SPAWN_MAX = 5;

export class ReactionParticle {
  constructor(type, startX, startY) {
    this.type = type;
    this.x = startX;
    this.y = startY;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = -1.5;
    this.opacity = 1;
    this.scale = 0.5 + Math.random() * 0.5;
    this.targetX = null;
    this.targetY = null;
    this.t = 0;
    this.startX = startX;
    this.startY = startY;
  }

  setTarget(tx, ty) { this.targetX = tx; this.targetY = ty; }

  update() {
    if (this.targetX !== null && this.targetY !== null) {
      this.t += 0.03;
      const t = Math.min(this.t, 1);
      const cpY = Math.min(this.startY, this.targetY) - 40;
      this.x = (1 - t) * (1 - t) * this.startX + 2 * (1 - t) * t * ((this.startX + this.targetX) / 2) + t * t * this.targetX;
      this.y = (1 - t) * (1 - t) * this.startY + 2 * (1 - t) * t * cpY + t * t * this.targetY;
      if (t >= 1) this.opacity = 0;
    } else {
      this.x += this.vx;
      this.y += this.vy;
      this.opacity -= 0.02;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.font = `${Math.round(12 * this.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(this.type === 'heart' ? '❤️' : '💋', this.x, this.y);
    ctx.restore();
  }

  isDead() { return this.opacity <= 0; }
}

export class ReactionParticleSystem {
  constructor() { this.particles = []; }

  spawnHearts(x, y) {
    const count = HEART_SPAWN_MIN + Math.floor(Math.random() * (HEART_SPAWN_MAX - HEART_SPAWN_MIN + 1));
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      this.particles.push(new ReactionParticle('heart', x + (Math.random() - 0.5) * 20, y));
    }
  }

  spawnKiss(fromX, fromY, toX, toY) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const p = new ReactionParticle('kiss', fromX, fromY);
    p.setTarget(toX, toY);
    this.particles.push(p);
  }

  update() {
    for (const p of this.particles) p.update();
    this.particles = this.particles.filter(p => !p.isDead());
  }

  draw(ctx) { for (const p of this.particles) p.draw(ctx); }
  isActive() { return this.particles.length > 0; }
  clear() { this.particles = []; }
}
