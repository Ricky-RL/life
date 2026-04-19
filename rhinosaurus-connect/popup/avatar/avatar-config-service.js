import { REALTIME_EVENTS } from '../../shared/constants.js';

export class AvatarConfigService {
  /**
   * @param {object} supabase - Supabase client instance.
   * @param {string} userId - Current user's ID.
   * @param {object} channel - Realtime channel with a send() method.
   */
  constructor(supabase, userId, channel) {
    this.supabase = supabase;
    this.userId = userId;
    this.channel = channel;
  }

  /**
   * Persists avatar config to the database and broadcasts the update over the channel.
   * @param {object} avatarConfig
   */
  async save(avatarConfig) {
    await this.supabase
      .from('users')
      .update({ avatar_config: avatarConfig })
      .eq('id', this.userId);

    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.AVATAR_CONFIG_UPDATE,
      payload: { user_id: this.userId, avatar_config: avatarConfig },
    });
  }

  /**
   * Fetches a partner's avatar config from the database.
   * @param {string} partnerId
   * @returns {Promise<object>} The partner's avatar_config object.
   */
  async loadPartnerConfig(partnerId) {
    const { data, error } = await this.supabase
      .from('users')
      .select('avatar_config')
      .eq('id', partnerId)
      .single();

    if (error) throw error;
    return data.avatar_config;
  }
}
