import { AuthUI } from './auth.js';
import { RoomRenderer } from './room/room-renderer.js';
import { RoomState } from './room/room-state.js';
import { DateService } from './calendar/date-service.js';
import { CalendarOverlay } from './calendar/calendar-overlay.js';
import { CalendarGlow } from './room/calendar-glow.js';
import { EditModeController } from './room/edit-mode.js';
import { CustomizationPanel } from './room/customization-panel.js';
import { FurnitureCatalog } from './room/furniture-catalog.js';
import { ColorTinter } from './room/color-tinter.js';
import { AvatarAnimator } from './room/avatar-animator.js';
import { AvatarController } from './room/avatar-controller.js';
import { TVDisplay } from './room/tv-display.js';
import { TVOverlay } from './room/tv-overlay.js';
import { AVATAR_SIZE, AVATAR_RENDER_SCALE } from '../shared/constants.js';

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
let tvDisplay = null;
let tvOverlay = null;

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
  const catalog = new FurnitureCatalog();
  const tinter = new ColorTinter();

  let editMode = null;
  let customPanel = null;

  renderer.addEffect({
    draw(ctx) {
      const cal = roomState.furniture.find(f => f.type === 'calendar');
      if (cal) calendarGlow.draw(ctx, cal.x, cal.y, performance.now());
      if (calendarGlow.isActive) renderer.markDirty();
    },
  });

  tvDisplay = new TVDisplay();
  renderer.addEffect({
    draw(ctx) {
      const tvItem = roomState.furniture.find(f => f.type === 'tv');
      if (tvItem && tvDisplay) {
        tvDisplay.draw(ctx, tvItem.x + 4, tvItem.y + 4, 40, 28);
        renderer.markDirty();
      }
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

  function setupCustomization() {
    editMode = new EditModeController(roomState, {
      broadcastFurnitureMove: () => {},
      broadcastFurnitureChange: () => {},
      scheduleSave: () => {},
    });

    renderer.editModeController = editMode;

    const panelContainer = document.createElement('div');
    panelContainer.id = 'customization-panel';
    document.getElementById('room-screen').appendChild(panelContainer);
    customPanel = new CustomizationPanel(panelContainer);
    customPanel.setCatalog(catalog);

    editMode.onSelectionChange = (selectedId) => {
      if (!selectedId) {
        customPanel.hide();
        renderer.markDirty();
        return;
      }
      const item = roomState.furniture.find(f => f.id === selectedId);
      if (item) {
        customPanel.show(item, roomState.isEssential(selectedId));
      }
      renderer.markDirty();
    };

    editMode.onModeChange = () => {
      renderer.markDirty();
    };

    customPanel.onColorChange = (color) => {
      editMode.changeColor(color);
      renderer.markDirty();
    };

    customPanel.onRemove = (id) => {
      editMode.removeItem(id);
      customPanel.hide();
      renderer.markDirty();
    };

    customPanel.onAddItem = (item) => {
      editMode.addItem(item);
      renderer.markDirty();
    };
  }

  setupCustomization();

  function addPlaceholderAvatar(id, color, startX, startY) {
    const animator = new AvatarAnimator();
    const w = AVATAR_SIZE.width * AVATAR_RENDER_SCALE;
    const h = AVATAR_SIZE.height * AVATAR_RENDER_SCALE;
    animator.draw = (ctx, x, y, scale) => {
      const sw = AVATAR_SIZE.width * scale;
      const sh = AVATAR_SIZE.height * scale;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + sw / 2, y + sh * 0.3, sw * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + sw * 0.2, y + sh * 0.5, sw * 0.6, sh * 0.45);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + sw * 0.38, y + sh * 0.27, 3, 0, Math.PI * 2);
      ctx.arc(x + sw * 0.62, y + sh * 0.27, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(x + sw * 0.38, y + sh * 0.27, 1.5, 0, Math.PI * 2);
      ctx.arc(x + sw * 0.62, y + sh * 0.27, 1.5, 0, Math.PI * 2);
      ctx.fill();
    };
    const controller = new AvatarController(id);
    controller.setPosition(startX, startY);
    renderer.addAvatar(id, animator, controller);
    return controller;
  }

  const myAvatar = addPlaceholderAvatar('me', '#E8A0BF', 100, 280);
  const partnerAvatar = addPlaceholderAvatar('partner', '#A0C4E8', 180, 280);

  canvas.addEventListener('click', (e) => {
    const { x, y } = canvasCoords(e);

    if (editMode && editMode.isEditMode) {
      const hit = renderer.hitTestAll(x, y);
      if (hit) {
        editMode.select(hit.id);
      } else {
        editMode.select(null);
      }
      return;
    }

    const hit = renderer.hitTest(x, y);
    if (hit) {
      handleInteraction(hit);
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!editMode || !editMode.isEditMode || !editMode.selectedId) return;
    const { x, y } = canvasCoords(e);
    const hit = renderer.hitTestAll(x, y);
    if (hit && hit.id === editMode.selectedId) {
      editMode.startDrag(x, y);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const { x, y } = canvasCoords(e);
    if (editMode && editMode.isDragging) {
      editMode.drag(x, y);
      renderer.markDirty();
      return;
    }
    renderer.handleMouseMove(x, y);
  });

  canvas.addEventListener('mouseup', () => {
    if (editMode && editMode.isDragging) {
      editMode.endDrag();
      renderer.markDirty();
    }
  });

  const settingsBtn = document.getElementById('settings-btn');
  const roomScreen = document.getElementById('room-screen');
  let editBanner = null;

  function updateEditModeUI(active) {
    settingsBtn.classList.toggle('edit-active', active);
    settingsBtn.title = active ? 'Exit Edit Mode' : 'Customize Room';
    if (active) {
      if (!editBanner) {
        editBanner = document.createElement('div');
        editBanner.id = 'edit-mode-banner';
        editBanner.textContent = 'EDIT MODE — tap items to customize';
        roomScreen.appendChild(editBanner);
      }
    } else if (editBanner) {
      editBanner.remove();
      editBanner = null;
    }
  }

  document.getElementById('settings-btn').addEventListener('click', () => {
    if (editMode) {
      if (editMode.isEditMode) {
        editMode.exit();
        customPanel.hide();
      } else {
        editMode.enter();
      }
      updateEditModeUI(editMode.isEditMode);
      renderer.markDirty();
    }
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
  setupCalendarMock();
  setupActivityMock();
}

function setupActivityMock() {
  if (!tvDisplay) return;

  const mockActivities = [
    { site: 'YouTube', title: 'Lo-fi hip hop beats to study to' },
    { site: 'Reddit', title: 'r/cozyplaces - My reading nook' },
    { site: 'Spotify', title: 'Chill Vibes Playlist' },
    { site: 'Netflix', title: 'Watching: Our Planet' },
    { site: 'Twitter', title: 'Home Timeline' },
  ];

  for (let i = mockActivities.length - 1; i >= 0; i--) {
    tvDisplay.addToHistory({ ...mockActivities[i], timestamp: Date.now() - (i + 1) * 120000 });
  }

  tvDisplay.setPartnerState({
    isOnline: true,
    activity: mockActivities[0],
  });
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
  if (item.interaction === 'activity' && tvDisplay) {
    const overlayContainer = document.getElementById('overlay-container');
    if (!tvOverlay) {
      tvOverlay = new TVOverlay(overlayContainer, tvDisplay, () => {
        console.log('Join & Watch Together (not yet implemented)');
      });
    }
    tvOverlay.show();
    return;
  }
  console.log('Interaction:', item.interaction, item.id);
}

async function boot() {
  const authUI = new AuthUI((screen) => {
    showScreen(screen);
    if (screen === 'room') {
      init();
    }
  });
  authUI.init();

  try {
    const { session } = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    if (session) {
      const { pair } = await chrome.runtime.sendMessage({ type: 'GET_PAIR' });
      if (pair) {
        showScreen('room');
        init();
      } else {
        showScreen('pairing');
      }
    } else {
      showScreen('login');
    }
  } catch (err) {
    console.error('Boot session check failed:', err);
    showScreen('login');
  }
}

boot();
