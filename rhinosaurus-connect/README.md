# Rhinosaurus Connect

A Chrome extension for long-distance couples. Open the popup to enter a shared Stardew Valley-style pixel art bedroom where both partners' avatars live together in real time.

Built for two people (sideloaded, not published to the Chrome Web Store).

## Features

- **Shared Bedroom** — a cozy pixel art room rendered on HTML5 Canvas with draggable avatars and interactive furniture
- **Activity Tracking** — see what your partner is browsing via a TV object in the room
- **Messaging** — chat with avatar speech bubbles
- **Reactions** — send hearts and kisses with animated effects
- **Watch Together** — detect YouTube and watch videos in sync
- **Mood Status** — set a mood (happy, sleepy, missing you, etc.) shown on your avatar
- **Date Tracker** — wall calendar that tracks your anniversary, upcoming visits, birthdays, and milestones with countdowns
- **Room Customization** — rearrange furniture, change colors, add new items
- **Avatar Customization** — personalize your avatar's appearance

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3 |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) |
| Auth | Google OAuth via Supabase |
| Rendering | HTML5 Canvas with pixel art sprite sheets |
| Bundler | esbuild |
| Tests | Vitest + jsdom |

## Project Structure

```
rhinosaurus-connect/
├── background/          # Service worker — auth, tab tracking, notifications
├── popup/               # Main UI — canvas room, overlays, toolbar
│   ├── room/            # Room renderer, avatars, furniture, edit mode
│   └── calendar/        # Date tracker overlay and service
├── content/             # Content script — corner popups, YouTube integration
├── options/             # Settings page
├── shared/              # Constants, date utils, helpers
├── assets/              # Icons, sprites, sounds
├── scripts/             # Build tooling
├── tests/               # Vitest test suite
└── dist/                # Built extension (load this in Chrome)
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project with the schema from `supabase/`

### Install

```sh
cd rhinosaurus-connect
npm install
```

### Build

```sh
npm run build
```

This outputs a `dist/` folder. To rebuild on file changes:

```sh
npm run build:watch
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `rhinosaurus-connect/dist` folder

### Run Tests

```sh
npm test
```

Watch mode:

```sh
npm run test:watch
```

## How It Works

1. **Sign in** with Google (Supabase Auth)
2. **Pair** with your partner using a 6-digit code (expires in 10 minutes)
3. **Enter the room** — both avatars appear in the shared bedroom
4. **Interact** — click furniture to open overlays (calendar, chat), drag your avatar around, send reactions from the toolbar
5. **Real-time sync** — presence, messages, room changes, and reactions sync instantly via Supabase Realtime channels

## Configuration

The Supabase client is initialized in `background/supabase-client.js`. Set your project URL and anon key there before building.
