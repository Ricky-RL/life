import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvatarConfigService } from '../../../popup/avatar/avatar-config-service.js';

describe('AvatarConfigService', () => {
  let service, mockSupabase, mockChannel;
  beforeEach(() => {
    mockChannel = { send: vi.fn() };
    mockSupabase = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })), select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { avatar_config: { top: { item: 'hoodie', color: '#FF6B9D' } } }, error: null })) })) })) })) };
    service = new AvatarConfigService(mockSupabase, 'user-1', mockChannel);
  });

  it('saves avatar config to DB', async () => { await service.save({ top: { item: 'hoodie', color: '#FF6B9D' } }); expect(mockSupabase.from).toHaveBeenCalledWith('users'); });
  it('broadcasts config update', async () => { const config = { top: { item: 'hoodie', color: '#FF6B9D' } }; await service.save(config); expect(mockChannel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'avatar_config_update', payload: { user_id: 'user-1', avatar_config: config } }); });
  it('loads partner config from DB', async () => { const config = await service.loadPartnerConfig('partner-1'); expect(config.top.item).toBe('hoodie'); });
});
