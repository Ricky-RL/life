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

  // TODO: remove once Phase 1A auth is wired up
  setupCalendarMock();
}

function setupCalendarMock() {
  const mockService = {
    fetchDates: () => Promise.resolve([
      { id: '1', label: 'Next Visit', date: '2026-05-10', is_countdown: true, is_recurring: false },
      { id: '2', label: 'Her Birthday', date: '2025-08-22', is_countdown: true, is_recurring: true },
      { id: '3', label: 'First Date', date: '2024-06-15', is_countdown: false, is_recurring: false },
    ]),
    addDate: (label, date, isCountdown, isRecurring) =>
      Promise.resolve({ id: String(Date.now()), label, date, is_countdown: isCountdown, is_recurring: isRecurring }),
    deleteDate: () => Promise.resolve(),
    updateDate: () => Promise.resolve(),
    getAnniversaryDays: (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null,
    sortDates: (dates) => {
      const now = new Date();
      const upcoming = [];
      const past = [];
      for (const d of dates) {
        const diff = Math.round((new Date(d.date) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
        const entry = { ...d, effectiveDate: d.date, days: diff };
        if (diff >= 0) upcoming.push(entry);
        else past.push(entry);
      }
      upcoming.sort((a, b) => a.days - b.days);
      past.sort((a, b) => b.days - a.days);
      return { upcoming, past };
    },
    checkAnniversaryMilestones: () => [],
    checkDateMilestones: () => [],
  };

  const overlayContainer = document.getElementById('overlay-container');
  calendarOverlay = new CalendarOverlay(overlayContainer, mockService, '2024-06-15');
  calendarOverlay.onClose = () => {};
}

function handleInteraction(item) {
  if (item.interaction === 'dates' && calendarOverlay) {
    calendarOverlay.open();
    return;
  }
  console.log('Interaction:', item.interaction, item.id);
}

init();
