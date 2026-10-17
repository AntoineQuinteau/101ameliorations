-- Tests for the klash administrative area (20261016200000_communes_reference.sql
-- and 20261016200100_klash_admin_area.sql): the commune / EPCI of a klash is
-- derived from its position by the database and cannot be forged by a client.
-- Run with `npx supabase test db`.
--
-- Self-contained: the fixture communes are two squares in the open sea off
-- the Landes coast (inside the service area, far from any real commune), so
-- the test also passes against a database where the real communes are loaded.
-- UUID range ffffffff-..., disjoint from the other tests and the seed.
begin;
select plan(30);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   'ffffffff-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'admin-area-test-author@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

-- Testville (99001) is west of Voisinville (99002); they share the meridian
-- -2.15. Testville belongs to an EPCI, Voisinville to none.
insert into public.communes (insee_code, name, epci_siren, epci_name, cog_year, geom) values
  ('99001', 'Testville', '999999999', 'CA Test', 2026,
   extensions.st_multi(extensions.st_makeenvelope(-2.25, 43.90, -2.15, 44.00, 4326))),
  ('99002', 'Voisinville', null, null, 2026,
   extensions.st_multi(extensions.st_makeenvelope(-2.15, 43.90, -2.05, 44.00, 4326)));

-- ---------- communes: read-only for the API roles ----------
set local role anon;
select ok(
  (select count(*) from public.communes where insee_code in ('99001', '99002')) = 2,
  'anon can read communes'
);
select throws_ok(
  $$ insert into public.communes (insee_code, name, cog_year, geom)
     values ('99003', 'Intruse', 2026,
             extensions.st_multi(extensions.st_makeenvelope(0, 43, 0.1, 43.1, 4326))) $$,
  '42501', null, 'anon cannot insert a commune'
);
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.communes (insee_code, name, cog_year, geom)
     values ('99003', 'Intruse', 2026,
             extensions.st_multi(extensions.st_makeenvelope(0, 43, 0.1, 43.1, 4326))) $$,
  '42501', null, 'authenticated cannot insert a commune'
);
select throws_ok(
  $$ update public.communes set name = 'Piratée' where insee_code = '99001' $$,
  '42501', null, 'authenticated cannot update a commune'
);
select throws_ok(
  $$ delete from public.communes where insee_code = '99001' $$,
  '42501', null, 'authenticated cannot delete a commune'
);
select throws_ok(
  $$ truncate public.communes $$,
  '42501', null, 'authenticated cannot truncate communes'
);

-- ---------- internal functions are not API endpoints ----------
select ok(
  not has_function_privilege('anon', 'public.refresh_klash_admin_areas()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.refresh_klash_admin_areas()', 'EXECUTE'),
  'API roles cannot execute refresh_klash_admin_areas'
);
select ok(
  not has_function_privilege('anon', 'public.find_commune(extensions.geography)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.find_commune(extensions.geography)', 'EXECUTE'),
  'API roles cannot execute find_commune'
);
select ok(
  not has_function_privilege('authenticated', 'public.set_klash_admin_area()', 'EXECUTE'),
  'authenticated cannot execute the trigger function directly'
);

-- ---------- area derived at creation ----------
select is(
  (select insee_code from public.create_klash(43.95, -2.20, 'category_1', 'medium', 'Klash Testville', null)),
  '99001'::char(5),
  'a klash inside Testville gets its INSEE code'
);
select is(
  (select commune_name from public.klashes_public where title = 'Klash Testville'),
  'Testville',
  'the commune name is exposed through klashes_public'
);
select is(
  (select epci_siren from public.klashes_public where title = 'Klash Testville'),
  '999999999'::char(9),
  'the EPCI SIREN is exposed through klashes_public'
);
select is(
  (select epci_name from public.klashes_public where title = 'Klash Testville'),
  'CA Test',
  'the EPCI name is exposed through klashes_public'
);

select is(
  (select insee_code from public.create_klash(43.95, -2.10, 'category_2', 'medium', 'Klash Voisinville', null)),
  '99002'::char(5),
  'a klash inside the neighbouring commune gets its own code'
);
select is(
  (select epci_siren from public.klashes_public where title = 'Klash Voisinville'),
  null,
  'a commune without EPCI leaves the EPCI columns null'
);

select is(
  (select insee_code from public.create_klash(43.95, -2.2504, 'category_3', 'medium', 'Klash au bord', null)),
  '99001'::char(5),
  'a point a few metres outside a commune is attached to the nearest one'
);

select is(
  (select insee_code from public.create_klash(43.95, -2.26, 'category_4', 'medium', 'Klash au large', null)),
  null,
  'a point more than ~100 m from every commune has no INSEE code'
);
select is(
  (select commune_name from public.klashes_public where title = 'Klash au large'),
  null,
  'and no commune name'
);

-- Spanish side of the service area (Navarre).
select is(
  (select insee_code from public.create_klash(42.90, -1.50, 'category_5', 'medium', 'Klash espagnol', null)),
  null,
  'a klash in Spain has no INSEE code'
);

-- ---------- a client cannot forge or clear the area ----------
update public.klashes
   set insee_code = '75056', commune_name = 'Paris', epci_siren = '200054781', epci_name = 'Forgé'
 where title = 'Klash Testville';
select is(
  (select insee_code || '/' || commune_name || '/' || epci_siren || '/' || epci_name
     from public.klashes where title = 'Klash Testville'),
  '99001/Testville/999999999/CA Test',
  'direct writes to the area columns are overwritten with the stored values'
);

update public.klashes set insee_code = '75056' where title = 'Klash au large';
select is(
  (select insee_code from public.klashes where title = 'Klash au large'),
  null,
  'a forged code on a klash outside every commune is discarded too'
);

update public.klashes set title = 'Klash Testville bis' where title = 'Klash Testville';
select is(
  (select insee_code from public.klashes where title = 'Klash Testville bis'),
  '99001'::char(5),
  'an unrelated edit leaves the area untouched'
);

-- Moving the pin recomputes the area.
update public.klashes
   set location = extensions.st_setsrid(extensions.st_makepoint(-2.08, 43.93), 4326)::extensions.geography
 where title = 'Klash Testville bis';
select is(
  (select insee_code from public.klashes where title = 'Klash Testville bis'),
  '99002'::char(5),
  'moving the position recomputes the commune'
);
select is(
  (select epci_siren from public.klashes where title = 'Klash Testville bis'),
  null,
  'and the EPCI with it'
);

-- ---------- refresh_klash_admin_areas ----------
reset role;
select set_config('test.updated_at_before',
  (select updated_at::text from public.klashes where title = 'Klash Voisinville'), true);

update public.communes set name = 'Voisinville-sur-Mer', epci_siren = '888888888', epci_name = 'CC Voisine'
 where insee_code = '99002';
select is(
  (select commune_name from public.klashes where title = 'Klash Voisinville'),
  'Voisinville',
  'changing communes alone does not rewrite existing klashes (frozen at report time)'
);

select lives_ok($$ select public.refresh_klash_admin_areas() $$, 'the owner can refresh the areas');
select is(
  (select commune_name || '/' || epci_siren from public.klashes where title = 'Klash Voisinville'),
  'Voisinville-sur-Mer/888888888',
  'a refresh applies the current communes to existing klashes'
);
select is(
  (select updated_at::text from public.klashes where title = 'Klash Voisinville'),
  current_setting('test.updated_at_before'),
  'a refresh does not touch updated_at'
);
select is(
  (select insee_code from public.klashes where title = 'Klash au large'),
  null,
  'a refresh leaves a klash outside every commune without a code'
);
select is(
  (select array_agg(tgname::text order by tgname)
     from pg_trigger
    where tgrelid = 'public.klashes'::regclass
      and tgname in ('klashes_set_admin_area', 'klashes_set_updated_at')
      and tgenabled = 'O'),
  array['klashes_set_admin_area', 'klashes_set_updated_at'],
  'both triggers are enabled again after a refresh'
);

select * from finish();
rollback;
