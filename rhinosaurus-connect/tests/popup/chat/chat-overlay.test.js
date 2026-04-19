import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatOverlay } from '../../../popup/chat/chat-overlay.js';

describe('ChatOverlay', () => {
  let overlay, container, mockService;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockService = {
      fetchMessages: vi.fn(() => Promise.resolve([])),
      sendText: vi.fn(() => Promise.resolve({ id: 'msg-1', type: 'text', content: 'hi' })),
      markAsRead: vi.fn(() => Promise.resolve()),
      formatPreview: vi.fn((c) => c),
    };
    overlay = new ChatOverlay(container, mockService, 'user-1');
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('creates overlay DOM structure', () => {
    overlay.render();
    expect(container.querySelector('.chat-header')).not.toBeNull();
    expect(container.querySelector('.chat-messages')).not.toBeNull();
    expect(container.querySelector('.chat-input-bar')).not.toBeNull();
  });

  it('shows overlay and loads messages', async () => {
    await overlay.open();
    expect(overlay.isOpen).toBe(true);
    expect(mockService.fetchMessages).toHaveBeenCalled();
    expect(mockService.markAsRead).toHaveBeenCalled();
  });

  it('closes overlay', () => {
    overlay.render();
    overlay.isOpen = true;
    overlay.close();
    expect(overlay.isOpen).toBe(false);
  });

  it('sends text message on submit', async () => {
    overlay.render();
    overlay.isOpen = true;
    const input = container.querySelector('.chat-text-input');
    input.value = 'hello';
    await overlay.handleSend();
    expect(mockService.sendText).toHaveBeenCalledWith('hello');
    expect(input.value).toBe('');
  });

  it('does not send empty message', async () => {
    overlay.render();
    overlay.isOpen = true;
    const input = container.querySelector('.chat-text-input');
    input.value = '   ';
    await overlay.handleSend();
    expect(mockService.sendText).not.toHaveBeenCalled();
  });

  it('appends incoming message to list', () => {
    overlay.render();
    overlay.isOpen = true;
    overlay.onIncomingMessage({ id: 'msg-2', sender_id: 'user-2', type: 'text', content: 'hey', created_at: new Date().toISOString() });
    expect(container.querySelectorAll('.chat-message').length).toBe(1);
  });

  it('renders own messages right-aligned', () => {
    overlay.render();
    overlay.isOpen = true;
    overlay.onIncomingMessage({ id: 'msg-1', sender_id: 'user-1', type: 'text', content: 'hi', created_at: new Date().toISOString() });
    expect(container.querySelector('.chat-message').classList.contains('chat-message-own')).toBe(true);
  });

  it('filters reactions from display', () => {
    overlay.render();
    overlay.isOpen = true;
    overlay.onIncomingMessage({ id: 'msg-3', sender_id: 'user-2', type: 'heart', content: null, created_at: new Date().toISOString() });
    expect(container.querySelectorAll('.chat-message').length).toBe(0);
  });
});
