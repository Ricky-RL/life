import { AVATAR_SIZE } from '../../shared/constants.js';

const MOVE_SPEED = 2;

export class AvatarController {
  constructor(userId) {
    this.userId = userId;
    this.x = 0;
    this.y = 0;
    this.targetX = null;
    this.targetY = null;
    this.isMoving = false;
    this.isDragging = false;
    this.previousPosition = null;
    this.onPositionChange = null;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  moveTo(x, y, savePrevious = false) {
    if (savePrevious) {
      this.previousPosition = { x: this.x, y: this.y };
    }
    this.targetX = x;
    this.targetY = y;
    this.isMoving = true;
  }

  returnToPrevious() {
    if (this.previousPosition) {
      this.moveTo(this.previousPosition.x, this.previousPosition.y);
      this.previousPosition = null;
    }
  }

  update() {
    if (!this.isMoving || this.isDragging) return;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= MOVE_SPEED) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.isMoving = false;
      this.targetX = null;
      this.targetY = null;
      if (this.onPositionChange) this.onPositionChange(this.x, this.y);
      return;
    }
    this.x += (dx / dist) * MOVE_SPEED;
    this.y += (dy / dist) * MOVE_SPEED;
  }

  startDrag(x, y) {
    this.isDragging = true;
    this.isMoving = false;
  }

  drag(x, y) {
    if (!this.isDragging) return;
    this.x = x;
    this.y = y;
  }

  endDrag() {
    this.isDragging = false;
    if (this.onPositionChange) this.onPositionChange(this.x, this.y);
  }

  hitTest(px, py, scale) {
    const w = AVATAR_SIZE.width * scale;
    const h = AVATAR_SIZE.height * scale;
    return px >= this.x && px <= this.x + w && py >= this.y && py <= this.y + h;
  }
}
