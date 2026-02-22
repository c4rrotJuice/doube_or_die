const STORAGE_KEYS = Object.freeze({
  STATS: 'dod.stats.v1',
  SETTINGS: 'dod.settings.v1',
});

const DEFAULT_STATS = Object.freeze({
  bestScore: 1,
  lifetimeBanked: 0,
  runsPlayed: 0,
});

const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  reducedMotion: false,
  soundEnabled: false,
});

function safeParse(raw, fallback) {
  if (!raw) return fallback;

  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function loadStats() {
  return safeParse(window.localStorage.getItem(STORAGE_KEYS.STATS), DEFAULT_STATS);
}

export function saveStats(stats) {
  window.localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

export function updateStatsForRun(stats, snapshot) {
  const updated = {
    ...stats,
    runsPlayed: stats.runsPlayed + 1,
  };

  if (snapshot.outcome === 'cashed_out') {
    updated.bestScore = Math.max(updated.bestScore, snapshot.value);
    updated.lifetimeBanked += snapshot.value;
  }

  return updated;
}

export function loadSettings() {
  return safeParse(window.localStorage.getItem(STORAGE_KEYS.SETTINGS), DEFAULT_SETTINGS);
}

export function saveSettings(settings) {
  window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}
