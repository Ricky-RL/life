import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactionHandler } from '../../../popup/room/reaction-handler.js';

describe('ReactionHandler', () => {
  let handler, mockService, mockParticles, mockAnimator, mockBubbleQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    mockService = { sendReaction: vi.fn(() => Promise.resolve({ id: 'msg-1' })) };
    mockParticles = { spawnHearts: vi.fn(), spawnKiss: vi.fn() };
    mockAnimator = { setState: vi.fn() };
    mockBubbleQueue = { add: vi.fn() };
    handler = new ReactionHandler(mockService, mockParticles);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('sends heart reaction', async () => {
    await handler.sendHeart();
    expect(mockService.sendReaction).toHaveBeenCalledWith('heart');
  });

  it('sends kiss reaction', async () => {
    await handler.sendKiss();
    expect(mockService.sendReaction).toHaveBeenCalledWith('kiss');
  });

  it('throttles to 1 per second per type', async () => {
    await handler.sendHeart();
    await handler.sendHeart();
    expect(mockService.sendReaction).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1100);
    await handler.sendHeart();
    expect(mockService.sendReaction).toHaveBeenCalledTimes(2);
  });

  it('allows different types simultaneously', async () => {
    await handler.sendHeart();
    await handler.sendKiss();
    expect(mockService.sendReaction).toHaveBeenCalledTimes(2);
  });

  it('triggers heart animation on receive', () => {
    handler.onReceiveReaction('heart', mockAnimator, mockBubbleQueue, 100, 200);
    expect(mockAnimator.setState).toHaveBeenCalledWith('heart_eyes');
    expect(mockBubbleQueue.add).toHaveBeenCalledWith('❤️', 100, 200);
    expect(mockParticles.spawnHearts).toHaveBeenCalledWith(100, 200);
  });

  it('triggers kiss animation on receive', () => {
    handler.onReceiveReaction('kiss', mockAnimator, mockBubbleQueue, 100, 200, 200, 200);
    expect(mockAnimator.setState).toHaveBeenCalledWith('kiss_face');
    expect(mockBubbleQueue.add).toHaveBeenCalledWith('💋', 100, 200);
    expect(mockParticles.spawnKiss).toHaveBeenCalledWith(100, 200, 200, 200);
  });

  it('formats batch summary for offline delivery', () => {
    const summary = handler.formatBatchSummary(3, 2);
    expect(summary).toContain('3');
    expect(summary).toContain('❤️');
    expect(summary).toContain('2');
    expect(summary).toContain('💋');
  });

  it('formats hearts-only batch', () => {
    const summary = handler.formatBatchSummary(5, 0);
    expect(summary).toContain('5');
    expect(summary).toContain('❤️');
    expect(summary).not.toContain('💋');
  });

  it('caps particle count at 10 for batch', () => {
    const count = handler.getBatchParticleCount(50);
    expect(count).toBeLessThanOrEqual(10);
  });
});
