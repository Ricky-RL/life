import { AVATAR_SIZE, ANIMATION_STATES } from '../shared/constants.js';

export class AvatarMiniRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.scale = 2;
    this.animationTimer = null;
  }

  renderStatic(spriteSheet, state, frame) {
    const stateData = ANIMATION_STATES[state];
    if (!stateData) return;
    this.drawFrame(spriteSheet, state, Math.min(frame, stateData.frames - 1));
  }

  renderFrame(spriteSheet, state, frame) {
    this.drawFrame(spriteSheet, state, frame);
  }

  renderAnimated(spriteSheet, state, onComplete) {
    const stateData = ANIMATION_STATES[state];
    if (!stateData) return;
    let frame = 0;
    this.stopAnimation();
    this.animationTimer = setInterval(() => {
      this.drawFrame(spriteSheet, state, frame);
      frame++;
      if (frame >= stateData.frames) {
        if (stateData.looping) {
          frame = 0;
        } else {
          this.stopAnimation();
          if (onComplete) onComplete();
        }
      }
    }, 33);
  }

  drawFrame(spriteSheet, state, frameIndex) {
    const { width: fw, height: fh } = AVATAR_SIZE;
    const stateIndex = Object.keys(ANIMATION_STATES).indexOf(state);
    const sx = frameIndex * fw;
    const sy = stateIndex * fh;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(spriteSheet, sx, sy, fw, fh, 0, 0, fw * this.scale, fh * this.scale);
  }

  stopAnimation() {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }
}
