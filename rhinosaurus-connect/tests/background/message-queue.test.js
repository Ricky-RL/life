import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageQueue } from '../../background/message-queue.js';

describe('MessageQueue', () => {
  let queue, mockSupabase;
  beforeEach(() => {
    mockSupabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ neq: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [{ id:'1',type:'text',content:'hi',sender_id:'p1',created_at:'2026-04-19T10:00:00Z' },{ id:'2',type:'heart',content:null,sender_id:'p1',created_at:'2026-04-19T10:01:00Z' },{ id:'3',type:'heart',content:null,sender_id:'p1',created_at:'2026-04-19T10:02:00Z' },{ id:'4',type:'kiss',content:null,sender_id:'p1',created_at:'2026-04-19T10:03:00Z' }], error: null })) })) })) })) })) })) };
    queue = new MessageQueue(mockSupabase);
  });

  it('fetches unread messages for a pair', async () => { const msgs = await queue.fetchUnread('pair-1','user-1'); expect(msgs).toHaveLength(4); });
  it('separates text messages from reactions', () => { const { textMessages, reactions } = queue.categorize([{id:'1',type:'text',content:'hi'},{id:'2',type:'heart',content:null},{id:'3',type:'heart',content:null},{id:'4',type:'kiss',content:null}]); expect(textMessages).toHaveLength(1); expect(reactions).toHaveLength(3); });
  it('formats batch reaction summary', () => { expect(queue.formatReactionSummary([{type:'heart'},{type:'heart'},{type:'heart'},{type:'kiss'},{type:'kiss'}])).toBe('She sent you 3 ❤️ and 2 💋 while you were away'); });
  it('formats summary with only hearts', () => { expect(queue.formatReactionSummary([{type:'heart'},{type:'heart'}])).toBe('She sent you 2 ❤️ while you were away'); });
  it('formats summary with only kisses', () => { expect(queue.formatReactionSummary([{type:'kiss'}])).toBe('She sent you 1 💋 while you were away'); });
  it('caps particle count at 10', () => { expect(queue.getParticleCount(Array(25).fill({type:'heart'}))).toBe(10); });
  it('returns actual count when under cap', () => { expect(queue.getParticleCount([{type:'heart'},{type:'kiss'},{type:'heart'}])).toBe(3); });
});
