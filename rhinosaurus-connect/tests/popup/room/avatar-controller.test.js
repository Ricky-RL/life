import { describe, it, expect, vi } from 'vitest';
import { AvatarController } from '../../../popup/room/avatar-controller.js';

describe('AvatarController', () => {
  it('stores current position', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    expect(ctrl.x).toBe(100);
    expect(ctrl.y).toBe(200);
  });

  it('calculates movement towards target', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(0, 0);
    ctrl.moveTo(100, 0);
    expect(ctrl.isMoving).toBe(true);
    ctrl.update();
    expect(ctrl.x).toBeGreaterThan(0);
  });

  it('stops when reaching target', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(0, 0);
    ctrl.moveTo(4, 0);
    for (let i = 0; i < 10; i++) ctrl.update();
    expect(ctrl.isMoving).toBe(false);
    expect(ctrl.x).toBe(4);
    expect(ctrl.y).toBe(0);
  });

  it('moves at 2px per update', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(0, 0);
    ctrl.moveTo(100, 0);
    ctrl.update();
    expect(ctrl.x).toBeCloseTo(2, 0);
  });

  it('saves previous position for return', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    ctrl.moveTo(50, 50, true);
    expect(ctrl.previousPosition).toEqual({ x: 100, y: 200 });
  });

  it('returns to previous position', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    ctrl.moveTo(50, 50, true);
    ctrl.returnToPrevious();
    expect(ctrl.targetX).toBe(100);
    expect(ctrl.targetY).toBe(200);
  });

  it('handles drag start/move/end', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    ctrl.startDrag(100, 200);
    expect(ctrl.isDragging).toBe(true);
    ctrl.drag(120, 220);
    expect(ctrl.x).toBe(120);
    expect(ctrl.y).toBe(220);
    ctrl.endDrag();
    expect(ctrl.isDragging).toBe(false);
  });

  it('checks if a point hits the avatar', () => {
    const ctrl = new AvatarController('user-1');
    ctrl.setPosition(100, 200);
    expect(ctrl.hitTest(110, 210, 3)).toBe(true);
    expect(ctrl.hitTest(0, 0, 3)).toBe(false);
  });
});
