-- Secure run verification primitives

alter table public.run_tokens
  add column if not exists consumed_at timestamptz;

create index if not exists idx_run_tokens_token_user_unused
  on public.run_tokens (token_id, user_id)
  where used = false;

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
  crown_stolen boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_best_changed boolean := false;
  v_crown_changed boolean := false;
begin
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

  return query
  select v_run_id, coalesce(v_best_changed, false), coalesce(v_crown_changed, false);
end;
$$;

revoke all on function public.submit_verified_run(uuid, uuid, bigint, integer, integer, text) from public;
grant execute on function public.submit_verified_run(uuid, uuid, bigint, integer, integer, text) to service_role;
