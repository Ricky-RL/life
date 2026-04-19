import { restoreSession, supabase } from './supabase-client.js';
import { AuthManager } from './auth-manager.js';
import { TabTracker } from './tab-tracker.js';
import { REALTIME_EVENTS } from '../shared/constants.js';
import { getEventsChannelName } from '../shared/supabase-helpers.js';

const authManager = new AuthManager();
let currentSession = null;
let currentPair = null;
let tabTracker = null;
let eventsChannel = null;
let partnerActivity = null;

console.log('[SW] Service worker loaded');

function initTabTracker() {
  if (!supabase || !currentPair) return;
  if (eventsChannel) {
    eventsChannel.unsubscribe();
  }

  eventsChannel = supabase.channel(getEventsChannelName(currentPair.id));

  eventsChannel
    .on('broadcast', { event: REALTIME_EVENTS.ACTIVITY_UPDATE }, (msg) => {
      const payload = msg.payload;
      console.log('[SW] Received activity:', payload.user_id, payload.activity?.site);
      if (payload.user_id === currentSession?.user?.id) return;
      partnerActivity = payload.activity;
      chrome.runtime.sendMessage({
        type: 'PARTNER_ACTIVITY_UPDATE',
        activity: partnerActivity,
      }).catch(() => {});
    })
    .subscribe((status) => {
      console.log('[SW] Channel status:', status);
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
    chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SW] Installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[SW] Browser startup');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    console.log('[SW] Keepalive tick');
  }
});

startup();

async function loadPairData() {
  if (!currentSession) return;
  currentPair = await authManager.getPair(currentSession.user.id);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

    default:
      return { error: 'Unknown message type' };
  }
}
