-- RLS + trigger tests for klash photos (step 5). Run with `npx supabase test db`.
--
-- Self-contained: creates its own auth.users and klashes fixtures inside this
-- transaction, so it also passes against a database reset with `--no-seed`
-- (as CI does). Uses a UUID range disjoint from the seed's 10000000-... range
-- and the existing aaaaaaaa-.../bbbbbbbb-... ranges from earlier steps.
--
-- Two things this file cannot cover, verified manually instead (README /
-- preview checks):
-- - The bucket's own file_size_limit and allowed_mime_types, enforced by the
--   Storage service from storage.buckets, not a Postgres constraint.
-- - The storage.objects DELETE policy: Supabase's storage extension installs
--   a statement-level `protect_objects_delete` trigger that unconditionally
--   rejects any direct SQL `delete from storage.objects` (even for a
--   superuser), regardless of RLS — real deletes only happen through the
--   Storage API, which this suite doesn't call. The policy still exists and
--   matters for that path; it just isn't exercisable from pgTAP.
begin;
select plan(8);

-- Two fixture users: one klash author, one unrelated user.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   'cccccccc-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'photo-test-author@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'cccccccc-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'photo-test-other@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

-- Two klashes owned by the author: one is driven to the 3-photo cap (for the
-- limit test), the other stays empty so the non-author-insert test (6) hits
-- the RLS check rather than tripping enforce_photo_limit() first — a BEFORE
-- ROW trigger runs before the INSERT policy's WITH CHECK is evaluated, so
-- reusing the capped klash there would test the wrong rejection reason.
-- Inserted as `postgres` to bypass the creation triggers entirely
-- (irrelevant to what's under test here).
set local role postgres;
insert into public.klashes (id, author_id, location, category, urgency, title)
values
  ('cccccccc-1111-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Klash test photos'),
  ('cccccccc-1111-4000-8000-000000000002',
   'cccccccc-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Klash test photos (empty)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 1. The klash author can insert a storage object under their klash's folder.
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('klash-photos', 'cccccccc-1111-4000-8000-000000000001/photo1.jpg',
             'cccccccc-0000-4000-8000-000000000001') $$,
  'the klash author can upload an object under their klash id'
);

-- 2. A malformed folder segment (not a uuid) is rejected without raising a
-- hard error (the regex guard short-circuits before the uuid cast, which
-- otherwise throws on invalid input rather than failing the comparison).
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('klash-photos', 'not-a-uuid/photo.jpg',
             'cccccccc-0000-4000-8000-000000000001') $$,
  'new row violates row-level security policy for table "objects"',
  'a malformed klash id segment is rejected by RLS, not a cast error'
);

-- 3. A user cannot upload under a klash they do not author.
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('klash-photos', 'cccccccc-1111-4000-8000-000000000001/photo2.jpg',
             'cccccccc-0000-4000-8000-000000000002') $$,
  'new row violates row-level security policy for table "objects"',
  'a non-author cannot upload under someone else''s klash'
);

-- 4. Back to the author: klash_photos insert succeeds and is capped at 3.
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  format(
    $$ insert into public.klash_photos (klash_id, author_id, storage_path)
       values ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p1.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p2.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p3.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p4.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p5.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p6.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p7.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p8.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p9.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p10.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p11.jpg'),
              ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p12.jpg') $$,
    'cccccccc-0000-4000-8000-000000000001'
  ),
  'the klash author can insert up to 12 photos'
);

select throws_ok(
  format(
    $$ insert into public.klash_photos (klash_id, author_id, storage_path)
       values ('cccccccc-1111-4000-8000-000000000001', '%1$s', 'cccccccc-1111-4000-8000-000000000001/p13.jpg') $$,
    'cccccccc-0000-4000-8000-000000000001'
  ),
  'photo limit exceeded: max 12 photos per klash',
  'a 13th photo on the same klash is rejected by enforce_photo_limit'
);

-- 5. A non-author cannot insert a klash_photos row for someone else's klash
-- (the other, still-empty klash, so this hits the RLS check rather than the
-- photo-limit trigger).
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  format(
    $$ insert into public.klash_photos (klash_id, author_id, storage_path)
       values ('cccccccc-1111-4000-8000-000000000002', '%1$s', 'cccccccc-1111-4000-8000-000000000002/hack.jpg') $$,
    'cccccccc-0000-4000-8000-000000000002'
  ),
  'new row violates row-level security policy for table "klash_photos"',
  'a non-author cannot insert a klash_photos row for someone else''s klash'
);

-- 6. Public (anon) select is allowed on both storage.objects and klash_photos.
reset role;
set local role anon;

select isnt_empty(
  $$ select 1 from storage.objects
      where bucket_id = 'klash-photos'
        and name = 'cccccccc-1111-4000-8000-000000000001/photo1.jpg' $$,
  'anon can read a klash-photos storage object'
);

select isnt_empty(
  $$ select 1 from public.klash_photos
      where klash_id = 'cccccccc-1111-4000-8000-000000000001' $$,
  'anon can read klash_photos rows'
);

select * from finish();
rollback;
