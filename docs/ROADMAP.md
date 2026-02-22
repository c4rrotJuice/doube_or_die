# Roadmap

## Phase 1 — Prep (current)
- Static shell and neon UI placeholder.
- Supabase schema, RLS, and Edge Function stubs.
- Documentation and threat model baseline.

## Phase 2 — Core game loop + local persistence
- Implement tap-to-double / cash-out / crash loop in client.
- Add deterministic local state machine and replay-ready event logs.
- Persist recent local sessions for fast rematches.

## Phase 3 — Auth + leaderboard reads
- Improve login UX (email/password + Google auth and profile bootstrap).
- Show active season leaderboard and crown in app.
- Add loading/error states tuned for mobile.

## Phase 4 — Verified submissions + crown stealing
- Implement robust server verification in `submitRun`.
- Enforce token expiry/reuse checks and score sanity thresholds.
- Finalize crown update logic and race-condition handling.

## Phase 5 — Titles, cosmetics, and light lore
- Seasonal titles and unlockable cosmetic themes.
- Introduce minimalist lore snippets tied to crown streaks.
- Add profile polish while keeping fast gameplay-first UX.

## What's next
Build the deterministic gameplay core first so server verification can replay/validate runs reliably.
