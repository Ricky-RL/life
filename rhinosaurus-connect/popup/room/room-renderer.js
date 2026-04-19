import { ROOM_DIMENSIONS } from '../../shared/constants.js';
import { SpeechBubbleQueue } from './speech-bubble.js';

const DEFAULT_HITBOX_SIZE = { width: 48, height: 48 };

export class RoomRenderer {
  constructor(canvas, roomState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.roomState = roomState;
    this.dirty = true;
    this.spriteLoader = null;
    this.hoveredItem = null;
    this.effectLayers = [];
    this.avatars = new Map();
  }

  setSpriteLoader(loader) {
    this.spriteLoader = loader;
  }

  addAvatar(userId, animator, controller) {
    this.avatars.set(userId, { animator, controller, bubbleQueue: new SpeechBubbleQueue() });
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
    const drawables = [];
    for (const item of this.roomState.furniture) {
      drawables.push({ type: 'furniture', data: item, y: item.y });
    }
    for (const [userId, avatar] of this.avatars) {
      drawables.push({ type: 'avatar', data: avatar, userId, y: avatar.controller.y });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.type === 'furniture') {
        this.drawFurnitureItem(d.data);
      } else {
        this.drawAvatar(d.data);
      }
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
    if (item.type === 'window') {
      this.drawWindow(item);
    }

    if (this.spriteLoader) {
      const frame = this.spriteLoader.getFrame(item.type, item.variant || 'default');
      if (frame) {
        frame.draw(this.ctx, item.x, item.y);
        if (this.hoveredItem === item && item.interactive) {
          this.drawHoverGlow(item);
        }
        return;
      }
    }

    this.ctx.fillStyle = item.color || '#A0522D';
    this.ctx.fillRect(item.x, item.y, DEFAULT_HITBOX_SIZE.width, DEFAULT_HITBOX_SIZE.height);
    if (this.hoveredItem === item && item.interactive) {
      this.drawHoverGlow(item);
    }
  }

  drawAvatar(avatar) {
    const { animator, controller, bubbleQueue } = avatar;
    const scale = 3;
    animator.draw(this.ctx, controller.x, controller.y, scale);
    bubbleQueue.draw(this.ctx);
  }

  drawHoverGlow(item) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(item.x - 1, item.y - 1, DEFAULT_HITBOX_SIZE.width + 2, DEFAULT_HITBOX_SIZE.height + 2);
    this.ctx.restore();
  }

  drawWindow(windowItem) {
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour >= 20;
    const isDusk = (hour >= 18 && hour < 20) || (hour >= 6 && hour < 8);

    this.ctx.fillStyle = isNight ? '#1a1a3e' : isDusk ? '#FF8C42' : '#87CEEB';
    this.ctx.fillRect(windowItem.x + 4, windowItem.y + 4, 40, 30);

    if (isNight) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.fillRect(windowItem.x + 12, windowItem.y + 10, 2, 2);
      this.ctx.fillRect(windowItem.x + 28, windowItem.y + 16, 2, 2);
      this.ctx.fillRect(windowItem.x + 20, windowItem.y + 8, 2, 2);
    }
  }

  handleMouseMove(canvasX, canvasY) {
    const hit = this.hitTest(canvasX, canvasY);
    const newHovered = hit?.interactive ? hit : null;
    if (newHovered !== this.hoveredItem) {
      this.hoveredItem = newHovered;
      this.canvas.style.cursor = newHovered ? 'pointer' : 'default';
      this.markDirty();
    }
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
