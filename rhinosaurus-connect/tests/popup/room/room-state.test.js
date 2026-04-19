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

  it('adds furniture and marks dirty', () => {
    const state = new RoomState();
    const initialCount = state.furniture.length;
    const added = state.addFurniture({ id: 'lamp-1', type: 'lamp', x: 50, y: 50 });
    expect(added).toBe(true);
    expect(state.furniture.length).toBe(initialCount + 1);
    expect(state.isDirty).toBe(true);
  });

  it('rejects adding furniture beyond max limit', () => {
    const state = new RoomState();
    state.furniture = Array.from({ length: 30 }, (_, i) => ({ id: `item-${i}`, type: 'rug' }));
    const added = state.addFurniture({ id: 'extra', type: 'lamp', x: 0, y: 0 });
    expect(added).toBe(false);
    expect(state.furniture.length).toBe(30);
  });

  it('removes non-essential furniture', () => {
    const state = new RoomState();
    const rug = state.furniture.find(f => f.type === 'rug');
    expect(rug).toBeDefined();
    const removed = state.removeFurniture(rug.id);
    expect(removed).toBe(true);
    expect(state.furniture.find(f => f.id === rug.id)).toBeUndefined();
    expect(state.isDirty).toBe(true);
  });

  it('prevents removing essential furniture', () => {
    const state = new RoomState();
    const bed = state.furniture.find(f => f.type === 'bed');
    const removed = state.removeFurniture(bed.id);
    expect(removed).toBe(false);
    expect(state.furniture.find(f => f.id === bed.id)).toBeDefined();
  });

  it('returns false when removing nonexistent furniture', () => {
    const state = new RoomState();
    const removed = state.removeFurniture('nonexistent');
    expect(removed).toBe(false);
  });

  it('identifies essential furniture types', () => {
    const state = new RoomState();
    const bed = state.furniture.find(f => f.type === 'bed');
    expect(state.isEssential(bed.id)).toBe(true);

    const rug = state.furniture.find(f => f.type === 'rug');
    expect(state.isEssential(rug.id)).toBe(false);
  });

  it('returns false for isEssential on nonexistent furniture', () => {
    const state = new RoomState();
    expect(state.isEssential('nonexistent')).toBe(false);
  });

  it('gets furniture by ID', () => {
    const state = new RoomState();
    const bed = state.getFurnitureById('bed-1');
    expect(bed).not.toBeNull();
    expect(bed.type).toBe('bed');
  });

  it('returns null for nonexistent furniture ID', () => {
    const state = new RoomState();
    expect(state.getFurnitureById('nonexistent')).toBeNull();
  });
});
