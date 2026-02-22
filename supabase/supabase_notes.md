# Supabase setup notes

## 1) Create project
1. Create a new Supabase project.
2. Save the project URL and anon key for local client use.
3. Keep the service-role key in Supabase secrets only (never commit it).

## 2) Apply SQL
Run `supabase/migrations/001_init.sql` in SQL Editor (or via CLI `supabase db push`).

## 3) Configure auth
- Enable Email/password authentication.
- Add your local URL (e.g. `http://localhost:5173`) to redirect allow-list.

## 4) Edge Function environment variables
Set the following secrets for functions:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional hardening secrets (phase 2+):
- `RUN_DIGEST_SECRET`
- `MIN_RUN_DURATION_MS`
- `MAX_SCORE_PER_SECOND`

## 5) Deploy functions
This repo includes `supabase/config.toml` with `verify_jwt = false` for edge functions so CORS preflight `OPTIONS` requests are not rejected before function code runs. Each function still validates bearer tokens manually for protected endpoints.

```bash
supabase functions deploy startRun
supabase functions deploy submitRun
supabase functions deploy getLeaderboard
```

## 6) Season management
The migration seeds one active season for 7 days.
For future seasons:
1. Set current season `is_active=false`.
2. Insert next season with dates + `is_active=true`.
3. Insert matching row into `crown` for that season.

Example SQL:
```sql
update public.seasons set is_active = false where is_active = true;

insert into public.seasons (name, starts_at, ends_at, is_active)
values ('Season 2', now(), now() + interval '7 days', true)
returning id;

insert into public.crown (season_id, score)
values ('<season_id>', 0);
```

## 7) Policy posture
- Client can read public profile metadata, seasons, leaderboard, and crown.
- Client cannot write runs/tokens/leaderboard/crown directly.
- Verified writes happen through Edge Functions using service-role credentials.
