import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomRenderer } from '../../../popup/room/room-renderer.js';
import { RoomState } from '../../../popup/room/room-state.js';

function createMockCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    strokeRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
  };
  const canvas = {
    width: 320,
    height: 400,
    getContext: vi.fn(() => ctx),
    style: {},
  };
  return { canvas, ctx };
}

describe('RoomRenderer', () => {
  let renderer;
  let mockCanvas;
  let mockCtx;
  let roomState;

  beforeEach(() => {
    const mock = createMockCanvas();
    mockCanvas = mock.canvas;
    mockCtx = mock.ctx;
    roomState = new RoomState();
    renderer = new RoomRenderer(mockCanvas, roomState);
  });

  it('initializes with dirty flag set to true', () => {
    expect(renderer.dirty).toBe(true);
  });

  it('gets 2d context with imageSmoothingEnabled false', () => {
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    expect(mockCtx.imageSmoothingEnabled).toBe(false);
  });

  it('renders when dirty and clears the flag', () => {
    renderer.renderFrame();
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 320, 400);
    expect(renderer.dirty).toBe(false);
  });

  it('skips rendering when not dirty', () => {
    renderer.dirty = false;
    renderer.renderFrame();
    expect(mockCtx.clearRect).not.toHaveBeenCalled();
  });

  it('markDirty sets dirty flag', () => {
    renderer.dirty = false;
    renderer.markDirty();
    expect(renderer.dirty).toBe(true);
  });

  it('sorts furniture by y-position for depth', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'a', type: 'rug', x: 0, y: 200 },
        { id: 'b', type: 'bed', x: 0, y: 50 },
        { id: 'c', type: 'tv', x: 0, y: 150 },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    const sorted = renderer.getSortedFurniture();
    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('c');
    expect(sorted[2].id).toBe('a');
  });

  it('detects hit on interactive furniture', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'tv-1', type: 'tv', x: 100, y: 100, interactive: true, interaction: 'activity' },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    const hit = renderer.hitTest(110, 110);
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('tv-1');
  });

  it('returns null for hit on empty area', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'tv-1', type: 'tv', x: 100, y: 100, interactive: true, interaction: 'activity' },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    const hit = renderer.hitTest(5, 5);
    expect(hit).toBeNull();
  });

  it('uses sprite loader to draw furniture when available', () => {
    const mockFrame = { draw: vi.fn() };
    const mockSpriteLoader = {
      getFrame: vi.fn(() => mockFrame),
    };
    renderer.setSpriteLoader(mockSpriteLoader);
    renderer.renderFrame();
    expect(mockSpriteLoader.getFrame).toHaveBeenCalled();
  });

  it('falls back to colored rectangles without sprite loader', () => {
    renderer.renderFrame();
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it('draws hover glow on interactive hovered item', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'tv-1', type: 'tv', x: 100, y: 100, interactive: true, interaction: 'activity' },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    renderer.hoveredItem = roomState.furniture[0];
    renderer.renderFrame();
    expect(mockCtx.strokeRect).toHaveBeenCalled();
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('handleMouseMove sets cursor to pointer on interactive item', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'tv-1', type: 'tv', x: 100, y: 100, interactive: true, interaction: 'activity' },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    renderer.handleMouseMove(110, 110);
    expect(mockCanvas.style.cursor).toBe('pointer');
    expect(renderer.hoveredItem).toBe(roomState.furniture[0]);
  });

  it('handleMouseMove resets cursor on empty area', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'tv-1', type: 'tv', x: 100, y: 100, interactive: true, interaction: 'activity' },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    renderer.hoveredItem = roomState.furniture[0];
    renderer.handleMouseMove(5, 5);
    expect(mockCanvas.style.cursor).toBe('default');
    expect(renderer.hoveredItem).toBeNull();
  });

  it('draws day/night window based on time', () => {
    roomState.loadFromDb({
      furniture: [
        { id: 'window-1', type: 'window', variant: 'default', x: 80, y: 20, interactive: false },
      ],
      avatar_positions: {},
      theme: 'default',
      version: 1,
    });
    renderer = new RoomRenderer(mockCanvas, roomState);
    renderer.renderFrame();
    // Window draws extra fillRects for the sky color
    const fillRectCalls = mockCtx.fillRect.mock.calls;
    // Should have floor + wall + window sky + the window furniture rect (fallback)
    expect(fillRectCalls.length).toBeGreaterThanOrEqual(4);
  });

  it('setSpriteLoader stores the loader', () => {
    const mockLoader = { getFrame: vi.fn() };
    renderer.setSpriteLoader(mockLoader);
    expect(renderer.spriteLoader).toBe(mockLoader);
  });
});
