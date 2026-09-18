-- RLS + trigger tests for get_klash_author_contact() and its audit trail,
-- author_contact_lookups (step 9, spec §2 line 39). Run with
-- `npx supabase test db`.
--
-- Self-contained: creates its own auth.users and klashes fixtures inside this
-- transaction, so it also passes against a database reset with `--no-seed`
-- (as CI does). Uses a UUID range disjoint from the seed's 10000000-... range
-- and the earlier steps' aaaaaaaa-.../.../eeeeeeee-... ranges.
begin;
select plan(13);

-- Five fixture users: a klash author, a plain user, a moderator, an
-- authority and an admin. Roles are set directly as postgres, since
-- guard_profiles_role blocks a non-admin from changing their own role.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'contact-test-author@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '11111111-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'contact-test-user@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '11111111-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'contact-test-moderator@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '11111111-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'contact-test-authority@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '11111111-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'contact-test-admin@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

set local role postgres;
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles set role = 'moderator'
 where id = '11111111-0000-4000-8000-000000000003';
update public.profiles set role = 'authority'
 where id = '11111111-0000-4000-8000-000000000004';
update public.profiles set role = 'admin'
 where id = '11111111-0000-4000-8000-000000000005';
alter table public.profiles enable trigger profiles_guard_role;

-- One klash, owned by the author, to look up.
insert into public.klashes (id, author_id, location, category, urgency, title)
values
  ('11111111-1111-4000-8000-000000000001',
   '11111111-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Klash test author contact');
reset role;

-- 1. A plain user cannot look up an author's contact.
select set_config('request.jwt.claims',
  '{"sub":"11111111-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.get_klash_author_contact('11111111-1111-4000-8000-000000000001') $$,
  'only a moderator, an authority or an admin can look up a klash author contact',
  '1. a user cannot look up a klash author contact'
);

-- 2. anon cannot call the RPC at all. Blocked at the grant layer, mirroring
-- change_klash_status's own anon test.
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$ select public.get_klash_author_contact('11111111-1111-4000-8000-000000000001') $$,
  'permission denied for function get_klash_author_contact',
  '2. an anonymous visitor cannot call get_klash_author_contact'
);

-- 3. an authenticated-role call with no sub claim is rejected by the RPC
-- itself, mirroring change_klash_status's own test 31b.
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.get_klash_author_contact('11111111-1111-4000-8000-000000000001') $$,
  'authentication required to look up a klash author contact',
  '3. an authenticated call with no sub claim is rejected by the RPC itself'
);

-- 4. a moderator gets the author's exact email.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"11111111-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select public.get_klash_author_contact('11111111-1111-4000-8000-000000000001')),
  'contact-test-author@101ameliorations.test',
  '4. a moderator can look up a klash author contact'
);

-- 5. an authority gets it too.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"11111111-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select public.get_klash_author_contact('11111111-1111-4000-8000-000000000001')),
  'contact-test-author@101ameliorations.test',
  '5. an authority can look up a klash author contact'
);

-- 6. an admin gets it too.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"11111111-0000-4000-8000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select public.get_klash_author_contact('11111111-1111-4000-8000-000000000001')),
  'contact-test-author@101ameliorations.test',
  '6. an admin can look up a klash author contact'
);

-- 7. an unknown klash id raises rather than returning null silently.
select throws_ok(
  $$ select public.get_klash_author_contact('00000000-0000-4000-8000-000000000000') $$,
  'klash 00000000-0000-4000-8000-000000000000 not found',
  '7. get_klash_author_contact on a non-existent klash raises'
);

-- 8. exactly 3 audit rows exist after tests 4-6 (test 7 raised before
-- reaching the insert, so it left no row), each pointing at the right klash
-- and author.
select is(
  (select count(*) from public.author_contact_lookups
    where klash_id = '11111111-1111-4000-8000-000000000001'
      and author_id = '11111111-0000-4000-8000-000000000001'),
  3::bigint,
  '8. exactly 3 audit rows were written, one per successful lookup'
);

-- 9. looked_up_role is recorded correctly for the moderator's lookup
-- (test 4), proving the denormalisation actually captures the actor's role
-- at lookup time rather than a placeholder.
select is(
  (select looked_up_role from public.author_contact_lookups
    where looked_up_by = '11111111-0000-4000-8000-000000000003'),
  'moderator'::public.user_role,
  '9. looked_up_role is recorded as moderator for the moderator lookup'
);

-- 10. a moderator cannot read the audit log (admin-only read).
reset role;
select set_config('request.jwt.claims',
  '{"sub":"11111111-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is_empty(
  $$ select * from public.author_contact_lookups $$,
  '10. a moderator cannot read the author contact lookup log'
);

-- 11. an admin can read it.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"11111111-0000-4000-8000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty(
  $$ select * from public.author_contact_lookups $$,
  '11. an admin can read the author contact lookup log'
);

-- 12. even an admin cannot forge or erase an entry: no INSERT/UPDATE/DELETE
-- policy exists, so a direct delete is a silent 0-row no-op and a direct
-- insert is rejected outright.
select is(
  (select count(*) from public.author_contact_lookups),
  3::bigint,
  '12a. an admin deleting from author_contact_lookups affects no rows (before)'
);
delete from public.author_contact_lookups;
select is(
  (select count(*) from public.author_contact_lookups),
  3::bigint,
  '12b. an admin deleting from author_contact_lookups affects no rows (after)'
);

select * from finish();
rollback;
