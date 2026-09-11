-- RLS tests for profiles (step 3: auth). Run with `npx supabase test db`.
--
-- Self-contained: creates its own auth.users fixtures inside this
-- transaction rather than depending on supabase/seed.sql, so it also
-- passes against a database reset with `--no-seed` (as CI does). Uses a
-- UUID range disjoint from the seed's 10000000-... range to avoid any
-- collision if this ever runs against a seeded database too.
begin;
select plan(5);

-- Two fixture users to test "own row" vs "someone else's row" against.
-- handle_new_user() (trigger on auth.users insert) creates the matching
-- public.profiles row for each.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'rls-test-self@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'rls-test-other@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

update public.profiles set display_name = 'Autre Personne'
  where id = 'aaaaaaaa-0000-4000-8000-000000000002';

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 1. A user can rename their own profile.
select lives_ok(
  $$ update public.profiles set display_name = 'Nouveau Pseudo'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'a user can rename their own profile'
);

-- 2. A user cannot rename another profile: under RLS, an update whose USING
-- clause matches no row is a silent 0-row no-op rather than an error, so we
-- assert the value is unchanged rather than expecting an exception.
update public.profiles set display_name = 'Hacked'
  where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select is(
  (select display_name from public.profiles
   where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  'Autre Personne',
  'a user cannot rename another profile'
);

-- 3. A user cannot promote themselves to admin.
select throws_ok(
  $$ update public.profiles set role = 'admin'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'only an admin can change a profile role',
  'a user cannot promote themselves to admin'
);

-- 4. A user cannot self-assign an organization (guard added by this step's
-- migration: organization is shown publicly via klashes_public and must stay
-- admin-only, like role).
select throws_ok(
  $$ update public.profiles set organization = 'CAPB'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'only an admin can change a profile organization',
  'a user cannot self-assign an organization'
);

-- 5. display_name outside 2-40 chars is rejected by the CHECK constraint.
select throws_ok(
  $$ update public.profiles set display_name = 'A'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'new row for relation "profiles" violates check constraint "profiles_display_name_check"',
  'a display_name shorter than 2 characters is rejected'
);

select * from finish();
rollback;
