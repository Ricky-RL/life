# Phase 1A: Auth & Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Google OAuth login, 6-digit pair code system, and session management for the Chrome extension.

**Architecture:** Auth uses chrome.identity.launchWebAuthFlow with Supabase OAuth, tokens stored split between session/local storage. Pairing uses atomic Postgres function. Service worker manages session lifecycle.

**Tech Stack:** Chrome Identity API, Supabase Auth, Supabase RPC (claim_pair_code)

---

## File Structure

```
rhinosaurus-connect/
├── background/
│   ├── auth-manager.js           # Google OAuth flow, session restore, user creation
│   └── service-worker.js         # (modify) Import auth-manager, handle messages
├── popup/
│   ├── auth.js                   # Popup-side auth UI (login button, pairing flow)
│   └── popup.js                  # (modify) Integrate auth flow, screen switching
├── tests/
│   ├── background/
│   │   └── auth-manager.test.js
│   └── popup/
│       └── auth.test.js
```

---

### Task 1: Pair code generation utility

**Files:**
- Create: `rhinosaurus-connect/shared/pair-code.js`
- Test: `rhinosaurus-connect/tests/shared/pair-code.test.js`

- [ ] **Step 1: Write test for pair code generation**

```js
// rhinosaurus-connect/tests/shared/pair-code.test.js
import { describe, it, expect } from 'vitest';
import { generatePairCode, isValidPairCode } from '../../shared/pair-code.js';

describe('pair code', () => {
  it('generates a 6-character code', () => {
    const code = generatePairCode();
    expect(code).toHaveLength(6);
  });

  it('uses only uppercase alphanumeric characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generatePairCode();
      expect(code).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it('excludes ambiguous characters 0, O, 1, I, L', () => {
    const ambiguous = ['0', 'O', '1', 'I', 'L'];
    for (let i = 0; i < 100; i++) {
      const code = generatePairCode();
      for (const char of ambiguous) {
        expect(code).not.toContain(char);
      }
    }
  });

  it('validates correct codes', () => {
    expect(isValidPairCode('A3X9K2')).toBe(true);
    expect(isValidPairCode('BCDEFG')).toBe(true);
  });

  it('rejects codes with wrong length', () => {
    expect(isValidPairCode('ABC')).toBe(false);
    expect(isValidPairCode('ABCDEFGH')).toBe(false);
  });

  it('rejects codes with ambiguous characters', () => {
    expect(isValidPairCode('A0B1C2')).toBe(false);
    expect(isValidPairCode('OILBCF')).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(isValidPairCode('abcdef')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/pair-code.test.js`
Expected: FAIL

- [ ] **Step 3: Implement pair-code.js**

```js
// rhinosaurus-connect/shared/pair-code.js
import { PAIR_CODE_LENGTH } from './constants.js';

const ALLOWED_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generatePairCode() {
  let code = '';
  const array = new Uint8Array(PAIR_CODE_LENGTH);
  crypto.getRandomValues(array);
  for (let i = 0; i < PAIR_CODE_LENGTH; i++) {
    code += ALLOWED_CHARS[array[i] % ALLOWED_CHARS.length];
  }
  return code;
}

export function isValidPairCode(code) {
  if (!code || code.length !== PAIR_CODE_LENGTH) return false;
  for (const char of code) {
    if (!ALLOWED_CHARS.includes(char)) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/pair-code.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/shared/pair-code.js rhinosaurus-connect/tests/shared/pair-code.test.js
git commit -m "feat: add pair code generation with ambiguous character exclusion"
```

---

### Task 2: Auth manager (service worker side)

**Files:**
- Create: `rhinosaurus-connect/background/auth-manager.js`
- Test: `rhinosaurus-connect/tests/background/auth-manager.test.js`

- [ ] **Step 1: Write test for auth manager**

```js
// rhinosaurus-connect/tests/background/auth-manager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage = {};
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/auth-manager.test.js`
Expected: FAIL

- [ ] **Step 3: Implement auth-manager.js**

```js
// rhinosaurus-connect/background/auth-manager.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/background/auth-manager.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/background/auth-manager.js rhinosaurus-connect/tests/background/auth-manager.test.js
git commit -m "feat: add auth manager with Google OAuth, pair code, and session handling"
```

---

### Task 3: Popup auth UI

**Files:**
- Create: `rhinosaurus-connect/popup/auth.js`
- Test: `rhinosaurus-connect/tests/popup/auth.test.js`

- [ ] **Step 1: Write test for popup auth controller**

```js
// rhinosaurus-connect/tests/popup/auth.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthUI } from '../../popup/auth.js';

function createMockElements() {
  const createElement = (id) => {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
    return el;
  };
  return {
    loginBtn: createElement('login-btn'),
    generateCodeBtn: createElement('generate-code-btn'),
    submitCodeBtn: createElement('submit-code-btn'),
    copyCodeBtn: createElement('copy-code-btn'),
    pairCode: createElement('pair-code'),
    codeDisplay: createElement('code-display'),
    codeInput: Object.assign(createElement('code-input'), { value: '' }),
    codeTimer: createElement('code-timer'),
    pairingError: createElement('pairing-error'),
  };
}

const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('AuthUI', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('sends SIGN_IN message on login click', () => {
    const els = createMockElements();
    const onScreenChange = vi.fn();
    const authUI = new AuthUI(onScreenChange);
    authUI.init();

    mockChrome.runtime.sendMessage.mockResolvedValue({ session: { user: { id: '1' } } });

    els.loginBtn.click();
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'SIGN_IN' });
  });

  it('sends GENERATE_CODE message on generate click', () => {
    const els = createMockElements();
    const onScreenChange = vi.fn();
    const authUI = new AuthUI(onScreenChange);
    authUI.init();

    mockChrome.runtime.sendMessage.mockResolvedValue({ code: 'A3X9K2' });

    els.generateCodeBtn.click();
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GENERATE_CODE' });
  });

  it('sends CLAIM_CODE message with input value', () => {
    const els = createMockElements();
    const onScreenChange = vi.fn();
    const authUI = new AuthUI(onScreenChange);
    authUI.init();

    els.codeInput.value = 'B4Y8M3';
    mockChrome.runtime.sendMessage.mockResolvedValue({ pairId: 'pair-123' });

    els.submitCodeBtn.click();
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'CLAIM_CODE',
      code: 'B4Y8M3',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/auth.test.js`
Expected: FAIL

- [ ] **Step 3: Implement auth.js**

```js
// rhinosaurus-connect/popup/auth.js
export class AuthUI {
  constructor(onScreenChange) {
    this.onScreenChange = onScreenChange;
    this.codeExpiryTimer = null;
  }

  init() {
    document.getElementById('login-btn')?.addEventListener('click', () => this.handleLogin());
    document.getElementById('generate-code-btn')?.addEventListener('click', () => this.handleGenerateCode());
    document.getElementById('submit-code-btn')?.addEventListener('click', () => this.handleSubmitCode());
    document.getElementById('copy-code-btn')?.addEventListener('click', () => this.handleCopyCode());
  }

  async handleLogin() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SIGN_IN' });
      if (response?.session) {
        const pair = await chrome.runtime.sendMessage({ type: 'GET_PAIR' });
        if (pair?.pair) {
          this.onScreenChange('room');
        } else {
          this.onScreenChange('pairing');
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
    }
  }

  async handleGenerateCode() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GENERATE_CODE' });
      if (response?.code) {
        this.showCode(response.code);
      }
    } catch (err) {
      this.showError('Failed to generate code');
    }
  }

  async handleSubmitCode() {
    const input = document.getElementById('code-input');
    const code = input?.value?.toUpperCase().trim();
    if (!code || code.length !== 6) {
      this.showError('Please enter a 6-character code');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CLAIM_CODE', code });
      if (response?.pairId) {
        this.onScreenChange('room');
      } else if (response?.error) {
        this.showError(response.error);
      }
    } catch (err) {
      this.showError('Failed to connect. Try again.');
    }
  }

  handleCopyCode() {
    const codeEl = document.getElementById('pair-code');
    if (codeEl?.textContent) {
      navigator.clipboard.writeText(codeEl.textContent);
    }
  }

  showCode(code) {
    const codeDisplay = document.getElementById('code-display');
    const pairCode = document.getElementById('pair-code');
    const codeTimer = document.getElementById('code-timer');

    if (pairCode) pairCode.textContent = code;
    if (codeDisplay) codeDisplay.classList.remove('hidden');

    let remaining = 10 * 60;
    if (this.codeExpiryTimer) clearInterval(this.codeExpiryTimer);

    this.codeExpiryTimer = setInterval(() => {
      remaining--;
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      if (codeTimer) codeTimer.textContent = `Expires in ${mins}:${String(secs).padStart(2, '0')}`;
      if (remaining <= 0) {
        clearInterval(this.codeExpiryTimer);
        if (codeDisplay) codeDisplay.classList.add('hidden');
        if (codeTimer) codeTimer.textContent = 'Code expired';
      }
    }, 1000);
  }

  showError(message) {
    const errorEl = document.getElementById('pairing-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
      setTimeout(() => errorEl.classList.add('hidden'), 5000);
    }
  }

  destroy() {
    if (this.codeExpiryTimer) clearInterval(this.codeExpiryTimer);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/auth.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/auth.js rhinosaurus-connect/tests/popup/auth.test.js
git commit -m "feat: add popup auth UI with login, code generation, and pairing flow"
```

---

### Task 4: Wire auth into service worker and popup

**Files:**
- Modify: `rhinosaurus-connect/background/service-worker.js`
- Modify: `rhinosaurus-connect/popup/popup.js`

- [ ] **Step 1: Add auth message handling to service-worker.js**

Add to the `handleMessage` switch in `service-worker.js`:

```js
import { AuthManager } from './auth-manager.js';

const authManager = new AuthManager();

// Inside handleMessage switch:
case 'SIGN_IN': {
  const session = await authManager.signInWithGoogle();
  currentSession = session;
  return { session };
}

case 'GENERATE_CODE': {
  if (!currentSession) return { error: 'Not logged in' };
  const code = await authManager.generatePairCode(currentSession.user.id);
  return { code };
}

case 'CLAIM_CODE': {
  if (!currentSession) return { error: 'Not logged in' };
  try {
    const pairId = await authManager.claimPairCode(message.code, currentSession.user.id);
    await loadPairData();
    return { pairId };
  } catch (err) {
    return { error: err.message };
  }
}

case 'GET_PAIR': {
  if (!currentSession) return { pair: null };
  if (!currentPair) await loadPairData();
  return { pair: currentPair };
}

case 'SIGN_OUT': {
  await authManager.signOut();
  currentSession = null;
  currentPair = null;
  return { ok: true };
}

case 'UNPAIR': {
  if (currentPair) {
    await authManager.unpair(currentPair.id);
    currentPair = null;
  }
  return { ok: true };
}
```

- [ ] **Step 2: Integrate AuthUI in popup.js**

Add to `popup.js`:

```js
import { AuthUI } from './auth.js';

const authUI = new AuthUI(showScreen);
authUI.init();
```

- [ ] **Step 3: Commit**

```bash
git add rhinosaurus-connect/background/service-worker.js rhinosaurus-connect/popup/popup.js
git commit -m "feat: wire auth flow between popup and service worker"
```

---

### Task 5: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 1A auth and pairing complete"
```

---

## Summary

After Phase 1A:
- **Google OAuth** via `chrome.identity.launchWebAuthFlow` with Supabase
- **Pair code generation**: 6 chars, excludes ambiguous (0/O/1/I/L), 10-min expiry
- **Atomic pairing** via `claim_pair_code` Postgres RPC
- **Session persistence**: access token in session storage, refresh token in local
- **Popup auth UI**: login screen, pairing screen with generate/enter code, countdown timer, error display
- **Service worker** handles auth messages from popup
