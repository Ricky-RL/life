chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_NOTIFICATION') {
    showCornerPopup(message.data);
    sendResponse({ ok: true });
  }
});

function showCornerPopup(data) {
  const existing = document.getElementById('rhinosaurus-notification');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'rhinosaurus-notification';

  const inner = document.createElement('div');
  inner.className = 'rhino-notif-container';

  const avatarEl = document.createElement('div');
  avatarEl.className = 'rhino-avatar-placeholder';

  const bubble = document.createElement('div');
  bubble.className = 'rhino-speech-bubble';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'rhino-message';
  msgSpan.textContent = data.preview || '';

  bubble.appendChild(msgSpan);
  inner.appendChild(avatarEl);
  inner.appendChild(bubble);
  container.appendChild(inner);
  document.body.appendChild(container);

  requestAnimationFrame(() => container.classList.add('rhino-visible'));

  setTimeout(() => {
    container.classList.remove('rhino-visible');
    setTimeout(() => container.remove(), 500);
  }, 5000);

  container.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    container.remove();
  });
}
