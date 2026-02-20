import { renderStatus, setBusy } from './ui.js';
import { fetchLeaderboard, getSession, signInWithMagicLink } from './supabase.js';

const loginBtn = document.querySelector('#loginBtn');
const leaderboardBtn = document.querySelector('#leaderboardBtn');
const statusOutput = document.querySelector('#statusOutput');

const state = {
  phase: 'bootstrap',
  session: null,
  // TODO(phase-2): add round state, score ladder, and crash multiplier state machine.
};

async function bootstrap() {
  const { data } = await getSession();
  state.session = data?.session ?? null;
  state.phase = 'idle';
  renderStatus(statusOutput, 'Ready', {
    authenticated: Boolean(state.session),
    message: 'Placeholder shell loaded. Gameplay arrives in phase 2.',
  });
}

loginBtn.dataset.label = 'Login';
leaderboardBtn.dataset.label = 'Leaderboard';

loginBtn.addEventListener('click', async () => {
  const email = window.prompt('Enter your email for a magic link:');
  if (!email) return;

  try {
    setBusy(loginBtn, true);
    const result = await signInWithMagicLink(email);
    renderStatus(statusOutput, 'Magic link requested', result);
  } catch (error) {
    renderStatus(statusOutput, 'Login failed', { message: error.message });
  } finally {
    setBusy(loginBtn, false);
  }
});

leaderboardBtn.addEventListener('click', async () => {
  try {
    setBusy(leaderboardBtn, true);
    const result = await fetchLeaderboard();
    renderStatus(statusOutput, 'Leaderboard payload', result);
  } catch (error) {
    renderStatus(statusOutput, 'Leaderboard error', { message: error.message });
  } finally {
    setBusy(leaderboardBtn, false);
  }
});

bootstrap().catch((error) => {
  renderStatus(statusOutput, 'Bootstrap error', { message: error.message });
});
