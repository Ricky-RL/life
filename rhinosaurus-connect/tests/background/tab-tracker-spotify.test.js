import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChrome = {
  tabs: {
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    get: vi.fn(),
  },
  alarms: {
    create: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({ tracking_enabled: true, wasOnYouTube: false })),
      set: vi.fn(() => Promise.resolve()),
    },
  },
};

vi.stubGlobal('chrome', mockChrome);

const { TabTracker } = await import('../../background/tab-tracker.js');

describe('TabTracker - Spotify', () => {
  let tracker;
  let mockBroadcast;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockBroadcast = vi.fn();
    tracker = new TabTracker(mockBroadcast);
  });

  describe('parseSpotifyTitle', () => {
    it('parses "Song · Artist" format', () => {
      const result = tracker.parseSpotifyTitle('Bohemian Rhapsody · Queen');
      expect(result).toEqual({ song: 'Bohemian Rhapsody', artist: 'Queen' });
    });

    it('handles extra whitespace around separator', () => {
      const result = tracker.parseSpotifyTitle('Song Name  ·  Artist Name');
      expect(result).toEqual({ song: 'Song Name', artist: 'Artist Name' });
    });

    it('returns null for titles without separator', () => {
      expect(tracker.parseSpotifyTitle('Spotify - Web Player')).toBeNull();
    });

    it('returns null for empty titles', () => {
      expect(tracker.parseSpotifyTitle('')).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(tracker.parseSpotifyTitle(null)).toBeNull();
      expect(tracker.parseSpotifyTitle(undefined)).toBeNull();
    });

    it('handles multiple separators by splitting on the first one', () => {
      const result = tracker.parseSpotifyTitle('Song · Artist · Extra');
      expect(result).toEqual({ song: 'Song', artist: 'Artist · Extra' });
    });
  });

  describe('isSpotifyTrack', () => {
    it('returns true for open.spotify.com', () => {
      expect(tracker.isSpotifyTrack('https://open.spotify.com/track/abc123')).toBe(true);
    });

    it('returns false for non-Spotify URLs', () => {
      expect(tracker.isSpotifyTrack('https://www.youtube.com/watch?v=abc')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(tracker.isSpotifyTrack('not-a-url')).toBe(false);
    });
  });

  describe('handleTabChange with Spotify', () => {
    it('enriches activity with spotifySong and spotifyArtist', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://open.spotify.com/track/abc123',
        title: 'Bohemian Rhapsody · Queen',
      });

      vi.advanceTimersByTime(600);

      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          site: 'Spotify',
          spotifySong: 'Bohemian Rhapsody',
          spotifyArtist: 'Queen',
        })
      );
    });

    it('does not add spotify fields for non-Spotify sites', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.reddit.com/',
        title: 'Reddit',
      });

      vi.advanceTimersByTime(600);

      const payload = mockBroadcast.mock.calls[0]?.[0];
      expect(payload?.spotifySong).toBeUndefined();
      expect(payload?.spotifyArtist).toBeUndefined();
    });

    it('handles Spotify pages without track title (e.g. search)', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://open.spotify.com/search',
        title: 'Spotify - Search',
      });

      vi.advanceTimersByTime(600);

      const payload = mockBroadcast.mock.calls[0]?.[0];
      expect(payload?.spotifySong).toBeUndefined();
      expect(payload?.spotifyArtist).toBeUndefined();
    });

    it('fires onSpotifyChange callback when entering Spotify', () => {
      tracker.trackingEnabled = true;
      const spotifyCallback = vi.fn();
      tracker.onSpotifyChange = spotifyCallback;

      tracker.handleTabChange({
        incognito: false,
        url: 'https://open.spotify.com/track/abc123',
        title: 'Song · Artist',
      });

      expect(spotifyCallback).toHaveBeenCalledWith('entered', expect.objectContaining({
        url: 'https://open.spotify.com/track/abc123',
      }));
    });

    it('fires onSpotifyChange callback when leaving Spotify', () => {
      tracker.trackingEnabled = true;
      tracker.wasOnSpotify = true;
      const spotifyCallback = vi.fn();
      tracker.onSpotifyChange = spotifyCallback;

      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.reddit.com/',
        title: 'Reddit',
      });

      expect(spotifyCallback).toHaveBeenCalledWith('left', null);
    });
  });
});
