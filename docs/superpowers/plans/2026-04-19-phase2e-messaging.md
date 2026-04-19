# Phase 2E: Messaging & Chat Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement text and image messaging between partners with a chat overlay in the popup, corner popup notifications when browsing, image compression, offline queue delivery, and typing indicators.

**Architecture:** ChatOverlay renders the message list and input as an HTML overlay on top of the room canvas. MessageService handles sending/receiving via Supabase (insert + Realtime broadcast). ImageCompressor handles client-side resize before upload to Supabase Storage. The service worker routes new messages to either the popup (phone glow) or content script (corner popup). On popup open, unread messages are fetched and displayed.

**Tech Stack:** Supabase (messages table, Realtime, Storage), HTML5 Canvas (avatar rendering in notifications), OffscreenCanvas (image compression)

---

### Task 1: Image compressor utility

**Files:**
- Create: `rhinosaurus-connect/shared/image-compressor.js`
- Test: `rhinosaurus-connect/tests/shared/image-compressor.test.js`

- [ ] **Step 1: Write test for image compressor**

```js
// rhinosaurus-connect/tests/shared/image-compressor.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressImage, MAX_IMAGE_SIZE, MAX_DIMENSION } from '../../shared/image-compressor.js';

describe('compressImage', () => {
  let mockBitmap;
  let mockCanvas;
  let mockCtx;
  let mockBlob;

  beforeEach(() => {
    mockBitmap = { width: 2400, height: 1800, close: vi.fn() };
    mockBlob = new Blob(['fake'], { type: 'image/jpeg' });
    mockCtx = { drawImage: vi.fn() };
    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      convertToBlob: vi.fn(() => Promise.resolve(mockBlob)),
    };

    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.resolve(mockBitmap)));
    vi.stubGlobal('OffscreenCanvas', vi.fn((w, h) => {
      mockCanvas.width = w;
      mockCanvas.height = h;
      return mockCanvas;
    }));
  });

  it('scales down images larger than MAX_DIMENSION', async () => {
    const file = new Blob(['test'], { type: 'image/png' });
    await compressImage(file);

    expect(mockCanvas.width).toBe(MAX_DIMENSION);
    expect(mockCanvas.height).toBe(900);
  });

  it('does not scale up small images', async () => {
    mockBitmap.width = 800;
    mockBitmap.height = 600;

    const file = new Blob(['test'], { type: 'image/png' });
    await compressImage(file);

    expect(mockCanvas.width).toBe(800);
    expect(mockCanvas.height).toBe(600);
  });

  it('returns a JPEG blob', async () => {
    const file = new Blob(['test'], { type: 'image/png' });
    const result = await compressImage(file);

    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.8,
    });
    expect(result).toBe(mockBlob);
  });

  it('closes the bitmap after use', async () => {
    const file = new Blob(['test'], { type: 'image/png' });
    await compressImage(file);
    expect(mockBitmap.close).toHaveBeenCalled();
  });

  it('exports MAX_IMAGE_SIZE as 1MB', () => {
    expect(MAX_IMAGE_SIZE).toBe(1024 * 1024);
  });

  it('exports MAX_DIMENSION as 1200', () => {
    expect(MAX_DIMENSION).toBe(1200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/image-compressor.test.js`
Expected: FAIL

- [ ] **Step 3: Implement image-compressor.js**

```js
// rhinosaurus-connect/shared/image-compressor.js
export const MAX_IMAGE_SIZE = 1024 * 1024;
export const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;

export async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/shared/image-compressor.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/shared/image-compressor.js rhinosaurus-connect/tests/shared/image-compressor.test.js
git commit -m "feat: add image compressor with max 1200px dimension and JPEG output"
```

---

### Task 2: Message service (send, receive, mark read)

**Files:**
- Create: `rhinosaurus-connect/popup/chat/message-service.js`
- Test: `rhinosaurus-connect/tests/popup/chat/message-service.test.js`

- [ ] **Step 1: Write test for message service**

```js
// rhinosaurus-connect/tests/popup/chat/message-service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '../../../popup/chat/message-service.js';

describe('MessageService', () => {
  let service;
  let mockSupabase;
  let mockChannel;

  beforeEach(() => {
    mockChannel = {
      send: vi.fn(),
    };
    mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'msg-1', type: 'text', content: 'hi' }, error: null })),
          })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        })),
      })),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(() => Promise.resolve({ data: { path: 'pair-1/msg-1.jpg' }, error: null })),
        })),
      },
    };
    service = new MessageService(mockSupabase, 'pair-1', 'user-1', mockChannel);
  });

  it('sends a text message', async () => {
    const msg = await service.sendText('hello');
    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
    expect(msg.type).toBe('text');
  });

  it('broadcasts after sending', async () => {
    await service.sendText('hello');
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'broadcast',
      event: 'new_message',
    }));
  });

  it('sends a reaction message', async () => {
    await service.sendReaction('heart');
    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
  });

  it('marks messages as read', async () => {
    await service.markAsRead();
    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
  });

  it('fetches message history with pagination', async () => {
    const result = await service.fetchMessages(0, 50);
    expect(result).toEqual([]);
  });

  it('truncates preview for corner popup', () => {
    const long = 'a'.repeat(100);
    expect(service.formatPreview(long).length).toBeLessThanOrEqual(83);
  });

  it('formats image preview', () => {
    expect(service.formatPreview(null, 'image')).toBe('Sent you a photo 📷');
  });

  it('formats heart preview', () => {
    expect(service.formatPreview(null, 'heart')).toBe('❤️');
  });

  it('formats kiss preview', () => {
    expect(service.formatPreview(null, 'kiss')).toBe('💋');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/chat/message-service.test.js`
Expected: FAIL

- [ ] **Step 3: Implement message-service.js**

```js
// rhinosaurus-connect/popup/chat/message-service.js
const PREVIEW_MAX_LENGTH = 80;
const PAGE_SIZE = 50;

export class MessageService {
  constructor(supabase, pairId, userId, channel) {
    this.supabase = supabase;
    this.pairId = pairId;
    this.userId = userId;
    this.channel = channel;
  }

  async sendText(content) {
    const { data, error } = await this.supabase
      .from('messages')
      .insert({ pair_id: this.pairId, sender_id: this.userId, type: 'text', content })
      .select()
      .single();

    if (error) throw error;
    this.broadcast(data);
    return data;
  }

  async sendImage(storagePath) {
    const { data, error } = await this.supabase
      .from('messages')
      .insert({ pair_id: this.pairId, sender_id: this.userId, type: 'image', content: storagePath })
      .select()
      .single();

    if (error) throw error;
    this.broadcast(data);
    return data;
  }

  async sendReaction(type) {
    const { data, error } = await this.supabase
      .from('messages')
      .insert({ pair_id: this.pairId, sender_id: this.userId, type, content: null })
      .select()
      .single();

    if (error) throw error;
    this.broadcast(data);
    return data;
  }

  async uploadImage(blob, messageId) {
    const path = `${this.pairId}/${messageId}.jpg`;
    const { data, error } = await this.supabase.storage
      .from('message-images')
      .upload(path, blob, { contentType: 'image/jpeg' });

    if (error) throw error;
    return data.path;
  }

  async fetchMessages(offset = 0, limit = PAGE_SIZE) {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('pair_id', this.pairId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  async markAsRead() {
    await this.supabase
      .from('messages')
      .update({ is_read: true })
      .eq('pair_id', this.pairId)
      .eq('is_read', false)
      .neq('sender_id', this.userId);
  }

  broadcast(message) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: message,
    });
  }

  formatPreview(content, type = 'text') {
    if (type === 'heart') return '❤️';
    if (type === 'kiss') return '💋';
    if (type === 'image') return 'Sent you a photo 📷';
    if (!content) return '';
    return content.length > PREVIEW_MAX_LENGTH
      ? content.substring(0, PREVIEW_MAX_LENGTH) + '...'
      : content;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/chat/message-service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/chat/message-service.js rhinosaurus-connect/tests/popup/chat/message-service.test.js
git commit -m "feat: add message service with send, receive, mark read, and image upload"
```

---

### Task 3: Chat overlay UI

**Files:**
- Create: `rhinosaurus-connect/popup/chat/chat-overlay.js`
- Test: `rhinosaurus-connect/tests/popup/chat/chat-overlay.test.js`

- [ ] **Step 1: Write test for chat overlay**

```js
// rhinosaurus-connect/tests/popup/chat/chat-overlay.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatOverlay } from '../../../popup/chat/chat-overlay.js';

describe('ChatOverlay', () => {
  let overlay;
  let container;
  let mockService;

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

  afterEach(() => {
    document.body.innerHTML = '';
  });

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
    overlay.onIncomingMessage({
      id: 'msg-2',
      sender_id: 'user-2',
      type: 'text',
      content: 'hey',
      created_at: new Date().toISOString(),
    });
    const messages = container.querySelectorAll('.chat-message');
    expect(messages.length).toBe(1);
  });

  it('renders own messages right-aligned', () => {
    overlay.render();
    overlay.isOpen = true;
    overlay.onIncomingMessage({
      id: 'msg-1',
      sender_id: 'user-1',
      type: 'text',
      content: 'hi',
      created_at: new Date().toISOString(),
    });
    const msg = container.querySelector('.chat-message');
    expect(msg.classList.contains('chat-message-own')).toBe(true);
  });

  it('filters reactions from display', () => {
    overlay.render();
    overlay.isOpen = true;
    overlay.onIncomingMessage({
      id: 'msg-3',
      sender_id: 'user-2',
      type: 'heart',
      content: null,
      created_at: new Date().toISOString(),
    });
    const messages = container.querySelectorAll('.chat-message');
    expect(messages.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/chat/chat-overlay.test.js`
Expected: FAIL

- [ ] **Step 3: Implement chat-overlay.js**

```js
// rhinosaurus-connect/popup/chat/chat-overlay.js
const MAX_TEXT_LENGTH = 500;

export class ChatOverlay {
  constructor(container, messageService, currentUserId) {
    this.container = container;
    this.service = messageService;
    this.currentUserId = currentUserId;
    this.isOpen = false;
    this.messagesEl = null;
    this.inputEl = null;
    this.onClose = null;
  }

  render() {
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'chat-header';
    const backBtn = document.createElement('button');
    backBtn.className = 'chat-back-btn';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.close());
    const title = document.createElement('span');
    title.className = 'chat-title';
    title.textContent = 'Chat';
    header.appendChild(backBtn);
    header.appendChild(title);

    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'chat-messages';

    const inputBar = document.createElement('div');
    inputBar.className = 'chat-input-bar';
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.className = 'chat-text-input';
    this.inputEl.placeholder = 'Type a message...';
    this.inputEl.maxLength = MAX_TEXT_LENGTH;
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSend();
    });
    const sendBtn = document.createElement('button');
    sendBtn.className = 'chat-send-btn';
    sendBtn.textContent = 'Send';
    sendBtn.addEventListener('click', () => this.handleSend());
    inputBar.appendChild(this.inputEl);
    inputBar.appendChild(sendBtn);

    this.container.appendChild(header);
    this.container.appendChild(this.messagesEl);
    this.container.appendChild(inputBar);
  }

  async open() {
    this.render();
    this.isOpen = true;
    this.container.classList.remove('hidden');
    const messages = await this.service.fetchMessages(0, 50);
    this.renderMessages(messages.reverse());
    await this.service.markAsRead();
    this.scrollToBottom();
  }

  close() {
    this.isOpen = false;
    this.container.classList.add('hidden');
    if (this.onClose) this.onClose();
  }

  renderMessages(messages) {
    if (!this.messagesEl) return;
    for (const msg of messages) {
      if (msg.type === 'heart' || msg.type === 'kiss') continue;
      this.appendMessageEl(msg);
    }
  }

  async handleSend() {
    if (!this.inputEl) return;
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = '';
    const msg = await this.service.sendText(text);
    this.appendMessageEl(msg);
    this.scrollToBottom();
  }

  onIncomingMessage(message) {
    if (!this.isOpen || !this.messagesEl) return;
    if (message.type === 'heart' || message.type === 'kiss') return;
    this.appendMessageEl(message);
    this.scrollToBottom();
  }

  appendMessageEl(msg) {
    if (!this.messagesEl) return;
    const el = document.createElement('div');
    el.className = 'chat-message';
    if (msg.sender_id === this.currentUserId) {
      el.classList.add('chat-message-own');
    }

    if (msg.type === 'image') {
      const img = document.createElement('img');
      img.className = 'chat-image-thumb';
      img.alt = 'Shared image';
      el.appendChild(img);
    } else {
      const textEl = document.createElement('span');
      textEl.className = 'chat-message-text';
      textEl.textContent = msg.content || '';
      el.appendChild(textEl);
    }

    const time = document.createElement('span');
    time.className = 'chat-message-time';
    time.textContent = this.formatTime(msg.created_at);
    el.appendChild(time);

    this.messagesEl.appendChild(el);
  }

  scrollToBottom() {
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/chat/chat-overlay.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/chat/chat-overlay.js rhinosaurus-connect/tests/popup/chat/chat-overlay.test.js
git commit -m "feat: add chat overlay with message list, input, and incoming message handling"
```

---

### Task 4: Typing indicator

**Files:**
- Create: `rhinosaurus-connect/popup/chat/typing-indicator.js`
- Test: `rhinosaurus-connect/tests/popup/chat/typing-indicator.test.js`

- [ ] **Step 1: Write test for typing indicator**

```js
// rhinosaurus-connect/tests/popup/chat/typing-indicator.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TypingIndicator } from '../../../popup/chat/typing-indicator.js';

describe('TypingIndicator', () => {
  let indicator;
  let mockChannel;

  beforeEach(() => {
    vi.useFakeTimers();
    mockChannel = { send: vi.fn() };
    indicator = new TypingIndicator(mockChannel, 'user-1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('broadcasts typing event', () => {
    indicator.startTyping();
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: 'user-1' },
    });
  });

  it('throttles typing broadcasts to 2 seconds', () => {
    indicator.startTyping();
    indicator.startTyping();
    indicator.startTyping();
    expect(mockChannel.send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2100);
    indicator.startTyping();
    expect(mockChannel.send).toHaveBeenCalledTimes(2);
  });

  it('tracks partner typing state', () => {
    expect(indicator.isPartnerTyping).toBe(false);
    indicator.onPartnerTyping();
    expect(indicator.isPartnerTyping).toBe(true);
  });

  it('clears partner typing after 3 seconds', () => {
    indicator.onPartnerTyping();
    expect(indicator.isPartnerTyping).toBe(true);
    vi.advanceTimersByTime(3100);
    expect(indicator.isPartnerTyping).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/chat/typing-indicator.test.js`
Expected: FAIL

- [ ] **Step 3: Implement typing-indicator.js**

```js
// rhinosaurus-connect/popup/chat/typing-indicator.js
const TYPING_THROTTLE_MS = 2000;
const TYPING_TIMEOUT_MS = 3000;

export class TypingIndicator {
  constructor(channel, userId) {
    this.channel = channel;
    this.userId = userId;
    this.lastSentAt = 0;
    this.isPartnerTyping = false;
    this.partnerTimer = null;
  }

  startTyping() {
    const now = Date.now();
    if (now - this.lastSentAt < TYPING_THROTTLE_MS) return;
    this.lastSentAt = now;
    this.channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: this.userId },
    });
  }

  onPartnerTyping() {
    this.isPartnerTyping = true;
    if (this.partnerTimer) clearTimeout(this.partnerTimer);
    this.partnerTimer = setTimeout(() => {
      this.isPartnerTyping = false;
    }, TYPING_TIMEOUT_MS);
  }

  destroy() {
    if (this.partnerTimer) clearTimeout(this.partnerTimer);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/chat/typing-indicator.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/chat/typing-indicator.js rhinosaurus-connect/tests/popup/chat/typing-indicator.test.js
git commit -m "feat: add typing indicator with throttle and partner timeout"
```

---

### Task 5: Phone glow effect (in-popup notification)

**Files:**
- Create: `rhinosaurus-connect/popup/room/phone-glow.js`
- Test: `rhinosaurus-connect/tests/popup/room/phone-glow.test.js`

- [ ] **Step 1: Write test for phone glow**

```js
// rhinosaurus-connect/tests/popup/room/phone-glow.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhoneGlow } from '../../../popup/room/phone-glow.js';

describe('PhoneGlow', () => {
  let glow;

  beforeEach(() => {
    vi.useFakeTimers();
    glow = new PhoneGlow();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts inactive', () => {
    expect(glow.isActive).toBe(false);
    expect(glow.unreadCount).toBe(0);
  });

  it('activates on new message', () => {
    glow.onNewMessage();
    expect(glow.isActive).toBe(true);
    expect(glow.unreadCount).toBe(1);
  });

  it('increments unread count', () => {
    glow.onNewMessage();
    glow.onNewMessage();
    expect(glow.unreadCount).toBe(2);
  });

  it('deactivates and resets on dismiss', () => {
    glow.onNewMessage();
    glow.onNewMessage();
    glow.dismiss();
    expect(glow.isActive).toBe(false);
    expect(glow.unreadCount).toBe(0);
  });

  it('calculates pulse opacity for draw', () => {
    glow.onNewMessage();
    const opacity = glow.getPulseOpacity(0);
    expect(opacity).toBeGreaterThanOrEqual(0.3);
    expect(opacity).toBeLessThanOrEqual(1);
  });

  it('draws glow around desk position', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    glow.onNewMessage();
    glow.draw(ctx, 40, 220, 0);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/phone-glow.test.js`
Expected: FAIL

- [ ] **Step 3: Implement phone-glow.js**

```js
// rhinosaurus-connect/popup/room/phone-glow.js
export class PhoneGlow {
  constructor() {
    this.isActive = false;
    this.unreadCount = 0;
  }

  onNewMessage() {
    this.isActive = true;
    this.unreadCount++;
  }

  dismiss() {
    this.isActive = false;
    this.unreadCount = 0;
  }

  getPulseOpacity(timestamp) {
    return 0.3 + 0.7 * Math.abs(Math.sin(timestamp / 500));
  }

  draw(ctx, deskX, deskY, timestamp) {
    if (!this.isActive) return;

    ctx.save();
    const opacity = this.getPulseOpacity(timestamp);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(deskX - 2, deskY - 2, 52, 52);
    ctx.globalAlpha = 1;

    if (this.unreadCount > 0) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(deskX + 36, deskY - 4, 16, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.unreadCount), deskX + 44, deskY + 3);
    }
    ctx.restore();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd rhinosaurus-connect && npx vitest run tests/popup/room/phone-glow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rhinosaurus-connect/popup/room/phone-glow.js rhinosaurus-connect/tests/popup/room/phone-glow.test.js
git commit -m "feat: add phone glow effect with pulse animation and unread badge"
```

---

### Task 6: Wire chat into popup and service worker

**Files:**
- Modify: `rhinosaurus-connect/popup/popup.js`
- Modify: `rhinosaurus-connect/background/service-worker.js`

- [ ] **Step 1: Add chat overlay integration to popup.js**

Add to popup.js:

```js
// Add imports at top:
import { ChatOverlay } from './chat/chat-overlay.js';
import { MessageService } from './chat/message-service.js';
import { TypingIndicator } from './chat/typing-indicator.js';
import { PhoneGlow } from './room/phone-glow.js';

// In init(), after renderer setup:
let chatOverlay = null;
let messageService = null;
let typingIndicator = null;
const phoneGlow = new PhoneGlow();

async function setupChat(supabase, pairId, userId, channel) {
  messageService = new MessageService(supabase, pairId, userId, channel);
  typingIndicator = new TypingIndicator(channel, userId);

  const overlayContainer = document.getElementById('overlay-container');
  chatOverlay = new ChatOverlay(overlayContainer, messageService, userId);
  chatOverlay.onClose = () => {
    phoneGlow.dismiss();
    renderer.markDirty();
  };

  channel.on('broadcast', { event: 'new_message' }, (payload) => {
    if (chatOverlay.isOpen) {
      chatOverlay.onIncomingMessage(payload.payload);
    } else {
      phoneGlow.onNewMessage();
      renderer.markDirty();
    }
  });

  channel.on('broadcast', { event: 'typing' }, (payload) => {
    if (payload.payload.user_id !== userId) {
      typingIndicator.onPartnerTyping();
    }
  });
}

// Modify handleInteraction:
function handleInteraction(item) {
  if (item.interaction === 'chat' && chatOverlay) {
    chatOverlay.open();
    phoneGlow.dismiss();
    renderer.markDirty();
  }
}

// Add chat button handler:
document.getElementById('chat-btn').addEventListener('click', () => {
  if (chatOverlay) {
    chatOverlay.open();
    phoneGlow.dismiss();
    renderer.markDirty();
  }
});

// Add phoneGlow to render loop (add as effect layer):
renderer.addEffect({
  draw(ctx) {
    const desk = roomState.furniture.find(f => f.type === 'desk');
    if (desk) phoneGlow.draw(ctx, desk.x, desk.y, performance.now());
    if (phoneGlow.isActive) renderer.markDirty();
  },
});

// Update unread badge:
function updateUnreadBadge(count) {
  const badge = document.getElementById('unread-badge');
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}
```

- [ ] **Step 2: Add message routing to service-worker.js**

Add to service-worker.js:

```js
// Add message handler for SEND_MESSAGE and SHOW_NOTIFICATION routing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEND_MESSAGE') {
    handleSendMessage(message.data).then(sendResponse);
    return true;
  }
  if (message.type === 'NEW_MESSAGE_RECEIVED') {
    routeNotification(message.data);
  }
});

async function routeNotification(messageData) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) return;

  try {
    await chrome.tabs.sendMessage(activeTab.id, {
      type: 'SHOW_NOTIFICATION',
      data: {
        preview: messageData.preview,
        messageType: messageData.type,
        senderName: messageData.senderName,
      },
    });
  } catch {
    chrome.notifications.create(messageData.id, {
      type: 'basic',
      iconUrl: 'assets/icons/icon-48.png',
      title: messageData.senderName || 'Rhinosaurus Connect',
      message: messageData.preview || 'New message',
      priority: 2,
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add rhinosaurus-connect/popup/popup.js rhinosaurus-connect/background/service-worker.js
git commit -m "feat: wire chat overlay, phone glow, and message routing into popup and service worker"
```

---

### Task 7: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `cd rhinosaurus-connect && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Commit**

```bash
git add -A rhinosaurus-connect/
git commit -m "chore: phase 2E messaging and chat overlay complete"
```

---

## Summary

After Phase 2E:
- **ImageCompressor**: client-side resize to max 1200px, JPEG output at 0.8 quality
- **MessageService**: send text/image/reaction, fetch history with pagination, mark as read, format preview
- **ChatOverlay**: HTML overlay with message list, input bar, Enter to send, incoming message updates, reaction filtering
- **TypingIndicator**: throttled broadcasts (2s), partner timeout (3s)
- **PhoneGlow**: pulsing desk glow with unread badge count
- **Service worker**: routes notifications to content script or Chrome native fallback
