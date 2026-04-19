const PREVIEW_MAX_LENGTH = 80;
const PAGE_SIZE = 50;

export class MessageService {
  constructor(supabase, pairId, userId, channel) {
    this.supabase = supabase;
    this.pairId = pairId;
    this.userId = userId;
    this.channel = channel;
  }

  async sendText(content) {
    const { data, error } = await this.supabase.from('messages').insert({ pair_id: this.pairId, sender_id: this.userId, type: 'text', content }).select().single();
    if (error) throw error;
    this.broadcast(data);
    return data;
  }

  async sendImage(storagePath) {
    const { data, error } = await this.supabase.from('messages').insert({ pair_id: this.pairId, sender_id: this.userId, type: 'image', content: storagePath }).select().single();
    if (error) throw error;
    this.broadcast(data);
    return data;
  }

  async sendReaction(type) {
    const { data, error } = await this.supabase.from('messages').insert({ pair_id: this.pairId, sender_id: this.userId, type, content: null }).select().single();
    if (error) throw error;
    this.broadcast(data);
    return data;
  }

  async uploadImage(blob, messageId) {
    const path = `${this.pairId}/${messageId}.jpg`;
    const { data, error } = await this.supabase.storage.from('message-images').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return data.path;
  }

  async fetchMessages(offset = 0, limit = PAGE_SIZE) {
    const { data, error } = await this.supabase.from('messages').select('*').eq('pair_id', this.pairId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  async markAsRead() {
    await this.supabase.from('messages').update({ is_read: true }).eq('pair_id', this.pairId).eq('is_read', false).neq('sender_id', this.userId);
  }

  broadcast(message) {
    if (!this.channel) return;
    this.channel.send({ type: 'broadcast', event: 'new_message', payload: message });
  }

  formatPreview(content, type = 'text') {
    if (type === 'heart') return '❤️';
    if (type === 'kiss') return '💋';
    if (type === 'image') return 'Sent you a photo 📷';
    if (!content) return '';
    return content.length > PREVIEW_MAX_LENGTH ? content.substring(0, PREVIEW_MAX_LENGTH) + '...' : content;
  }
}
