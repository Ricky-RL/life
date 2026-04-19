import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TypingIndicator } from '../../../popup/chat/typing-indicator.js';

describe('TypingIndicator', () => {
  let indicator, mockChannel;

  beforeEach(() => {
    vi.useFakeTimers();
    mockChannel = { send: vi.fn() };
    indicator = new TypingIndicator(mockChannel, 'user-1');
  });

  afterEach(() => { vi.useRealTimers(); });

  it('broadcasts typing event', () => {
    indicator.startTyping();
    expect(mockChannel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'typing', payload: { user_id: 'user-1' } });
  });

  it('throttles typing broadcasts to 2 seconds', () => {
    indicator.startTyping();
    indicator.startTyping();
    indicator.startTyping();
    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2100);
    indicator.startTyping();
    expect(mockChannel.send).toHaveBeenCalledTimes(2);
  });

  it('tracks partner typing state', () => {
    expect(indicator.isPartnerTyping).toBe(false);
    indicator.onPartnerTyping();
    expect(indicator.isPartnerTyping).toBe(true);
  });

  it('clears partner typing after 3 seconds', () => {
    indicator.onPartnerTyping();
    expect(indicator.isPartnerTyping).toBe(true);
    vi.advanceTimersByTime(3100);
    expect(indicator.isPartnerTyping).toBe(false);
  });
});
