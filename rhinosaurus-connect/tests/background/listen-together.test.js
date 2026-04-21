import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListenTogetherManager } from '../../background/listen-together.js';

describe('ListenTogetherManager', () => {
  let manager, mockChannel;

  beforeEach(() => {
    mockChannel = { send: vi.fn() };
    manager = new ListenTogetherManager('user-1', mockChannel);
  });

  it('starts inactive', () => {
    expect(manager.getState().active).toBe(false);
    expect(manager.getState().trackId).toBeNull();
  });

  it('detects same track match', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    expect(manager.getState().active).toBe(true);
    expect(manager.getState().trackId).toBe('abc123');
  });

  it('does not match different tracks', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/xyz789' });
    manager.check();
    expect(manager.getState().active).toBe(false);
  });

  it('strips query params when comparing', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123?si=foo' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123?si=bar' });
    manager.check();
    expect(manager.getState().active).toBe(true);
  });

  it('does not match when one user has no track URL', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: null });
    manager.check();
    expect(manager.getState().active).toBe(false);
  });

  it('does not match non-track URLs', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/playlist/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/playlist/abc123' });
    manager.check();
    expect(manager.getState().active).toBe(false);
  });

  it('deactivates when partner leaves', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    expect(manager.getState().active).toBe(true);
    manager.setPartnerActivity({ spotifyTrackUrl: null });
    manager.check();
    expect(manager.getState().active).toBe(false);
  });

  it('broadcasts listen_together_joined on activation', () => {
    manager.setMyActivity({
      spotifyTrackUrl: 'https://open.spotify.com/track/abc123',
      spotifySong: 'Cool Song',
      spotifyArtist: 'Cool Artist',
    });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'listen_together_joined',
      payload: {
        user_id: 'user-1',
        spotifyTrackUrl: 'https://open.spotify.com/track/abc123',
        spotifySong: 'Cool Song',
        spotifyArtist: 'Cool Artist',
      },
    });
  });

  it('broadcasts listen_together_ended on deactivation', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    mockChannel.send.mockClear();
    manager.setPartnerActivity({ spotifyTrackUrl: null });
    manager.check();
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'listen_together_ended',
      payload: { user_id: 'user-1' },
    });
  });

  it('does not broadcast again if already active on same track', () => {
    manager.setMyActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/abc123' });
    manager.check();
    mockChannel.send.mockClear();
    manager.check();
    expect(mockChannel.send).not.toHaveBeenCalled();
  });

  it('returns partner track URL from getJoinUrl', () => {
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/track/xyz789' });
    expect(manager.getJoinUrl()).toBe('https://open.spotify.com/track/xyz789');
  });

  it('returns null from getJoinUrl when partner has no track', () => {
    manager.setPartnerActivity({ spotifyTrackUrl: null });
    expect(manager.getJoinUrl()).toBeNull();
  });

  it('returns null from getJoinUrl when partner has non-track URL', () => {
    manager.setPartnerActivity({ spotifyTrackUrl: 'https://open.spotify.com/playlist/abc' });
    expect(manager.getJoinUrl()).toBeNull();
  });
});
