export const SUPABASE_URL = 'https://qgpvetskinbghlimcwkb.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_oncL8niGrC0aC7MsbnYcGw_2w-Ff8F-';

export function getPresenceChannelName(pairId) {
  return `pair:${pairId}`;
}

export function getEventsChannelName(pairId) {
  return `pair:${pairId}:events`;
}
