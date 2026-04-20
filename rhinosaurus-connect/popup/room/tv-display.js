export class TVDisplay {
  constructor() {
    this.partnerState = { isOnline: false };
    this.watchTogether = false;
    this.history = [];
    this.staticFrame = 0;
    this.staticTimer = 0;
    this.listenTogether = false;
    this.listenTogetherSong = null;
    this.listenTogetherArtist = null;
  }

  setPartnerState(state) {
    this.partnerState = state;
    if (state.activity && !state.idle && !state.trackingPaused) {
      this.addToHistory(state.activity);
    }
  }

  /**
   * Activates or deactivates Watch Together mode.
   * @param {boolean} active
   * @param {string|null} [title]
   * @param {string|null} [videoId]
   */
  setWatchTogether(active, title = null, videoId = null) {
    this.watchTogether = active;
    this.watchTogetherTitle = active ? title : null;
    this.watchTogetherVideoId = active ? videoId : null;
  }

  setListenTogether(active, song = null, artist = null) {
    this.listenTogether = active;
    this.listenTogetherSong = active ? song : null;
    this.listenTogetherArtist = active ? artist : null;
  }

  /**
   * Returns avatar seat positions relative to the TV centre.
   * @param {number} tvX - Centre X of the TV on the canvas.
   * @param {number} tvY - Centre Y of the TV on the canvas.
   * @returns {{ left: {x:number,y:number}, right: {x:number,y:number}, solo: {x:number,y:number} }}
   */
  getWatchTogetherSeats(tvX, tvY) {
    return {
      left: { x: tvX - 20, y: tvY + 60 },
      right: { x: tvX + 20, y: tvY + 60 },
      solo: { x: tvX, y: tvY + 60 },
    };
  }

  addToHistory(activity) {
    if (!activity.site) return;
    if (this.history.length > 0 && this.history[0].site === activity.site && this.history[0].title === activity.title) {
      return;
    }
    this.history.unshift({ ...activity, timestamp: activity.timestamp || Date.now() });
    if (this.history.length > 5) {
      this.history.length = 5;
    }
  }

  getDisplayState() {
    if (this.listenTogether) return 'listen_together';
    if (this.watchTogether) return 'watch_together';
    if (this.partnerState.isYouTube) return 'youtube';
    if (!this.partnerState.isOnline) return 'offline';
    if (this.partnerState.trackingPaused) return 'tracking_paused';
    if (this.partnerState.idle) return 'idle';
    if (this.partnerState.activity?.site === 'Spotify') return 'spotify';
    if (this.partnerState.activity?.site === 'YouTube') return 'youtube';
    if (this.partnerState.activity) return 'browsing';
    return 'offline';
  }

  draw(ctx, x, y, width, height) {
    const state = this.getDisplayState();

    ctx.save();

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = '#4a4a6a';
    if (ctx.strokeRect) ctx.strokeRect(x, y, width, height);

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    switch (state) {
      case 'offline':
        this.drawOffline(ctx, centerX, centerY);
        break;
      case 'tracking_paused':
        this.drawTrackingPaused(ctx, centerX, centerY);
        break;
      case 'idle':
        this.drawIdle(ctx, x, y, width, height);
        break;
      case 'youtube':
        this.drawYouTube(ctx, x, y, width, height);
        break;
      case 'browsing':
        this.drawBrowsing(ctx, x, y, width, height);
        break;
      case 'watch_together':
        this.drawWatchTogether(ctx, centerX, centerY);
        break;
      case 'spotify':
        this.drawSpotify(ctx, x, y, width, height);
        break;
      case 'listen_together':
        this.drawListenTogether(ctx, centerX, centerY);
        break;
    }

    ctx.restore();
  }

  drawOffline(ctx, cx, cy) {
    ctx.fillStyle = '#333';
    ctx.font = '6px monospace';
    ctx.fillText('OFF', cx, cy);
  }

  drawTrackingPaused(ctx, cx, cy) {
    ctx.fillStyle = '#888';
    ctx.font = '5px monospace';
    ctx.fillText('Tracking', cx, cy - 4);
    ctx.fillText('paused', cx, cy + 4);
  }

  drawIdle(ctx, x, y, width, height) {
    this.staticTimer++;
    if (this.staticTimer % 10 === 0) {
      this.staticFrame = (this.staticFrame + 1) % 3;
    }
    const colors = ['#2a2a4a', '#3a3a5a', '#1a1a3a'];
    for (let py = 0; py < height; py += 2) {
      for (let px = 0; px < width; px += 2) {
        ctx.fillStyle = colors[Math.floor(Math.random() * 3)];
        ctx.fillRect(x + px, y + py, 2, 2);
      }
    }
  }

  drawYouTube(ctx, x, y, width, height) {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x + 2, y + 2, 10, 7);

    ctx.fillStyle = '#FFF';
    if (ctx.beginPath) ctx.beginPath();
    ctx.fillRect(x + 5, y + 4, 4, 3);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = '5px monospace';
    ctx.textAlign = 'left';
    const title = this.partnerState.activity?.title || '';
    const truncated = title.length > 15 ? title.substring(0, 15) + '..' : title;
    ctx.fillText(truncated, x + 14, y + 8);

    ctx.fillStyle = '#4CAF50';
    ctx.font = '4px monospace';
    ctx.fillText('Join', x + width - 14, y + height - 4);
  }

  drawBrowsing(ctx, x, y, width, height) {
    const activity = this.partnerState.activity;
    if (!activity) return;

    ctx.fillStyle = '#88ccff';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(activity.site, x + width / 2, y + 10);

    ctx.fillStyle = '#aaa';
    ctx.font = '4px monospace';
    const title = activity.title || '';
    const truncated = title.length > 20 ? title.substring(0, 20) + '..' : title;
    ctx.fillText(truncated, x + width / 2, y + 20);
  }

  drawWatchTogether(ctx, cx, cy) {
    ctx.fillStyle = '#FFD700';
    ctx.font = '5px monospace';
    ctx.fillText('Watching', cx, cy - 4);
    ctx.fillText('Together!', cx, cy + 4);
  }

  drawSpotify(ctx, x, y, width, height) {
    ctx.fillStyle = '#1DB954';
    ctx.fillRect(x + 2, y + 2, 8, 8);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = '5px monospace';
    ctx.textAlign = 'left';
    const song = this.partnerState.activity?.spotifySong || '';
    const truncSong = song.length > 12 ? song.substring(0, 12) + '..' : song;
    ctx.fillText(truncSong, x + 12, y + 8);

    ctx.fillStyle = '#aaa';
    ctx.font = '4px monospace';
    const artist = this.partnerState.activity?.spotifyArtist || '';
    const truncArtist = artist.length > 15 ? artist.substring(0, 15) + '..' : artist;
    ctx.fillText(truncArtist, x + 12, y + 16);

    ctx.fillStyle = '#1DB954';
    ctx.font = '4px monospace';
    ctx.fillText('Listen', x + width - 18, y + height - 4);
  }

  drawListenTogether(ctx, cx, cy) {
    ctx.fillStyle = '#1DB954';
    ctx.font = '5px monospace';
    ctx.fillText('Listening', cx, cy - 4);
    ctx.fillText('Together!', cx, cy + 4);
  }
}
