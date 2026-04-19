import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChrome = {
  tabs: { query: vi.fn(), sendMessage: vi.fn() },
  notifications: { create: vi.fn() },
  runtime: { getURL: vi.fn((path) => `chrome-extension://abc123/${path}`) },
};
vi.stubGlobal('chrome', mockChrome);

const { NotificationManager } = await import('../../background/notification-manager.js');

describe('NotificationManager', () => {
  let manager;
  beforeEach(() => { vi.clearAllMocks(); manager = new NotificationManager(); });

  it('sends corner popup to active tab content script', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ id: 42, url: 'https://example.com' }]);
    mockChrome.tabs.sendMessage.mockResolvedValue({ ok: true });
    await manager.notify({ type: 'text', senderName: 'Partner', preview: 'miss you!', animation: 'speaking' });
    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(42, { type: 'SHOW_NOTIFICATION', data: expect.objectContaining({ preview: 'miss you!' }) });
  });

  it('falls back to Chrome native notification for chrome:// pages', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ id: 42, url: 'chrome://settings' }]);
    await manager.notify({ type: 'text', senderName: 'Partner', preview: 'hello!', animation: 'speaking' });
    expect(mockChrome.notifications.create).toHaveBeenCalled();
    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('falls back to Chrome native when content script fails', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ id: 42, url: 'https://example.com' }]);
    mockChrome.tabs.sendMessage.mockRejectedValue(new Error('no listener'));
    await manager.notify({ type: 'text', senderName: 'Partner', preview: 'hi!', animation: 'speaking' });
    expect(mockChrome.notifications.create).toHaveBeenCalled();
  });

  it('formats heart reaction preview', () => { expect(manager.formatPreview({ type: 'heart' })).toBe('Sent you a heart ❤️'); });
  it('formats kiss reaction preview', () => { expect(manager.formatPreview({ type: 'kiss' })).toBe('Sent you a kiss 💋'); });
  it('formats image message preview', () => { expect(manager.formatPreview({ type: 'image' })).toBe('Sent you a photo 📷'); });
  it('truncates long text messages to 80 chars', () => { const p = manager.formatPreview({ type: 'text', content: 'a'.repeat(100) }); expect(p.length).toBeLessThanOrEqual(83); expect(p.endsWith('...')).toBe(true); });
});
