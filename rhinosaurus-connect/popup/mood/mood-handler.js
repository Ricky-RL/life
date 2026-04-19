import { REALTIME_EVENTS } from '../../shared/constants.js';

export class MoodHandler {
  constructor(supabase, userId, channel) {
    this.supabase = supabase;
    this.userId = userId;
    this.channel = channel;
    this.currentMood = null;
    this.onPartnerMoodChange = null;
  }

  loadInitialMood(mood) {
    this.currentMood = mood;
  }

  async setMood(mood) {
    this.currentMood = mood;
    await this.supabase.from('users').update({ mood }).eq('id', this.userId);
    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.MOOD_UPDATE,
      payload: { user_id: this.userId, mood },
    });
  }

  handlePartnerMood(partnerId, mood) {
    if (this.onPartnerMoodChange) this.onPartnerMoodChange(partnerId, mood);
  }
}
