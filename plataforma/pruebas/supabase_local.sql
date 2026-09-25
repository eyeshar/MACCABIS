-- Emulacion minima de lo que Supabase trae de serie, SOLO para las pruebas locales.
-- (En Supabase real todo esto ya existe: no se aplica nunca alli.)
-- Roles, esquema auth con auth.uid()/auth.jwt(), y los permisos por defecto
-- de Supabase (que conceden TODO a anon/authenticated en public: justo lo que
-- la migracion tiene que retirar).

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'pruebas';
grant anon, authenticated, service_role to authenticator;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  encrypted_password text,
  email_confirmed_at timestamptz default now(),
  created_at timestamptz default now()
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt()->>'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select auth.jwt()->>'role'
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
