import { RoomRenderer } from './room/room-renderer.js';
import { RoomState } from './room/room-state.js';
import { DateService } from './calendar/date-service.js';
import { CalendarOverlay } from './calendar/calendar-overlay.js';
import { CalendarGlow } from './room/calendar-glow.js';

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

let calendarOverlay = null;
let dateService = null;
const calendarGlow = new CalendarGlow();

async function setupCalendar(supabase, pairId, userId, anniversaryDate) {
  dateService = new DateService(supabase, pairId, userId);
  const overlayContainer = document.getElementById('overlay-container');
  calendarOverlay = new CalendarOverlay(overlayContainer, dateService, anniversaryDate);

  const dates = await dateService.fetchDates();
  const milestones = [
    ...dateService.checkAnniversaryMilestones(anniversaryDate),
    ...dateService.checkDateMilestones(dates),
  ];
  calendarGlow.setMilestones(milestones);
}

async function init() {
  const canvas = document.getElementById('room-canvas');
  const roomState = new RoomState();
  const renderer = new RoomRenderer(canvas, roomState);

  renderer.addEffect({
    draw(ctx) {
      const cal = roomState.furniture.find(f => f.type === 'calendar');
      if (cal) calendarGlow.draw(ctx, cal.x, cal.y, performance.now());
      if (calendarGlow.isActive) renderer.markDirty();
    },
  });

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener('click', (e) => {
    const { x, y } = canvasCoords(e);
    const hit = renderer.hitTest(x, y);
    if (hit) {
      handleInteraction(hit);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const { x, y } = canvasCoords(e);
    renderer.handleMouseMove(x, y);
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

  showScreen('room');
  renderer.startRenderLoop();
}

function handleInteraction(item) {
  if (item.interaction === 'dates' && calendarOverlay) {
    calendarOverlay.open();
    return;
  }
  console.log('Interaction:', item.interaction, item.id);
}

init();
