/**
 * Extracts the Spotify track ID from a Spotify track URL.
 * Returns null for non-track URLs, invalid URLs, or null input.
 * @param {string|null} url
 * @returns {string|null}
 */
function extractTrackId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'open.spotify.com') return null;
    const match = parsed.pathname.match(/^\/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Manages the Listen Together feature — detects when both users are listening
 * to the same Spotify track and broadcasts lifecycle events over the channel.
 */
export class ListenTogetherManager {
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
      trackId: null,
      spotifySong: null,
      spotifyArtist: null,
      spotifyTrackUrl: null,
    };
  }

  /** @param {{ spotifyTrackUrl: string|null, spotifySong?: string, spotifyArtist?: string }} activity */
  setMyActivity(activity) {
    this.myActivity = activity;
  }

  /** @param {{ spotifyTrackUrl: string|null }} activity */
  setPartnerActivity(activity) {
    this.partnerActivity = activity;
  }

  /**
   * Evaluates current activities and transitions state, broadcasting events
   * when Listen Together starts or ends.
   */
  check() {
    const myTrackId = extractTrackId(this.myActivity?.spotifyTrackUrl);
    const partnerTrackId = extractTrackId(this.partnerActivity?.spotifyTrackUrl);
    const wasActive = this.state.active;

    if (myTrackId && partnerTrackId && myTrackId === partnerTrackId) {
      if (!wasActive) {
        this.state = {
          active: true,
          trackId: myTrackId,
          spotifySong: this.myActivity.spotifySong || null,
          spotifyArtist: this.myActivity.spotifyArtist || null,
          spotifyTrackUrl: this.myActivity.spotifyTrackUrl,
        };
        this.channel.send({
          type: 'broadcast',
          event: 'listen_together_joined',
          payload: {
            user_id: this.userId,
            spotifyTrackUrl: this.myActivity.spotifyTrackUrl,
            spotifySong: this.myActivity.spotifySong || null,
            spotifyArtist: this.myActivity.spotifyArtist || null,
          },
        });
      }
    } else if (wasActive) {
      this.channel.send({
        type: 'broadcast',
        event: 'listen_together_ended',
        payload: { user_id: this.userId },
      });
      this.state = {
        active: false,
        trackId: null,
        spotifySong: null,
        spotifyArtist: null,
        spotifyTrackUrl: null,
      };
    }
  }

  /**
   * Returns the partner's current Spotify track URL if they are on a track, or null.
   * @returns {string|null}
   */
  getJoinUrl() {
    if (!this.partnerActivity?.spotifyTrackUrl) return null;
    const trackId = extractTrackId(this.partnerActivity.spotifyTrackUrl);
    if (!trackId) return null;
    return this.partnerActivity.spotifyTrackUrl;
  }

  /**
   * Returns a shallow copy of the current state.
   * @returns {object}
   */
  getState() {
    return { ...this.state };
  }
}
