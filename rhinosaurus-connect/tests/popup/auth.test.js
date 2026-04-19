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
