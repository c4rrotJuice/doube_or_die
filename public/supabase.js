import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assertEnv } from './utils.js';

const config = {
  url: window.__ENV__?.PUBLIC_SUPABASE_URL ?? '',
  anonKey: window.__ENV__?.PUBLIC_SUPABASE_ANON_KEY ?? '',
};

assertEnv('PUBLIC_SUPABASE_URL', config.url);
assertEnv('PUBLIC_SUPABASE_ANON_KEY', config.anonKey);

export const supabase = config.url && config.anonKey ? createClient(config.url, config.anonKey) : null;

export async function signInWithMagicLink(email) {
  if (!supabase) throw new Error('Supabase is not configured.');
  // TODO: move email collection and redirect URL to a dedicated auth modal.
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return { data: { session: null } };
  return supabase.auth.getSession();
}

export async function fetchLeaderboard() {
  if (!supabase) throw new Error('Supabase is not configured.');
  // TODO: consider switching to direct view reads once schema is stable.
  return supabase.functions.invoke('getLeaderboard', { body: {} });
}

export async function startRun() {
  if (!supabase) throw new Error('Supabase is not configured.');
  // TODO: call before game loop starts.
  return supabase.functions.invoke('startRun', { body: {} });
}

export async function submitRun(payload) {
  if (!supabase) throw new Error('Supabase is not configured.');
  // TODO: attach client digest once gameplay is implemented.
  return supabase.functions.invoke('submitRun', { body: payload });
}
