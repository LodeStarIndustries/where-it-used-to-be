-- Milestone 3: accounts and social.
-- Marketing opt-in, linking a guest device's plays to an account, streaks, and
-- the leaderboard queries. Every function here is called only by the server
-- (service role); browsers can't run them.

-- ---------------------------------------------------------------------------
-- Marketing opt-in (unticked by default; the time records when it was given)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column marketing_opt_in boolean not null default false,
  add column marketing_opt_in_at timestamptz;

-- ---------------------------------------------------------------------------
-- Streaks: consecutive puzzle dates with a finished play
-- ---------------------------------------------------------------------------

-- Recomputes a player's current and best streak from their finished plays.
-- Current: the run ending today or yesterday (New Brunswick time), else 0.
-- Best never goes down.
create or replace function public.refresh_streaks(p_user uuid)
returns table (current_streak integer, best_streak integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer := 0;
  v_best integer := 0;
begin
  with dates as (
    select distinct p.puzzle_date as d
    from public.plays p
    where p.user_id = p_user and p.completed_at is not null
  ),
  islands as (
    select d, d - (row_number() over (order by d))::integer as grp from dates
  ),
  runs as (
    select max(d) as last_day, count(*)::integer as len from islands group by grp
  )
  select
    coalesce(max(len) filter (where last_day >= public.moncton_today() - 1), 0),
    coalesce(max(len), 0)
  into v_current, v_best
  from runs;

  update public.profiles pr
  set current_streak = v_current,
      best_streak = greatest(pr.best_streak, v_best)
  where pr.id = p_user
  returning pr.current_streak, pr.best_streak into v_current, v_best;

  return query select v_current, v_best;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guest to account
-- ---------------------------------------------------------------------------

-- Attaches a device to an account and moves the device's guest plays onto it.
-- If the account already has a play for a date the device also played, the
-- account's play is kept and the device's stays a guest play.
-- Returns how many plays moved.
create or replace function public.link_device(p_device uuid, p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved integer;
begin
  insert into public.devices as d (id, user_id)
  values (p_device, p_user)
  on conflict (id) do update set user_id = excluded.user_id, last_seen_at = now();

  update public.plays p
  set user_id = p_user
  where p.device_id = p_device
    and p.user_id is null
    and not exists (
      select 1 from public.plays q where q.user_id = p_user and q.puzzle_date = p.puzzle_date
    );
  get diagnostics moved = row_count;

  if moved > 0 then
    perform public.refresh_streaks(p_user);
  end if;
  return moved;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboards
-- ---------------------------------------------------------------------------

-- One day's board: finished plays by signed-in players with a display name.
-- Ties: the earlier finish ranks higher. Returns the top p_limit rows plus the
-- viewer's own row. With p_group, only that group's members.
-- round_points is for group boards; the server decides whether to show it.
create or replace function public.leaderboard_day(
  p_date date,
  p_viewer uuid,
  p_group uuid default null,
  p_limit integer default 50
)
returns table (
  rank bigint,
  display_name text,
  total_points integer,
  completed_at timestamptz,
  is_me boolean,
  round_points smallint[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      p.id as play_id,
      p.user_id,
      pr.display_name,
      p.total_points,
      p.completed_at,
      row_number() over (order by p.total_points desc, p.completed_at asc, p.id) as rank
    from public.plays p
    join public.profiles pr on pr.id = p.user_id
    where p.puzzle_date = p_date
      and p.completed_at is not null
      and pr.display_name is not null
      and (
        p_group is null
        or exists (select 1 from public.group_members gm where gm.group_id = p_group and gm.user_id = p.user_id)
      )
  )
  select
    r.rank,
    r.display_name,
    r.total_points,
    r.completed_at,
    r.user_id is not distinct from p_viewer,
    (select array_agg(x.points order by x.round_index) from public.play_rounds x where x.play_id = r.play_id)
  from ranked r
  where r.rank <= p_limit or r.user_id is not distinct from p_viewer
  order by r.rank;
$$;

-- A group's board for the 7 puzzle dates ending p_end: total points across the
-- week. Ties: more days played, then the earlier last finish.
create or replace function public.leaderboard_group_week(p_group uuid, p_end date, p_viewer uuid)
returns table (
  rank bigint,
  display_name text,
  total_points bigint,
  days_played integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with week as (
    select
      p.user_id,
      sum(p.total_points) as total_points,
      count(*)::integer as days_played,
      max(p.completed_at) as last_finish
    from public.plays p
    join public.group_members gm on gm.user_id = p.user_id and gm.group_id = p_group
    where p.puzzle_date between p_end - 6 and p_end
      and p.completed_at is not null
    group by p.user_id
  )
  select
    row_number() over (order by w.total_points desc, w.days_played desc, w.last_finish asc, w.user_id),
    pr.display_name,
    w.total_points,
    w.days_played,
    w.user_id = p_viewer
  from week w
  join public.profiles pr on pr.id = w.user_id
  where pr.display_name is not null
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: server only
-- ---------------------------------------------------------------------------

revoke execute on function public.refresh_streaks(uuid) from public, anon, authenticated;
revoke execute on function public.link_device(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.leaderboard_day(date, uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.leaderboard_group_week(uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.refresh_streaks(uuid) to service_role;
grant execute on function public.link_device(uuid, uuid) to service_role;
grant execute on function public.leaderboard_day(date, uuid, uuid, integer) to service_role;
grant execute on function public.leaderboard_group_week(uuid, date, uuid) to service_role;
