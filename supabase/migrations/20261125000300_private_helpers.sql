-- Fixes from Supabase's security advisor:
-- * SECURITY DEFINER helpers move out of `public` (which the Data API exposes as
--   /rest/v1/rpc/...) into a `private` schema the API never exposes. Policies can still
--   call them; browsers can't.
-- * submissions gets one SELECT policy instead of two overlapping ones.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers in the private schema
-- ---------------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function private.is_group_member(p_group_id uuid)
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

create or replace function private.app_environment()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select environment from public.app_settings where id;
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- The TEST: guard now reads the environment from the private helper.
create or replace function public.block_test_names_outside_dev()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  label text;
begin
  -- places.name or submissions.business_name
  label := coalesce(to_jsonb(new)->>'name', to_jsonb(new)->>'business_name');
  if label ilike 'TEST:%' and private.app_environment() <> 'development' then
    raise exception 'TEST: content is only allowed in a development database (this one is "%")',
      private.app_environment()
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Policies: point at the private helpers
-- ---------------------------------------------------------------------------

drop policy "groups: read if member or owner" on public.groups;
create policy "groups: read if member or owner" on public.groups
  for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_group_member(id));

drop policy "group_members: read members of my groups" on public.group_members;
create policy "group_members: read members of my groups" on public.group_members
  for select to authenticated
  using (private.is_group_member(group_id));

drop policy "submissions: read own" on public.submissions;
drop policy "submissions: admins read" on public.submissions;
create policy "submissions: read own, or all for admins" on public.submissions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy "submissions: admins review" on public.submissions;
create policy "submissions: admins review" on public.submissions
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy "sites: admins manage" on public.sites;
create policy "sites: admins manage" on public.sites
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy "places: admins manage" on public.places;
create policy "places: admins manage" on public.places
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy "daily_puzzles: admins manage" on public.daily_puzzles;
create policy "daily_puzzles: admins manage" on public.daily_puzzles
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy "admin_events: admins manage" on public.admin_events;
create policy "admin_events: admins manage" on public.admin_events
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Remove the old public versions
-- ---------------------------------------------------------------------------

drop function public.is_admin();
drop function public.is_group_member(uuid);
drop function public.app_environment();
