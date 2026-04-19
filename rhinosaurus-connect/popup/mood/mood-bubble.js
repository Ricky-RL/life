import { MOOD_OPTIONS } from '../../shared/constants.js';

const BUBBLE_WIDTH = 20;
const BUBBLE_HEIGHT = 16;
const SPRITE_SIZE = 16;
const FADE_DURATION_MS = 300;

export class MoodBubble {
  constructor() {
    this.spriteSheet = null;
    this.currentMood = null;
    this.opacity = 1;
    this.transitioning = false;
    this.fadeElapsed = 0;
  }

  setSpriteSheet(sheet) {
    this.spriteSheet = sheet;
  }

  setMood(mood) {
    this.currentMood = mood;
    if (mood) {
      this.transitioning = true;
      this.fadeElapsed = 0;
      this.opacity = 0;
    }
  }

  update(deltaMs) {
    if (!this.transitioning) return;
    this.fadeElapsed += deltaMs;
    this.opacity = Math.min(1, this.fadeElapsed / FADE_DURATION_MS);
    if (this.fadeElapsed >= FADE_DURATION_MS) {
      this.transitioning = false;
      this.opacity = 1;
    }
  }

  getPosition(avatarX, avatarY) {
    return { x: avatarX + 10, y: avatarY - 20 };
  }

  draw(ctx, avatarX, avatarY, mood) {
    if (!mood) return;
    const pos = this.getPosition(avatarX, avatarY);
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(pos.x, pos.y, BUBBLE_WIDTH, BUBBLE_HEIGHT);
    if (this.spriteSheet) {
      const idx = MOOD_OPTIONS.findIndex((m) => m.key === mood);
      if (idx >= 0) {
        ctx.drawImage(
          this.spriteSheet,
          idx * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE,
          pos.x + 2, pos.y, SPRITE_SIZE, SPRITE_SIZE,
        );
      }
    } else {
      const option = MOOD_OPTIONS.find((m) => m.key === mood);
      if (option) {
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(option.emoji, pos.x + BUBBLE_WIDTH / 2, pos.y + BUBBLE_HEIGHT / 2);
      }
    }
    ctx.restore();
  }
}
