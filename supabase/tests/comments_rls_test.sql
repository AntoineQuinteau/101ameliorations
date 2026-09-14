-- RLS + trigger tests for comments (step 6). Run with `npx supabase test db`.
--
-- Self-contained: creates its own auth.users and klashes fixtures inside this
-- transaction, so it also passes against a database reset with `--no-seed`
-- (as CI does). Uses a UUID range disjoint from the seed's 10000000-... range
-- and the aaaaaaaa-.../bbbbbbbb-.../cccccccc-... ranges from earlier steps.
begin;
select plan(13);

-- Three fixture users: a klash author, a commenter, and a moderator (role set
-- directly as postgres, since guard_profiles_role blocks a non-admin from
-- changing their own role).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   'dddddddd-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'comment-test-author@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'dddddddd-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'comment-test-commenter@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'dddddddd-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'comment-test-moderator@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

-- guard_profiles_role() checks current_user_role(), which reads auth.uid()
-- from the JWT claim, not the Postgres session role — so `set local role
-- postgres` alone does not bypass it. Disabling the trigger for this one
-- fixture statement is the direct way to seed a moderator without it.
set local role postgres;
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles set role = 'moderator'
 where id = 'dddddddd-0000-4000-8000-000000000003';
alter table public.profiles enable trigger profiles_guard_role;

-- One klash, owned by the author, to comment on.
insert into public.klashes (id, author_id, location, category, urgency, title)
values
  ('dddddddd-1111-4000-8000-000000000001',
   'dddddddd-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Klash test comments');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- 1. A connected user can comment on someone else's klash.
select lives_ok(
  $$ insert into public.comments (klash_id, author_id, body)
     values ('dddddddd-1111-4000-8000-000000000001',
             'dddddddd-0000-4000-8000-000000000002', 'Toujours pas repare.') $$,
  'a user can comment on someone else''s klash'
);

-- 2. comments_count is incremented by that comment — the regression test for
-- refresh_comments_count() needing security definer: the trigger's own
-- `update klashes` runs under RLS as the commenting (non-author) user, who
-- has no UPDATE policy on someone else's klash, so before the fix this
-- silently stayed at 0.
select is(
  (select comments_count from public.klashes
    where id = 'dddddddd-1111-4000-8000-000000000001'),
  1,
  'comments_count is incremented after a non-author comments'
);

-- 3. An anonymous visitor cannot comment. The JWT claim is set_config'd with
-- is_local=true, so it survives a plain `reset role` within this same
-- transaction — it must be cleared explicitly, or auth.uid() would still
-- resolve to the previous (authenticated) user and the check would pass.
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$ insert into public.comments (klash_id, author_id, body)
     values ('dddddddd-1111-4000-8000-000000000001',
             'dddddddd-0000-4000-8000-000000000002', 'Anonyme.') $$,
  'new row violates row-level security policy for table "comments"',
  'an anonymous visitor cannot comment'
);

-- 4. A connected user cannot post a comment authored as someone else.
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.comments (klash_id, author_id, body)
     values ('dddddddd-1111-4000-8000-000000000001',
             'dddddddd-0000-4000-8000-000000000001', 'Usurpation.') $$,
  'new row violates row-level security policy for table "comments"',
  'a user cannot post a comment authored as someone else'
);

-- 5. The author can edit their own comment.
select lives_ok(
  format(
    $$ update public.comments set body = 'Toujours pas repare (edite).'
        where klash_id = 'dddddddd-1111-4000-8000-000000000001'
          and author_id = '%s' $$,
    'dddddddd-0000-4000-8000-000000000002'
  ),
  'a user can edit their own comment'
);

-- 6. A different user cannot edit someone else's comment: under RLS, an
-- update whose USING clause matches no row is a silent 0-row no-op rather
-- than an error, so this is asserted with is(...) rather than throws_ok
-- (same idiom as profiles_rls_test.sql).
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

update public.comments set body = 'Pirate.'
 where klash_id = 'dddddddd-1111-4000-8000-000000000001'
   and author_id = 'dddddddd-0000-4000-8000-000000000002';

select is(
  (select body from public.comments
    where klash_id = 'dddddddd-1111-4000-8000-000000000001'
      and author_id = 'dddddddd-0000-4000-8000-000000000002'),
  'Toujours pas repare (edite).',
  'a user cannot edit another user''s comment'
);

-- 7. body outside 1-1000 chars is rejected by the CHECK constraint.
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.comments (klash_id, author_id, body)
     values ('dddddddd-1111-4000-8000-000000000001',
             'dddddddd-0000-4000-8000-000000000002', '') $$,
  'new row for relation "comments" violates check constraint "comments_body_check"',
  'an empty comment body is rejected'
);

-- 8. The 51st comment in 24h for the same author is rejected by the rate
-- limit (1 already posted in test 1, so 49 more reach the limit without
-- asserting on each one individually, then the 51st is rejected).
do $$
begin
  for i in 2..50 loop
    perform set_config('request.jwt.claims',
      '{"sub":"dddddddd-0000-4000-8000-000000000002","role":"authenticated"}', true);
    insert into public.comments (klash_id, author_id, body)
    values ('dddddddd-1111-4000-8000-000000000001',
            'dddddddd-0000-4000-8000-000000000002', 'Commentaire ' || i || '.');
  end loop;
end;
$$;

select throws_ok(
  $$ insert into public.comments (klash_id, author_id, body)
     values ('dddddddd-1111-4000-8000-000000000001',
             'dddddddd-0000-4000-8000-000000000002', 'Au dela de la limite.') $$,
  'rate limit exceeded: max 50 comments per 24h',
  'the 51st comment in 24h is rejected by the rate limit'
);

-- 9. A user cannot hide their own comment (reserved to moderator/admin).
-- Plain SQL UPDATE has no LIMIT clause, so this targets one specific row by
-- its body instead of relying on a limit.
select throws_ok(
  format(
    $$ update public.comments set hidden = true
        where klash_id = 'dddddddd-1111-4000-8000-000000000001'
          and author_id = '%s'
          and body = 'Toujours pas repare (edite).' $$,
    'dddddddd-0000-4000-8000-000000000002'
  ),
  'only a moderator can hide a comment',
  'a user cannot hide their own comment'
);

-- 10. A moderator can hide someone else's comment.
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  format(
    $$ update public.comments set hidden = true
        where klash_id = 'dddddddd-1111-4000-8000-000000000001'
          and author_id = '%s'
          and body = 'Toujours pas repare (edite).' $$,
    'dddddddd-0000-4000-8000-000000000002'
  ),
  'a moderator can hide someone else''s comment'
);

-- 11. A hidden comment is invisible to a non-staff visitor.
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
  $$ select 1 from public.comments
      where klash_id = 'dddddddd-1111-4000-8000-000000000001'
        and body = 'Toujours pas repare (edite).' $$,
  'a hidden comment is invisible to a non-staff user'
);

-- 12. A hidden comment does not count toward comments_count (50 comments
-- inserted total: 1 in test 1, 49 more in test 8's loop; 1 hidden in test 10).
select is(
  (select comments_count from public.klashes
    where id = 'dddddddd-1111-4000-8000-000000000001'),
  49,
  'a hidden comment does not count toward comments_count'
);

-- 13. The author of a hidden comment can still delete it themselves.
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  format(
    $$ delete from public.comments
        where klash_id = 'dddddddd-1111-4000-8000-000000000001'
          and author_id = '%s'
          and body = 'Toujours pas repare (edite).' $$,
    'dddddddd-0000-4000-8000-000000000002'
  ),
  'the author can delete their own comment, even hidden'
);

select * from finish();
rollback;
