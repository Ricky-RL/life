const FADE_IN_MS = 200;
const VISIBLE_MS = 5000;
const FADE_OUT_MS = 500;
const MAX_TEXT_LENGTH = 50;
const GAP_MS = 1000;

export class SpeechBubble {
  constructor(text, x, y) {
    this.text = text;
    this.displayText = text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) + '...' : text;
    this.x = x;
    this.y = y;
    this.phase = 'fade_in';
    this.opacity = 0;
    this.phaseElapsed = 0;
  }

  update(deltaMs) {
    this.phaseElapsed += deltaMs;
    switch (this.phase) {
      case 'fade_in':
        this.opacity = Math.min(1, this.phaseElapsed / FADE_IN_MS);
        if (this.phaseElapsed >= FADE_IN_MS) {
          this.phase = 'visible';
          this.phaseElapsed = 0;
        }
        break;
      case 'visible':
        this.opacity = 1;
        if (this.phaseElapsed >= VISIBLE_MS) {
          this.phase = 'fade_out';
          this.phaseElapsed = 0;
        }
        break;
      case 'fade_out':
        this.opacity = Math.max(0, 1 - this.phaseElapsed / FADE_OUT_MS);
        if (this.phaseElapsed >= FADE_OUT_MS) {
          this.phase = 'done';
        }
        break;
    }
  }

  isDone() {
    return this.phase === 'done';
  }

  draw(ctx) {
    if (this.phase === 'done') return;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    const padding = 6;
    ctx.font = '8px monospace';
    const textWidth = ctx.measureText(this.displayText).width;
    const bubbleWidth = Math.min(textWidth + padding * 2, 120);
    const bubbleHeight = 18;
    const bx = this.x + 10;
    const by = this.y - 20;
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(bx, by, bubbleWidth, bubbleHeight);
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(bx + 8, by + bubbleHeight);
    ctx.lineTo(bx + 4, by + bubbleHeight + 6);
    ctx.lineTo(bx + 14, by + bubbleHeight);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.displayText, bx + padding, by + bubbleHeight / 2);
    ctx.restore();
  }
}

export class SpeechBubbleQueue {
  constructor() {
    this.active = null;
    this.pending = [];
    this.gapTimer = 0;
    this.waitingForGap = false;
  }

  add(text, x, y) {
    const bubble = new SpeechBubble(text, x, y);
    if (!this.active) {
      this.active = bubble;
    } else {
      this.pending.push(bubble);
    }
  }

  update(deltaMs) {
    if (this.active) {
      this.active.update(deltaMs);
      if (this.active.isDone()) {
        this.active = null;
        if (this.pending.length > 0) {
          this.waitingForGap = true;
          this.gapTimer = 0;
        }
      }
    }
    if (this.waitingForGap) {
      this.gapTimer += deltaMs;
      if (this.gapTimer >= GAP_MS && this.pending.length > 0) {
        this.active = this.pending.shift();
        this.waitingForGap = false;
      }
    }
  }

  draw(ctx) {
    if (this.active) this.active.draw(ctx);
  }

  clear() {
    this.active = null;
    this.pending = [];
    this.waitingForGap = false;
  }
}
