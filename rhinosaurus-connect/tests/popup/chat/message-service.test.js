import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '../../../popup/chat/message-service.js';

describe('MessageService', () => {
  let service, mockSupabase, mockChannel;

  beforeEach(() => {
    mockChannel = { send: vi.fn() };
    mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: 'msg-1', type: 'text', content: 'hi' }, error: null })) })) })),
        select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ range: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ neq: vi.fn(() => Promise.resolve({ error: null })) })) })) })),
      })),
      storage: { from: vi.fn(() => ({ upload: vi.fn(() => Promise.resolve({ data: { path: 'pair-1/msg-1.jpg' }, error: null })) })) },
    };
    service = new MessageService(mockSupabase, 'pair-1', 'user-1', mockChannel);
  });

  it('sends a text message', async () => {
    const msg = await service.sendText('hello');
    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
    expect(msg.type).toBe('text');
  });

  it('broadcasts after sending', async () => {
    await service.sendText('hello');
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'broadcast', event: 'new_message' }));
  });

  it('sends a reaction message', async () => {
    await service.sendReaction('heart');
    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
  });

  it('marks messages as read', async () => {
    await service.markAsRead();
    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
  });

  it('fetches message history with pagination', async () => {
    const result = await service.fetchMessages(0, 50);
    expect(result).toEqual([]);
  });

  it('truncates preview for corner popup', () => {
    const long = 'a'.repeat(100);
    expect(service.formatPreview(long).length).toBeLessThanOrEqual(83);
  });

  it('formats image preview', () => { expect(service.formatPreview(null, 'image')).toBe('Sent you a photo 📷'); });
  it('formats heart preview', () => { expect(service.formatPreview(null, 'heart')).toBe('❤️'); });
  it('formats kiss preview', () => { expect(service.formatPreview(null, 'kiss')).toBe('💋'); });
});
