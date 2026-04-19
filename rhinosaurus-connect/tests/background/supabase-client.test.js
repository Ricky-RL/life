import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage = {};
const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys) => Promise.resolve(
        keys.reduce((acc, k) => ({ ...acc, [k]: mockStorage[k] }), {})
      )),
      set: vi.fn((items) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
    },
    session: {
      get: vi.fn((keys) => Promise.resolve(
        keys.reduce((acc, k) => ({ ...acc, [k]: mockStorage[`session_${k}`] }), {})
      )),
      set: vi.fn((items) => {
        for (const [k, v] of Object.entries(items)) {
          mockStorage[`session_${k}`] = v;
        }
        return Promise.resolve();
      }),
    },
  },
};

vi.stubGlobal('chrome', mockChrome);

const { storeTokens, getStoredTokens, clearTokens } = await import(
  '../../background/supabase-client.js'
);

describe('supabase-client token storage', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
    vi.clearAllMocks();
  });

  it('stores access token in session and refresh token in local', async () => {
    await storeTokens('access_123', 'refresh_456');

    expect(mockChrome.storage.session.set).toHaveBeenCalledWith({
      access_token: 'access_123',
    });
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
      refresh_token: 'refresh_456',
    });
  });

  it('retrieves stored tokens', async () => {
    mockStorage['session_access_token'] = 'access_123';
    mockStorage['refresh_token'] = 'refresh_456';

    const tokens = await getStoredTokens();
    expect(tokens.accessToken).toBe('access_123');
    expect(tokens.refreshToken).toBe('refresh_456');
  });

  it('clears all tokens', async () => {
    await clearTokens();
    expect(mockChrome.storage.session.set).toHaveBeenCalledWith({
      access_token: null,
    });
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
      refresh_token: null,
    });
  });
});
