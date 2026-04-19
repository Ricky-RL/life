export class AuthUI {
  constructor(onScreenChange) {
    this.onScreenChange = onScreenChange;
    this.codeExpiryTimer = null;
  }

  init() {
    const loginBtn = document.getElementById('login-btn');
    console.log('[AuthUI] init called, login-btn element:', loginBtn);
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        console.log('[AuthUI] login-btn clicked');
        this.handleLogin();
      });
    }
    document.getElementById('generate-code-btn')?.addEventListener('click', () => this.handleGenerateCode());
    document.getElementById('submit-code-btn')?.addEventListener('click', () => this.handleSubmitCode());
    document.getElementById('copy-code-btn')?.addEventListener('click', () => this.handleCopyCode());
  }

  async handleLogin() {
    const loginBtn = document.getElementById('login-btn');
    try {
      if (loginBtn) loginBtn.disabled = true;
      console.log('Sending SIGN_IN message...');
      const response = await chrome.runtime.sendMessage({ type: 'SIGN_IN' });
      console.log('SIGN_IN response:', response);
      if (response?.error) {
        this.showLoginError(response.error);
        return;
      }
      if (response?.session) {
        const pair = await chrome.runtime.sendMessage({ type: 'GET_PAIR' });
        if (pair?.pair) {
          this.onScreenChange('room');
        } else {
          this.onScreenChange('pairing');
        }
      } else {
        this.showLoginError('No session returned. Check service worker logs.');
      }
    } catch (err) {
      console.error('Login failed:', err);
      this.showLoginError(err.message || 'Login failed');
    } finally {
      if (loginBtn) loginBtn.disabled = false;
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

  showLoginError(message) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
      setTimeout(() => errorEl.classList.add('hidden'), 8000);
    }
  }

  destroy() {
    if (this.codeExpiryTimer) clearInterval(this.codeExpiryTimer);
  }
}
