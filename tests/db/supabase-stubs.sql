-- Minimal stand-ins for the parts of Supabase our migrations touch, so the
-- migrations can be tested on a plain in-memory Postgres (PGlite) without Docker.
-- This file is for tests only. Real Supabase projects already have all of this.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- Mirrors a project created with "Grant API access to new tables automatically" OFF:
-- roles can see the schema but get no table access unless a migration grants it.
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase reads the signed-in user from the request's JWT claims.
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
