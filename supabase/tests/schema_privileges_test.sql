-- Guards the schema/table grants restored by
-- 20260918172310_public_schema_grants.sql. Run with `npx supabase test db`.
--
-- IMPORTANT LOCAL-TEST LIMITATION: the first checks below (schema USAGE,
-- table SELECT) cannot actually catch a missing-grants regression when run
-- through `supabase test db` locally. `supabase db reset` never reproduces
-- the failure mode this migration fixes, because `auto_expose_new_tables`
-- (config.toml, defaults to true when unset) re-exposes every table to
-- anon/authenticated/service_role regardless of what any migration grants —
-- confirmed by removing this migration, resetting, and observing
-- `pg_namespace.nspacl` for `public` still fully populated. So these
-- assertions pass whether or not 20260918172310_public_schema_grants.sql
-- exists; they document the expected state and would fail if `revoke`
-- statements were ever added by mistake, but they are not a regression
-- guard for the original bug. The actual regression guard is running
-- `supabase db reset --linked` against a hosted project (STAGING) and
-- checking `pg_namespace.nspacl` / `has_schema_privilege` there directly —
-- see the plan's verification steps.
--
-- The second half of this file (revoked functions) IS a real regression
-- guard: it would fail if a future change ever re-opened one of these
-- SECURITY DEFINER functions via a blanket `grant ... on all functions`.
begin;
select plan(10);

-- ---------- schema usage ----------
select ok(
  has_schema_privilege('anon', 'public', 'USAGE'),
  'anon has USAGE on schema public'
);
select ok(
  has_schema_privilege('authenticated', 'public', 'USAGE'),
  'authenticated has USAGE on schema public'
);
select ok(
  has_schema_privilege('service_role', 'public', 'USAGE'),
  'service_role has USAGE on schema public'
);

-- ---------- table access ----------
select ok(
  has_table_privilege('anon', 'public.klashes_public', 'SELECT'),
  'anon can select from public.klashes_public'
);
select ok(
  has_table_privilege('authenticated', 'public.klashes', 'SELECT'),
  'authenticated can select from public.klashes'
);

-- ---------- deliberately revoked functions must stay closed ----------
select ok(
  not has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE'),
  'anon cannot execute delete_my_account'
);
select ok(
  not has_function_privilege('anon', 'public.get_klash_author_contact(uuid)', 'EXECUTE'),
  'anon cannot execute get_klash_author_contact'
);
select ok(
  not has_function_privilege('anon', 'public.purge_author_contact_lookups()', 'EXECUTE'),
  'anon cannot execute purge_author_contact_lookups'
);
select ok(
  not has_function_privilege('anon', 'public.find_profile_by_email(text)', 'EXECUTE'),
  'anon cannot execute find_profile_by_email'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.change_klash_status(uuid, public.klash_status, text)',
    'EXECUTE'
  ),
  'anon cannot execute change_klash_status'
);

select * from finish();
rollback;
