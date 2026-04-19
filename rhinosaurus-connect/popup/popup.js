import { RoomRenderer } from './room/room-renderer.js';
import { RoomState } from './room/room-state.js';
import { AuthUI } from './auth.js';

console.log('[popup] script loaded');

const screens = {
  login: document.getElementById('login-screen'),
  pairing: document.getElementById('pairing-screen'),
  room: document.getElementById('room-screen'),
};

console.log('[popup] screens:', Object.keys(screens).map(k => `${k}=${!!screens[k]}`).join(', '));

function showScreen(name) {
  for (const screen of Object.values(screens)) {
    screen.classList.add('hidden');
  }
  screens[name].classList.remove('hidden');
}

const authUI = new AuthUI(showScreen);
authUI.init();

async function init() {
  try {
    const session = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    if (!session?.session) {
      showScreen('login');
      return;
    }

    const pair = await chrome.runtime.sendMessage({ type: 'GET_PAIR' });
    if (!pair?.pair) {
      showScreen('pairing');
      return;
    }

    initRoom();
  } catch (err) {
    console.error('Init failed:', err);
    showScreen('login');
  }
}

function initRoom() {
  showScreen('room');

  const canvas = document.getElementById('room-canvas');
  const roomState = new RoomState();
  const renderer = new RoomRenderer(canvas, roomState);

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const hit = renderer.hitTest(x, y);
    if (hit) {
      handleInteraction(hit);
    }
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('heart-btn').addEventListener('click', () => {
    console.log('Heart sent (not yet implemented)');
  });

  document.getElementById('kiss-btn').addEventListener('click', () => {
    console.log('Kiss sent (not yet implemented)');
  });

  document.getElementById('mood-btn').addEventListener('click', () => {
    console.log('Mood picker (not yet implemented)');
  });

  document.getElementById('chat-btn').addEventListener('click', () => {
    console.log('Chat (not yet implemented)');
  });

  renderer.startRenderLoop();
}

function handleInteraction(item) {
  console.log('Interaction:', item.interaction, item.id);
}

init();
