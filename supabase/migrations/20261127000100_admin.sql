-- Milestone 4: admin and submissions.
-- Scheduling guards, last-used bookkeeping and nearby-site lookup. Every function
-- here is called only by the server (service role).

-- ---------------------------------------------------------------------------
-- A place in today's or a future puzzle must stay live
-- ---------------------------------------------------------------------------

create or replace function public.check_place_still_scheduled()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_date date;
begin
  if old.status = 'live' and new.status <> 'live' then
    select min(d.puzzle_date) into next_date
    from public.daily_puzzles d, jsonb_array_elements(d.rounds) r
    where d.puzzle_date >= public.moncton_today()
      and (
        r->>'place_id' = old.id::text
        or coalesce(r->'wrong_place_ids', '[]'::jsonb) ? old.id::text
      );
    if next_date is not null then
      raise exception 'Place "%" is in the puzzle for % so it must stay live. Swap it out of that day first.',
        old.name, next_date
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger places_keep_live_while_scheduled
  before update of status on public.places
  for each row execute function public.check_place_still_scheduled();

-- ---------------------------------------------------------------------------
-- last_used_on: the latest puzzle date a place is the answer for
-- ---------------------------------------------------------------------------

-- Recomputes last_used_on from the puzzles, so swapping a place in the editor
-- keeps "least recently used first" honest. Returns how many places changed.
create or replace function public.refresh_last_used()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  with used as (
    select (r->>'place_id')::uuid as place_id, max(d.puzzle_date) as last_date
    from public.daily_puzzles d, jsonb_array_elements(d.rounds) r
    group by 1
  )
  update public.places p
  set last_used_on = u.last_date
  from (
    select p2.id, used.last_date
    from public.places p2
    left join used on used.place_id = p2.id
  ) u
  where p.id = u.id and p.last_used_on is distinct from u.last_date;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sites near a point (for "attach to the existing site within 30 m")
-- ---------------------------------------------------------------------------

create or replace function public.sites_near(p_lat double precision, p_lng double precision, p_meters double precision)
returns table (site_id uuid, distance_m double precision, address_text text, place_names text[])
language sql
stable
security definer
set search_path = ''
as $$
  with d as (
    select
      s.id,
      s.address_text,
      -- Haversine distance in metres.
      2 * 6371000 * asin(sqrt(
        power(sin(radians(s.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - p_lng) / 2), 2)
      )) as dist
    from public.sites s
    where s.lat is not null
      -- Cheap box filter first (about 0.01 degrees is 1 km here).
      and s.lat between p_lat - 0.01 and p_lat + 0.01
      and s.lng between p_lng - 0.015 and p_lng + 0.015
  )
  select
    d.id,
    d.dist,
    d.address_text,
    coalesce((select array_agg(p.name order by p.name) from public.places p where p.site_id = d.id), '{}')
  from d
  where d.dist <= p_meters
  order by d.dist;
$$;

revoke execute on function public.refresh_last_used() from public, anon, authenticated;
revoke execute on function public.sites_near(double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.refresh_last_used() to service_role;
grant execute on function public.sites_near(double precision, double precision, double precision) to service_role;
