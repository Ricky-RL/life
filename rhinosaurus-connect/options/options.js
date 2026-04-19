document.getElementById('tracking-toggle').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ tracking_enabled: e.target.checked });
  chrome.runtime.sendMessage({ type: 'TRACKING_TOGGLED', enabled: e.target.checked });
});

document.getElementById('unpair-btn').addEventListener('click', () => {
  if (confirm('Are you sure? This will delete your shared room, chat history, and tracked dates.')) {
    chrome.runtime.sendMessage({ type: 'UNPAIR' });
  }
});

async function loadSettings() {
  const { tracking_enabled } = await chrome.storage.local.get(['tracking_enabled']);
  document.getElementById('tracking-toggle').checked = tracking_enabled !== false;
}

loadSettings();
