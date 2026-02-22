export const PHASES = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  CASHED_OUT: 'CASHED_OUT',
  CRASHED: 'CRASHED',
  SUMMARY: 'SUMMARY',
});

export const DEFAULT_TUNING = Object.freeze({
  startValue: 1,
  riskBase: 0.08,
  riskGrowthRate: 0.34,
  riskMidpoint: 4,
  riskCap: 0.92,
});

export function riskForStep(doubleCount, tuning = DEFAULT_TUNING) {
  const { riskBase, riskGrowthRate, riskMidpoint, riskCap } = tuning;
  const logistic = 1 / (1 + Math.exp(-riskGrowthRate * (doubleCount - riskMidpoint)));
  return Math.min(riskCap, riskBase + (riskCap - riskBase) * logistic);
}

export class GameEngine {
  constructor(rng = Math.random, tuning = DEFAULT_TUNING) {
    this.rng = rng;
    this.tuning = tuning;
    this.state = this.#freshState();
  }

  #freshState() {
    return {
      phase: PHASES.IDLE,
      value: this.tuning.startValue,
      doubles: 0,
      outcome: null,
      message: 'Press DOUBLE to begin.',
    };
  }

  resetToIdle() {
    this.state = this.#freshState();
    return this.snapshot();
  }

  startRun() {
    this.state.phase = PHASES.RUNNING;
    this.state.value = this.tuning.startValue;
    this.state.doubles = 0;
    this.state.outcome = null;
    this.state.message = 'Run started. Risk climbs with every DOUBLE.';
  }

  doubleDown() {
    if (this.state.phase === PHASES.IDLE || this.state.phase === PHASES.SUMMARY) {
      this.startRun();
    }

    if (this.state.phase !== PHASES.RUNNING) {
      return this.snapshot();
    }

    const nextStep = this.state.doubles + 1;
    const crashChance = riskForStep(nextStep, this.tuning);
    const crashed = this.rng() < crashChance;

    if (crashed) {
      this.state.phase = PHASES.CRASHED;
      this.state.outcome = 'crashed';
      this.state.message = `Crashed at x${this.state.value}.`; 
      return this.finishRun();
    }

    this.state.doubles = nextStep;
    this.state.value *= 2;
    this.state.message = `Safe! Multiplied to x${this.state.value}.`;
    return this.snapshot();
  }

  cashOut() {
    if (this.state.phase !== PHASES.RUNNING) {
      return this.snapshot();
    }

    this.state.phase = PHASES.CASHED_OUT;
    this.state.outcome = 'cashed_out';
    this.state.message = `Cashed out at x${this.state.value}.`;
    return this.finishRun();
  }

  finishRun() {
    if (![PHASES.CASHED_OUT, PHASES.CRASHED].includes(this.state.phase)) {
      return this.snapshot();
    }

    this.state.phase = PHASES.SUMMARY;
    return this.snapshot();
  }

  snapshot() {
    const nextCrashChance = this.state.phase === PHASES.RUNNING
      ? riskForStep(this.state.doubles + 1, this.tuning)
      : 0;

    return {
      ...this.state,
      nextCrashChance,
      riskCap: this.tuning.riskCap,
    };
  }
}
