# Spotify Listen Together — Design Spec

## Overview

Add Spotify activity display and "Listen Together" functionality to Rhinosaurus Connect. When one partner is listening to Spotify, the other sees what they're playing (song + artist) on the room TV and via a floating music note near the partner's avatar. A "Listen Together" button opens the same track in the partner's browser. When both are on the same track, a special "Listening Together" state appears.

## Approach

**Hybrid: title parsing + lightweight content script.**

- Parse the Spotify web player tab title (`"Song Name · Artist Name"`) in TabTracker to extract song/artist — no new dependencies, already captured.
- A small content script on `open.spotify.com` extracts the current track's shareable URL from the now-playing bar DOM via MutationObserver.
- No Spotify OAuth or API integration. Works for free and premium users.

## Data Flow

### 1. Track Detection

**TabTracker** (`background/tab-tracker.js`):
- When active tab hostname matches `open.spotify.com`, parse `tab.title` using the `·` separator.
- Emit enriched activity payload:
  ```js
  {
    site: 'Spotify',
    title: 'Song Name · Artist Name',
    spotifySong: 'Song Name',
    spotifyArtist: 'Artist Name',
    timestamp: Date.now()
  }
  ```

**Spotify Content Script** (`content/spotify-content.js`):
- Injected only on `open.spotify.com/*` via manifest.
- Extracts the track URL from the now-playing bar's track link element.
- Uses MutationObserver on the now-playing bar to detect track changes.
- Sends `{ type: 'SPOTIFY_TRACK_URL', url: 'https://open.spotify.com/track/...' }` to service worker via `chrome.runtime.sendMessage`.

**Service Worker** (`background/service-worker.js`):
- Receives `SPOTIFY_TRACK_URL` messages from the content script.
- Stores the URL and attaches it as `spotifyTrackUrl` to the next activity broadcast.
- Full broadcast payload to partner:
  ```js
  {
    site: 'Spotify',
    title: 'Song Name · Artist Name',
    spotifySong: 'Song Name',
    spotifyArtist: 'Artist Name',
    spotifyTrackUrl: 'https://open.spotify.com/track/abc123'
  }
  ```

### 2. Listen Together Detection

**ListenTogetherManager** (`background/listen-together.js`):
- Mirrors the `WatchTogetherManager` pattern.
- Tracks `myActivity` and `partnerActivity`.
- `check()` compares `spotifyTrackUrl` from both users. URLs are normalized before comparison by extracting the `/track/<id>` path segment (stripping query params like `?si=...`).
- When both are on the same track ID: broadcasts `listen_together_joined` with track info.
- When one leaves Spotify or changes track: broadcasts `listen_together_ended`.
- `getJoinUrl()` returns the partner's `spotifyTrackUrl` if they're on Spotify.

### 3. Realtime Events

New events added to `REALTIME_EVENTS` in `shared/constants.js`:
- `LISTEN_TOGETHER_JOINED` — `'listen_together_joined'`
- `LISTEN_TOGETHER_ENDED` — `'listen_together_ended'`

Payloads follow the same shape as watch-together events:
```js
// listen_together_joined
{ user_id, spotifyTrackUrl, spotifySong, spotifyArtist }

// listen_together_ended
{ user_id }
```

## UI

### TV Display (`popup/room/tv-display.js`)

**New display states:**

- `'spotify'` — Partner is on Spotify. Draws a Spotify-themed screen: green (#1DB954) accent, song name, artist name.
- `'listen_together'` — Both on the same track. Draws "Listening Together!" with song name, similar to "Watching Together!" for YouTube.

**New methods:**
- `setListenTogether(active, song, artist)` — Activates/deactivates the listen-together display state.
- `drawSpotify(ctx, x, y, width, height)` — Renders Spotify activity on the TV canvas.
- `drawListenTogether(ctx, cx, cy)` — Renders the "Listening Together!" state.

**Display state priority** (highest to lowest):
`listen_together` > `watch_together` > `spotify` > `youtube` > `browsing` > `idle` > `tracking_paused` > `offline`

### TV Overlay (`popup/room/tv-overlay.js`)

When display state is `'spotify'`:
- Shows song name (larger text, white).
- Shows artist name (smaller, muted text).
- Shows a **"Listen Together"** button — calls `window.open(spotifyTrackUrl, '_blank')`.

When display state is `'listen_together'`:
- Shows shared song/artist info.
- Shows "Listening Together!" badge instead of the button.

### Music Note Indicator (`popup/room/music-indicator.js`)

**New class: `MusicIndicator`**
- Renders a floating `♪` glyph near the partner's avatar when they're on Spotify.
- Sine-wave vertical bob animation (amplitude ~3px, period ~1.5s).
- Green (#1DB954) color to match Spotify branding.
- Click/tap detection: clicking the note opens `spotifyTrackUrl` in a new tab.
- `setActive(active, trackUrl)` — show/hide the indicator.
- `draw(ctx, avatarX, avatarY, timestamp)` — render at the current frame.
- `hitTest(x, y)` — returns true if click is within the note's bounding box.

### Popup Wiring (`popup/popup.js`)

- Register `MusicIndicator` as a renderer effect.
- On `PARTNER_ACTIVITY_UPDATE`: if `activity.site === 'Spotify'`, activate the music indicator with the track URL. Otherwise, deactivate it.
- Handle click on music indicator: open the track URL.
- Listen for `listen_together_joined` / `listen_together_ended` messages from service worker and update `tvDisplay.setListenTogether()`.

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `content/spotify-content.js` | Content script for open.spotify.com — extracts track URL |
| `background/listen-together.js` | ListenTogetherManager — detects when both on same track |
| `popup/room/music-indicator.js` | Floating music note near partner avatar |

### Modified Files

| File | Changes |
|------|---------|
| `manifest.json` | Add content_scripts entry for open.spotify.com |
| `shared/constants.js` | Add LISTEN_TOGETHER_JOINED, LISTEN_TOGETHER_ENDED to REALTIME_EVENTS |
| `background/tab-tracker.js` | Parse Spotify titles into spotifySong/spotifyArtist, store spotifyTrackUrl from content script |
| `background/service-worker.js` | Instantiate ListenTogetherManager, handle SPOTIFY_TRACK_URL messages, wire listen-together events |
| `popup/room/tv-display.js` | Add spotify/listen_together states, drawSpotify(), drawListenTogether(), setListenTogether() |
| `popup/room/tv-overlay.js` | Spotify section with Listen Together button, listen-together badge |
| `popup/popup.js` | Wire MusicIndicator, handle listen-together events, connect avatar click |
| `scripts/build.js` | Add spotify-content.js to build entries |

### No Changes Needed

- **Database schema** — All state flows through realtime broadcasts, nothing persisted.
- **Authentication** — No Spotify OAuth needed.
- **Permissions** — `open.spotify.com` is already covered by the existing `<all_urls>` host permission in the manifest.

## Content Script DOM Strategy

The Spotify content script targets the now-playing bar at the bottom of the web player. The extraction strategy:

1. Look for the track link in the now-playing bar — typically an `<a>` element with an `href` containing `/track/`.
2. Use a MutationObserver on the now-playing bar container to detect when the track changes.
3. On each change, extract the `href` and send it to the service worker.
4. If the DOM structure changes in a Spotify update, the content script gracefully falls back — the feature degrades to title-only display (no "Listen Together" button), which still works via TabTracker.

## Edge Cases

- **Partner not on Spotify web player** (using desktop app): No track data available. Feature inactive — this is expected since we can only detect browser tabs.
- **Spotify tab in background**: TabTracker only fires on active tab changes. If the user switches away from Spotify, the last known activity persists until a new tab is activated.
- **Tab title doesn't contain `·` separator**: Treat as non-music page (Spotify search, browse, etc). Don't populate spotifySong/spotifyArtist.
- **Content script can't find track URL**: Feature degrades to activity display only (song/artist from title). No "Listen Together" button shown.
- **Both users on Spotify but different tracks**: Each sees the other's activity on their TV. No "Listening Together" state.
- **One user leaves Spotify mid-listen-together**: `listen_together_ended` broadcast, TV returns to normal activity display.

## Testing

- Unit tests for `ListenTogetherManager` (mirrors existing WatchTogetherManager tests).
- Unit tests for Spotify title parsing in TabTracker.
- Unit tests for `MusicIndicator` hit test and state management.
- Manual testing: open Spotify web player, verify song/artist appear on partner's TV, verify "Listen Together" button opens correct URL.
