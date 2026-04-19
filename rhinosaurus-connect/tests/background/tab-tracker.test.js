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

describe('TabTracker', () => {
  let tracker;
  let mockBroadcast;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockBroadcast = vi.fn();
    tracker = new TabTracker(mockBroadcast);
  });

  describe('extractSiteName', () => {
    it('maps known hostnames to friendly names', () => {
      expect(tracker.extractSiteName('www.youtube.com')).toBe('YouTube');
      expect(tracker.extractSiteName('youtube.com')).toBe('YouTube');
      expect(tracker.extractSiteName('m.youtube.com')).toBe('YouTube');
      expect(tracker.extractSiteName('open.spotify.com')).toBe('Spotify');
      expect(tracker.extractSiteName('www.netflix.com')).toBe('Netflix');
      expect(tracker.extractSiteName('netflix.com')).toBe('Netflix');
      expect(tracker.extractSiteName('www.reddit.com')).toBe('Reddit');
      expect(tracker.extractSiteName('reddit.com')).toBe('Reddit');
      expect(tracker.extractSiteName('twitter.com')).toBe('Twitter');
      expect(tracker.extractSiteName('x.com')).toBe('Twitter');
      expect(tracker.extractSiteName('www.instagram.com')).toBe('Instagram');
      expect(tracker.extractSiteName('instagram.com')).toBe('Instagram');
      expect(tracker.extractSiteName('www.twitch.tv')).toBe('Twitch');
      expect(tracker.extractSiteName('twitch.tv')).toBe('Twitch');
    });

    it('strips www. from unknown hostnames', () => {
      expect(tracker.extractSiteName('www.example.com')).toBe('example.com');
    });

    it('returns hostname as-is for unknown without www', () => {
      expect(tracker.extractSiteName('docs.google.com')).toBe('docs.google.com');
    });
  });

  describe('shouldSkipTab', () => {
    it('skips incognito tabs', () => {
      expect(tracker.shouldSkipTab({ incognito: true, url: 'https://example.com' })).toBe(true);
    });

    it('skips chrome:// URLs', () => {
      expect(tracker.shouldSkipTab({ incognito: false, url: 'chrome://settings' })).toBe(true);
    });

    it('skips chrome-extension:// URLs', () => {
      expect(tracker.shouldSkipTab({ incognito: false, url: 'chrome-extension://abc/popup.html' })).toBe(true);
    });

    it('skips about: URLs', () => {
      expect(tracker.shouldSkipTab({ incognito: false, url: 'about:blank' })).toBe(true);
    });

    it('does not skip normal URLs', () => {
      expect(tracker.shouldSkipTab({ incognito: false, url: 'https://example.com' })).toBe(false);
    });

    it('skips when tracking is disabled', () => {
      tracker.trackingEnabled = false;
      expect(tracker.shouldSkipTab({ incognito: false, url: 'https://example.com' })).toBe(true);
    });
  });

  describe('isYouTubeVideo', () => {
    it('detects youtube.com/watch URLs', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    });

    it('detects youtu.be short links', () => {
      expect(tracker.isYouTubeVideo('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('detects /shorts/ URLs', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/shorts/abc123')).toBe(true);
    });

    it('detects /live/ URLs', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/live/xyz789')).toBe(true);
    });

    it('rejects YouTube homepage', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/')).toBe(false);
    });

    it('rejects YouTube search', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/results?search_query=cats')).toBe(false);
    });

    it('rejects YouTube channel pages', () => {
      expect(tracker.isYouTubeVideo('https://www.youtube.com/@MrBeast')).toBe(false);
    });

    it('rejects non-YouTube URLs', () => {
      expect(tracker.isYouTubeVideo('https://www.google.com')).toBe(false);
    });

    it('rejects YouTube Music', () => {
      expect(tracker.isYouTubeVideo('https://music.youtube.com/watch?v=abc')).toBe(false);
    });
  });

  describe('getYouTubeVideoId', () => {
    it('extracts from standard watch URL', () => {
      expect(tracker.getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts from youtu.be', () => {
      expect(tracker.getYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts from /shorts/', () => {
      expect(tracker.getYouTubeVideoId('https://www.youtube.com/shorts/abc123')).toBe('abc123');
    });

    it('extracts from /live/', () => {
      expect(tracker.getYouTubeVideoId('https://www.youtube.com/live/xyz789')).toBe('xyz789');
    });

    it('ignores extra query params', () => {
      expect(tracker.getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe('dQw4w9WgXcQ');
    });
  });

  describe('handleTabChange', () => {
    it('broadcasts activity for normal tabs', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.reddit.com/r/programming',
        title: 'r/programming - Reddit',
      });

      vi.advanceTimersByTime(600);

      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          site: 'Reddit',
          title: 'r/programming - Reddit',
        })
      );
    });

    it('does not broadcast URL in activity payload', () => {
      tracker.trackingEnabled = true;
      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.reddit.com/r/secrets',
        title: 'Secrets',
      });

      vi.advanceTimersByTime(600);

      const broadcastedPayload = mockBroadcast.mock.calls[0]?.[0];
      if (broadcastedPayload) {
        expect(broadcastedPayload.url).toBeUndefined();
      }
    });

    it('skips duplicate activity', () => {
      tracker.trackingEnabled = true;
      const tab = {
        incognito: false,
        url: 'https://www.reddit.com/r/programming',
        title: 'r/programming',
      };

      tracker.handleTabChange(tab);
      vi.advanceTimersByTime(600);
      mockBroadcast.mockClear();

      tracker.handleTabChange(tab);
      vi.advanceTimersByTime(600);

      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('triggers YouTube enter callback', () => {
      tracker.trackingEnabled = true;
      const ytCallback = vi.fn();
      tracker.onYouTubeChange = ytCallback;

      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
      });

      expect(ytCallback).toHaveBeenCalledWith('entered', expect.objectContaining({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }));
    });

    it('triggers YouTube leave callback', () => {
      tracker.trackingEnabled = true;
      tracker.wasOnYouTube = true;
      const ytCallback = vi.fn();
      tracker.onYouTubeChange = ytCallback;

      tracker.handleTabChange({
        incognito: false,
        url: 'https://www.reddit.com/',
        title: 'Reddit',
      });

      expect(ytCallback).toHaveBeenCalledWith('left', null);
    });

    it('triggers YouTube leave when switching to a skipped tab', () => {
      tracker.trackingEnabled = true;
      tracker.wasOnYouTube = true;
      const ytCallback = vi.fn();
      tracker.onYouTubeChange = ytCallback;

      tracker.handleTabChange({
        incognito: false,
        url: 'chrome://settings',
        title: 'Settings',
      });

      expect(ytCallback).toHaveBeenCalledWith('left', null);
      expect(tracker.wasOnYouTube).toBe(false);
    });

    it('does not fire YouTube leave for skipped tabs when not on YouTube', () => {
      tracker.trackingEnabled = true;
      tracker.wasOnYouTube = false;
      const ytCallback = vi.fn();
      tracker.onYouTubeChange = ytCallback;

      tracker.handleTabChange({
        incognito: false,
        url: 'chrome://settings',
        title: 'Settings',
      });

      expect(ytCallback).not.toHaveBeenCalled();
    });
  });

  describe('checkIdle', () => {
    it('broadcasts idle when past threshold', () => {
      tracker.lastActivityTimestamp = Date.now() - 6 * 60 * 1000;
      tracker.checkIdle();
      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({ idle: true })
      );
    });

    it('does not broadcast when within threshold', () => {
      tracker.lastActivityTimestamp = Date.now();
      tracker.checkIdle();
      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });

  describe('setTrackingEnabled', () => {
    it('broadcasts tracking paused when disabled', () => {
      tracker.setTrackingEnabled(false);
      expect(tracker.trackingEnabled).toBe(false);
      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({ trackingPaused: true })
      );
    });

    it('updates chrome storage', () => {
      tracker.setTrackingEnabled(false);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ tracking_enabled: false });
    });
  });
});
