import { restoreSession } from './supabase-client.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Rhinosaurus Connect installed');
});

chrome.runtime.onStartup.addListener(async () => {
  await restoreSession();
});
