# Rhinosaurus Connect — Master Design Spec

## Overview

Rhinosaurus Connect is a Chrome extension for long-distance couples. The core experience is a shared, interactive Stardew Valley-style pixel art bedroom where both partners' avatars live together. Features include real-time browsing activity tracking, messaging with avatar speech bubbles, quick reactions (hearts, kisses), Watch Together mode for YouTube, mood status, anniversary/date tracking, and deep customization of both avatars and the room.

**Target users:** Two specific people (Ricky on Android/Chrome, girlfriend on iOS/Mac Chrome). Sideloaded, not published to Chrome Web Store.

---

## Tech Stack

### Chrome Extension (Manifest V3)
- **Service Worker** (`background.js`): handles tab tracking, Supabase Realtime subscriptions, notification orchestration, message queue processing
- **Popup** (`popup.html`): the shared bedroom UI, rendered on HTML5 Canvas with a bottom toolbar
- **Content Script** (`content.js`): injected into web pages for corner popup notifications and YouTube Watch Together integration
- **Options Page** (`options.html`): avatar customization, room settings, date management, account settings

### Supabase
- **Auth**: Google OAuth
- **Database** (Postgres): users, pairs, messages, room state, avatar config, dates, mood, activity
- **Realtime**: presence (online/offline), broadcast (activity updates, room changes, messages, reactions)
- **Storage**: image messages, avatar assets (if user-uploaded)

### Rendering
- **HTML5 Canvas**: room and avatar rendering in the popup
- **Sprite sheets**: Stardew Valley-style 16-bit pixel art for room objects, avatars, furniture, animations
- **Animation loop**: requestAnimationFrame for avatar animations (idle, speaking, heart eyes, kiss, sleeping, waving)

---

## Art Style

Stardew Valley-inspired:
- 16-bit pixel art with warm, cozy color palette
- Soft lighting, visible pixel grid
- Detailed but charming — not overly complex
- Warm browns, soft pinks, muted blues, golden yellows
- Items have subtle shading and depth

---

## Authentication & Pairing

### Auth Flow
1. User clicks extension icon → popup shows login screen
2. "Sign in with Google" button → Supabase Auth Google OAuth flow
3. On first login, user is prompted to either:
   - **Generate a pair code** (6-digit alphanumeric, expires in 10 minutes)
   - **Enter a pair code** from their partner
4. Once paired, both users are linked in the `pairs` table
5. Subsequent logins go straight to the bedroom

### Unpairing
- Available in settings
- Requires confirmation ("Are you sure? This will delete your shared room and chat history.")
- Deletes: pair record, room state, messages, shared dates
- Preserves: individual avatar config, account

---

## Database Schema

### Tables

```sql
-- Users
create table users (
  id uuid primary key references auth.users(id),
  display_name text not null,
  avatar_config jsonb not null default '{}',
  mood text default null, -- 'happy', 'sad', 'missing_you', 'stressed', 'sleepy', 'excited', 'cozy'
  is_online boolean default false,
  last_seen_at timestamptz default now(),
  current_activity jsonb default null, -- { site: string, title: string, url: string }
  tracking_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pairs
create table pairs (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references users(id),
  user_b uuid not null references users(id),
  anniversary_date date default null,
  created_at timestamptz default now(),
  unique(user_a, user_b)
);

-- Pair Codes (temporary, for pairing flow)
create table pair_codes (
  code text primary key,
  user_id uuid not null references users(id),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  sender_id uuid not null references users(id),
  type text not null, -- 'text', 'image', 'heart', 'kiss'
  content text default null, -- text content or storage path for images
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Room State
create table room_state (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade unique,
  furniture jsonb not null default '[]', -- array of { type, x, y, variant, color }
  avatar_positions jsonb not null default '{}', -- { user_id: { x, y } }
  theme text default 'default',
  updated_at timestamptz default now()
);

-- Dates (anniversary, milestones, custom)
create table tracked_dates (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  label text not null, -- 'Anniversary', 'First Date', 'Next Visit', etc.
  date date not null,
  is_countdown boolean default false, -- true for future dates
  created_by uuid not null references users(id),
  created_at timestamptz default now()
);
```

### Storage Buckets
- `message-images`: image attachments in chat (public within pair, RLS enforced)

### Row Level Security
- Users can only read/write their own user record
- Pair members can only read/write records belonging to their pair
- Pair codes are readable by anyone (for the pairing flow) but writable only by the creator

---

## Supabase Realtime Channels

### Presence Channel: `pair:{pair_id}`
Tracks online/offline status for both users.
```js
{
  user_id: string,
  is_online: boolean,
  current_activity: { site: string, title: string } | null,
  mood: string | null,
  avatar_position: { x: number, y: number }
}
```

### Broadcast Channel: `pair:{pair_id}:events`
Used for ephemeral events that don't need persistence beyond delivery:
- `activity_update` — tab changed
- `reaction` — heart or kiss sent (also persisted to messages table for queue)
- `room_update` — furniture moved/changed
- `avatar_move` — avatar dragged to new position
- `watch_together_invite` — "Join me" on YouTube
- `watch_together_joined` — partner accepted
- `mood_update` — mood changed
- `typing` — partner is typing in chat

### Database Changes (Realtime)
Subscribe to inserts on `messages` table filtered by `pair_id` for new message delivery.

---

## Extension Architecture

### File Structure
```
rhinosaurus-connect/
├── manifest.json
├── background/
│   ├── service-worker.js      # main service worker entry
│   ├── supabase-client.js     # supabase init + auth
│   ├── tab-tracker.js         # active tab monitoring
│   ├── notification-manager.js # chrome notification handling
│   └── message-queue.js       # offline message queue processing
├── popup/
│   ├── popup.html
│   ├── popup.js               # entry point, mounts canvas
│   ├── room/
│   │   ├── room-renderer.js   # canvas rendering loop
│   │   ├── room-objects.js    # furniture definitions + interactions
│   │   ├── avatar-renderer.js # avatar sprite rendering + animation
│   │   └── room-state.js     # local room state management
│   ├── overlays/
│   │   ├── chat-overlay.js    # chat UI overlay
│   │   ├── calendar-overlay.js # date tracker overlay
│   │   ├── makeup-overlay.js  # makeup stand overlay
│   │   └── customize-overlay.js # room/avatar customization
│   └── toolbar/
│       └── toolbar.js         # bottom toolbar component
├── content/
│   ├── content.js             # main content script
│   ├── corner-popup.js        # avatar notification popup
│   └── youtube-watcher.js     # youtube detection + watch together
├── shared/
│   ├── constants.js
│   ├── types.js
│   └── supabase-helpers.js
├── assets/
│   ├── sprites/
│   │   ├── room/              # furniture sprite sheets
│   │   ├── avatars/           # avatar sprite sheets
│   │   └── effects/           # hearts, kisses, sparkles
│   ├── sounds/                # notification sounds
│   └── icons/                 # extension icons
└── options/
    ├── options.html
    └── options.js
```

### Manifest V3 Permissions
```json
{
  "manifest_version": 3,
  "name": "Rhinosaurus Connect",
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "notifications",
    "identity"
  ],
  "host_permissions": [
    "https://*.youtube.com/*",
    "https://*.supabase.co/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": "assets/icons/icon-48.png"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/corner-popup.css"]
    }
  ],
  "options_page": "options/options.html"
}
```

---

## Feature Specs

Each feature has its own detailed spec document:

1. [Auth & Pairing](./features/01-auth-pairing.md)
2. [Shared Bedroom (Room)](./features/02-shared-bedroom.md)
3. [Avatars](./features/03-avatars.md)
4. [Activity Tracking](./features/04-activity-tracking.md)
5. [Messaging & Notifications](./features/05-messaging-notifications.md)
6. [Reactions (Hearts & Kisses)](./features/06-reactions.md)
7. [Watch Together](./features/07-watch-together.md)
8. [Mood Status](./features/08-mood-status.md)
9. [Date Tracker](./features/09-date-tracker.md)
10. [Room Customization](./features/10-room-customization.md)
11. [Avatar Customization & Makeup](./features/11-avatar-customization.md)

---

## Implementation Order (Recommended)

### Phase 0: Scaffolding (must be done first, single branch)
- Chrome extension skeleton (manifest, service worker, popup shell, content script shell)
- Supabase project setup (tables, RLS, storage bucket, realtime)
- Supabase client initialization in service worker
- Basic canvas rendering loop in popup
- Build tooling (bundler if needed)

### Phase 1: Parallel worktrees (after scaffolding)
These can be built independently:
- **Worktree A**: Auth & Pairing
- **Worktree B**: Shared Bedroom rendering + Room State sync
- **Worktree C**: Avatar rendering + animations
- **Worktree D**: Activity Tracking (tab tracker + TV object)

### Phase 2: Parallel worktrees (depends on Phase 1)
- **Worktree E**: Messaging & Chat overlay (depends on Auth)
- **Worktree F**: Reactions — hearts & kisses (depends on Auth + Avatars)
- **Worktree G**: Watch Together (depends on Activity Tracking + Avatars)

### Phase 3: Parallel worktrees (depends on Phase 1)
- **Worktree H**: Mood Status (depends on Auth + Avatars)
- **Worktree I**: Date Tracker + Calendar (depends on Auth + Room)
- **Worktree J**: Room Customization (depends on Room)
- **Worktree K**: Avatar Customization + Makeup Stand (depends on Avatars + Room)

### Phase 4: Integration
- Corner popup notifications (depends on Messaging + Reactions)
- Message queue / offline delivery (depends on Messaging)
- Polish, animation tuning, sound effects

---

## Future Features (v2+)
- **Shared Music**: detect Spotify Web, show what partner is listening to, "Listen Along" link
- **Synced YouTube Playback**: frame-synced play/pause/seek during Watch Together
- **Seasonal Room Themes**: holiday decorations, seasonal furniture sets
- **Unlockable Items**: earn new furniture/accessories through milestones or daily logins
- **More Interactive Objects**: bookshelf (shared reading list), fridge (shared grocery list)
