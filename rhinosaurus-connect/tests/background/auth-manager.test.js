import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChrome = {
  identity: {
    getRedirectURL: vi.fn(() => 'https://abc123.chromiumapp.org/'),
    launchWebAuthFlow: vi.fn(),
  },
  storage: {
    session: {
      set: vi.fn(() => Promise.resolve()),
      get: vi.fn(() => Promise.resolve({})),
    },
    local: {
      set: vi.fn(() => Promise.resolve()),
      get: vi.fn(() => Promise.resolve({})),
    },
  },
};

vi.stubGlobal('chrome', mockChrome);

const mockSupabase = {
  auth: {
    setSession: vi.fn(),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      or: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
  rpc: vi.fn(),
};

vi.mock('../../background/supabase-client.js', () => ({
  supabase: mockSupabase,
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
}));

const { AuthManager } = await import('../../background/auth-manager.js');

describe('AuthManager', () => {
  let auth;

  beforeEach(() => {
    vi.clearAllMocks();
    auth = new AuthManager();
  });

  it('builds correct OAuth URL', () => {
    const url = auth.buildAuthUrl();
    expect(url).toContain('/auth/v1/authorize');
    expect(url).toContain('provider=google');
    expect(url).toContain('redirect_to=');
    expect(url).toContain(encodeURIComponent('https://abc123.chromiumapp.org/'));
  });

  it('extracts tokens from redirect URL hash', () => {
    const redirectUrl = 'https://abc123.chromiumapp.org/#access_token=at_123&refresh_token=rt_456&token_type=bearer';
    const tokens = auth.extractTokens(redirectUrl);
    expect(tokens.accessToken).toBe('at_123');
    expect(tokens.refreshToken).toBe('rt_456');
  });

  it('returns null tokens for invalid redirect URL', () => {
    const tokens = auth.extractTokens('https://abc123.chromiumapp.org/');
    expect(tokens.accessToken).toBeNull();
    expect(tokens.refreshToken).toBeNull();
  });

  it('generates a pair code via supabase insert', async () => {
    mockSupabase.from.mockReturnValueOnce({
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    });
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    });

    const code = await auth.generatePairCode('user-1');
    expect(code).toHaveLength(6);
  });

  it('claims a pair code via RPC', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'pair-id-123', error: null });
    const pairId = await auth.claimPairCode('A3X9K2', 'user-2');
    expect(pairId).toBe('pair-id-123');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('claim_pair_code', {
      p_code: 'A3X9K2',
      p_user_id: 'user-2',
    });
  });

  it('throws on invalid claim', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Invalid code' } });
    await expect(auth.claimPairCode('BADCOD', 'user-2')).rejects.toThrow('Invalid code');
  });
});
