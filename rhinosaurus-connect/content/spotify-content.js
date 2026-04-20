function extractTrackUrl() {
  const links = document.querySelectorAll('[data-testid="now-playing-widget"] a[href*="/track/"]');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href && href.includes('/track/')) {
      return href.startsWith('http') ? href : `https://open.spotify.com${href}`;
    }
  }
  const fallbackLinks = document.querySelectorAll('a[href*="/track/"]');
  for (const link of fallbackLinks) {
    const parent = link.closest('[data-testid]');
    if (parent && parent.dataset.testid.includes('now-playing')) {
      const href = link.getAttribute('href');
      return href.startsWith('http') ? href : `https://open.spotify.com${href}`;
    }
  }
  return null;
}

let lastSentUrl = null;

function checkAndSend() {
  const url = extractTrackUrl();
  if (url !== lastSentUrl) {
    lastSentUrl = url;
    if (url) {
      chrome.runtime.sendMessage({ type: 'SPOTIFY_TRACK_URL', url }).catch(() => {});
    }
  }
}

const observer = new MutationObserver(() => {
  checkAndSend();
});

function init() {
  checkAndSend();
  const target = document.querySelector('[data-testid="now-playing-widget"]') || document.body;
  observer.observe(target, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
