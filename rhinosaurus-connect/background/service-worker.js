import { restoreSession } from './supabase-client.js';
import { AuthManager } from './auth-manager.js';

const authManager = new AuthManager();
let currentSession = null;
let currentPair = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Rhinosaurus Connect installed');
});

chrome.runtime.onStartup.addListener(async () => {
  currentSession = await restoreSession();
  if (currentSession) {
    await loadPairData();
  }
});

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
        return { pairId };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'GET_PAIR': {
      if (!currentSession) return { pair: null };
      await loadPairData();
      return { pair: currentPair };
    }

    case 'GET_SESSION': {
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
      }
      return { ok: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
