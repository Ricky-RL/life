import { restoreSession, supabase } from './supabase-client.js';
import { AuthManager } from './auth-manager.js';
import { TabTracker } from './tab-tracker.js';
import { NotificationManager } from './notification-manager.js';
import { MessageQueue } from './message-queue.js';
import { REALTIME_EVENTS } from '../shared/constants.js';
import { getEventsChannelName } from '../shared/supabase-helpers.js';

const authManager = new AuthManager();
const notificationManager = new NotificationManager();
const messageQueue = new MessageQueue(supabase);
let currentSession = null;
let currentPair = null;
let tabTracker = null;
let eventsChannel = null;
let channelReady = false;
let partnerActivity = null;
let popupOpen = false;
let lastNotifiedAt = null;

function sendToPopup(message) {
  if (!popupOpen) return false;
  chrome.runtime.sendMessage(message).catch(() => { popupOpen = false; });
  return true;
}

async function pollForNotifications() {
  if (popupOpen || !currentPair || !currentSession) return;
  const since = lastNotifiedAt || new Date(Date.now() - 30000).toISOString();
  try {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('pair_id', currentPair.id)
      .neq('sender_id', currentSession.user.id)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(5);
    if (data && data.length > 0) {
      lastNotifiedAt = data[data.length - 1].created_at;
      for (const msg of data) {
        await notificationManager.notify({
          type: msg.type,
          content: msg.content,
          senderName: 'Partner',
          animation: msg.type === 'heart' || msg.type === 'kiss' ? msg.type : 'speaking',
        });
      }
    }
  } catch (e) {
    console.warn('[SW] Poll failed:', e.message);
  }
}

console.log('[SW] Service worker loaded');

function initTabTracker() {
  if (!supabase || !currentPair) return;
  if (eventsChannel) {
    eventsChannel.unsubscribe();
    channelReady = false;
  }

  eventsChannel = supabase.channel(getEventsChannelName(currentPair.id));

  eventsChannel
    .on('broadcast', { event: REALTIME_EVENTS.ACTIVITY_UPDATE }, (msg) => {
      const payload = msg.payload;
      console.log('[SW] Received activity:', payload.user_id, payload.activity?.site);
      if (payload.user_id === currentSession?.user?.id) return;
      partnerActivity = payload.activity;
      sendToPopup({ type: 'PARTNER_ACTIVITY_UPDATE', activity: partnerActivity });
    })
    .on('broadcast', { event: 'new_message' }, (msg) => {
      const payload = msg.payload;
      if (payload.sender_id === currentSession?.user?.id) return;
      if (payload.type === 'heart' || payload.type === 'kiss') {
        const sent = sendToPopup({
          type: 'PARTNER_REACTION',
          data: { reaction: payload.type, sender_id: payload.sender_id },
        });
        if (!sent) {
          notificationManager.notify({ type: payload.type, senderName: 'Partner', animation: payload.type });
        }
      } else {
        const sent = sendToPopup({ type: 'NEW_MESSAGE', data: payload });
        if (!sent) {
          notificationManager.notify({
            type: payload.type,
            content: payload.content,
            senderName: 'Partner',
            animation: 'speaking',
          });
        }
      }
    })
    .on('broadcast', { event: REALTIME_EVENTS.MOOD_UPDATE }, (msg) => {
      const payload = msg.payload;
      if (payload.user_id === currentSession?.user?.id) return;
      sendToPopup({ type: 'PARTNER_MOOD_UPDATE', data: { mood: payload.mood } });
    })
    .on('broadcast', { event: 'typing' }, (msg) => {
      const payload = msg.payload;
      if (payload.user_id === currentSession?.user?.id) return;
      sendToPopup({ type: 'PARTNER_TYPING' });
    })
    .subscribe((status) => {
      console.log('[SW] Channel status:', status);
      channelReady = status === 'SUBSCRIBED';
    });

  tabTracker = new TabTracker((activity) => {
    if (eventsChannel) {
      console.log('[SW] Broadcasting:', activity.site, activity.title);
      eventsChannel.send({
        type: 'broadcast',
        event: REALTIME_EVENTS.ACTIVITY_UPDATE,
        payload: {
          user_id: currentSession?.user?.id,
          activity,
        },
      });
    }
  });

  tabTracker.onYouTubeChange = (action) => {
    if (eventsChannel) {
      eventsChannel.send({
        type: 'broadcast',
        event: 'avatar_auto_move',
        payload: {
          user_id: currentSession?.user?.id,
          target: action === 'entered' ? 'tv' : 'previous',
        },
      });
    }
  };

  tabTracker.init();
}

async function startup() {
  console.log('[SW] startup()');
  if (!currentSession) {
    currentSession = await restoreSession();
  }
  if (currentSession && !currentPair) {
    await loadPairData();
  }
  if (currentPair) {
    initTabTracker();
  }
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SW] Installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[SW] Browser startup');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    if (!currentSession || !currentPair || !channelReady) {
      startup();
    }
    pollForNotifications();
  }
});

startup();

async function loadPairData() {
  if (!currentSession) return;
  currentPair = await authManager.getPair(currentSession.user.id);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id === chrome.runtime.id && !sender.tab) {
    popupOpen = true;
    lastNotifiedAt = null;
  }
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => {
      console.error(`Error handling ${message.type}:`, err);
      sendResponse({ error: err.message });
    });
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'SIGN_IN': {
      const session = await authManager.signInWithGoogle();
      currentSession = session;
      return { session };
    }

    case 'GENERATE_CODE': {
      if (!currentSession) return { error: 'Not logged in' };
      const code = await authManager.generatePairCode(currentSession.user.id);
      return { code };
    }

    case 'CLAIM_CODE': {
      if (!currentSession) return { error: 'Not logged in' };
      try {
        const pairId = await authManager.claimPairCode(message.code, currentSession.user.id);
        await loadPairData();
        if (currentPair) {
          initTabTracker();
        }
        return { pairId };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'GET_PAIR': {
      if (!currentSession) return { pair: null };
      await loadPairData();
      if (currentPair && !tabTracker) {
        initTabTracker();
      }
      return { pair: currentPair };
    }

    case 'GET_SESSION': {
      if (!currentSession) {
        currentSession = await restoreSession();
      }
      return { session: currentSession };
    }

    case 'SIGN_OUT': {
      await authManager.signOut();
      currentSession = null;
      currentPair = null;
      return { ok: true };
    }

    case 'UNPAIR': {
      if (currentPair) {
        await authManager.unpair(currentPair.id);
        currentPair = null;
        if (eventsChannel) {
          eventsChannel.unsubscribe();
          eventsChannel = null;
        }
        tabTracker = null;
      }
      return { ok: true };
    }

    case 'TRACKING_TOGGLED': {
      if (tabTracker) {
        tabTracker.setTrackingEnabled(message.enabled);
      }
      return { ok: true };
    }

    case 'GET_PARTNER_ACTIVITY': {
      return { activity: partnerActivity };
    }

    case 'PROCESS_QUEUE': {
      if (!currentPair || !currentSession) return null;
      return messageQueue.processQueue(currentPair.id, currentSession.user.id);
    }

    case 'SEND_REACTION': {
      if (!currentPair || !currentSession) return { error: 'Not paired' };
      const reactionPayload = {
        id: `local-${Date.now()}`,
        pair_id: currentPair.id,
        sender_id: currentSession.user.id,
        type: message.reaction,
        content: null,
        created_at: new Date().toISOString(),
      };
      try {
        const { data: reactionMsg, error: rErr } = await supabase.from('messages').insert({
          pair_id: currentPair.id,
          sender_id: currentSession.user.id,
          type: message.reaction,
          content: null,
        }).select().single();
        if (!rErr && reactionMsg) Object.assign(reactionPayload, reactionMsg);
      } catch (e) {
        console.warn('[SW] DB insert failed for reaction:', e.message);
      }
      if (eventsChannel && channelReady) {
        eventsChannel.send({ type: 'broadcast', event: 'new_message', payload: reactionPayload });
      } else {
        console.warn('[SW] Channel not ready, reaction broadcast skipped');
      }
      return { error: null };
    }

    case 'SEND_TEXT': {
      if (!currentPair || !currentSession) return { error: 'Not paired' };
      const textPayload = {
        id: `local-${Date.now()}`,
        pair_id: currentPair.id,
        sender_id: currentSession.user.id,
        type: 'text',
        content: message.content,
        created_at: new Date().toISOString(),
      };
      try {
        const { data: textMsg, error: tErr } = await supabase.from('messages').insert({
          pair_id: currentPair.id,
          sender_id: currentSession.user.id,
          type: 'text',
          content: message.content,
        }).select().single();
        if (!tErr && textMsg) Object.assign(textPayload, textMsg);
      } catch (e) {
        console.warn('[SW] DB insert failed for text:', e.message);
      }
      if (eventsChannel && channelReady) {
        eventsChannel.send({ type: 'broadcast', event: 'new_message', payload: textPayload });
      } else {
        console.warn('[SW] Channel not ready, text broadcast skipped');
      }
      return { error: null, message: textPayload };
    }

    case 'FETCH_MESSAGES': {
      if (!currentPair) return { messages: [] };
      const offset = message.offset || 0;
      const limit = message.limit || 50;
      try {
        const { data, error: fErr } = await supabase
          .from('messages')
          .select('*')
          .eq('pair_id', currentPair.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        return { messages: data || [], error: fErr?.message || null };
      } catch (e) {
        console.warn('[SW] Fetch messages failed:', e.message);
        return { messages: [] };
      }
    }

    case 'MARK_READ': {
      if (!currentPair || !currentSession) return { ok: true };
      try {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('pair_id', currentPair.id)
          .eq('is_read', false)
          .neq('sender_id', currentSession.user.id);
      } catch (e) {
        console.warn('[SW] Mark read failed:', e.message);
      }
      return { ok: true };
    }

    case 'SET_MOOD': {
      if (!currentSession) return { error: 'Not logged in' };
      try {
        await supabase
          .from('users')
          .update({ mood: message.mood })
          .eq('id', currentSession.user.id);
      } catch (e) {
        console.warn('[SW] DB update failed for mood:', e.message);
      }
      if (eventsChannel && channelReady) {
        eventsChannel.send({
          type: 'broadcast',
          event: REALTIME_EVENTS.MOOD_UPDATE,
          payload: { user_id: currentSession.user.id, mood: message.mood },
        });
      } else {
        console.warn('[SW] Channel not ready, mood broadcast skipped');
      }
      return { ok: true };
    }

    case 'POPUP_CLOSED': {
      popupOpen = false;
      lastNotifiedAt = new Date().toISOString();
      if (currentSession) {
        await supabase
          .from('users')
          .update({ is_online: false, last_seen_at: new Date().toISOString() })
          .eq('id', currentSession.user.id);
      }
      return { ok: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
