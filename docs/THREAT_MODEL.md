# Threat model (prep)

## Core assumption
Complete client-side trust is impossible. Players can inspect and modify browser code, request payloads, and local state.

## Security model for this game
- Gameplay executes client-side for responsiveness.
- Every score submission requires a short-lived server-issued run token.
- Edge Functions verify token validity + timing + score sanity before accepting runs.
- RLS prevents direct client writes to sensitive tables.

## Planned sanity checks in `submitRun`
- Token checks: ownership, TTL, single-use, active season binding.
- Timing checks: minimum duration thresholds, impossible action cadence rejection.
- Score checks: score growth limits, doubles-to-score consistency.
- Replay checks (future): deterministic event log hashing and secret-salted digest validation.
- Abuse checks: ban flag checks, per-user submission rate limiting.

## Known risks
- Automation scripts can still play perfectly; anti-bot heuristics may be needed later.
- Without deterministic replay, sophisticated fabricated payloads may pass basic sanity checks.
- Leaderboard race conditions can occur if crown updates are not transactional.

## Mitigation direction
Move critical checks server-side over time, keep client protocol minimal, and prefer append-only run evidence for later audits.
