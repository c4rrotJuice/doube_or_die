-- Auth/profile onboarding hardening

alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[A-Za-z0-9_]{3,24}$');

alter table public.profiles
  add constraint profiles_theme_allowed
  check (theme in ('dark', 'light'));

-- Ensure authenticated users can only mutate their own profile row.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Optional helper policy for profile bootstrap during first sign-in.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);
