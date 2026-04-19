import { describe, it, expect, vi } from 'vitest';
import { RoomState } from '../../../popup/room/room-state.js';

describe('RoomState', () => {
  it('initializes with default furniture', () => {
    const state = new RoomState();
    expect(state.furniture).toBeInstanceOf(Array);
    expect(state.furniture.length).toBeGreaterThan(0);
    expect(state.furniture.find(f => f.type === 'bed')).toBeDefined();
    expect(state.furniture.find(f => f.type === 'tv')).toBeDefined();
    expect(state.furniture.find(f => f.type === 'desk')).toBeDefined();
    expect(state.furniture.find(f => f.type === 'calendar')).toBeDefined();
    expect(state.furniture.find(f => f.type === 'makeup_stand')).toBeDefined();
  });

  it('initializes with empty avatar positions', () => {
    const state = new RoomState();
    expect(state.avatarPositions).toEqual({});
  });

  it('loads state from database record', () => {
    const state = new RoomState();
    const dbRecord = {
      furniture: [
        { id: 'bed-1', type: 'bed', variant: 'double-wood', color: '#FF6B9D', x: 40, y: 80 },
      ],
      avatar_positions: { 'user-1': { x: 100, y: 260 } },
      theme: 'cozy',
      version: 5,
    };
    state.loadFromDb(dbRecord);
    expect(state.furniture).toEqual(dbRecord.furniture);
    expect(state.avatarPositions).toEqual(dbRecord.avatar_positions);
    expect(state.theme).toBe('cozy');
    expect(state.version).toBe(5);
  });

  it('updates a furniture item position', () => {
    const state = new RoomState();
    state.loadFromDb({
      furniture: [
        { id: 'bed-1', type: 'bed', x: 40, y: 80 },
        { id: 'tv-1', type: 'tv', x: 240, y: 180 },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });

    const changed = state.updateFurniture('bed-1', { x: 60, y: 100 });
    expect(changed).toBe(true);
    expect(state.furniture[0].x).toBe(60);
    expect(state.furniture[0].y).toBe(100);
  });

  it('returns false when updating nonexistent furniture', () => {
    const state = new RoomState();
    const changed = state.updateFurniture('nonexistent', { x: 0 });
    expect(changed).toBe(false);
  });

  it('updates avatar position', () => {
    const state = new RoomState();
    state.setAvatarPosition('user-1', 150, 200);
    expect(state.avatarPositions['user-1']).toEqual({ x: 150, y: 200 });
  });

  it('serializes to database format', () => {
    const state = new RoomState();
    state.loadFromDb({
      furniture: [{ id: 'bed-1', type: 'bed', x: 40, y: 80 }],
      avatar_positions: { 'user-1': { x: 100, y: 260 } },
      theme: 'default',
      version: 3,
    });

    const dbFormat = state.toDbRecord();
    expect(dbFormat.furniture).toEqual(state.furniture);
    expect(dbFormat.avatar_positions).toEqual(state.avatarPositions);
    expect(dbFormat.theme).toBe('default');
    expect(dbFormat.version).toBe(4);
  });

  it('tracks dirty state', () => {
    const state = new RoomState();
    expect(state.isDirty).toBe(false);
    state.setAvatarPosition('user-1', 100, 200);
    expect(state.isDirty).toBe(true);
    state.markClean();
    expect(state.isDirty).toBe(false);
  });
});
