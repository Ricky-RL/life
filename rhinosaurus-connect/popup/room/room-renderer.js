import { ROOM_DIMENSIONS } from '../../shared/constants.js';
import { SpeechBubbleQueue } from './speech-bubble.js';
import { ColorTinter } from './color-tinter.js';

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
    this.editModeController = null;
    this.avatars = new Map();
    this.colorTinter = new ColorTinter();
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

  getItemSize(item) {
    if (this.spriteLoader) {
      const frame = this.spriteLoader.getFrame(item.type, item.variant || 'default');
      if (frame) {
        return { width: item.renderWidth || frame.sw, height: item.renderHeight || frame.sh };
      }
    }
    return { width: item.renderWidth || 48, height: item.renderHeight || 48 };
  }

  hitTest(clickX, clickY) {
    const interactives = this.roomState.furniture
      .filter(f => f.interactive)
      .sort((a, b) => b.y - a.y);

    for (const item of interactives) {
      const size = this.getItemSize(item);
      if (
        clickX >= item.x &&
        clickX <= item.x + size.width &&
        clickY >= item.y &&
        clickY <= item.y + size.height
      ) {
        return item;
      }
    }
    return null;
  }

  hitTestAll(clickX, clickY) {
    const items = [...this.roomState.furniture].sort((a, b) => b.y - a.y);
    for (const item of items) {
      const size = this.getItemSize(item);
      if (
        clickX >= item.x &&
        clickX <= item.x + size.width &&
        clickY >= item.y &&
        clickY <= item.y + size.height
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
    const { width, height } = ROOM_DIMENSIONS;
    const floorY = Math.floor(height * 0.15);
    const floorH = height - floorY;
    const ctx = this.ctx;

    const plankColors = ['#B8894A', '#A67B3D', '#C49A5A'];
    const lineColor = '#7A5520';
    const grainColor = '#9A6B30';

    for (let row = 0; row * 16 < floorH; row++) {
      const y = floorY + row * 16;
      const plankColor = plankColors[row % 3];
      ctx.fillStyle = plankColor;
      ctx.fillRect(0, y, width, 16);

      ctx.fillStyle = lineColor;
      ctx.fillRect(0, y, width, 1);

      const offset = (row % 2 === 0) ? 0 : 20;
      for (let x = offset; x < width; x += 40) {
        ctx.fillRect(x, y, 1, 16);
      }

      for (let x = 3; x < width; x += 13) {
        const gy = y + 5 + (x % 7);
        if (gy < y + 15 && gy < height) {
          ctx.fillStyle = grainColor;
          ctx.fillRect(x, gy, 2, 1);
        }
      }
    }
  }

  drawWalls() {
    const { width, height } = ROOM_DIMENSIONS;
    const wallH = Math.floor(height * 0.15);
    const ctx = this.ctx;

    ctx.fillStyle = '#C8D5C0';
    ctx.fillRect(0, 0, width, wallH);

    for (let x = 0; x < width; x += 8) {
      ctx.fillStyle = '#B8C8B0';
      ctx.fillRect(x, 0, 1, wallH - 4);
      ctx.fillStyle = '#A8B8A0';
      ctx.fillRect(x + 4, 0, 1, wallH - 4);
    }

    const panelTop = Math.floor(wallH * 0.55);
    ctx.fillStyle = '#C4B68E';
    ctx.fillRect(0, panelTop, width, wallH - panelTop - 4);
    for (let x = 0; x < width; x += 40) {
      ctx.fillStyle = '#B0A078';
      ctx.fillRect(x, panelTop, 1, wallH - panelTop - 4);
      ctx.fillStyle = '#D5C8A6';
      ctx.fillRect(x + 1, panelTop, 1, wallH - panelTop - 4);
    }

    ctx.fillStyle = '#B0A078';
    ctx.fillRect(0, panelTop, width, 1);
    ctx.fillStyle = '#C49A5A';
    ctx.fillRect(0, panelTop - 1, width, 1);

    ctx.fillStyle = '#8B7D5C';
    ctx.fillRect(0, wallH - 4, width, 4);
    ctx.fillStyle = '#C49A5A';
    ctx.fillRect(0, wallH - 5, width, 1);
  }

  drawFurnitureItem(item) {
    const inEditMode = this.editModeController?.isEditMode;
    const ctx = this.ctx;

    if (this.spriteLoader) {
      const frame = this.spriteLoader.getFrame(item.type, item.variant || 'default');
      if (frame) {
        const dw = item.renderWidth || frame.sw;
        const dh = item.renderHeight || frame.sh;
        frame.draw(ctx, item.x, item.y, dw, dh);
        if (item.color) {
          this.colorTinter.applyTint(ctx, item.color, item.x, item.y, dw, dh);
        }
        if (inEditMode) this.drawEditOutline(item, dw, dh);
        if (this.editModeController?.selectedId === item.id) this.drawSelectionHighlight(item, dw, dh);
        else if (this.hoveredItem === item) this.drawHoverGlow(item, dw, dh);
        return;
      }
    }

    const size = this.getItemSize(item);
    if (item.type === 'window') {
      this.drawWindow(item);
    } else if (item.type === 'calendar') {
      this.drawCalendarPlaceholder(item);
    } else {
      ctx.fillStyle = item.color || '#A0522D';
      ctx.fillRect(item.x, item.y, size.width, size.height);
    }
    if (inEditMode) this.drawEditOutline(item, size.width, size.height);
    if (this.editModeController?.selectedId === item.id) this.drawSelectionHighlight(item, size.width, size.height);
    else if (this.hoveredItem === item) this.drawHoverGlow(item, size.width, size.height);
  }

  drawAvatar(avatar) {
    const { animator, controller, bubbleQueue } = avatar;
    const scale = 3;
    animator.draw(this.ctx, controller.x, controller.y, scale);
    bubbleQueue.draw(this.ctx);
  }

  drawHoverGlow(item, w, h) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(item.x - 1, item.y - 1, (w || 48) + 2, (h || 48) + 2);
    this.ctx.restore();
  }

  drawEditOutline(item, w, h) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);
    this.ctx.strokeRect(item.x, item.y, w || 48, h || 48);
    this.ctx.restore();
  }

  drawSelectionHighlight(item, w, h) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(item.x - 2, item.y - 2, (w || 48) + 4, (h || 48) + 4);
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

  drawCalendarPlaceholder(item) {
    const x = item.x;
    const y = item.y;
    const w = 48;
    const h = 48;

    this.ctx.fillStyle = '#FFF8EC';
    this.ctx.fillRect(x, y, w, h);

    this.ctx.fillStyle = '#C25A6E';
    this.ctx.fillRect(x, y, w, 13);

    this.ctx.fillStyle = '#FFF8EC';
    this.ctx.font = 'bold 8px monospace';
    this.ctx.textAlign = 'center';
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    this.ctx.fillText(monthNames[new Date().getMonth()], x + w / 2, y + 10);

    this.ctx.fillStyle = '#3B2F20';
    this.ctx.font = 'bold 20px monospace';
    this.ctx.fillText(String(new Date().getDate()), x + w / 2, y + 37);

    this.ctx.strokeStyle = '#3B2F20';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, w, h);

    this.ctx.fillStyle = '#6B4B2A';
    this.ctx.fillRect(x + 10, y - 4, 6, 8);
    this.ctx.fillRect(x + 32, y - 4, 6, 8);

    this.ctx.textAlign = 'start';
  }

  handleMouseMove(canvasX, canvasY) {
    const inEditMode = this.editModeController?.isEditMode;
    const hit = inEditMode ? this.hitTestAll(canvasX, canvasY) : this.hitTest(canvasX, canvasY);
    const newHovered = inEditMode ? hit : (hit?.interactive ? hit : null);
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
