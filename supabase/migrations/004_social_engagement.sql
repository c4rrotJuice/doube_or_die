-- Social engagement mechanics: crown runs, streaks, and notification feed

create table if not exists public.crown_run_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_date date not null,
  season_id uuid not null references public.seasons(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, run_date)
);

create table if not exists public.user_cashout_streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  successful_cashouts integer not null default 0 check (successful_cashouts >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  bonus_awards integer not null default 0 check (bonus_awards >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_events (
  id bigint generated always as identity primary key,
  season_id uuid not null references public.seasons(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('dethroned')),
  score bigint not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_social_events_created_desc on public.social_events (created_at desc);

create or replace view public.public_social_events_view as
select
  e.id,
  e.season_id,
  e.event_type,
  e.score,
  e.created_at,
  e.actor_user_id,
  actor.username as actor_username,
  e.target_user_id,
  target.username as target_username
from public.social_events e
left join public.profiles actor on actor.id = e.actor_user_id
left join public.profiles target on target.id = e.target_user_id
join public.seasons s on s.id = e.season_id
where s.is_active = true
order by e.created_at desc;

alter table public.crown_run_attempts enable row level security;
alter table public.user_cashout_streaks enable row level security;
alter table public.social_events enable row level security;

create policy if not exists "social_events_select_public"
  on public.social_events for select
  using (true);

create policy if not exists "user_cashout_streaks_select_own"
  on public.user_cashout_streaks for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.public_social_events_view to anon, authenticated;

create or replace function public.submit_verified_run(
  p_user_id uuid,
  p_season_id uuid,
  p_score bigint,
  p_doubles integer,
  p_duration_ms integer,
  p_digest text
)
returns table (
  run_id uuid,
  new_best boolean,
  crown_stolen boolean,
  streak_count integer,
  streak_bonus_awarded boolean,
  crown_run_available_tomorrow timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_best_changed boolean := false;
  v_crown_changed boolean := false;
  v_previous_crown_user uuid;
  v_attempt_date date := timezone('utc', now())::date;
  v_streak_count integer := 0;
  v_streak_bonus boolean := false;
  v_available_tomorrow timestamptz := date_trunc('day', now() at time zone 'utc') + interval '1 day';
begin
  select user_id into v_previous_crown_user
  from public.crown
  where season_id = p_season_id
  for update;

  insert into public.runs (
    user_id,
    season_id,
    score,
    doubles,
    duration_ms,
    digest,
    is_valid
  )
  values (
    p_user_id,
    p_season_id,
    p_score,
    p_doubles,
    p_duration_ms,
    p_digest,
    true
  )
  returning id into v_run_id;

  insert into public.leaderboard (
    season_id,
    user_id,
    best_score,
    best_run_id,
    updated_at
  )
  values (
    p_season_id,
    p_user_id,
    p_score,
    v_run_id,
    now()
  )
  on conflict (season_id, user_id)
  do update
  set
    best_score = excluded.best_score,
    best_run_id = excluded.best_run_id,
    updated_at = now()
  where excluded.best_score > leaderboard.best_score
  returning true into v_best_changed;

  if not found then
    v_best_changed := false;
  end if;

  -- Streak bonus: every 3 successful verified cashouts.
  insert into public.user_cashout_streaks (
    user_id,
    successful_cashouts,
    current_streak,
    bonus_awards,
    updated_at
  )
  values (
    p_user_id,
    1,
    1,
    0,
    now()
  )
  on conflict (user_id)
  do update
  set
    successful_cashouts = user_cashout_streaks.successful_cashouts + 1,
    current_streak = user_cashout_streaks.current_streak + 1,
    bonus_awards = user_cashout_streaks.bonus_awards
      + case
          when (user_cashout_streaks.current_streak + 1) % 3 = 0 then 1
          else 0
        end,
    updated_at = now()
  returning
    current_streak,
    case when current_streak % 3 = 0 then true else false end
  into v_streak_count, v_streak_bonus;

  -- Crown runs are limited to one successful dethrone attempt per UTC day.
  insert into public.crown_run_attempts (user_id, run_date, season_id, run_id)
  values (p_user_id, v_attempt_date, p_season_id, v_run_id)
  on conflict (user_id, run_date) do nothing;

  if found then
    insert into public.crown (
      season_id,
      user_id,
      score,
      run_id,
      updated_at
    )
    values (
      p_season_id,
      p_user_id,
      p_score,
      v_run_id,
      now()
    )
    on conflict (season_id)
    do update
    set
      user_id = excluded.user_id,
      score = excluded.score,
      run_id = excluded.run_id,
      updated_at = now()
    where excluded.score > crown.score
    returning true into v_crown_changed;

    if not found then
      v_crown_changed := false;
    end if;
  else
    v_crown_changed := false;
  end if;

  if coalesce(v_crown_changed, false) and v_previous_crown_user is distinct from p_user_id then
    insert into public.social_events (season_id, actor_user_id, target_user_id, event_type, score)
    values (p_season_id, p_user_id, v_previous_crown_user, 'dethroned', p_score);
  end if;

  return query
  select
    v_run_id,
    coalesce(v_best_changed, false),
    coalesce(v_crown_changed, false),
    coalesce(v_streak_count, 1),
    coalesce(v_streak_bonus, false),
    v_available_tomorrow;
end;
$$;

revoke all on function public.submit_verified_run(uuid, uuid, bigint, integer, integer, text) from public;
grant execute on function public.submit_verified_run(uuid, uuid, bigint, integer, integer, text) to service_role;
