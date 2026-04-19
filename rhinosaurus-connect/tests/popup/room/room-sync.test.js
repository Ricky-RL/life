import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomSync } from '../../../popup/room/room-sync.js';

describe('RoomSync', () => {
  let sync;
  let mockChannel;
  let mockSupabase;

  beforeEach(() => {
    vi.useFakeTimers();
    mockChannel = {
      send: vi.fn(),
      on: vi.fn(() => mockChannel),
      subscribe: vi.fn(() => mockChannel),
      unsubscribe: vi.fn(),
    };
    mockSupabase = {
      channel: vi.fn(() => mockChannel),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { furniture: [], avatar_positions: {}, theme: 'default', version: 1 },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    };
    sync = new RoomSync(mockSupabase, 'pair-123');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes a Realtime channel on init', () => {
    sync.init();
    expect(mockSupabase.channel).toHaveBeenCalledWith('pair:pair-123:events');
    expect(mockChannel.on).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('broadcasts furniture move immediately', () => {
    sync.init();
    sync.broadcastFurnitureMove('bed-1', { x: 50, y: 90 });
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'room_update',
      payload: {
        action: 'furniture_move',
        furniture_id: 'bed-1',
        changes: { x: 50, y: 90 },
      },
    });
  });

  it('broadcasts furniture change immediately', () => {
    sync.init();
    sync.broadcastFurnitureChange('bed-1', { color: '#FF0000' });
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'room_update',
      payload: {
        action: 'furniture_change',
        furniture_id: 'bed-1',
        changes: { color: '#FF0000' },
      },
    });
  });

  it('broadcasts avatar move immediately', () => {
    sync.init();
    sync.broadcastAvatarMove('user-1', 100, 200);
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'avatar_move',
      payload: { user_id: 'user-1', x: 100, y: 200 },
    });
  });

  it('does not broadcast without init', () => {
    sync.broadcastFurnitureMove('bed-1', { x: 50, y: 90 });
    expect(mockChannel.send).not.toHaveBeenCalled();
  });

  it('debounces DB writes to 2 seconds', async () => {
    sync.init();
    const roomState = { furniture: [], avatar_positions: {}, theme: 'default', version: 2 };

    sync.scheduleSave(roomState);
    expect(mockSupabase.from).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    await vi.runAllTimersAsync();

    expect(mockSupabase.from).toHaveBeenCalled();
  });

  it('coalesces multiple saves within debounce window', () => {
    sync.init();
    const state1 = { furniture: [{ id: 'a' }], avatar_positions: {}, theme: 'default', version: 2 };
    const state2 = { furniture: [{ id: 'b' }], avatar_positions: {}, theme: 'default', version: 3 };

    sync.scheduleSave(state1);
    sync.scheduleSave(state2);

    expect(sync.pendingState).toBe(state2);
  });

  it('loads room state from database', async () => {
    const state = await sync.loadFromDb();
    expect(state).toBeDefined();
    expect(state.furniture).toEqual([]);
    expect(state.version).toBe(1);
  });

  it('force saves immediately without debounce', async () => {
    sync.init();
    const roomState = { furniture: [{ id: 'a' }], avatar_positions: {}, theme: 'default', version: 5 };

    await sync.forceSave(roomState);
    expect(mockSupabase.from).toHaveBeenCalled();
    expect(sync.pendingState).toBeNull();
  });

  it('cleans up on destroy', () => {
    sync.init();
    sync.scheduleSave({ furniture: [], avatar_positions: {}, theme: 'default', version: 1 });
    sync.destroy();
    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });

  it('calls onRemoteUpdate when broadcast is received', () => {
    const callback = vi.fn();
    sync.onRemoteUpdate = callback;
    sync.init();

    const broadcastHandler = mockChannel.on.mock.calls[0][2];
    broadcastHandler({ payload: { action: 'furniture_move', furniture_id: 'bed-1', changes: { x: 10 } } });

    expect(callback).toHaveBeenCalledWith({
      action: 'furniture_move',
      furniture_id: 'bed-1',
      changes: { x: 10 },
    });
  });
});
