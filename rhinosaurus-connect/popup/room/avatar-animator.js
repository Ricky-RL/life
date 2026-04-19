import { ANIMATION_STATES, AVATAR_SIZE } from '../../shared/constants.js';

const FRAME_DURATION_MS = 33;

export class AvatarAnimator {
  constructor() {
    this.spriteSheet = null;
    this.currentState = 'idle';
    this.currentFrame = 0;
    this.elapsed = 0;
    this.onAnimationComplete = null;
  }

  setState(state) {
    if (!ANIMATION_STATES[state]) return;
    this.currentState = state;
    this.currentFrame = 0;
    this.elapsed = 0;
  }

  isLooping() {
    return ANIMATION_STATES[this.currentState]?.looping ?? true;
  }

  update(deltaMs) {
    this.elapsed += deltaMs;
    if (this.elapsed < FRAME_DURATION_MS) return;
    this.elapsed -= FRAME_DURATION_MS;
    const stateData = ANIMATION_STATES[this.currentState];
    if (!stateData) return;
    this.currentFrame++;
    if (this.currentFrame >= stateData.frames) {
      if (stateData.looping) {
        this.currentFrame = 0;
      } else {
        const completedState = this.currentState;
        this.setState('idle');
        if (this.onAnimationComplete) {
          this.onAnimationComplete(completedState);
        }
      }
    }
  }

  draw(ctx, x, y, scale) {
    if (!this.spriteSheet) return;
    const { width: fw, height: fh } = AVATAR_SIZE;
    const stateIndex = Object.keys(ANIMATION_STATES).indexOf(this.currentState);
    const sx = this.currentFrame * fw;
    const sy = stateIndex * fh;
    ctx.drawImage(this.spriteSheet, sx, sy, fw, fh, x, y, fw * scale, fh * scale);
  }
}
