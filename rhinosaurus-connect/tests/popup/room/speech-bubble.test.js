import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechBubble, SpeechBubbleQueue } from '../../../popup/room/speech-bubble.js';

describe('SpeechBubble', () => {
  it('starts in fade-in phase', () => {
    const bubble = new SpeechBubble('hello', 100, 200);
    expect(bubble.phase).toBe('fade_in');
    expect(bubble.opacity).toBe(0);
  });

  it('transitions through phases: fade_in → visible → fade_out → done', () => {
    const bubble = new SpeechBubble('hello', 100, 200);
    bubble.update(250);
    expect(bubble.phase).toBe('visible');
    bubble.update(5100);
    expect(bubble.phase).toBe('fade_out');
    bubble.update(600);
    expect(bubble.isDone()).toBe(true);
  });

  it('calculates opacity during fade_in', () => {
    const bubble = new SpeechBubble('hello', 100, 200);
    bubble.update(100);
    expect(bubble.opacity).toBeCloseTo(0.5, 1);
  });

  it('truncates long text', () => {
    const longText = 'a'.repeat(100);
    const bubble = new SpeechBubble(longText, 100, 200);
    expect(bubble.displayText.length).toBeLessThanOrEqual(53);
  });

  it('draws to canvas context', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 40 })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      globalAlpha: 1,
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    const bubble = new SpeechBubble('hello', 100, 200);
    bubble.phase = 'visible';
    bubble.opacity = 1;
    bubble.draw(ctx);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

describe('SpeechBubbleQueue', () => {
  it('starts empty', () => {
    const queue = new SpeechBubbleQueue();
    expect(queue.active).toBeNull();
    expect(queue.pending).toHaveLength(0);
  });

  it('immediately shows first bubble', () => {
    const queue = new SpeechBubbleQueue();
    queue.add('hello', 100, 200);
    expect(queue.active).not.toBeNull();
    expect(queue.active.text).toBe('hello');
  });

  it('queues subsequent bubbles', () => {
    const queue = new SpeechBubbleQueue();
    queue.add('hello', 100, 200);
    queue.add('world', 100, 200);
    expect(queue.pending).toHaveLength(1);
  });

  it('shows next bubble after gap when current finishes', () => {
    const queue = new SpeechBubbleQueue();
    queue.add('hello', 100, 200);
    queue.add('world', 100, 200);
    queue.active.phase = 'done';
    queue.update(0);
    // Advance gap timer by passing deltaMs through update
    queue.update(1100);
    expect(queue.active).not.toBeNull();
    expect(queue.active.text).toBe('world');
  });
});
