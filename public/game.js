import { GameEngine } from './game-logic.js';
import {
  animateCrash,
  applySettings,
  createToastSystem,
  renderGame,
  setupHowToPlayModal,
  setupKeyboardSupport,
  setupSettingsUI,
} from './ui.js';
import { loadSettings, loadStats, saveSettings, saveStats, updateStatsForRun } from './storage.js';

const doubleBtn = document.querySelector('#doubleBtn');
const cashOutBtn = document.querySelector('#cashOutBtn');

const game = new GameEngine();
const toasts = createToastSystem();
const helpModal = setupHowToPlayModal();
let stats = loadStats();
let settings = loadSettings();
let previousSnapshot = null;

function syncUI() {
  applySettings(settings);
  const snapshot = game.snapshot();
  renderGame(snapshot, stats, previousSnapshot);
  previousSnapshot = snapshot;
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

setupKeyboardSupport({
  double: onDouble,
  cashOut: onCashOut,
  openHelp: helpModal.open,
  closeHelp: helpModal.close,
});

setupSettingsUI(settings, (nextSettings) => {
  settings = nextSettings;
  saveSettings(settings);
  syncUI();
});

syncUI();
