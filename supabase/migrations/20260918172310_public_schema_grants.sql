-- Restore the schema-level and table-level privileges a hosted Supabase
-- project normally gets from the platform at creation time, and make them
-- part of the migration history instead of invisible environment state.
--
-- On a hosted project, Supabase grants `usage on schema public` to
-- anon/authenticated/service_role and sets `alter default privileges` so
-- that every future table/sequence/function in `public` is automatically
-- granted to those roles. No migration in this repo has ever needed to
-- write a table-level grant because of that: the defaults did it silently.
--
-- `supabase db reset --linked` runs `drop schema public cascade; create
-- schema public;`. The new schema starts with a null ACL, and the
-- `alter default privileges` entries were attached to the dropped schema,
-- so they vanish with it. Migrations replay and recreate every table, but
-- nothing grants access to them any more — which is exactly what broke
-- STAGING after a reset (42501 permission denied for schema/table).
--
-- Locally, `supabase start` papers over the same gap via
-- `auto_expose_new_tables` (config.toml), which defaults to true when
-- unset. That is why this was never caught in CI.
--
-- This migration makes the grants explicit and idempotent, so that
-- `supabase db reset` reconstructs a working database on any project —
-- local, staging or production — without depending on platform bootstrap.
-- Security remains enforced by RLS (see supabase/tests/), not by table
-- grants: this matches Supabase's own default posture.

grant usage on schema public to postgres, anon, authenticated, service_role;

-- Cover objects created by future migrations.
alter default privileges for role postgres in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to postgres, anon, authenticated, service_role;

-- Cover objects already created by earlier migrations (defaults above only
-- apply going forward).
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Deliberately NOT `grant all on all functions`: several SECURITY DEFINER
-- functions had EXECUTE explicitly revoked from anon/public in earlier
-- migrations, and a blanket grant would silently re-open them. Postgres
-- already grants EXECUTE to PUBLIC by default, so those functions remain
-- reachable through targeted grants; re-apply every prior revoke here so
-- this migration can never widen access by accident.
revoke execute on function public.find_profile_by_email(text) from public, anon;
revoke execute on function public.change_klash_status(
  uuid, public.klash_status, text
) from public, anon;
revoke execute on function public.get_klash_author_contact(uuid) from public, anon;
revoke execute on function public.purge_author_contact_lookups() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
