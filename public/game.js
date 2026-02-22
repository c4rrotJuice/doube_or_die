import { GameEngine } from './game-logic.js';
import {
  animateCrash,
  applySettings,
  createToastSystem,
  renderAuthState,
  renderGame,
  setupAuthModal,
  setupHowToPlayModal,
  setupKeyboardSupport,
  setupProfileOnboardingModal,
  setupSettingsUI,
} from './ui.js';
import { loadSettings, loadStats, saveSettings, saveStats, updateStatsForRun } from './storage.js';
import {
  getProfile,
  getSession,
  onAuthStateChange,
  setAccountPassword,
  signInWithGoogle,
  signInWithMagicLink,
  signInWithPassword,
  signOut,
  supabase,
  upsertProfile,
} from './supabase.js';

const doubleBtn = document.querySelector('#doubleBtn');
const cashOutBtn = document.querySelector('#cashOutBtn');
const signOutBtn = document.querySelector('#signOutBtn');

const game = new GameEngine();
const toasts = createToastSystem();
const helpModal = setupHowToPlayModal();
let stats = loadStats();
let settings = loadSettings();
let previousSnapshot = null;
let authState = { user: null, profile: null };

const authModal = setupAuthModal({
  async magicLink(email) {
    if (!email) {
      toasts.show('warning', 'Enter an email to receive a magic link.');
      return;
    }

    const { error } = await signInWithMagicLink(email);
    if (error) {
      toasts.show('error', error.message);
      return;
    }

    toasts.show('success', 'Magic link sent. Check your inbox.');
    authModal.close();
  },
  async password(email, password) {
    if (!email || !password) {
      toasts.show('warning', 'Enter your email and password.');
      return;
    }

    const { error } = await signInWithPassword(email, password);
    if (error) {
      toasts.show('error', error.message);
      return;
    }

    toasts.show('success', 'Signed in successfully.');
    authModal.close();
  },
  async google() {
    const { error } = await signInWithGoogle();
    if (error) {
      toasts.show('error', error.message);
    }
  },
});

const profileModal = setupProfileOnboardingModal({
  async submit({ username, theme, password }) {
    if (!authState.user) {
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      toasts.show('warning', 'Username must be 3-24 chars using letters, numbers, or _.');
      return;
    }

    if (password && password.length < 8) {
      toasts.show('warning', 'Password must be at least 8 characters.');
      return;
    }

    const { data, error } = await upsertProfile({
      id: authState.user.id,
      username,
      theme,
    });

    if (error) {
      if (error.code === '23505') {
        toasts.show('error', 'That username is already taken.');
      } else {
        toasts.show('error', error.message);
      }
      return;
    }

    if (password) {
      const { error: passwordError } = await setAccountPassword(password);
      if (passwordError) {
        toasts.show('error', `Profile saved, but password update failed: ${passwordError.message}`);
      }
    }

    authState = { ...authState, profile: data };
    settings = { ...settings, theme: data.theme };
    saveSettings(settings);
    profileModal.close();
    syncUI();
    toasts.show('success', 'Profile saved.');
  },
});

function syncUI() {
  applySettings(settings);
  renderAuthState(authState);
  const snapshot = game.snapshot();
  renderGame(snapshot, stats, previousSnapshot);
  previousSnapshot = snapshot;
}

async function syncAuthState(sessionUser) {
  if (!sessionUser) {
    authState = { user: null, profile: null };
    syncUI();
    return;
  }

  const { data: profile, error } = await getProfile(sessionUser.id);
  if (error) {
    toasts.show('error', error.message);
  }

  authState = { user: sessionUser, profile: profile ?? null };

  if (profile?.theme) {
    settings = { ...settings, theme: profile.theme };
    saveSettings(settings);
  }

  syncUI();

  if (!profile) {
    profileModal.open();
  }
}

function handleRunEnd(snapshotBefore, snapshotAfter) {
  if (snapshotBefore.phase === 'RUNNING' && snapshotAfter.phase === 'SUMMARY') {
    stats = updateStatsForRun(stats, snapshotAfter);
    saveStats(stats);
  }

  if (snapshotBefore.phase === 'RUNNING' && snapshotAfter.phase === 'SUMMARY' && snapshotAfter.outcome === 'crashed') {
    animateCrash();
    toasts.show('error', 'Crash! Run ended with no banked multiplier.');
  }

  if (snapshotBefore.phase === 'RUNNING' && snapshotAfter.phase === 'SUMMARY' && snapshotAfter.outcome === 'cashed_out') {
    toasts.show('success', `Cashed out at x${snapshotAfter.value}.`);
  }
}

function onDouble() {
  const before = game.snapshot();
  const after = game.doubleDown();
  handleRunEnd(before, after);

  if (after.phase === 'RUNNING' && after.nextCrashChance >= 0.7) {
    toasts.show('warning', `High risk: ${Math.round(after.nextCrashChance * 100)}% crash chance next DOUBLE.`, 1800);
  }

  syncUI();
}

function onCashOut() {
  const before = game.snapshot();
  const after = game.cashOut();
  handleRunEnd(before, after);
  syncUI();
}

doubleBtn.addEventListener('click', onDouble);
cashOutBtn.addEventListener('click', onCashOut);
signOutBtn.addEventListener('click', async () => {
  const { error } = await signOut();
  if (error) {
    toasts.show('error', error.message);
    return;
  }
  toasts.show('success', 'Signed out.');
});

setupKeyboardSupport({
  double: onDouble,
  cashOut: onCashOut,
  openHelp: helpModal.open,
  closeHelp: helpModal.close,
});

setupSettingsUI(settings, (nextSettings) => {
  settings = nextSettings;
  saveSettings(settings);

  if (authState.user && authState.profile) {
    upsertProfile({
      id: authState.user.id,
      username: authState.profile.username,
      theme: settings.theme,
    }).then(({ data }) => {
      authState = { ...authState, profile: data ?? authState.profile };
      syncUI();
    });
  }

  syncUI();
});

async function bootstrapAuth() {
  if (!supabase) {
    syncUI();
    return;
  }

  const { data } = await getSession();
  await syncAuthState(data.session?.user ?? null);

  onAuthStateChange(async (_event, session) => {
    await syncAuthState(session?.user ?? null);
  });
}

bootstrapAuth();
syncUI();
