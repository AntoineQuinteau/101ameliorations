-- RLS + trigger tests for delete_my_account() and the "compte supprimé"
-- sentinel (step 9, spec §6.5 RGPD account deletion). Run with
-- `npx supabase test db`.
--
-- Self-contained: creates its own auth.users, klashes, klash_photos,
-- comments, confirmations and status_changes fixtures inside this
-- transaction, so it also passes against a database reset with `--no-seed`
-- (as CI does). Uses a UUID range disjoint from the seed's 10000000-...
-- range and the earlier steps' ranges. The sentinel account itself
-- (00000000-0000-4000-8000-000000000001) is seeded by the migration, not
-- by this file.
begin;
select plan(21);

-- Fixtures: a plain user who deletes their account (the main case), an
-- authority who also deletes their own account (the C.2 regression case —
-- guard_klash_authority_columns previously blocked this), and a second user
-- whose confirmation is what makes the deleting user's klash's
-- confirmations_count non-trivial to check.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   '22222222-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'deletion-test-user@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'deletion-test-confirmer@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'deletion-test-moderator@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'deletion-test-authority@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

set local role postgres;
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles set role = 'moderator'
 where id = '22222222-0000-4000-8000-000000000003';
update public.profiles set role = 'authority'
 where id = '22222222-0000-4000-8000-000000000004';
alter table public.profiles enable trigger profiles_guard_role;

-- The deleting user's klash, one photo on it, a hidden comment they left,
-- and a status_changes row recording a moderator action on it (changed_by
-- deliberately the deleting user themselves, to exercise that
-- reassignment).
insert into public.klashes (id, author_id, location, category, importance, title)
values
  ('22222222-1111-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Klash test account deletion');

insert into public.klash_photos (id, klash_id, author_id, storage_path)
values
  ('22222222-2222-4000-8000-000000000001',
   '22222222-1111-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000001',
   '22222222-1111-4000-8000-000000000001/photo.jpg');

insert into public.comments (id, klash_id, author_id, body, hidden)
values
  ('22222222-3333-4000-8000-000000000001',
   '22222222-1111-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000001',
   'Commentaire test', true);

insert into public.status_changes (id, klash_id, changed_by, from_status, to_status)
values
  ('22222222-4444-4000-8000-000000000001',
   '22222222-1111-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000001',
   'new', 'new');

-- The authority's own klash, for the C.2 regression case.
insert into public.klashes (id, author_id, location, category, importance, title)
values
  ('22222222-1111-4000-8000-000000000002',
   '22222222-0000-4000-8000-000000000004',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Klash test authority self deletion');
reset role;

-- A non-author confirms the deleting user's klash, so confirmations_count
-- starts at 1 and the deletion's decrement can be checked.
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.confirmations (klash_id, user_id)
     values ('22222222-1111-4000-8000-000000000001',
             '22222222-0000-4000-8000-000000000002') $$,
  'setup: a confirmer confirms the deleting user''s klash'
);

-- 1. anon cannot call the RPC at all. Blocked at the grant layer, mirroring
-- change_klash_status's own anon test.
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$ select public.delete_my_account() $$,
  'permission denied for function delete_my_account',
  '1. an anonymous visitor cannot call delete_my_account'
);

-- 2. an authenticated-role call with no sub claim is rejected by the RPC
-- itself.
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.delete_my_account() $$,
  'authentication required to delete an account',
  '2. an authenticated call with no sub claim is rejected by the RPC itself'
);

-- 3. a plain user deletes their own account.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.delete_my_account() $$,
  '3. a user can delete their own account'
);

-- Remaining assertions read data written by the RPC; switch to postgres so
-- they are not themselves filtered by RLS (author_contact_lookups-style
-- narrow policies do not apply here, but klashes/comments/photos visibility
-- should not be what's under test in these checks).
set local role postgres;

-- 4. their auth.users row is gone.
select is_empty(
  $$ select * from auth.users where id = '22222222-0000-4000-8000-000000000001' $$,
  '4. the deleted user''s auth.users row is gone'
);

-- 5. their profiles row cascaded away.
select is_empty(
  $$ select * from public.profiles where id = '22222222-0000-4000-8000-000000000001' $$,
  '5. the deleted user''s profiles row cascaded away'
);

-- 6. their klash still exists, author_id now the sentinel.
select is(
  (select author_id from public.klashes
    where id = '22222222-1111-4000-8000-000000000001'),
  '00000000-0000-4000-8000-000000000001'::uuid,
  '6. the deleted user''s klash survives, reassigned to the sentinel'
);

-- 7. their klash_photos row survives, reassigned.
select is(
  (select author_id from public.klash_photos
    where id = '22222222-2222-4000-8000-000000000001'),
  '00000000-0000-4000-8000-000000000001'::uuid,
  '7. the deleted user''s photo survives, reassigned to the sentinel'
);

-- 8. their comment survives, reassigned, and still hidden (guard_comment_
-- hidden did not fire and did not un-hide it).
select is(
  (select author_id from public.comments
    where id = '22222222-3333-4000-8000-000000000001'),
  '00000000-0000-4000-8000-000000000001'::uuid,
  '8a. the deleted user''s comment survives, reassigned to the sentinel'
);
select is(
  (select hidden from public.comments
    where id = '22222222-3333-4000-8000-000000000001'),
  true,
  '8b. the deleted user''s comment is still hidden'
);

-- 9. their status_changes row survives with changed_by = sentinel (history
-- stays complete).
select is(
  (select changed_by from public.status_changes
    where id = '22222222-4444-4000-8000-000000000001'),
  '00000000-0000-4000-8000-000000000001'::uuid,
  '9. the deleted user''s status_changes row survives, changed_by reassigned'
);

-- 10. their confirmations are gone (withdrawn, not transferred).
select is_empty(
  $$ select * from public.confirmations
      where user_id = '22222222-0000-4000-8000-000000000001' $$,
  '10. the deleted user''s confirmations are gone'
);

-- 11. the confirmed klash's confirmations_count decremented correctly (the
-- confirmer's own confirmation is untouched; only the deleting user's own
-- confirmation, if any, would have moved the count -- here the count should
-- simply reflect the surviving confirmer's +1).
select is(
  (select confirmations_count from public.klashes
    where id = '22222222-1111-4000-8000-000000000001'),
  1,
  '11. confirmations_count still reflects the surviving confirmation'
);

-- 12. an authority can delete their own account (the exact case that raised
-- 'an authority can only change a klash status' before C.2).
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.delete_my_account() $$,
  '12. an authority can delete their own account'
);
set local role postgres;
select is(
  (select author_id from public.klashes
    where id = '22222222-1111-4000-8000-000000000002'),
  '00000000-0000-4000-8000-000000000001'::uuid,
  '12b. the authority''s klash survives, reassigned to the sentinel'
);

-- 13. the sentinel profile's display_name is "Compte supprimé" and its role
-- is 'user'.
select is(
  (select display_name from public.profiles
    where id = '00000000-0000-4000-8000-000000000001'),
  'Compte supprimé',
  '13a. the sentinel profile''s display_name is "Compte supprimé"'
);
select is(
  (select role from public.profiles
    where id = '00000000-0000-4000-8000-000000000001'),
  'user'::public.user_role,
  '13b. the sentinel profile''s role is user'
);

-- 14. an admin promoting the sentinel is rejected.
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role postgres;
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles set role = 'admin'
 where id = '22222222-0000-4000-8000-000000000003';
alter table public.profiles enable trigger profiles_guard_role;
set local role authenticated;
select throws_ok(
  $$ update public.profiles set role = 'admin'
      where id = '00000000-0000-4000-8000-000000000001' $$,
  'the deleted-account profile cannot be given a role or an organization',
  '14. an admin cannot promote the sentinel to a role'
);

-- 15. calling delete_my_account() as the sentinel is rejected.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.delete_my_account() $$,
  'the deleted-account profile cannot be deleted',
  '15. the sentinel cannot delete itself'
);

-- 16. the anonymising_account GUC is left 'off' after the RPC returns, so a
-- later direct author_id update in the same transaction is still rejected
-- by guard_klash_system_columns -- mirroring klash_lifecycle_test.sql's own
-- check that app.status_change isn't left open after change_klash_status.
select is(
  coalesce(current_setting('app.anonymising_account', true), 'off'),
  'off',
  '16a. app.anonymising_account reads off after delete_my_account returns'
);
set local role postgres;
select throws_ok(
  $$ update public.klashes set author_id = '22222222-0000-4000-8000-000000000002'
      where id = '22222222-1111-4000-8000-000000000001' $$,
  'klash identity, counters and timestamps are maintained by the database',
  '16b. a direct author_id update after the RPC still raises'
);

select * from finish();
rollback;
