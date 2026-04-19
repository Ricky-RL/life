const TYPING_THROTTLE_MS = 2000;
const TYPING_TIMEOUT_MS = 3000;

export class TypingIndicator {
  constructor(channel, userId) {
    this.channel = channel;
    this.userId = userId;
    this.lastSentAt = 0;
    this.isPartnerTyping = false;
    this.partnerTimer = null;
  }

  startTyping() {
    const now = Date.now();
    if (now - this.lastSentAt < TYPING_THROTTLE_MS) return;
    this.lastSentAt = now;
    this.channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: this.userId } });
  }

  onPartnerTyping() {
    this.isPartnerTyping = true;
    if (this.partnerTimer) clearTimeout(this.partnerTimer);
    this.partnerTimer = setTimeout(() => { this.isPartnerTyping = false; }, TYPING_TIMEOUT_MS);
  }

  destroy() { if (this.partnerTimer) clearTimeout(this.partnerTimer); }
}
