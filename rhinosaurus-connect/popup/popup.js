import { AuthUI } from './auth.js';
import { RoomRenderer } from './room/room-renderer.js';
import { RoomState } from './room/room-state.js';
import { SpriteLoader } from './room/sprite-loader.js';
import { DateService } from './calendar/date-service.js';
import { CalendarOverlay } from './calendar/calendar-overlay.js';
import { CalendarGlow } from './room/calendar-glow.js';
import { EditModeController } from './room/edit-mode.js';
import { CustomizationPanel } from './room/customization-panel.js';
import { FurnitureCatalog } from './room/furniture-catalog.js';
import { AvatarAnimator } from './room/avatar-animator.js';
import { AvatarController } from './room/avatar-controller.js';
import { TVDisplay } from './room/tv-display.js';
import { TVOverlay } from './room/tv-overlay.js';
import { ChatOverlay } from './chat/chat-overlay.js';
import { MessageService } from './chat/message-service.js';
import { TypingIndicator } from './chat/typing-indicator.js';
import { PhoneGlow } from './room/phone-glow.js';
import { ReactionHandler } from './room/reaction-handler.js';
import { ReactionParticleSystem } from './room/reaction-particles.js';
import { MoodDropdown } from './mood/mood-dropdown.js';
import { MoodBubble } from './mood/mood-bubble.js';
import { MoodHandler } from './mood/mood-handler.js';
import { SoundManager } from '../shared/sound-manager.js';
import { AVATAR_SIZE, AVATAR_RENDER_SCALE, MOOD_OPTIONS } from '../shared/constants.js';

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
const soundManager = new SoundManager();
const phoneGlow = new PhoneGlow();
const particleSystem = new ReactionParticleSystem();
let chatOverlay = null;
let messageService = null;
let typingIndicator = null;
let reactionHandler = null;
let moodDropdown = null;
let moodHandler = null;
const moodBubbles = new Map();

async function setupCalendar(anniversaryDate) {
  dateService = new DateService();
  const overlayContainer = document.getElementById('overlay-container');
  calendarOverlay = new CalendarOverlay(overlayContainer, dateService, anniversaryDate);

  const dates = await dateService.fetchDates();
  const milestones = [
    ...dateService.checkAnniversaryMilestones(anniversaryDate),
    ...dateService.checkDateMilestones(dates),
  ];
  calendarGlow.setMilestones(milestones);
}

async function init(sessionData) {
  const canvas = document.getElementById('room-canvas');
  const roomState = new RoomState();
  const renderer = new RoomRenderer(canvas, roomState);
  const catalog = new FurnitureCatalog();

  const spriteLoader = new SpriteLoader();

  function spriteUrl(filename) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(`assets/sprites/${filename}`);
    }
    return `../assets/sprites/${filename}`;
  }

  const spriteManifest = [
    ['bed', 'double-wood', 'bed-double-wood.png'],
    ['tv', 'crt', 'tv-crt.png'],
    ['desk', 'wooden', 'desk-wooden.png'],
    ['calendar', 'default', 'calendar-default.png'],
    ['makeup_stand', 'default', 'makeup-stand-default.png'],
    ['window', 'default', 'window-default.png'],
    ['nightstand', 'wooden', 'nightstand-wooden.png'],
    ['nightstand', 'wooden-2', 'nightstand-wooden-2.png'],
    ['rug', 'round', 'rug-round.png'],
    ['bookshelf', 'default', 'bookshelf.png'],
    ['plant', 'potted', 'plant-potted.png'],
    ['plant', 'hanging', 'plant-hanging.png'],
    ['plant', 'succulent', 'plant-succulent.png'],
    ['photo_frame', 'default', 'photo-frame.png'],
    ['misc', 'plushie', 'plushie.png'],
    ['misc', 'candles', 'candles.png'],
    ['misc', 'pet_bed', 'pet-bed.png'],
    ['flowers', 'vase', 'flowers-vase.png'],
    ['poster', 'default', 'poster.png'],
    ['rug', 'rectangular', 'rug-rectangular.png'],
    ['curtains', 'solid', 'curtains-solid.png'],
    ['wall_shelf', 'default', 'wall-shelf.png'],
    ['misc', 'books', 'book-stack.png'],
    ['lamp', 'floor', 'floor-lamp.png'],
  ];

  await Promise.all(
    spriteManifest.map(([type, variant, file]) =>
      spriteLoader.loadSprite(type, variant, spriteUrl(file)).catch(() => {
        console.warn(`Failed to load sprite: ${file}`);
      })
    )
  );

  renderer.setSpriteLoader(spriteLoader);

  let editMode = null;
  let customPanel = null;

  const userBar = document.getElementById('user-bar');
  if (sessionData?.session?.user) {
    const user = sessionData.session.user;
    const name = user.user_metadata?.full_name || user.email || 'signed in';
    userBar.textContent = name;
    userBar.classList.remove('hidden');
  }

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

  function applyActivity(activity) {
    if (!activity) {
      tvDisplay.setPartnerState({ isOnline: false });
    } else if (activity.idle) {
      tvDisplay.setPartnerState({ isOnline: true, idle: true });
    } else if (activity.trackingPaused) {
      tvDisplay.setPartnerState({ isOnline: true, trackingPaused: true });
    } else if (activity.site) {
      tvDisplay.setPartnerState({ isOnline: true, activity });
    } else {
      tvDisplay.setPartnerState({ isOnline: true });
    }
    if (tvOverlay?.element) {
      tvOverlay.show();
    }
  }

  chrome.runtime.sendMessage({ type: 'GET_PARTNER_ACTIVITY' }).then((res) => {
    if (res?.activity) applyActivity(res.activity);
  }).catch(() => {});

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PARTNER_ACTIVITY_UPDATE') {
      applyActivity(message.activity);
    }
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

  function addSpriteAvatar(id, spriteUrl, startX, startY) {
    const animator = new AvatarAnimator();
    const avatarImg = new Image();
    avatarImg.src = spriteUrl;
    avatarImg.onload = () => {
      const aspect = avatarImg.naturalWidth / avatarImg.naturalHeight;
      animator.draw = (ctx, x, y) => {
        const drawH = 75;
        const drawW = drawH * aspect;
        ctx.drawImage(avatarImg, 0, 0, avatarImg.naturalWidth, avatarImg.naturalHeight, x, y, drawW, drawH);
      };
      renderer.markDirty();
    };
    animator.draw = (ctx, x, y) => {
      ctx.fillStyle = '#ccc';
      ctx.fillRect(x, y, 28, 75);
    };
    const controller = new AvatarController(id);
    controller.setPosition(startX, startY);
    renderer.addAvatar(id, animator, controller);
    return controller;
  }

  function addPlaceholderAvatar(id, color, startX, startY) {
    const animator = new AvatarAnimator();
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

  const myAvatar = addSpriteAvatar('me', spriteUrl('avatar-male.png'), 130, 310);
  const partnerAvatar = addSpriteAvatar('partner', spriteUrl('avatar-female.png'), 175, 310);
  let draggingAvatar = null;

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
    const { x, y } = canvasCoords(e);

    if (editMode && editMode.isEditMode) {
      if (!editMode.selectedId) return;
      const hit = renderer.hitTestAll(x, y);
      if (hit && hit.id === editMode.selectedId) {
        editMode.startDrag(x, y);
      }
      return;
    }

    if (myAvatar.hitTest(x, y, AVATAR_RENDER_SCALE)) {
      draggingAvatar = myAvatar;
      myAvatar.startDrag(x, y);
      return;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const { x, y } = canvasCoords(e);

    if (draggingAvatar) {
      const sw = AVATAR_SIZE.width * AVATAR_RENDER_SCALE;
      const sh = AVATAR_SIZE.height * AVATAR_RENDER_SCALE;
      draggingAvatar.drag(x - sw / 2, y - sh / 2);
      renderer.markDirty();
      return;
    }

    if (editMode && editMode.isDragging) {
      editMode.drag(x, y);
      renderer.markDirty();
      return;
    }
    renderer.handleMouseMove(x, y);
  });

  canvas.addEventListener('mouseup', () => {
    if (draggingAvatar) {
      draggingAvatar.endDrag();
      draggingAvatar = null;
      renderer.markDirty();
      return;
    }
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

  document.getElementById('heart-btn').addEventListener('click', async () => {
    if (reactionHandler) {
      await reactionHandler.sendHeart();
      particleSystem.spawnHearts(myAvatar.x + 40, myAvatar.y);
      renderer.markDirty();
      soundManager.play('heart');
    }
  });

  document.getElementById('kiss-btn').addEventListener('click', async () => {
    if (reactionHandler) {
      await reactionHandler.sendKiss();
      particleSystem.spawnKiss(myAvatar.x + 40, myAvatar.y, partnerAvatar.x + 40, partnerAvatar.y);
      renderer.markDirty();
      soundManager.play('kiss');
    }
  });

  document.getElementById('mood-btn').addEventListener('click', () => {
    if (moodDropdown) moodDropdown.toggle();
  });

  document.getElementById('chat-btn').addEventListener('click', () => {
    if (chatOverlay) {
      chatOverlay.open();
      phoneGlow.dismiss();
      renderer.markDirty();
    }
  });

  renderer.startRenderLoop();

  renderer.addEffect({
    draw(ctx) {
      particleSystem.update();
      particleSystem.draw(ctx);
      if (particleSystem.isActive()) renderer.markDirty();
    },
  });

  renderer.addEffect({
    draw(ctx) {
      const desk = roomState.furniture.find(f => f.type === 'desk');
      if (desk) phoneGlow.draw(ctx, desk.x, desk.y, performance.now());
      if (phoneGlow.isActive) renderer.markDirty();
    },
  });

  renderer.addEffect({
    draw(ctx) {
      for (const [userId, bubble] of moodBubbles) {
        const avatar = renderer.avatars.get(userId);
        if (avatar) {
          bubble.update(16);
          bubble.draw(ctx, avatar.controller.x, avatar.controller.y, bubble.currentMood);
          if (bubble.transitioning) renderer.markDirty();
        }
      }
    },
  });

  await soundManager.init();
  const userId = sessionData?.session?.user?.id || 'me';
  setupChat(renderer, userId);
  setupMood(renderer, userId);
  setupReactions(renderer);

  const anniversaryDate = sessionData?.pair?.anniversary_date || null;
  await setupCalendar(anniversaryDate);

  setupCalendarMock();
}

function setupChat(renderer, userId) {
  const overlayContainer = document.getElementById('overlay-container');

  const swMessageService = {
    async sendText(content) {
      const res = await chrome.runtime.sendMessage({ type: 'SEND_TEXT', content });
      if (res?.error) throw new Error(res.error);
      return res.message || { id: String(Date.now()), type: 'text', content, sender_id: userId, created_at: new Date().toISOString() };
    },
    async sendReaction(reactionType) {
      await chrome.runtime.sendMessage({ type: 'SEND_REACTION', reaction: reactionType });
    },
    async fetchMessages(offset, limit) {
      const res = await chrome.runtime.sendMessage({ type: 'FETCH_MESSAGES', offset, limit });
      return res?.messages || [];
    },
    async markAsRead() {
      await chrome.runtime.sendMessage({ type: 'MARK_READ' });
    },
    formatPreview(content, type = 'text') {
      if (type === 'heart') return '❤️';
      if (type === 'kiss') return '💋';
      if (type === 'image') return 'Sent you a photo 📷';
      if (!content) return '';
      return content.length > 80 ? content.substring(0, 80) + '...' : content;
    },
  };

  messageService = swMessageService;
  chatOverlay = new ChatOverlay(overlayContainer, swMessageService, userId);
  chatOverlay.onClose = () => {
    phoneGlow.dismiss();
    renderer.markDirty();
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'NEW_MESSAGE') {
      const msg = message.data;
      if (msg.sender_id === userId) return;
      if (chatOverlay && chatOverlay.isOpen) {
        chatOverlay.onIncomingMessage(msg);
      } else {
        phoneGlow.onNewMessage();
        renderer.markDirty();
        soundManager.play('message');
      }
    }
    if (message.type === 'PARTNER_REACTION') {
      const { reaction, sender_id } = message.data;
      if (sender_id === userId) return;
      const partnerAvatarData = renderer.avatars.get('partner');
      if (partnerAvatarData && reactionHandler) {
        reactionHandler.onReceiveReaction(
          reaction,
          partnerAvatarData.animator,
          partnerAvatarData.bubbleQueue,
          partnerAvatarData.controller.x,
          partnerAvatarData.controller.y,
          renderer.avatars.get('me')?.controller.x,
          renderer.avatars.get('me')?.controller.y
        );
        renderer.markDirty();
        soundManager.play(reaction);
      }
    }
    if (message.type === 'PARTNER_MOOD_UPDATE') {
      const { mood } = message.data;
      let bubble = moodBubbles.get('partner');
      if (!bubble) {
        bubble = new MoodBubble();
        moodBubbles.set('partner', bubble);
      }
      bubble.setMood(mood);
      renderer.markDirty();
    }
    if (message.type === 'PARTNER_TYPING') {
      if (typingIndicator) typingIndicator.onPartnerTyping();
    }
  });
}

function setupMood(renderer, userId) {
  const toolbar = document.getElementById('toolbar');
  moodDropdown = new MoodDropdown(toolbar);
  moodDropdown.render();
  moodDropdown.onSelect = async (mood) => {
    const moodIcon = document.getElementById('mood-icon');
    const option = MOOD_OPTIONS.find(m => m.key === mood);
    moodIcon.textContent = option ? option.emoji : '😶';
    let bubble = moodBubbles.get('me');
    if (!bubble) {
      bubble = new MoodBubble();
      moodBubbles.set('me', bubble);
    }
    bubble.setMood(mood);
    renderer.markDirty();
    await chrome.runtime.sendMessage({ type: 'SET_MOOD', mood });
  };
}

function setupReactions(renderer) {
  const swReactionService = {
    async sendReaction(type) {
      await chrome.runtime.sendMessage({ type: 'SEND_REACTION', reaction: type });
    },
  };
  reactionHandler = new ReactionHandler(swReactionService, particleSystem);
}

function setupCalendarMock() {
  const dates = [
    { id: '1', label: 'Next Visit', date: '2026-05-10', is_countdown: true, is_recurring: false },
    { id: '2', label: 'Her Birthday', date: '2025-08-22', is_countdown: true, is_recurring: true },
    { id: '3', label: 'First Date', date: '2024-06-15', is_countdown: false, is_recurring: false },
  ];

  const mockService = {
    fetchDates: () => Promise.resolve([...dates]),
    addDate: (label, date, isCountdown, isRecurring) => {
      const newDate = { id: String(Date.now()), label, date, is_countdown: isCountdown, is_recurring: isRecurring };
      dates.push(newDate);
      return Promise.resolve(newDate);
    },
    deleteDate: (id) => {
      const idx = dates.findIndex(d => d.id === id);
      if (idx !== -1) dates.splice(idx, 1);
      return Promise.resolve();
    },
    updateDate: (id, changes) => {
      const idx = dates.findIndex(d => d.id === id);
      if (idx !== -1) Object.assign(dates[idx], changes);
      return Promise.resolve();
    },
    getAnniversaryDays: (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null,
    sortDates: (list) => {
      const now = new Date();
      const upcoming = [];
      const past = [];
      for (const d of list) {
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
  if (item.interaction === 'chat' && chatOverlay) {
    chatOverlay.open();
    phoneGlow.dismiss();
    return;
  }
  if (item.interaction === 'dates' && calendarOverlay) {
    calendarOverlay.open();
    return;
  }
  if (item.interaction === 'activity' && tvDisplay) {
    const overlayContainer = document.getElementById('overlay-container');
    if (!tvOverlay) {
      tvOverlay = new TVOverlay(overlayContainer, tvDisplay, () => {
        const activity = tvDisplay.partnerState.activity;
        if (activity?.youtubeVideoId) {
          window.open(`https://www.youtube.com/watch?v=${activity.youtubeVideoId}`, '_blank');
        }
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
      bootRoom();
    }
  });
  authUI.init();

  try {
    const { session } = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    if (session) {
      const { pair } = await chrome.runtime.sendMessage({ type: 'GET_PAIR' });
      if (pair) {
        showScreen('room');
        init({ session, pair });
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

async function bootRoom() {
  try {
    const { session } = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    const { pair } = await chrome.runtime.sendMessage({ type: 'GET_PAIR' });
    init({ session, pair });
  } catch (err) {
    console.error('Failed to load session for room:', err);
    init();
  }
}

boot();

window.addEventListener('unload', () => {
  chrome.runtime.sendMessage({ type: 'POPUP_CLOSED' }).catch(() => {});
});
