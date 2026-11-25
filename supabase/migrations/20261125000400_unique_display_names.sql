-- Display names are unique, ignoring case and surrounding spaces ("Pat" and " pat " clash).
-- Null (not picked yet) is allowed for any number of players.
-- Groups are already deleted with their owner: groups.owner_id cascades from profiles,
-- and profiles cascade from auth.users.

create unique index profiles_display_name_unique
  on public.profiles (lower(btrim(display_name)))
  where display_name is not null;
