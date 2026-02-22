import { GameEngine } from './game-logic.js';
import { applySettings, renderGame, setupSettingsUI } from './ui.js';
import { loadSettings, loadStats, saveSettings, saveStats, updateStatsForRun } from './storage.js';

const doubleBtn = document.querySelector('#doubleBtn');
const cashOutBtn = document.querySelector('#cashOutBtn');

const game = new GameEngine();
let stats = loadStats();
let settings = loadSettings();

function syncUI() {
  applySettings(settings);
  renderGame(game.snapshot(), stats);
}

function handleRunEnd(snapshotBefore, snapshotAfter) {
  if (snapshotBefore.phase === 'RUNNING' && snapshotAfter.phase === 'SUMMARY') {
    stats = updateStatsForRun(stats, snapshotAfter);
    saveStats(stats);
  }
}

doubleBtn.addEventListener('click', () => {
  const before = game.snapshot();
  const after = game.doubleDown();
  handleRunEnd(before, after);
  syncUI();
});

cashOutBtn.addEventListener('click', () => {
  const before = game.snapshot();
  const after = game.cashOut();
  handleRunEnd(before, after);
  syncUI();
});

setupSettingsUI(settings, (nextSettings) => {
  settings = nextSettings;
  saveSettings(settings);
  syncUI();
});

syncUI();
