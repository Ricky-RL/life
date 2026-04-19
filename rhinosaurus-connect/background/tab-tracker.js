import { SITE_NAMES, IDLE_THRESHOLD_MS } from '../shared/constants.js';

export class TabTracker {
  constructor(broadcastFn) {
    this.broadcast = broadcastFn;
    this.trackingEnabled = true;
    this.lastActivity = null;
    this.lastActivityTimestamp = Date.now();
    this.wasOnYouTube = false;
    this.localActivity = null;
    this.debounceTimer = null;
    this.onYouTubeChange = null;
  }

  async init() {
    const stored = await chrome.storage.local.get(['tracking_enabled', 'wasOnYouTube']);
    this.trackingEnabled = stored.tracking_enabled !== false;
    this.wasOnYouTube = stored.wasOnYouTube || false;

    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        this.handleTabChange(tab);
      } catch {
        // Tab may have been closed
      }
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (tab.active && (changeInfo.url || changeInfo.title)) {
        this.handleTabChange(tab);
      }
    });

    chrome.alarms.create('idle-check', { periodInMinutes: 1 });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'idle-check') {
        this.checkIdle();
      }
    });
  }

  extractSiteName(hostname) {
    return SITE_NAMES[hostname] || hostname.replace('www.', '');
  }

  shouldSkipTab(tab) {
    if (!this.trackingEnabled) return true;
    if (tab.incognito) return true;
    if (!tab.url) return true;

    const url = tab.url;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
      return true;
    }

    return false;
  }

  isYouTubeVideo(url) {
    try {
      const parsed = new URL(url);
      const ytHosts = ['www.youtube.com', 'youtube.com', 'm.youtube.com'];

      if (!ytHosts.includes(parsed.hostname)) {
        if (parsed.hostname === 'youtu.be') return true;
        return false;
      }

      return (
        (parsed.pathname === '/watch' && parsed.searchParams.has('v')) ||
        parsed.pathname.startsWith('/shorts/') ||
        parsed.pathname.startsWith('/live/')
      );
    } catch {
      return false;
    }
  }

  getYouTubeVideoId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2];
      if (parsed.pathname.startsWith('/live/')) return parsed.pathname.split('/')[2];
      return parsed.searchParams.get('v');
    } catch {
      return null;
    }
  }

  handleTabChange(tab) {
    if (this.shouldSkipTab(tab)) return;

    let hostname;
    try {
      hostname = new URL(tab.url).hostname;
    } catch {
      return;
    }

    const siteName = this.extractSiteName(hostname);

    const activity = {
      site: siteName,
      title: tab.title || '',
      timestamp: Date.now(),
    };

    const isYT = this.isYouTubeVideo(tab.url);
    if (isYT) {
      activity.youtubeVideoId = this.getYouTubeVideoId(tab.url);
    }

    this.localActivity = { ...activity, url: tab.url };

    if (
      this.lastActivity &&
      this.lastActivity.site === activity.site &&
      this.lastActivity.title === activity.title
    ) {
      this.lastActivityTimestamp = Date.now();
      return;
    }

    this.lastActivity = activity;
    this.lastActivityTimestamp = Date.now();

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.broadcast(activity);
    }, 500);

    if (isYT && !this.wasOnYouTube) {
      this.wasOnYouTube = true;
      chrome.storage.local.set({ wasOnYouTube: true });
      if (this.onYouTubeChange) this.onYouTubeChange('entered', this.localActivity);
    } else if (!isYT && this.wasOnYouTube) {
      this.wasOnYouTube = false;
      chrome.storage.local.set({ wasOnYouTube: false });
      if (this.onYouTubeChange) this.onYouTubeChange('left', null);
    }
  }

  checkIdle() {
    if (Date.now() - this.lastActivityTimestamp > IDLE_THRESHOLD_MS) {
      this.broadcast({ site: null, title: null, idle: true, timestamp: Date.now() });
    }
  }

  setTrackingEnabled(enabled) {
    this.trackingEnabled = enabled;
    chrome.storage.local.set({ tracking_enabled: enabled });
    if (!enabled) {
      this.broadcast({ site: null, title: null, trackingPaused: true, timestamp: Date.now() });
    }
  }
}
