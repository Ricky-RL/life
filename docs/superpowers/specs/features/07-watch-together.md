# Feature 07: Watch Together

## Summary
When both partners are watching the same YouTube video, a "Watching Together" badge appears on the TV with both avatars side by side. Either partner can invite the other to watch what they're watching by clicking "Join" on the TV. Both avatars automatically move to sit in front of the TV.

---

## User Flows

### Automatic Detection (Same Video)
1. Both users happen to be on the same YouTube video URL
2. Service worker detects URL match via activity tracking
3. Both users' TVs show "Watching Together!" badge
4. Both avatars auto-move to sit in front of the TV, side by side
5. A brief celebration: both avatars do a small bounce, sparkle effect

### Join Flow (One Invites the Other)
1. User A is watching a YouTube video
2. User B sees on their TV: "She's watching: YouTube — [Video Title]"
3. User B clicks the TV → overlay shows video details + "Join & Watch Together" button
4. User B clicks "Join & Watch Together":
   a. Broadcast `watch_together_invite` event
   b. The YouTube video URL opens in a new tab in User B's browser
5. User A receives notification: "Ricky is watching with you!" with both avatars
6. Both avatars move to TV, "Watching Together" badge appears
7. When either user navigates away from the video, Watch Together ends

### End of Watch Together
- Either user navigates away from YouTube → their avatar walks back from TV
- If both were watching together, the remaining user stays at TV but badge changes back to solo viewing
- Notification to the other: "[Partner] left the couch" (gentle, not naggy)

---

## Technical Implementation

### YouTube URL Detection
```js
// In tab tracker (service worker)
function isYouTubeVideo(url) {
  try {
    const parsed = new URL(url);
    const ytHosts = ['www.youtube.com', 'youtube.com', 'm.youtube.com'];

    if (!ytHosts.includes(parsed.hostname)) {
      // Handle youtu.be short links
      if (parsed.hostname === 'youtu.be') return true;
      return false;
    }

    // Match /watch?v=, /shorts/, /live/ — but NOT homepage, search, channel pages
    return (parsed.pathname === '/watch' && parsed.searchParams.has('v'))
      || parsed.pathname.startsWith('/shorts/')
      || parsed.pathname.startsWith('/live/');
  } catch {
    return false;
  }
}

function getYouTubeVideoId(url) {
  const parsed = new URL(url);
  if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
  if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2];
  if (parsed.pathname.startsWith('/live/')) return parsed.pathname.split('/')[2];
  return parsed.searchParams.get('v');
}
```

### Watch Together State
Managed in the service worker, not persisted to database (ephemeral):

```js
const watchTogetherState = {
  active: false,
  videoId: null,
  videoTitle: null,
  videoUrl: null,
  participants: [] // [userId1, userId2]
};
```

### Same-Video Detection
```js
// When activity update received from partner
function checkWatchTogether(myActivity, partnerActivity) {
  if (!myActivity || !partnerActivity) return;

  const myVideoId = isYouTubeVideo(myActivity.url) ? getYouTubeVideoId(myActivity.url) : null;
  const partnerVideoId = isYouTubeVideo(partnerActivity.url) ? getYouTubeVideoId(partnerActivity.url) : null;

  if (myVideoId && partnerVideoId && myVideoId === partnerVideoId) {
    activateWatchTogether(myVideoId, myActivity.title, myActivity.url);
  } else if (watchTogetherState.active) {
    deactivateWatchTogether();
  }
}
```

### Join Flow
```js
// User clicks "Join & Watch Together"
async function joinPartnerVideo(partnerActivity) {
  // Open the video in a new tab
  await chrome.tabs.create({ url: partnerActivity.url });

  // Broadcast join event
  await channel.send({
    type: 'broadcast',
    event: 'watch_together_invite',
    payload: {
      user_id: currentUser.id,
      video_id: getYouTubeVideoId(partnerActivity.url),
      video_url: partnerActivity.url
    }
  });
}
```

---

## TV Display States

### Solo Watching YouTube
```
┌─────────────────┐
│  ▶ YouTube      │
│  [Video Title]  │
│                 │
│  "Join" button  │
└─────────────────┘
```

### Watching Together
```
┌─────────────────┐
│ 🎬 Watching     │
│   Together!     │
│                 │
│ [Avatar] [Avatar]│
│   side by side  │
└─────────────────┘
```
- Both avatars sit in front of the TV in `sitting` animation
- Small sparkle/heart effect between them
- TV shows a "Watching Together!" banner

---

## Avatar Positioning at TV

When watching (solo or together):
```js
const TV_POSITION = { x: 240, y: 180 }; // TV object position

// Solo watching: avatar centered in front of TV
const SOLO_SEAT = { x: TV_POSITION.x, y: TV_POSITION.y + 60 };

// Watch Together: two seats side by side
const LEFT_SEAT = { x: TV_POSITION.x - 20, y: TV_POSITION.y + 60 };
const RIGHT_SEAT = { x: TV_POSITION.x + 20, y: TV_POSITION.y + 60 };
```

Avatars walk to their seat position and switch to `sitting` animation.

---

## Realtime Events

Broadcast on `pair:{pair_id}:events`:
- `{ type: 'watch_together_invite', user_id, video_id, video_url }`
- `{ type: 'watch_together_joined', user_id, video_id }`
- `{ type: 'watch_together_ended', user_id }`

---

## Future Enhancement: Synced Playback (v2)
Not implemented in v1, but designed for future addition:
- Content script on YouTube pages would capture play/pause/seek events
- Broadcast via Realtime to partner
- Partner's content script applies the same action
- One user is "host" (whoever started watching first), other syncs to host
- Will require a dedicated content script: `youtube-sync.js`
- Challenges: network latency, buffering differences, ad timing

---

## Edge Cases
- **Different YouTube URLs for same video** (e.g., with different query params like `&t=120`): compare only the `v` parameter, ignore other params
- **One user on YouTube Music vs YouTube**: treat as different sites (YouTube Music URLs use `music.youtube.com`)
- **User opens YouTube but not a video** (homepage, search): not a Watch Together trigger — only `/watch?v=` URLs count
- **Both click "Join" on each other simultaneously**: both are already on YouTube, same-video detection kicks in naturally
- **Popup closed during Watch Together**: avatars still shown at TV for the partner who has popup open. Corner notification: "Watching together! 🎬"
