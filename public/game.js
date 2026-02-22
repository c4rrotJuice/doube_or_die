import { GameEngine } from './game-logic.js';
import {
  animateCrash,
  applySettings,
  createToastSystem,
  renderAuthState,
  renderGame,
  renderLeaderboard,
  renderSocialFeed,
  buildShareCopyTemplate,
  setupAuthModal,
  setupHowToPlayModal,
  setupKeyboardSupport,
  setupProfileOnboardingModal,
  setupSettingsUI,
} from './ui.js';
import { loadSettings, loadStats, saveSettings, saveStats, updateStatsForRun } from './storage.js';
import {
  fetchActiveSeason,
  fetchSocialEvents,
  fetchPlayerSeasonRank,
  fetchSeasonLeaderboard,
  getProfile,
  getSession,
  onAuthStateChange,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  startRun,
  submitRun,
  supabase,
  upsertProfile,
} from './supabase.js';

const doubleBtn = document.querySelector('#doubleBtn');
const cashOutBtn = document.querySelector('#cashOutBtn');
const signOutBtn = document.querySelector('#signOutBtn');
const shareScoreBtn = document.querySelector('#shareScoreBtn');

const game = new GameEngine();
const toasts = createToastSystem();
const helpModal = setupHowToPlayModal();
let stats = loadStats();
let settings = loadSettings();
let previousSnapshot = null;
let authState = { user: null, profile: null };


const LEADERBOARD_CACHE_MS = 45_000;
let leaderboardState = null;
let leaderboardCache = { loadedAt: 0, userId: null, payload: null };
let leaderboardRefreshTimer = null;
let countdownTimer = null;
let latestShareText = '';

const runVerification = {
  token: null,
  seasonId: null,
  issuedAtMs: 0,
  events: [],
};

function normalizeLeaderboardState({ season, rows, playerRank }) {
  const entries = rows.map((row, index) => ({
    rank: index + 1,
    userId: row.user_id,
    username: row.username,
    bestScore: row.best_score,
    hasCrown: row.has_crown,
    isCurrentPlayer: Boolean(authState.user && row.user_id === authState.user.id),
  }));

  return {
    season,
    entries,
    timeRemainingMs: season ? Math.max(0, new Date(season.ends_at).getTime() - Date.now()) : 0,
    playerRank: playerRank ?? null,
  };
}



async function loadSocialFeed() {
  if (!supabase) {
    renderSocialFeed([]);
    return;
  }

  const { data, error } = await fetchSocialEvents();
  if (error) {
    toasts.show('warning', `Social feed unavailable: ${error.message}`);
    renderSocialFeed([]);
    return;
  }

  renderSocialFeed(data ?? []);
}

function scheduleLeaderboardRefresh() {
  if (leaderboardRefreshTimer) {
    window.clearTimeout(leaderboardRefreshTimer);
  }

  leaderboardRefreshTimer = window.setTimeout(() => {
    loadLeaderboard({ force: true });
  }, LEADERBOARD_CACHE_MS);
}

function startCountdownTicker() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
  }

  countdownTimer = window.setInterval(() => {
    if (!leaderboardState?.season) {
      return;
    }

    leaderboardState = {
      ...leaderboardState,
      timeRemainingMs: Math.max(0, new Date(leaderboardState.season.ends_at).getTime() - Date.now()),
    };
    renderLeaderboard(leaderboardState);
  }, 1_000);
}

async function loadLeaderboard({ force = false } = {}) {
  if (!supabase) {
    leaderboardState = { error: 'Connect Supabase to view leaderboard.' };
    renderLeaderboard(leaderboardState);
    return;
  }

  const isCacheFresh = Date.now() - leaderboardCache.loadedAt < LEADERBOARD_CACHE_MS;
  const cacheKey = authState.user?.id ?? null;
  if (!force && isCacheFresh && leaderboardCache.payload && leaderboardCache.userId === cacheKey) {
    leaderboardState = normalizeLeaderboardState(leaderboardCache.payload);
    renderLeaderboard(leaderboardState);
    return;
  }

  const [{ data: season, error: seasonError }, { data: rows, error: leaderboardError }] = await Promise.all([
    fetchActiveSeason(),
    fetchSeasonLeaderboard(),
  ]);

  if (seasonError || leaderboardError) {
    leaderboardState = { error: seasonError?.message ?? leaderboardError?.message ?? 'Unable to load leaderboard.' };
    renderLeaderboard(leaderboardState);
    return;
  }

  const { data: playerRank, error: playerRankError } = await fetchPlayerSeasonRank({
    seasonId: season?.id ?? null,
    userId: authState.user?.id ?? null,
  });

  if (playerRankError) {
    leaderboardState = { error: playerRankError.message ?? 'Unable to load leaderboard.' };
    renderLeaderboard(leaderboardState);
    return;
  }

  leaderboardCache = {
    loadedAt: Date.now(),
    userId: cacheKey,
    payload: { season, rows: rows ?? [], playerRank },
  };

  leaderboardState = normalizeLeaderboardState(leaderboardCache.payload);
  renderLeaderboard(leaderboardState);
  scheduleLeaderboardRefresh();
}

const authModal = setupAuthModal({
  async signIn(email, password) {
    if (!email || !password) {
      toasts.show('warning', 'Enter your email and password to sign in.');
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
  async signUp(email, password) {
    if (!email || !password) {
      toasts.show('warning', 'Enter your email and password to create an account.');
      return;
    }

    if (password.length < 8) {
      toasts.show('warning', 'Password must be at least 8 characters.');
      return;
    }

    const { data, error } = await signUpWithPassword(email, password);
    if (error) {
      toasts.show('error', error.message);
      return;
    }

    const hasActiveSession = Boolean(data?.session);
    toasts.show('success', hasActiveSession ? 'Account created. Choose your username next.' : 'Account created. Check your inbox to verify your email.');
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
  async submit({ username, theme }) {
    if (!authState.user) {
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      toasts.show('warning', 'Username must be 3-24 chars using letters, numbers, or _.');
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
  renderLeaderboard(leaderboardState);
}

async function syncAuthState(sessionUser) {
  if (!sessionUser) {
    authState = { user: null, profile: null };
    syncUI();
    loadLeaderboard({ force: true });
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
  loadLeaderboard({ force: true });

  if (!profile) {
    profileModal.open();
  }
}

function resetRunVerification() {
  runVerification.token = null;
  runVerification.seasonId = null;
  runVerification.issuedAtMs = 0;
  runVerification.events = [];
}

function recordRunEvent(action, snapshot) {
  if (!runVerification.issuedAtMs) {
    return;
  }

  const now = Date.now();
  runVerification.events.push({
    action,
    delta_ms: now - runVerification.issuedAtMs,
    value: snapshot.value,
    doubles: snapshot.doubles,
    phase: snapshot.phase,
  });
}

async function ensureRunToken() {
  if (!authState.user || !supabase) {
    return;
  }

  if (runVerification.token) {
    return;
  }

  const { data, error } = await startRun();
  if (error || !data?.run_token) {
    toasts.show('warning', error?.message ?? 'Unable to verify run token.');
    return;
  }

  runVerification.token = data.run_token;
  runVerification.seasonId = data.season_id ?? null;
  runVerification.issuedAtMs = Date.now();
  runVerification.events = [];
}

async function submitVerifiedRun(summarySnapshot) {
  if (!authState.user || !supabase || !runVerification.token || !runVerification.issuedAtMs) {
    resetRunVerification();
    return;
  }

  const now = Date.now();
  const durationMs = Math.max(0, now - runVerification.issuedAtMs);
  const digestPayload = {
    v: 1,
    season_id: runVerification.seasonId,
    started_at_ms: runVerification.issuedAtMs,
    duration_ms: durationMs,
    outcome: summarySnapshot.outcome,
    actions: runVerification.events,
  };

  const { data: result, error } = await submitRun({
    run_token: runVerification.token,
    final_score: summarySnapshot.value,
    doubles: summarySnapshot.doubles,
    duration_ms: durationMs,
    digest: JSON.stringify(digestPayload),
  });

  if (error) {
    toasts.show('warning', `Run verification failed: ${error.message}`);
    resetRunVerification();
    return;
  }

  const streakCount = Number(result.streak_count ?? 0);
  const streakBonusAwarded = Boolean(result.streak_bonus_awarded);

  if (streakBonusAwarded) {
    toasts.show('success', `Streak bonus! ${streakCount} successful cashouts.`);
  }

  latestShareText = buildShareCopyTemplate({
    score: summarySnapshot.value,
    streakCount,
    streakBonusAwarded,
  });

  const sharePreview = document.querySelector('#sharePreview');
  if (sharePreview) {
    sharePreview.textContent = latestShareText;
  }

  if (result.crown_stolen) {
    const availableTomorrow = result.crown_run_available_tomorrow
      ? new Date(result.crown_run_available_tomorrow).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'tomorrow';
    toasts.show('success', `Crown Run used. Next crown attempt opens ${availableTomorrow} UTC.`);
  }

  resetRunVerification();
  loadLeaderboard({ force: true });
  loadSocialFeed();
}

function handleRunEnd(snapshotBefore, snapshotAfter) {
  if (snapshotBefore.phase === 'RUNNING' && snapshotAfter.phase === 'SUMMARY') {
    stats = updateStatsForRun(stats, snapshotAfter);
    saveStats(stats);
  }

  if (snapshotAfter.phase === 'SUMMARY' && snapshotAfter.outcome === 'crashed') {
    animateCrash();
    resetRunVerification();
    toasts.show('error', 'Crash! Run ended with no banked multiplier.');
  }

  if (snapshotBefore.phase === 'RUNNING' && snapshotAfter.phase === 'SUMMARY' && snapshotAfter.outcome === 'cashed_out') {
    toasts.show('success', `Cashed out at x${snapshotAfter.value}.`);
  }
}

async function onDouble() {
  const before = game.snapshot();

  if ((before.phase === 'IDLE' || before.phase === 'SUMMARY') && authState.user) {
    await ensureRunToken();
  }

  const after = game.doubleDown();
  handleRunEnd(before, after);

  if (before.phase === 'RUNNING' || before.phase === 'IDLE' || before.phase === 'SUMMARY') {
    recordRunEvent('double', after);
  }

  if (after.phase === 'RUNNING' && after.nextCrashChance >= 0.7) {
    toasts.show('warning', `High risk: ${Math.round(after.nextCrashChance * 100)}% crash chance next DOUBLE.`, 1800);
  }

  syncUI();
}

async function onCashOut() {
  const before = game.snapshot();
  const after = game.cashOut();
  recordRunEvent('cash_out', after);
  handleRunEnd(before, after);

  if (before.phase === 'RUNNING' && after.phase === 'SUMMARY' && after.outcome === 'cashed_out') {
    await submitVerifiedRun(after);
  }

  syncUI();
}

doubleBtn.addEventListener('click', onDouble);
cashOutBtn.addEventListener('click', onCashOut);
shareScoreBtn?.addEventListener('click', async () => {
  if (!latestShareText) {
    toasts.show('warning', 'Complete a verified cashout to generate share copy.');
    return;
  }

  try {
    if (navigator.share) {
      await navigator.share({ text: latestShareText });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(latestShareText);
      toasts.show('success', 'Share copy copied to clipboard.');
    }
  } catch (_error) {
    toasts.show('warning', 'Share cancelled.');
  }
});

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
loadLeaderboard();
loadSocialFeed();
startCountdownTicker();
