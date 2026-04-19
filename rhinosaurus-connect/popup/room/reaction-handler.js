const THROTTLE_MS = 1000;
const MAX_BATCH_PARTICLES = 10;

export class ReactionHandler {
  constructor(messageService, particleSystem) {
    this.service = messageService;
    this.particles = particleSystem;
    this.lastSent = { heart: 0, kiss: 0 };
  }

  async sendHeart() {
    if (!this.canSend('heart')) return;
    this.lastSent.heart = Date.now();
    await this.service.sendReaction('heart');
  }

  async sendKiss() {
    if (!this.canSend('kiss')) return;
    this.lastSent.kiss = Date.now();
    await this.service.sendReaction('kiss');
  }

  canSend(type) { return Date.now() - this.lastSent[type] >= THROTTLE_MS; }

  onReceiveReaction(type, animator, bubbleQueue, avatarX, avatarY, myAvatarX, myAvatarY) {
    if (type === 'heart') {
      animator.setState('heart_eyes');
      bubbleQueue.add('❤️', avatarX, avatarY);
      this.particles.spawnHearts(avatarX, avatarY);
    } else if (type === 'kiss') {
      animator.setState('kiss_face');
      bubbleQueue.add('💋', avatarX, avatarY);
      this.particles.spawnKiss(avatarX, avatarY, myAvatarX, myAvatarY);
    }
  }

  formatBatchSummary(heartCount, kissCount) {
    const parts = [];
    if (heartCount > 0) parts.push(`${heartCount} ❤️`);
    if (kissCount > 0) parts.push(`${kissCount} 💋`);
    return `Sent you ${parts.join(' and ')} while you were away`;
  }

  getBatchParticleCount(totalReactions) { return Math.min(totalReactions, MAX_BATCH_PARTICLES); }
}
