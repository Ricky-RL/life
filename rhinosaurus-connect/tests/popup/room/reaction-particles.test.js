import { describe, it, expect, vi } from 'vitest';
import { ReactionParticle, ReactionParticleSystem } from '../../../popup/room/reaction-particles.js';

describe('ReactionParticle', () => {
  it('initializes with position and type', () => {
    const p = new ReactionParticle('heart', 100, 200);
    expect(p.type).toBe('heart');
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
    expect(p.opacity).toBe(1);
  });

  it('moves upward and drifts on update', () => {
    const p = new ReactionParticle('heart', 100, 200);
    const startY = p.y;
    p.update();
    expect(p.y).toBeLessThan(startY);
    expect(p.opacity).toBeLessThan(1);
  });

  it('is dead when opacity reaches zero', () => {
    const p = new ReactionParticle('heart', 100, 200);
    p.opacity = 0.01;
    p.update();
    expect(p.isDead()).toBe(true);
  });

  it('draws to canvas context', () => {
    const ctx = { save: vi.fn(), restore: vi.fn(), fillText: vi.fn(), globalAlpha: 1, font: '', textAlign: '' };
    const p = new ReactionParticle('heart', 100, 200);
    p.draw(ctx);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe('ReactionParticleSystem', () => {
  it('starts with no particles', () => {
    const sys = new ReactionParticleSystem();
    expect(sys.particles).toHaveLength(0);
  });

  it('spawns 3-5 particles for heart', () => {
    const sys = new ReactionParticleSystem();
    sys.spawnHearts(100, 200);
    expect(sys.particles.length).toBeGreaterThanOrEqual(3);
    expect(sys.particles.length).toBeLessThanOrEqual(5);
  });

  it('spawns 1 particle for kiss', () => {
    const sys = new ReactionParticleSystem();
    sys.spawnKiss(100, 200, 200, 200);
    expect(sys.particles.length).toBe(1);
  });

  it('removes dead particles on update', () => {
    const sys = new ReactionParticleSystem();
    sys.spawnHearts(100, 200);
    for (const p of sys.particles) p.opacity = 0;
    sys.update();
    expect(sys.particles).toHaveLength(0);
  });

  it('caps particles at 10', () => {
    const sys = new ReactionParticleSystem();
    for (let i = 0; i < 20; i++) sys.spawnHearts(100, 200);
    expect(sys.particles.length).toBeLessThanOrEqual(10);
  });

  it('reports active state', () => {
    const sys = new ReactionParticleSystem();
    expect(sys.isActive()).toBe(false);
    sys.spawnHearts(100, 200);
    expect(sys.isActive()).toBe(true);
  });
});
