-- RLS tests for public.settings (settings_select_all / settings_write_admin, initial
-- migration), exercised against the 'tile_provider' row added by
-- 20260923140000_tile_provider_setting.sql. Run with `npx supabase test db`.
--
-- No test file has covered public.settings before this one: service_area_bbox's own
-- RLS is a special case of the same two policies tested here, so this closes that gap
-- for both rows, not just tile_provider.
--
-- Self-contained: creates its own auth.users fixtures inside this transaction, so it
-- also passes against a database reset with `--no-seed` (as CI does). Uses a UUID range
-- disjoint from the seed's 10000000-... range and every other test file's own range.
begin;
select plan(8);

-- Four fixture users: a plain user, a moderator, an authority and an admin. Roles are
-- set directly as postgres, since guard_profiles_role blocks a non-admin from changing
-- their own role (same fixture pattern as author_contact_rls_test.sql).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   '22222222-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'settings-test-user@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'settings-test-moderator@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'settings-test-authority@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'settings-test-admin@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

set local role postgres;
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles set role = 'moderator'
 where id = '22222222-0000-4000-8000-000000000002';
update public.profiles set role = 'authority'
 where id = '22222222-0000-4000-8000-000000000003';
update public.profiles set role = 'admin'
 where id = '22222222-0000-4000-8000-000000000004';
alter table public.profiles enable trigger profiles_guard_role;
reset role;

-- 1. anon can read settings, including the tile_provider row this migration added.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select value #>> '{}' from public.settings where key = 'tile_provider'),
  'maptiler',
  '1. anon can read settings.tile_provider'
);

-- 2. an authenticated plain user can read it too.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty(
  $$ select * from public.settings where key = 'tile_provider' $$,
  '2. a plain user can read settings.tile_provider'
);

-- 3. a plain user cannot change it: under RLS an update whose USING clause matches no
-- row is a silent 0-row no-op rather than an error (same reasoning as
-- profiles_rls_test.sql's own "cannot rename another profile" case), so assert the
-- value is unchanged rather than expecting an exception.
update public.settings set value = '"ign"'::jsonb where key = 'tile_provider';
select is(
  (select value #>> '{}' from public.settings where key = 'tile_provider'),
  'maptiler',
  '3. a plain user cannot change settings.tile_provider'
);

-- 4. a moderator cannot change it either.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
update public.settings set value = '"ign"'::jsonb where key = 'tile_provider';
select is(
  (select value #>> '{}' from public.settings where key = 'tile_provider'),
  'maptiler',
  '4. a moderator cannot change settings.tile_provider'
);

-- 5. an authority cannot change it either.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
update public.settings set value = '"ign"'::jsonb where key = 'tile_provider';
select is(
  (select value #>> '{}' from public.settings where key = 'tile_provider'),
  'maptiler',
  '5. an authority cannot change settings.tile_provider'
);

-- 6. none of tests 3-5 left any row behind: no INSERT policy exists for anyone but
-- an admin (settings_write_admin covers "all", not just update), so a non-admin
-- inserting a brand-new key is rejected outright rather than silently no-op-ing.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.settings (key, value) values ('forged_key', '"x"'::jsonb) $$,
  'new row violates row-level security policy for table "settings"',
  '6. a plain user cannot insert a new settings row'
);

-- 7. an admin can change it.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
update public.settings set value = '"ign"'::jsonb where key = 'tile_provider';
select is(
  (select value #>> '{}' from public.settings where key = 'tile_provider'),
  'ign',
  '7. an admin can change settings.tile_provider'
);

-- 8. an admin can change it back (proving the override in test 7 wasn't a fixture
-- artefact, and that the setting is freely reversible for spec §6.1 follow-up's
-- documented "flip it back once MapTiler recovers" flow).
update public.settings set value = '"maptiler"'::jsonb where key = 'tile_provider';
select is(
  (select value #>> '{}' from public.settings where key = 'tile_provider'),
  'maptiler',
  '8. an admin can change settings.tile_provider back'
);

select * from finish();
rollback;
