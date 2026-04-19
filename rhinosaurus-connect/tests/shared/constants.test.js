import { describe, it, expect } from 'vitest';
import {
  MOOD_OPTIONS,
  ANIMATION_STATES,
  MESSAGE_TYPES,
  ROOM_DIMENSIONS,
  REALTIME_EVENTS,
} from '../../shared/constants.js';

describe('constants', () => {
  it('defines all 7 mood options', () => {
    expect(MOOD_OPTIONS).toHaveLength(7);
    expect(MOOD_OPTIONS.map(m => m.key)).toEqual([
      'happy', 'sad', 'missing_you', 'stressed', 'sleepy', 'excited', 'cozy',
    ]);
  });

  it('defines all 8 animation states', () => {
    expect(Object.keys(ANIMATION_STATES)).toEqual([
      'idle', 'speaking', 'heart_eyes', 'kiss_face', 'sleeping', 'waving', 'walking', 'sitting',
    ]);
    expect(ANIMATION_STATES.idle).toEqual({ frames: 4, looping: true });
    expect(ANIMATION_STATES.heart_eyes).toEqual({ frames: 6, looping: false });
  });

  it('defines message types', () => {
    expect(MESSAGE_TYPES).toEqual(['text', 'image', 'heart', 'kiss']);
  });

  it('defines room dimensions', () => {
    expect(ROOM_DIMENSIONS.width).toBe(320);
    expect(ROOM_DIMENSIONS.height).toBe(400);
  });

  it('defines realtime event names', () => {
    expect(REALTIME_EVENTS.ACTIVITY_UPDATE).toBe('activity_update');
    expect(REALTIME_EVENTS.REACTION).toBe('reaction');
    expect(REALTIME_EVENTS.ROOM_UPDATE).toBe('room_update');
    expect(REALTIME_EVENTS.AVATAR_MOVE).toBe('avatar_move');
    expect(REALTIME_EVENTS.WATCH_TOGETHER_INVITE).toBe('watch_together_invite');
    expect(REALTIME_EVENTS.WATCH_TOGETHER_JOINED).toBe('watch_together_joined');
    expect(REALTIME_EVENTS.WATCH_TOGETHER_ENDED).toBe('watch_together_ended');
    expect(REALTIME_EVENTS.MOOD_UPDATE).toBe('mood_update');
    expect(REALTIME_EVENTS.TYPING).toBe('typing');
    expect(REALTIME_EVENTS.AVATAR_CONFIG_UPDATE).toBe('avatar_config_update');
  });
});
