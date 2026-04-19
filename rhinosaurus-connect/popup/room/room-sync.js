import { getEventsChannelName } from '../../shared/supabase-helpers.js';
import { REALTIME_EVENTS } from '../../shared/constants.js';

const DB_SAVE_DEBOUNCE_MS = 2000;

export class RoomSync {
  constructor(supabase, pairId) {
    this.supabase = supabase;
    this.pairId = pairId;
    this.channel = null;
    this.saveTimer = null;
    this.pendingState = null;
    this.onRemoteUpdate = null;
  }

  init() {
    const channelName = getEventsChannelName(this.pairId);
    this.channel = this.supabase.channel(channelName);

    this.channel
      .on('broadcast', { event: REALTIME_EVENTS.ROOM_UPDATE }, (payload) => {
        if (this.onRemoteUpdate) {
          this.onRemoteUpdate(payload.payload);
        }
      })
      .subscribe();
  }

  broadcastFurnitureMove(furnitureId, changes) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.ROOM_UPDATE,
      payload: {
        action: 'furniture_move',
        furniture_id: furnitureId,
        changes,
      },
    });
  }

  broadcastFurnitureChange(furnitureId, changes) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.ROOM_UPDATE,
      payload: {
        action: 'furniture_change',
        furniture_id: furnitureId,
        changes,
      },
    });
  }

  broadcastAvatarMove(userId, x, y) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.AVATAR_MOVE,
      payload: { user_id: userId, x, y },
    });
  }

  scheduleSave(roomState) {
    this.pendingState = roomState;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveToDb(), DB_SAVE_DEBOUNCE_MS);
  }

  async saveToDb() {
    if (!this.pendingState) return;
    const state = this.pendingState;
    this.pendingState = null;

    await this.supabase
      .from('room_state')
      .update({
        furniture: state.furniture,
        avatar_positions: state.avatar_positions,
        theme: state.theme,
        version: state.version,
        updated_at: new Date().toISOString(),
      })
      .eq('pair_id', this.pairId);
  }

  async loadFromDb() {
    const { data, error } = await this.supabase
      .from('room_state')
      .select('*')
      .eq('pair_id', this.pairId)
      .single();

    if (error) throw error;
    return data;
  }

  async forceSave(roomState) {
    this.pendingState = null;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    await this.supabase
      .from('room_state')
      .update({
        furniture: roomState.furniture,
        avatar_positions: roomState.avatar_positions,
        theme: roomState.theme,
        version: roomState.version,
        updated_at: new Date().toISOString(),
      })
      .eq('pair_id', this.pairId);
  }

  destroy() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.channel) this.channel.unsubscribe();
  }
}
