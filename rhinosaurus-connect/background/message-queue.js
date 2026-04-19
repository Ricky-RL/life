const MAX_PARTICLES = 10;

export class MessageQueue {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async fetchUnread(pairId, userId) {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('pair_id', pairId)
      .neq('sender_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  categorize(messages) {
    return {
      textMessages: messages.filter(m => m.type === 'text' || m.type === 'image'),
      reactions: messages.filter(m => m.type === 'heart' || m.type === 'kiss'),
    };
  }

  formatReactionSummary(reactions) {
    const hearts = reactions.filter(r => r.type === 'heart').length;
    const kisses = reactions.filter(r => r.type === 'kiss').length;
    const parts = [];
    if (hearts > 0) parts.push(`${hearts} ❤️`);
    if (kisses > 0) parts.push(`${kisses} 💋`);
    return `She sent you ${parts.join(' and ')} while you were away`;
  }

  getParticleCount(reactions) {
    return Math.min(reactions.length, MAX_PARTICLES);
  }

  async processQueue(pairId, userId) {
    const messages = await this.fetchUnread(pairId, userId);
    if (messages.length === 0) return null;
    const { textMessages, reactions } = this.categorize(messages);
    return {
      textMessages,
      textCount: textMessages.length,
      reactions,
      reactionSummary: reactions.length > 0 ? this.formatReactionSummary(reactions) : null,
      particleCount: this.getParticleCount(reactions),
      totalUnread: messages.length,
    };
  }
}
