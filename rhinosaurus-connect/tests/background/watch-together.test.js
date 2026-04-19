import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WatchTogetherManager } from '../../background/watch-together.js';

describe('WatchTogetherManager', () => {
  let manager, mockChannel;

  beforeEach(() => {
    mockChannel = { send: vi.fn() };
    manager = new WatchTogetherManager('user-1', mockChannel);
  });

  it('starts inactive', () => {
    expect(manager.state.active).toBe(false);
    expect(manager.state.videoId).toBeNull();
  });

  it('detects same video match', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'Cool Vid' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'Cool Vid' });
    manager.check();
    expect(manager.state.active).toBe(true);
    expect(manager.state.videoId).toBe('abc123');
  });

  it('does not match different videos', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=xyz789', title: 'B' });
    manager.check();
    expect(manager.state.active).toBe(false);
  });

  it('does not match non-YouTube URLs', () => {
    manager.setMyActivity({ url: 'https://reddit.com', title: 'Reddit' });
    manager.setPartnerActivity({ url: 'https://reddit.com', title: 'Reddit' });
    manager.check();
    expect(manager.state.active).toBe(false);
  });

  it('handles youtu.be short links', () => {
    manager.setMyActivity({ url: 'https://youtu.be/abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    expect(manager.state.active).toBe(true);
  });

  it('ignores extra query params when comparing', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123&t=120', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    expect(manager.state.active).toBe(true);
  });

  it('deactivates when partner leaves video', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    expect(manager.state.active).toBe(true);
    manager.setPartnerActivity({ url: 'https://reddit.com', title: 'Reddit' });
    manager.check();
    expect(manager.state.active).toBe(false);
  });

  it('broadcasts watch_together_joined on activation', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'broadcast', event: 'watch_together_joined' }));
  });

  it('broadcasts watch_together_ended on deactivation', () => {
    manager.setMyActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=abc123', title: 'A' });
    manager.check();
    mockChannel.send.mockClear();
    manager.setPartnerActivity({ url: 'https://reddit.com', title: 'Reddit' });
    manager.check();
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'broadcast', event: 'watch_together_ended' }));
  });

  it('generates join URL from partner activity', () => {
    manager.setPartnerActivity({ url: 'https://www.youtube.com/watch?v=xyz789', title: 'B' });
    expect(manager.getJoinUrl()).toBe('https://www.youtube.com/watch?v=xyz789');
  });

  it('returns null join URL when partner is not on YouTube', () => {
    manager.setPartnerActivity({ url: 'https://reddit.com', title: 'Reddit' });
    expect(manager.getJoinUrl()).toBeNull();
  });
});
