import { supabase, storeTokens, clearTokens } from './supabase-client.js';
import { SUPABASE_URL } from '../shared/supabase-helpers.js';
import { generatePairCode } from '../shared/pair-code.js';
import { PAIR_CODE_EXPIRY_MINUTES } from '../shared/constants.js';

export class AuthManager {
  buildAuthUrl() {
    const redirectUrl = chrome.identity.getRedirectURL();
    return `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
  }

  extractTokens(redirectUrl) {
    try {
      const url = new URL(redirectUrl);
      const hash = url.hash.substring(1);
      const params = new URLSearchParams(hash);
      return {
        accessToken: params.get('access_token') || null,
        refreshToken: params.get('refresh_token') || null,
      };
    } catch {
      return { accessToken: null, refreshToken: null };
    }
  }

  async signInWithGoogle() {
    const authUrl = this.buildAuthUrl();

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    const { accessToken, refreshToken } = this.extractTokens(responseUrl);

    if (!accessToken || !refreshToken) {
      throw new Error('Failed to extract tokens from OAuth redirect');
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;

    await storeTokens(data.session.access_token, data.session.refresh_token);

    await this.ensureUserRecord(data.session.user);

    return data.session;
  }

  async ensureUserRecord(user) {
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      display_name: user.user_metadata?.full_name || user.email || 'User',
    }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) console.error('Error creating user record:', error);
  }

  async generatePairCode(userId) {
    await supabase.from('pair_codes').delete().eq('user_id', userId);

    const code = generatePairCode();
    const expiresAt = new Date(Date.now() + PAIR_CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error } = await supabase.from('pair_codes').insert({
      code,
      user_id: userId,
      expires_at: expiresAt,
    });

    if (error) throw error;
    return code;
  }

  async claimPairCode(code, userId) {
    const { data, error } = await supabase.rpc('claim_pair_code', {
      p_code: code,
      p_user_id: userId,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  async getPair(userId) {
    const { data } = await supabase
      .from('pairs')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .limit(1);

    return data?.[0] || null;
  }

  async unpair(pairId) {
    const { error } = await supabase.from('pairs').delete().eq('id', pairId);
    if (error) throw error;
  }

  async signOut() {
    await supabase.auth.signOut();
    await clearTokens();
  }
}
