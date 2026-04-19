import { describe, it, expect, vi } from 'vitest';
import { AvatarAnimator } from '../../../popup/room/avatar-animator.js';

describe('AvatarAnimator', () => {
  it('starts in idle state', () => {
    const animator = new AvatarAnimator();
    expect(animator.currentState).toBe('idle');
    expect(animator.currentFrame).toBe(0);
  });

  it('sets state and resets frame', () => {
    const animator = new AvatarAnimator();
    animator.setState('heart_eyes');
    expect(animator.currentState).toBe('heart_eyes');
    expect(animator.currentFrame).toBe(0);
  });

  it('advances frames on update', () => {
    const animator = new AvatarAnimator();
    animator.setState('idle');
    animator.update(34);
    expect(animator.currentFrame).toBe(1);
  });

  it('loops looping animations', () => {
    const animator = new AvatarAnimator();
    animator.setState('idle'); // 4 frames, looping
    for (let i = 0; i < 5; i++) animator.update(34);
    expect(animator.currentFrame).toBe(1);
  });

  it('returns to idle after non-looping animation completes', () => {
    const animator = new AvatarAnimator();
    animator.setState('heart_eyes'); // 6 frames, not looping
    for (let i = 0; i < 7; i++) animator.update(34);
    expect(animator.currentState).toBe('idle');
  });

  it('calls onComplete callback for non-looping animations', () => {
    const animator = new AvatarAnimator();
    const callback = vi.fn();
    animator.onAnimationComplete = callback;
    animator.setState('waving'); // 6 frames, not looping
    for (let i = 0; i < 7; i++) animator.update(34);
    expect(callback).toHaveBeenCalledWith('waving');
  });

  it('draws current frame from sprite sheet', () => {
    const ctx = { drawImage: vi.fn() };
    const animator = new AvatarAnimator();
    const mockSheet = { width: 256, height: 384 };
    animator.spriteSheet = mockSheet;
    animator.draw(ctx, 100, 200, 3);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('reports correct animation state info', () => {
    const animator = new AvatarAnimator();
    expect(animator.isLooping()).toBe(true);
    animator.setState('heart_eyes');
    expect(animator.isLooping()).toBe(false);
  });
});
