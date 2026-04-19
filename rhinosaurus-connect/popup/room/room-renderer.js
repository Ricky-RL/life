import { ROOM_DIMENSIONS } from '../../shared/constants.js';

const DEFAULT_HITBOX_SIZE = { width: 48, height: 48 };

export class RoomRenderer {
  constructor(canvas, roomState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.roomState = roomState;
    this.dirty = true;
    this.spriteCache = {};
    this.effectLayers = [];
  }

  markDirty() {
    this.dirty = true;
  }

  getSortedFurniture() {
    return [...this.roomState.furniture].sort((a, b) => a.y - b.y);
  }

  hitTest(clickX, clickY) {
    const interactives = this.roomState.furniture
      .filter(f => f.interactive)
      .sort((a, b) => b.y - a.y);

    for (const item of interactives) {
      const hitbox = {
        x: item.x,
        y: item.y,
        width: DEFAULT_HITBOX_SIZE.width,
        height: DEFAULT_HITBOX_SIZE.height,
      };
      if (
        clickX >= hitbox.x &&
        clickX <= hitbox.x + hitbox.width &&
        clickY >= hitbox.y &&
        clickY <= hitbox.y + hitbox.height
      ) {
        return item;
      }
    }
    return null;
  }

  renderFrame() {
    if (!this.dirty) return;
    this.dirty = false;

    const { width, height } = ROOM_DIMENSIONS;
    this.ctx.clearRect(0, 0, width, height);

    this.drawFloor();
    this.drawWalls();

    const sorted = this.getSortedFurniture();
    for (const item of sorted) {
      this.drawFurnitureItem(item);
    }

    for (const effect of this.effectLayers) {
      effect.draw(this.ctx);
    }
  }

  drawFloor() {
    this.ctx.fillStyle = '#8B7355';
    this.ctx.fillRect(0, ROOM_DIMENSIONS.height * 0.15, ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height * 0.85);
  }

  drawWalls() {
    this.ctx.fillStyle = '#D4C5A9';
    this.ctx.fillRect(0, 0, ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height * 0.15);
  }

  drawFurnitureItem(item) {
    this.ctx.fillStyle = item.color || '#A0522D';
    this.ctx.fillRect(item.x, item.y, DEFAULT_HITBOX_SIZE.width, DEFAULT_HITBOX_SIZE.height);
  }

  addEffect(effect) {
    this.effectLayers.push(effect);
    this.markDirty();
  }

  removeEffect(effect) {
    this.effectLayers = this.effectLayers.filter(e => e !== effect);
    this.markDirty();
  }

  startRenderLoop() {
    const loop = () => {
      this.renderFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
