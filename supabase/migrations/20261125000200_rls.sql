-- Row Level Security for every table.
--
-- The model:
--   * The app's server uses the service role key, which bypasses RLS. All scoring,
--     puzzle reads, leaderboards and writes go through server route handlers.
--   * Browsers (anon / authenticated) can read only their own rows, and can't read
--     places, sites or puzzles at all, so no answer can leak through the Data API.
--   * Admin policies let an admin's own session manage content too, but admin routes
--     still check is_admin() on the server.

-- ---------------------------------------------------------------------------
-- Turn RLS on everywhere
-- ---------------------------------------------------------------------------

alter table public.app_settings     enable row level security;
alter table public.profiles         enable row level security;
alter table public.devices          enable row level security;
alter table public.sites            enable row level security;
alter table public.places           enable row level security;
alter table public.daily_puzzles    enable row level security;
alter table public.plays            enable row level security;
alter table public.play_rounds      enable row level security;
alter table public.groups           enable row level security;
alter table public.group_members    enable row level security;
alter table public.submissions      enable row level security;
alter table public.rate_limit_hits  enable row level security;
alter table public.admin_events     enable row level security;

-- ---------------------------------------------------------------------------
-- Table privileges: start from nothing, then grant only what policies need
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- Tables added by later migrations also start with no browser access.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- The server (secret key = service_role) needs every table. Granted explicitly so this
-- works even when the project's "Grant API access to new tables automatically" is off.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Functions the policies and server rely on, granted explicitly for the same reason.
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.moncton_today() to authenticated, service_role;

grant select, update (display_name) on public.profiles to authenticated;
grant select on public.plays, public.play_rounds to authenticated;
grant select on public.groups, public.group_members to authenticated;
grant select on public.submissions to authenticated;
-- Admin-only content tables (policies below restrict these to admins).
grant select, insert, update, delete on public.sites, public.places, public.daily_puzzles to authenticated;
grant update on public.submissions to authenticated;
grant select, update on public.admin_events to authenticated;

-- Server-only functions must not be callable through the Data API.
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.app_environment() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.app_environment() to service_role;

-- ---------------------------------------------------------------------------
-- Helper: group membership without recursive policy checks
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- profiles: a player reads and renames only their own profile.
-- (Column grants above stop anyone setting is_admin or streaks from the browser.)
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own display name" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- plays and play_rounds: read own only. Writes happen on the server.
create policy "plays: read own" on public.plays
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "play_rounds: read own" on public.play_rounds
  for select to authenticated
  using (exists (
    select 1 from public.plays p
    where p.id = play_rounds.play_id and p.user_id = (select auth.uid())
  ));

-- groups: members (and the owner) can see the group. Writes happen on the server.
create policy "groups: read if member or owner" on public.groups
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_group_member(id));

create policy "group_members: read members of my groups" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

-- submissions: a player reads their own. Admins read and review all.
create policy "submissions: read own" on public.submissions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "submissions: admins read" on public.submissions
  for select to authenticated
  using ((select public.is_admin()));

create policy "submissions: admins review" on public.submissions
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- sites, places, daily_puzzles: admins only. Players get game data from the server.
create policy "sites: admins manage" on public.sites
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "places: admins manage" on public.places
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "daily_puzzles: admins manage" on public.daily_puzzles
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "admin_events: admins manage" on public.admin_events
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- app_settings, devices, rate_limit_hits: no client policies (server only).
