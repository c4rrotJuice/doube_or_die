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

export function setupAuthModal(actions) {
  const modal = document.querySelector('#authModal');
  const openBtn = document.querySelector('#authBtn');
  const closeBtn = document.querySelector('#closeAuthBtn');
  const signInForm = document.querySelector('#passwordSignInForm');
  const signInEmailInput = document.querySelector('#passwordEmailInput');
  const signInPasswordInput = document.querySelector('#passwordInput');
  const signUpForm = document.querySelector('#passwordSignUpForm');
  const signUpEmailInput = document.querySelector('#signupEmailInput');
  const signUpPasswordInput = document.querySelector('#signupPasswordInput');
  const googleBtn = document.querySelector('#googleSignInBtn');

  const open = () => {
    if (modal && !modal.open) {
      modal.showModal();
      signInEmailInput?.focus();
    }
  };

  const close = () => {
    if (modal?.open) {
      modal.close();
      openBtn?.focus();
    }
  };

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);

  modal?.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  signInForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.signIn(signInEmailInput.value.trim(), signInPasswordInput.value);
  });

  signUpForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.signUp(signUpEmailInput.value.trim(), signUpPasswordInput.value);
  });

  googleBtn?.addEventListener('click', () => {
    actions.google();
  });

  return { open, close };
}

export function renderAuthState(authState) {
  const guestBadge = document.querySelector('#guestBadge');
  const userPill = document.querySelector('#userPill');
  const profileOutput = document.querySelector('#profileSummary');
  const authBtn = document.querySelector('#authBtn');
  const signOutBtn = document.querySelector('#signOutBtn');

  if (!authState?.user) {
    guestBadge.hidden = false;
    userPill.hidden = true;
    authBtn.hidden = false;
    signOutBtn.hidden = true;
    return;
  }

  const username = authState.profile?.username ?? authState.user.email ?? 'Player';
  const title = authState.profile?.title ?? 'Rookie';

  profileOutput.textContent = `${username} · ${title}`;
  guestBadge.hidden = true;
  userPill.hidden = false;
  authBtn.hidden = true;
  signOutBtn.hidden = false;
}

export function setupProfileOnboardingModal(actions) {
  const modal = document.querySelector('#profileModal');
  const form = document.querySelector('#profileForm');
  const usernameInput = document.querySelector('#usernameInput');
  const themeSelect = document.querySelector('#profileThemeSelect');

  const open = () => {
    if (!modal.open) {
      modal.showModal();
      usernameInput.focus();
    }
  };

  const close = () => {
    if (modal.open) {
      modal.close();
    }
  };

  modal.addEventListener('cancel', (event) => {
    event.preventDefault();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.submit({
      username: usernameInput.value.trim(),
      theme: themeSelect.value,
    });
  });

  return { open, close };
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


function formatCountdown(msRemaining) {
  if (msRemaining <= 0) {
    return 'Season ended';
  }

  const secondsTotal = Math.floor(msRemaining / 1000);
  const days = Math.floor(secondsTotal / 86400);
  const hours = Math.floor((secondsTotal % 86400) / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
}

export function renderLeaderboard(state) {
  const countdown = document.querySelector('#seasonCountdown');
  const summary = document.querySelector('#leaderboardSummary');
  const rowsRoot = document.querySelector('#leaderboardRows');

  if (!countdown || !summary || !rowsRoot) {
    return;
  }

  if (!state) {
    countdown.textContent = 'Loading season…';
    summary.textContent = 'Top 50 players this season.';
    rowsRoot.innerHTML = '<tr><td colspan="3" class="leaderboard-empty">Loading leaderboard…</td></tr>';
    return;
  }

  if (state.error) {
    countdown.textContent = 'Season unavailable';
    summary.textContent = state.error;
    rowsRoot.innerHTML = '<tr><td colspan="3" class="leaderboard-empty">Unable to load leaderboard.</td></tr>';
    return;
  }

  const seasonName = state.season?.name ?? 'Active season';
  countdown.textContent = `${seasonName} · ${formatCountdown(state.timeRemainingMs ?? 0)}`;

  const playerRankText = state.playerRank
    ? `Your rank: #${state.playerRank.rank} (${state.playerRank.score})`
    : 'Your rank: not ranked yet';
  summary.textContent = `Top ${state.entries.length} players this season. ${playerRankText}`;

  if (!state.entries.length) {
    rowsRoot.innerHTML = '<tr><td colspan="3" class="leaderboard-empty">No scores yet this season.</td></tr>';
    return;
  }

  rowsRoot.innerHTML = state.entries.map((entry) => {
    const classes = ['leaderboard-row'];
    if (entry.hasCrown) classes.push('is-crown');
    if (entry.isCurrentPlayer) classes.push('is-self');

    const crown = entry.hasCrown ? '<span class="crown-icon" aria-label="Crown holder" title="Crown holder">👑</span>' : '';
    return `
      <tr class="${classes.join(' ')}">
        <td class="leaderboard-rank">#${entry.rank}</td>
        <td>${crown}${entry.username}</td>
        <td>${entry.bestScore}</td>
      </tr>
    `;
  }).join('');
}


function formatEventTimestamp(isoString) {
  const timestamp = new Date(isoString);
  if (Number.isNaN(timestamp.getTime())) {
    return 'just now';
  }
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function renderSocialFeed(events) {
  const root = document.querySelector('#socialFeed');
  if (!root) return;

  if (!events?.length) {
    root.innerHTML = '<li class="social-feed-empty">No social moments yet.</li>';
    return;
  }

  root.innerHTML = events.map((event) => {
    if (event.event_type === 'dethroned') {
      const actor = event.actor_username ?? 'Unknown';
      const target = event.target_username ?? 'the crown';
      return `<li>${actor} dethroned ${target} at ${event.score} · ${formatEventTimestamp(event.created_at)}</li>`;
    }

    return `<li>New event at ${event.score}</li>`;
  }).join('');
}

export function buildShareCopyTemplate({ score, streakCount = 0, streakBonusAwarded = false }) {
  const vibes = [
    'vibe: ice-cold hands, hot doubles',
    'vibe: pure chaos, somehow controlled',
    'vibe: pressure makes diamonds',
  ];
  const vibeLine = vibes[Math.abs(Number(score) || 0) % vibes.length];
  const streakLine = streakBonusAwarded
    ? `🔥 3-cashout streak bonus unlocked (streak ${streakCount}).`
    : `Current cashout streak: ${streakCount}.`;

  return `I just cashed out at x${score} in Double or Die. ${streakLine} ${vibeLine} 👑`;
}
