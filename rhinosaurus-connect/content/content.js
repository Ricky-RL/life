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

  const icon = document.createElement('div');
  icon.className = 'rhino-notif-icon';
  icon.textContent = data.animation === 'heart' ? '❤️'
    : data.animation === 'kiss' ? '💋' : '💬';

  const body = document.createElement('div');
  body.className = 'rhino-notif-body';

  const title = document.createElement('span');
  title.className = 'rhino-notif-title';
  title.textContent = 'Rhinosaurus Connect';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'rhino-message';
  msgSpan.textContent = data.preview || '';

  body.appendChild(title);
  body.appendChild(msgSpan);
  inner.appendChild(icon);
  inner.appendChild(body);
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
