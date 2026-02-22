# Don't Get Greedy (working title)

A lightweight, minimalist web game scaffold where each run asks one question: **double again, or cash out before the crash?**

This repo is **Phase 1 prep** only (not full gameplay). It sets up a fast client shell, Supabase foundations, and secure submission pathways for future leaderboard chaos.

## Premise
- Core loop: start a run, repeatedly double your score, and cash out before you bust.
- Social chaos layer: seasonal leaderboards, one active crown holder, and title/cosmetic progression.
- Goal: keep the game feel instant on mobile while preventing easy fake score submissions.

## Why this architecture
- **Client-side gameplay** keeps interactions fast and responsive.
- **Server-verified submissions** protect leaderboard integrity.
- **Supabase (Auth + Postgres + RLS + Edge Functions)** provides auth, secure writes, and deployable backend logic with minimal overhead.

## Tech stack
- Vanilla HTML/CSS/JavaScript (ES modules)
- Supabase Auth
- Supabase Postgres + RLS
- Supabase Edge Functions (TypeScript stubs)

## Project layout
```text
/public
  index.html
  style.css
  game.js
  ui.js
  supabase.js
  utils.js
  /assets/icons
  /assets/img

/supabase
  /migrations/001_init.sql
  /policies/001_rls_policies.sql
  /functions/startRun/index.ts
  /functions/submitRun/index.ts
  /functions/getLeaderboard/index.ts
  supabase_notes.md

/docs
  ROADMAP.md
  THREAT_MODEL.md
  API.md
```

## Quickstart (local)
1. Clone the repo.
2. Copy environment template:
   ```bash
   cp .env.example .env.local
   ```
3. Serve the static client from `public/`:
   ```bash
   cd public
   python -m http.server 5173
   ```
4. Open `http://localhost:5173`.

### Local env wiring note (no bundler)
This project avoids build tooling, so `.env` values are not auto-injected.
For now, set these in browser local storage for testing:
```js
localStorage.setItem('PUBLIC_SUPABASE_URL', 'https://YOUR_PROJECT.supabase.co');
localStorage.setItem('PUBLIC_SUPABASE_ANON_KEY', 'YOUR_ANON_KEY');
```
Reload afterwards.

## Supabase setup overview
1. Create a Supabase project.
2. Apply SQL from `supabase/migrations/001_init.sql`.
3. Configure auth (Email OTP/magic link + redirect URL allow-list).
4. (Optional) Enable Google provider in Supabase Auth and add the same redirect URL.
5. Set Edge Function secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
6. Deploy function stubs:
   ```bash
   supabase functions deploy startRun
   supabase functions deploy submitRun
   supabase functions deploy getLeaderboard
   ```

Detailed checklist lives in [`supabase/supabase_notes.md`](./supabase/supabase_notes.md).


## Auth UX flow
- Guests can play fully without signing in (all local state stays in localStorage).
- Auth modal supports email magic links and Google OAuth.
- After sign-in, users without a `profiles` row must complete onboarding with a unique username + theme.
- Header switches from `Guest mode` badge to a user pill showing `username · title`, with sign-out action.

## Security notes
- Client **cannot directly write** runs, leaderboard, crown, or run tokens.
- Edge Functions mint run tokens and process submissions.
- RLS is enabled across all core tables.
- Public reads are exposed through controlled tables/views (`public_leaderboard_view`, `public_crown_view`).

### Public env vars vs secrets
- `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are safe to expose to clients.
- **Never** ship service-role keys to the browser.

## Current status
- ✅ Placeholder UI is live (`Play coming soon`, login button, leaderboard button).
- ✅ Database schema + indexes + RLS + views are in place.
- ✅ Edge Function stubs exist with TODOs for deeper anti-cheat verification.

## Roadmap
See [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## What's next
Phase 2 implements the deterministic game loop and event logging so `submitRun` can perform stronger verification instead of basic sanity checks.
