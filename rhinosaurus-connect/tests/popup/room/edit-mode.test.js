import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditModeController } from '../../../popup/room/edit-mode.js';

describe('EditModeController', () => {
  let controller;
  let mockRoomState;
  let mockSync;

  beforeEach(() => {
    mockRoomState = {
      furniture: [
        { id: 'bed-1', type: 'bed', x: 40, y: 80 },
        { id: 'rug-1', type: 'rug', x: 130, y: 160 },
      ],
      updateFurniture: vi.fn(() => true),
      addFurniture: vi.fn(() => true),
      removeFurniture: vi.fn(() => true),
      isEssential: vi.fn((id) => id === 'bed-1'),
      toDbRecord: vi.fn(() => ({})),
    };
    mockSync = {
      broadcastFurnitureMove: vi.fn(),
      broadcastFurnitureChange: vi.fn(),
      scheduleSave: vi.fn(),
    };
    controller = new EditModeController(mockRoomState, mockSync);
  });

  it('starts not in edit mode', () => {
    expect(controller.isEditMode).toBe(false);
  });

  it('enters edit mode', () => {
    controller.enter();
    expect(controller.isEditMode).toBe(true);
  });

  it('exits edit mode and saves', () => {
    controller.enter();
    controller.exit();
    expect(controller.isEditMode).toBe(false);
    expect(mockSync.scheduleSave).toHaveBeenCalled();
  });

  it('selects furniture item', () => {
    controller.enter();
    controller.select('bed-1');
    expect(controller.selectedId).toBe('bed-1');
  });

  it('deselects on second click', () => {
    controller.enter();
    controller.select('bed-1');
    controller.select('bed-1');
    expect(controller.selectedId).toBeNull();
  });

  it('starts drag on selected item', () => {
    controller.enter();
    controller.select('bed-1');
    controller.startDrag(50, 90);
    expect(controller.isDragging).toBe(true);
  });

  it('moves item during drag', () => {
    controller.enter();
    controller.select('bed-1');
    controller.startDrag(50, 90);
    controller.drag(70, 110);
    expect(mockRoomState.updateFurniture).toHaveBeenCalledWith('bed-1', { x: 70, y: 110 });
  });

  it('broadcasts move on drag end', () => {
    controller.enter();
    controller.select('bed-1');
    controller.startDrag(50, 90);
    controller.drag(70, 110);
    controller.endDrag();
    expect(controller.isDragging).toBe(false);
    expect(mockSync.broadcastFurnitureMove).toHaveBeenCalledWith('bed-1', { x: 70, y: 110 });
  });

  it('changes variant and broadcasts', () => {
    controller.enter();
    controller.select('bed-1');
    controller.changeVariant('double-metal');
    expect(mockRoomState.updateFurniture).toHaveBeenCalledWith('bed-1', { variant: 'double-metal' });
    expect(mockSync.broadcastFurnitureChange).toHaveBeenCalled();
  });

  it('changes color and broadcasts', () => {
    controller.enter();
    controller.select('bed-1');
    controller.changeColor('#9D6BFF');
    expect(mockRoomState.updateFurniture).toHaveBeenCalledWith('bed-1', { color: '#9D6BFF' });
    expect(mockSync.broadcastFurnitureChange).toHaveBeenCalled();
  });

  it('prevents removing essential items', () => {
    controller.enter();
    const result = controller.removeItem('bed-1');
    expect(result).toBe(false);
    expect(mockRoomState.removeFurniture).not.toHaveBeenCalled();
  });

  it('removes non-essential items', () => {
    controller.enter();
    const result = controller.removeItem('rug-1');
    expect(result).toBe(true);
    expect(mockRoomState.removeFurniture).toHaveBeenCalledWith('rug-1');
  });

  it('adds new item', () => {
    controller.enter();
    const item = { id: 'plant-1', type: 'plant', variant: 'potted', x: 100, y: 200 };
    const result = controller.addItem(item);
    expect(result).toBe(true);
    expect(mockRoomState.addFurniture).toHaveBeenCalledWith(item);
  });
});
