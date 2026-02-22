export function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function applySettings(settings) {
  document.body.dataset.theme = settings.theme;
  document.body.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
}

export function renderGame(snapshot, stats, previousSnapshot = null) {
  const phaseOutput = document.querySelector('#phaseOutput');
  const valueOutput = document.querySelector('#valueOutput');
  const messageOutput = document.querySelector('#messageOutput');
  const riskFill = document.querySelector('#riskFill');
  const riskMeter = document.querySelector('.risk-meter');
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
  const riskPercent = Math.min(100, risk * 100);
  riskFill.style.width = `${riskPercent}%`;
  riskValue.textContent = formatPercent(risk);
  riskMeter.setAttribute('aria-valuenow', String(Math.round(riskPercent)));

  const nearDanger = risk >= 0.7;
  riskFill.classList.toggle('danger', nearDanger);

  const doubledSuccessfully = previousSnapshot
    && snapshot.phase === 'RUNNING'
    && snapshot.value > previousSnapshot.value;

  if (doubledSuccessfully) {
    replayAnimation(valueOutput, 'pop');
  }

  doubleBtn.textContent = snapshot.phase === 'RUNNING' ? 'DOUBLE' : 'START + DOUBLE';
  cashOutBtn.disabled = snapshot.phase !== 'RUNNING';

  bestScoreOutput.textContent = `x${stats.bestScore}`;
  lifetimeBankedOutput.textContent = `x${stats.lifetimeBanked}`;
  runsPlayedOutput.textContent = `${stats.runsPlayed}`;
}

function replayAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

export function animateCrash() {
  const panel = document.querySelector('.game-panel');
  replayAnimation(panel, 'shake');
}

export function createToastSystem() {
  const region = document.querySelector('#toastRegion');

  return {
    show(type, message, timeoutMs = 2200) {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
      toast.textContent = message;
      region.appendChild(toast);

      window.setTimeout(() => {
        toast.remove();
      }, timeoutMs);
    },
  };
}

export function setupHowToPlayModal() {
  const modal = document.querySelector('#howToPlayModal');
  const openBtn = document.querySelector('#howToPlayBtn');

  const open = () => {
    if (!modal.open) {
      modal.showModal();
    }
  };

  const close = () => {
    if (modal.open) {
      modal.close();
      openBtn.focus();
    }
  };

  openBtn.addEventListener('click', open);
  modal.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  return { open, close, isOpen: () => modal.open };
}

export function setupKeyboardSupport(actions) {
  document.addEventListener('keydown', (event) => {
    const targetTag = event.target?.tagName;
    const isTyping = ['INPUT', 'SELECT', 'TEXTAREA'].includes(targetTag);

    if (isTyping) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'd') {
      actions.double();
    }

    if (key === 'c') {
      actions.cashOut();
    }

    if (key === 'h') {
      actions.openHelp();
    }

    if (key === 'escape') {
      actions.closeHelp();
    }
  });
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
