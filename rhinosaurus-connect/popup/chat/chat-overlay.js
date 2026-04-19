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
    this.inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleSend(); });
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
    try {
      const msg = await this.service.sendText(text);
      this.appendMessageEl(msg);
      this.scrollToBottom();
    } catch (err) {
      console.error('Failed to send message:', err);
      this.inputEl.value = text;
    }
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
    if (msg.sender_id === this.currentUserId) el.classList.add('chat-message-own');
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

  scrollToBottom() { if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight; }

  formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}
