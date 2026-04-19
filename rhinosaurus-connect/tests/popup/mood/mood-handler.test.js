import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MoodHandler } from '../../../popup/mood/mood-handler.js';

describe('MoodHandler', () => {
  let handler, mockSupabase, mockChannel;
  beforeEach(() => {
    mockChannel = { send: vi.fn() };
    mockSupabase = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })) };
    handler = new MoodHandler(mockSupabase, 'user-1', mockChannel);
  });

  it('starts with no mood', () => { expect(handler.currentMood).toBeNull(); });
  it('sets mood and updates DB', async () => { await handler.setMood('happy'); expect(handler.currentMood).toBe('happy'); expect(mockSupabase.from).toHaveBeenCalledWith('users'); });
  it('broadcasts mood update', async () => { await handler.setMood('sad'); expect(mockChannel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'mood_update', payload: { user_id: 'user-1', mood: 'sad' } }); });
  it('clears mood with null', async () => { await handler.setMood('happy'); await handler.setMood(null); expect(handler.currentMood).toBeNull(); expect(mockChannel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'mood_update', payload: { user_id: 'user-1', mood: null } }); });
  it('handles partner mood update', () => { const cb = vi.fn(); handler.onPartnerMoodChange = cb; handler.handlePartnerMood('partner-1', 'excited'); expect(cb).toHaveBeenCalledWith('partner-1', 'excited'); });
  it('loads initial mood', () => { handler.loadInitialMood('cozy'); expect(handler.currentMood).toBe('cozy'); });
});
