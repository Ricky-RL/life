import { RoomRenderer } from './room/room-renderer.js';
import { RoomState } from './room/room-state.js';

const screens = {
  login: document.getElementById('login-screen'),
  pairing: document.getElementById('pairing-screen'),
  room: document.getElementById('room-screen'),
};

function showScreen(name) {
  for (const screen of Object.values(screens)) {
    screen.classList.add('hidden');
  }
  screens[name].classList.remove('hidden');
}

async function init() {
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

  showScreen('room');
  renderer.startRenderLoop();
}

function handleInteraction(item) {
  console.log('Interaction:', item.interaction, item.id);
}

init();
