export function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function applySettings(settings) {
  document.body.dataset.theme = settings.theme;
  document.body.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
}

export function renderGame(snapshot, stats) {
  const phaseOutput = document.querySelector('#phaseOutput');
  const valueOutput = document.querySelector('#valueOutput');
  const messageOutput = document.querySelector('#messageOutput');
  const riskFill = document.querySelector('#riskFill');
  const riskValue = document.querySelector('#riskValue');
  const doubleBtn = document.querySelector('#doubleBtn');
  const cashOutBtn = document.querySelector('#cashOutBtn');

  const bestScoreOutput = document.querySelector('#bestScoreOutput');
  const lifetimeBankedOutput = document.querySelector('#lifetimeBankedOutput');
  const runsPlayedOutput = document.querySelector('#runsPlayedOutput');

  phaseOutput.textContent = snapshot.phase;
  valueOutput.textContent = `x${snapshot.value}`;
  messageOutput.textContent = snapshot.message;

  const risk = snapshot.phase === 'RUNNING' ? snapshot.nextCrashChance : 0;
  riskFill.style.width = `${Math.min(100, risk * 100)}%`;
  riskValue.textContent = formatPercent(risk);

  doubleBtn.textContent = snapshot.phase === 'RUNNING' ? 'DOUBLE' : 'START + DOUBLE';
  cashOutBtn.disabled = snapshot.phase !== 'RUNNING';

  bestScoreOutput.textContent = `x${stats.bestScore}`;
  lifetimeBankedOutput.textContent = `x${stats.lifetimeBanked}`;
  runsPlayedOutput.textContent = `${stats.runsPlayed}`;
}

export function setupSettingsUI(initialSettings, onChange) {
  const themeSelect = document.querySelector('#themeSelect');
  const reducedMotionToggle = document.querySelector('#reducedMotionToggle');
  const soundToggle = document.querySelector('#soundToggle');

  let settings = { ...initialSettings };

  themeSelect.value = settings.theme;
  reducedMotionToggle.checked = settings.reducedMotion;
  soundToggle.checked = settings.soundEnabled;

  themeSelect.addEventListener('change', () => {
    settings = { ...settings, theme: themeSelect.value };
    onChange(settings);
  });

  reducedMotionToggle.addEventListener('change', () => {
    settings = { ...settings, reducedMotion: reducedMotionToggle.checked };
    onChange(settings);
  });

  soundToggle.addEventListener('change', () => {
    settings = { ...settings, soundEnabled: soundToggle.checked };
    onChange(settings);
  });
}
