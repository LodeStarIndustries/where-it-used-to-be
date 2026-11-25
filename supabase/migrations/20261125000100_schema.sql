-- Where It Used To Be: core schema.
-- Every table has Row Level Security turned on (see 20261125000200_rls.sql).
-- The app's server uses the service role for game data, so most tables have
-- no client policies at all: browsers never read places, sites or puzzles directly.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.era as enum ('1970s', '1980s', '1990s', '2000s', '2010s');

create type public.place_category as enum (
  'restaurant', 'bar', 'retail', 'grocery', 'entertainment', 'service', 'automotive', 'other'
);

create type public.place_status as enum ('draft', 'live', 'retired');

create type public.submission_status as enum ('pending', 'approved', 'rejected');

create type public.round_mode as enum ('pin', 'name');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The puzzle date is always the calendar date in New Brunswick (hard rule 1).
create or replace function public.moncton_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Moncton')::date;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- App settings (one row per database)
-- ---------------------------------------------------------------------------
-- `environment` marks which database this is. It starts as 'unset'.
-- TEST: fixtures load only when it is 'development' (hard rule 8).

create table public.app_settings (
  id boolean primary key default true check (id),
  environment text not null default 'unset'
    check (environment in ('unset', 'development', 'production')),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true);

create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

create or replace function public.app_environment()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select environment from public.app_settings where id;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Null until the player picks one on first sign-in.
  display_name text
    check (display_name is null or char_length(btrim(display_name)) between 2 and 24),
  is_admin boolean not null default false,
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
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

-- ---------------------------------------------------------------------------
-- Devices (guest play)
-- ---------------------------------------------------------------------------

create table public.devices (
  id uuid primary key,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index devices_user_id_idx on public.devices (user_id);

-- ---------------------------------------------------------------------------
-- Sites and places
-- ---------------------------------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  -- Null until an admin drops the pin ("needs pin").
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  address_text text check (char_length(address_text) <= 200),
  neighbourhood text check (char_length(neighbourhood) <= 80),
  current_use text check (char_length(current_use) <= 120),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sites_lat_lng_together check ((lat is null) = (lng is null))
);

create trigger sites_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

create table public.places (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category public.place_category not null,
  year_opened smallint check (year_opened between 1700 and 2100),
  year_closed smallint check (year_closed between 1700 and 2100),
  era public.era,
  fact text check (char_length(fact) <= 160),
  -- [{ "label": "...", "url": "https://..." }], up to three in the CSV, more in admin.
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  photo_path text,
  photo_rights_confirmed boolean not null default false,
  difficulty smallint check (difficulty between 1 and 3),
  status public.place_status not null default 'draft',
  verified_at timestamptz,
  last_used_on date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_years_in_order
    check (year_opened is null or year_closed is null or year_opened <= year_closed),
  constraint places_photo_needs_rights
    check (photo_path is null or photo_rights_confirmed),
  constraint places_live_needs_verified_and_difficulty
    check (status <> 'live' or (verified_at is not null and difficulty is not null))
);

create index places_site_id_idx on public.places (site_id);
create index places_status_last_used_idx on public.places (status, last_used_on nulls first);

create trigger places_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

-- A place can only go live if its site has coordinates.
create or replace function public.check_place_live()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'live' and not exists (
    select 1 from public.sites s
    where s.id = new.site_id and s.lat is not null and s.lng is not null
  ) then
    raise exception 'Place "%" cannot go live: its site has no coordinates', new.name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger places_check_live
  before insert or update of status, site_id on public.places
  for each row execute function public.check_place_live();

-- A site's pin can't be removed while a live place sits on it.
create or replace function public.check_site_coords_for_live_places()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.lat is null or new.lng is null) and exists (
    select 1 from public.places p where p.site_id = new.id and p.status = 'live'
  ) then
    raise exception 'Site % has live places, so it must keep its coordinates', new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sites_keep_coords_for_live_places
  before update of lat, lng on public.sites
  for each row execute function public.check_site_coords_for_live_places();

-- Hard rule 8: names starting with TEST: may only exist in a development database.
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
  if label ilike 'TEST:%' and public.app_environment() <> 'development' then
    raise exception 'TEST: content is only allowed in a development database (this one is "%")',
      public.app_environment()
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger places_block_test_names
  before insert or update of name on public.places
  for each row execute function public.block_test_names_outside_dev();

-- ---------------------------------------------------------------------------
-- Daily puzzles
-- ---------------------------------------------------------------------------
-- `rounds` is an array of five objects:
--   { "place_id": uuid, "mode": "pin" | "name", "wrong_place_ids": [uuid, uuid, uuid] }
-- `wrong_place_ids` is present only for name rounds.

create table public.daily_puzzles (
  puzzle_date date primary key,
  number integer not null unique check (number > 0),
  rounds jsonb not null check (jsonb_typeof(rounds) = 'array' and jsonb_array_length(rounds) = 5),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger daily_puzzles_updated_at
  before update on public.daily_puzzles
  for each row execute function public.set_updated_at();

-- Checks the scheduling rules every time a puzzle is written:
-- live places only, no shared sites in a day, and name-round wrong answers
-- that are three distinct live places from other sites.
create or replace function public.validate_daily_puzzle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r jsonb;
  i integer := 0;
  round_place uuid;
  round_site uuid;
  wrong_ids uuid[];
  day_place_ids uuid[] := '{}';
  day_site_ids uuid[] := '{}';
begin
  if tg_op = 'UPDATE' and (old.locked or old.puzzle_date <= public.moncton_today())
     and new.rounds is distinct from old.rounds then
    raise exception 'Puzzle % has started or is locked, so its rounds cannot change', old.puzzle_date
      using errcode = 'check_violation';
  end if;

  for r in select * from jsonb_array_elements(new.rounds) loop
    i := i + 1;

    if jsonb_typeof(r) <> 'object' or not (r ? 'place_id') or not (r ? 'mode') then
      raise exception 'Round % needs place_id and mode', i using errcode = 'check_violation';
    end if;
    if r->>'mode' not in ('pin', 'name') then
      raise exception 'Round % has an unknown mode "%"', i, r->>'mode' using errcode = 'check_violation';
    end if;

    round_place := (r->>'place_id')::uuid;

    select p.site_id into round_site
    from public.places p
    where p.id = round_place and p.status = 'live';

    if round_site is null then
      raise exception 'Round % uses place % which is not live', i, round_place
        using errcode = 'check_violation';
    end if;
    if round_site = any (day_site_ids) then
      raise exception 'Round % shares a site with an earlier round', i using errcode = 'check_violation';
    end if;

    day_place_ids := day_place_ids || round_place;
    day_site_ids := day_site_ids || round_site;

    if r->>'mode' = 'name' then
      if jsonb_typeof(r->'wrong_place_ids') is distinct from 'array'
         or jsonb_array_length(r->'wrong_place_ids') <> 3 then
        raise exception 'Name round % needs exactly three wrong_place_ids', i
          using errcode = 'check_violation';
      end if;

      select array_agg(value::uuid) into wrong_ids
      from jsonb_array_elements_text(r->'wrong_place_ids');

      if (select count(distinct w) from unnest(wrong_ids) w) <> 3 or round_place = any (wrong_ids) then
        raise exception 'Name round % has repeated wrong answers', i using errcode = 'check_violation';
      end if;

      if (
        select count(*) from public.places p
        where p.id = any (wrong_ids) and p.status = 'live' and p.site_id <> round_site
      ) <> 3 then
        raise exception 'Name round % wrong answers must be live places from other sites', i
          using errcode = 'check_violation';
      end if;
    elsif r ? 'wrong_place_ids' then
      raise exception 'Pin round % must not have wrong_place_ids', i using errcode = 'check_violation';
    end if;
  end loop;

  return new;
end;
$$;

create trigger daily_puzzles_validate
  before insert or update on public.daily_puzzles
  for each row execute function public.validate_daily_puzzle();

-- ---------------------------------------------------------------------------
-- Plays and rounds
-- ---------------------------------------------------------------------------

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date not null references public.daily_puzzles (puzzle_date) on delete restrict,
  user_id uuid references public.profiles (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_points integer not null default 0 check (total_points between 0 and 1000),
  constraint plays_has_owner check (user_id is not null or device_id is not null),
  constraint plays_one_per_user_per_date unique (user_id, puzzle_date),
  constraint plays_one_per_device_per_date unique (device_id, puzzle_date)
);

create index plays_puzzle_date_idx on public.plays (puzzle_date, total_points desc, completed_at);

create table public.play_rounds (
  play_id uuid not null references public.plays (id) on delete cascade,
  round_index smallint not null check (round_index between 0 and 4),
  mode public.round_mode not null,
  guess_lat double precision check (guess_lat between -90 and 90),
  guess_lng double precision check (guess_lng between -180 and 180),
  choice_place_id uuid references public.places (id),
  distance_m integer check (distance_m >= 0),
  points smallint not null check (points between 0 and 200),
  created_at timestamptz not null default now(),
  primary key (play_id, round_index),
  constraint play_rounds_pin_shape check (
    mode <> 'pin' or (guess_lat is not null and guess_lng is not null and distance_m is not null)
  ),
  constraint play_rounds_name_shape check (mode <> 'name' or choice_place_id is not null)
);

-- Rounds are final: no updates once written.
create or replace function public.block_round_updates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Rounds are final and cannot be changed' using errcode = 'check_violation';
end;
$$;

create trigger play_rounds_final
  before update on public.play_rounds
  for each row execute function public.block_round_updates();

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  invite_code text not null unique check (invite_code ~ '^[A-Za-z0-9]{8}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Submissions
-- ---------------------------------------------------------------------------

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) between 1 and 120),
  category public.place_category not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  address_text text check (char_length(address_text) <= 200),
  current_use text check (char_length(current_use) <= 120),
  years_text text check (char_length(years_text) <= 60),
  era public.era,
  memory text check (char_length(memory) <= 500),
  photo_path text,
  photo_rights_confirmed boolean not null default false,
  -- The required "this was a business or public place, not someone's home" checkbox.
  confirmed_not_residence boolean not null check (confirmed_not_residence),
  status public.submission_status not null default 'pending',
  admin_note text check (char_length(admin_note) <= 1000),
  place_id uuid references public.places (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint submissions_photo_needs_rights check (photo_path is null or photo_rights_confirmed)
);

create index submissions_status_created_idx on public.submissions (status, created_at);
create index submissions_user_created_idx on public.submissions (user_id, created_at);

create trigger submissions_block_test_names
  before insert or update of business_name on public.submissions
  for each row execute function public.block_test_names_outside_dev();

-- ---------------------------------------------------------------------------
-- Rate limits and admin events (server only)
-- ---------------------------------------------------------------------------

create table public.rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

-- Counts one hit against `p_key` in a fixed window and says whether it is allowed.
-- Called only by the server (service role).
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.rate_limit_hits as h (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = h.hits + 1
  returning hits into n;

  -- Opportunistic cleanup of old windows.
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < now() - interval '2 days';
  end if;

  return n <= p_max;
end;
$$;

create table public.admin_events (
  id bigint generated always as identity primary key,
  kind text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index admin_events_open_idx on public.admin_events (created_at desc) where resolved_at is null;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for place and submission photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;
