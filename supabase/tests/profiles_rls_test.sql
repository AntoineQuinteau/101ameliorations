-- RLS tests for profiles (step 3: auth). Run with `npx supabase test db`.
begin;
select plan(5);

-- Two seed users to test "own row" vs "someone else's row" against.
-- (from supabase/seed.sql: seed-11/12 have a NULL display_name, and
-- seed-02 has 'Julien P.')
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
set local role authenticated;

-- 1. A user can rename their own profile.
select lives_ok(
  $$ update public.profiles set display_name = 'Nouveau Pseudo'
     where id = '10000000-0000-4000-8000-000000000011' $$,
  'a user can rename their own profile'
);

-- 2. A user cannot rename another profile: under RLS, an update whose USING
-- clause matches no row is a silent 0-row no-op rather than an error, so we
-- assert the value is unchanged rather than expecting an exception.
update public.profiles set display_name = 'Hacked'
  where id = '10000000-0000-4000-8000-000000000002';
select is(
  (select display_name from public.profiles
   where id = '10000000-0000-4000-8000-000000000002'),
  'Julien P.',
  'a user cannot rename another profile'
);

-- 3. A user cannot promote themselves to admin.
select throws_ok(
  $$ update public.profiles set role = 'admin'
     where id = '10000000-0000-4000-8000-000000000011' $$,
  'only an admin can change a profile role',
  'a user cannot promote themselves to admin'
);

-- 4. A user cannot self-assign an organization (guard added by this step's
-- migration: organization is shown publicly via klashes_public and must stay
-- admin-only, like role).
select throws_ok(
  $$ update public.profiles set organization = 'CAPB'
     where id = '10000000-0000-4000-8000-000000000011' $$,
  'only an admin can change a profile organization',
  'a user cannot self-assign an organization'
);

-- 5. display_name outside 2-40 chars is rejected by the CHECK constraint.
select throws_ok(
  $$ update public.profiles set display_name = 'A'
     where id = '10000000-0000-4000-8000-000000000011' $$,
  'new row for relation "profiles" violates check constraint "profiles_display_name_check"',
  'a display_name shorter than 2 characters is rejected'
);

select * from finish();
rollback;
