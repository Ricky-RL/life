import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/supabase-helpers.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
  },
});

export async function storeTokens(accessToken, refreshToken) {
  await chrome.storage.session.set({ access_token: accessToken });
  await chrome.storage.local.set({ refresh_token: refreshToken });
}

export async function getStoredTokens() {
  const sessionData = await chrome.storage.session.get(['access_token']);
  const localData = await chrome.storage.local.get(['refresh_token']);
  return {
    accessToken: sessionData.access_token || null,
    refreshToken: localData.refresh_token || null,
  };
}

export async function clearTokens() {
  await chrome.storage.session.set({ access_token: null });
  await chrome.storage.local.set({ refresh_token: null });
}

export async function restoreSession() {
  const { accessToken, refreshToken } = await getStoredTokens();
  if (!accessToken && !refreshToken) return null;

  if (refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken || '',
      refresh_token: refreshToken,
    });
    if (error) {
      await clearTokens();
      return null;
    }
    if (data.session) {
      await storeTokens(data.session.access_token, data.session.refresh_token);
    }
    return data.session;
  }
  return null;
}
