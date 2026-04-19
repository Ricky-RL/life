/**
 * Determines whether a URL points to a YouTube video.
 * @param {string} url
 * @returns {boolean}
 */
function isYouTubeVideo(url) {
  try {
    const parsed = new URL(url);
    const ytHosts = ['www.youtube.com', 'youtube.com', 'm.youtube.com'];
    if (parsed.hostname === 'youtu.be') return true;
    if (!ytHosts.includes(parsed.hostname)) return false;
    return (parsed.pathname === '/watch' && parsed.searchParams.has('v'))
      || parsed.pathname.startsWith('/shorts/')
      || parsed.pathname.startsWith('/live/');
  } catch { return false; }
}

/**
 * Extracts the video ID from a YouTube URL.
 * @param {string} url
 * @returns {string|null}
 */
function getVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
    if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2];
    if (parsed.pathname.startsWith('/live/')) return parsed.pathname.split('/')[2];
    return parsed.searchParams.get('v');
  } catch { return null; }
}

/**
 * Manages the Watch Together feature — detects when both users are watching
 * the same YouTube video and broadcasts lifecycle events over the channel.
 */
export class WatchTogetherManager {
  /**
   * @param {string} userId - The local user's ID.
   * @param {{ send: (msg: object) => void }} channel - Realtime channel for broadcasting.
   */
  constructor(userId, channel) {
    this.userId = userId;
    this.channel = channel;
    this.myActivity = null;
    this.partnerActivity = null;
    this.state = {
      active: false,
      videoId: null,
      videoTitle: null,
      videoUrl: null,
      participants: [],
    };
  }

  /** @param {{ url: string, title: string }} activity */
  setMyActivity(activity) {
    this.myActivity = activity;
  }

  /** @param {{ url: string, title: string }} activity */
  setPartnerActivity(activity) {
    this.partnerActivity = activity;
  }

  /**
   * Evaluates current activities and transitions state, broadcasting events
   * when Watch Together starts or ends.
   */
  check() {
    const myVideoId = this.myActivity && isYouTubeVideo(this.myActivity.url)
      ? getVideoId(this.myActivity.url)
      : null;
    const partnerVideoId = this.partnerActivity && isYouTubeVideo(this.partnerActivity.url)
      ? getVideoId(this.partnerActivity.url)
      : null;

    const wasActive = this.state.active;

    if (myVideoId && partnerVideoId && myVideoId === partnerVideoId) {
      if (!wasActive) {
        this.state = {
          active: true,
          videoId: myVideoId,
          videoTitle: this.myActivity.title,
          videoUrl: this.myActivity.url,
          participants: [this.userId],
        };
        this.channel.send({
          type: 'broadcast',
          event: 'watch_together_joined',
          payload: {
            user_id: this.userId,
            video_id: myVideoId,
            video_url: this.myActivity.url,
          },
        });
      }
    } else if (wasActive) {
      this.channel.send({
        type: 'broadcast',
        event: 'watch_together_ended',
        payload: { user_id: this.userId },
      });
      this.state = {
        active: false,
        videoId: null,
        videoTitle: null,
        videoUrl: null,
        participants: [],
      };
    }
  }

  /**
   * Returns the partner's current YouTube URL if they are on YouTube, or null.
   * @returns {string|null}
   */
  getJoinUrl() {
    if (!this.partnerActivity || !isYouTubeVideo(this.partnerActivity.url)) return null;
    return this.partnerActivity.url;
  }

  /**
   * Returns a shallow copy of the current state.
   * @returns {object}
   */
  getState() {
    return { ...this.state };
  }
}
