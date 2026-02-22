import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assertEnv } from './utils.js';

const env = window.__ENV__ ?? {};

const config = {
  url: env.PUBLIC_SUPABASE_URL || window.localStorage.getItem('PUBLIC_SUPABASE_URL') || '',
  anonKey: env.PUBLIC_SUPABASE_ANON_KEY || window.localStorage.getItem('PUBLIC_SUPABASE_ANON_KEY') || '',
};

assertEnv('PUBLIC_SUPABASE_URL', config.url);
assertEnv('PUBLIC_SUPABASE_ANON_KEY', config.anonKey);

export const supabase = config.url && config.anonKey ? createClient(config.url, config.anonKey) : null;

function getRedirectUrl() {
  return window.location.origin;
}

export async function signInWithMagicLink(email) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: getRedirectUrl() } });
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getRedirectUrl() },
  });
}

export async function signInWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function setAccountPassword(password) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.updateUser({ password });
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return { data: { session: null } };
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback) {
  if (!supabase) {
    return { data: { subscription: { unsubscribe() {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
}

export async function getProfile(userId) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.from('profiles').select('id, username, theme, title').eq('id', userId).maybeSingle();
}

export async function upsertProfile(profile) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.from('profiles').upsert(profile, { onConflict: 'id' }).select('id, username, theme, title').single();
}

export async function fetchSeasonLeaderboard() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase
    .from('public_leaderboard_view')
    .select('season_id, season_name, user_id, username, best_score, updated_at, has_crown')
    .order('best_score', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(50);
}

export async function fetchActiveSeason() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase
    .from('seasons')
    .select('id, name, starts_at, ends_at')
    .eq('is_active', true)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function startRun() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.functions.invoke('startRun', { body: {} });
}

export async function submitRun(payload) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.functions.invoke('submitRun', { body: payload });
}
