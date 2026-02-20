-- Don't Get Greedy - initial schema foundation
-- Run with Supabase SQL editor or `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 24),
  theme text not null default 'neon',
  title text not null default 'Rookie',
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.run_tokens (
  token_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  server_nonce text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used boolean not null default false
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  score bigint not null check (score >= 0),
  doubles integer not null check (doubles >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  digest text not null,
  created_at timestamptz not null default now(),
  is_valid boolean not null default true
);

create table if not exists public.leaderboard (
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  best_score bigint not null check (best_score >= 0),
  best_run_id uuid references public.runs(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id)
);

create table if not exists public.crown (
  season_id uuid primary key references public.seasons(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  score bigint not null default 0 check (score >= 0),
  run_id uuid references public.runs(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_runs_season_score_desc on public.runs (season_id, score desc);
create index if not exists idx_leaderboard_season_score_desc on public.leaderboard (season_id, best_score desc);
create index if not exists idx_run_tokens_user_expires_at on public.run_tokens (user_id, expires_at);

-- Keep exactly one active season manually; this seed gives a starting point.
insert into public.seasons (name, starts_at, ends_at, is_active)
select
  'Season 1',
  now(),
  now() + interval '7 days',
  true
where not exists (select 1 from public.seasons);

-- Ensure crown row exists for active season.
insert into public.crown (season_id, user_id, score)
select s.id, null, 0
from public.seasons s
where s.is_active = true
  and not exists (
    select 1 from public.crown c where c.season_id = s.id
  );

-- Public views for safe client reads.
create or replace view public.public_leaderboard_view as
select
  l.season_id,
  s.name as season_name,
  l.user_id,
  p.username,
  l.best_score,
  l.updated_at,
  (c.user_id is not null and c.user_id = l.user_id) as has_crown
from public.leaderboard l
join public.seasons s on s.id = l.season_id
join public.profiles p on p.id = l.user_id
left join public.crown c on c.season_id = l.season_id
where s.is_active = true
order by l.best_score desc, l.updated_at asc;

create or replace view public.public_crown_view as
select
  c.season_id,
  s.name as season_name,
  c.user_id,
  p.username,
  c.score,
  c.run_id,
  c.updated_at
from public.crown c
join public.seasons s on s.id = c.season_id
left join public.profiles p on p.id = c.user_id
where s.is_active = true;

-- RLS
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.run_tokens enable row level security;
alter table public.runs enable row level security;
alter table public.leaderboard enable row level security;
alter table public.crown enable row level security;

-- profiles: public read, owner insert/update
create policy if not exists "profiles_select_public"
  on public.profiles for select
  using (true);

create policy if not exists "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy if not exists "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- seasons: public read only
create policy if not exists "seasons_select_public"
  on public.seasons for select
  using (true);

-- leaderboard: public read only
create policy if not exists "leaderboard_select_public"
  on public.leaderboard for select
  using (true);

-- crown: public read only
create policy if not exists "crown_select_public"
  on public.crown for select
  using (true);

-- runs: only owner can read
create policy if not exists "runs_select_own"
  on public.runs for select
  to authenticated
  using (auth.uid() = user_id);

-- run_tokens: no client access (no policies)

-- Views readable to all clients.
grant select on public.public_leaderboard_view to anon, authenticated;
grant select on public.public_crown_view to anon, authenticated;
