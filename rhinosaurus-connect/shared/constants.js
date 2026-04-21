export const MOOD_OPTIONS = [
  { key: 'happy', emoji: '😊', label: 'happy' },
  { key: 'sad', emoji: '😢', label: 'sad' },
  { key: 'missing_you', emoji: '🥺', label: 'missing you' },
  { key: 'stressed', emoji: '😩', label: 'stressed' },
  { key: 'sleepy', emoji: '😴', label: 'sleepy' },
  { key: 'excited', emoji: '🤩', label: 'excited' },
  { key: 'cozy', emoji: '🥰', label: 'cozy' },
];

export const ANIMATION_STATES = {
  idle: { frames: 4, looping: true },
  speaking: { frames: 4, looping: true },
  heart_eyes: { frames: 6, looping: false },
  kiss_face: { frames: 6, looping: false },
  sleeping: { frames: 4, looping: true },
  waving: { frames: 6, looping: false },
  walking: { frames: 8, looping: true },
  sitting: { frames: 2, looping: true },
};

export const MESSAGE_TYPES = ['text', 'image', 'heart', 'kiss'];

export const ROOM_DIMENSIONS = {
  width: 320,
  height: 400,
};

export const POPUP_DIMENSIONS = {
  width: 400,
  height: 500,
};

export const REALTIME_EVENTS = {
  ACTIVITY_UPDATE: 'activity_update',
  REACTION: 'reaction',
  ROOM_UPDATE: 'room_update',
  AVATAR_MOVE: 'avatar_move',
  WATCH_TOGETHER_INVITE: 'watch_together_invite',
  WATCH_TOGETHER_JOINED: 'watch_together_joined',
  WATCH_TOGETHER_ENDED: 'watch_together_ended',
  LISTEN_TOGETHER_JOINED: 'listen_together_joined',
  LISTEN_TOGETHER_ENDED: 'listen_together_ended',
  MOOD_UPDATE: 'mood_update',
  TYPING: 'typing',
  AVATAR_CONFIG_UPDATE: 'avatar_config_update',
};

export const PAIR_CODE_LENGTH = 6;
export const PAIR_CODE_EXPIRY_MINUTES = 10;

export const AVATAR_SIZE = { width: 32, height: 48 };
export const AVATAR_RENDER_SCALE = 3;

export const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

export const SITE_NAMES = {
  'youtube.com': 'YouTube',
  'www.youtube.com': 'YouTube',
  'm.youtube.com': 'YouTube',
  'open.spotify.com': 'Spotify',
  'netflix.com': 'Netflix',
  'www.netflix.com': 'Netflix',
  'reddit.com': 'Reddit',
  'www.reddit.com': 'Reddit',
  'twitter.com': 'Twitter',
  'x.com': 'Twitter',
  'instagram.com': 'Instagram',
  'www.instagram.com': 'Instagram',
  'twitch.tv': 'Twitch',
  'www.twitch.tv': 'Twitch',
};
