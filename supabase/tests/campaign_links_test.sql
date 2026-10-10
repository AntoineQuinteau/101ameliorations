-- Tests for campaign links (20261009090000_campaign_links.sql): access
-- control, slug uniqueness and immutability, value validation, resolution of
-- active / deactivated / unknown links. Run with `npx supabase test db`.
--
-- Self-contained, like the other files here: own fixtures, UUID range
-- cccccccc-... (disjoint from the other tests and the seed).
begin;
select plan(33);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   'cccccccc-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'campaign-test-user@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'cccccccc-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'campaign-test-moderator@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'cccccccc-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'campaign-test-manager@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'cccccccc-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'campaign-test-admin@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

set local role postgres;
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles set role = 'moderator'
 where id = 'cccccccc-0000-4000-8000-000000000002';
update public.profiles set can_manage_campaigns = true
 where id = 'cccccccc-0000-4000-8000-000000000003';
update public.profiles set role = 'admin'
 where id = 'cccccccc-0000-4000-8000-000000000004';
alter table public.profiles enable trigger profiles_guard_role;
reset role;

-- ---------- convention helpers ----------
select is(public.normalize_campaign_token('  Papillon Vélo ! '), 'papillon-velo',
  'normalize: lowercase, no accents, hyphens');
select ok(public.is_campaign_token('lancement-2026-10'), 'valid token accepted');
select ok(
  not public.is_campaign_token('Lancement') and not public.is_campaign_token('a b')
  and not public.is_campaign_token('a--b') and not public.is_campaign_token('-a')
  and not public.is_campaign_token('é') and not public.is_campaign_token(repeat('a', 65)),
  'invalid tokens rejected');

-- ---------- initial data ----------
select is((select count(*)::int from public.campaign_links
            where campaign = 'lancement-2026-10'), 8, 'the 8 launch links exist');

-- ---------- access control ----------
-- Anonymous: no direct access, but resolution works.
set local role anon;
select throws_ok($$ select * from public.campaign_links $$, '42501', null,
  'anon cannot read campaign_links');
select throws_ok($$ select * from public.campaign_link_scans $$, '42501', null,
  'anon cannot read campaign_link_scans');
select throws_ok(
  $$ select public.create_campaign_link('txdo', 'print', 'x-2026-10', 'a') $$, '42501', null,
  'anon cannot create a link');
reset role;

-- Plain user and moderator: nothing visible, cannot create.
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.campaign_links), 0,
  'a plain user sees no link');
select throws_ok(
  $$ select public.create_campaign_link('txdo', 'print', 'x-2026-10', 'a') $$,
  'only a campaign manager can create a campaign link',
  'a plain user cannot create a link');
select throws_ok(
  $$ update public.profiles set can_manage_campaigns = true
      where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'only an admin can change a profile campaign right',
  'a user cannot grant themselves the campaign right');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.campaign_links), 0,
  'a moderator without the right sees no link');
select throws_ok(
  $$ select public.create_campaign_link('txdo', 'print', 'x-2026-10', 'a') $$,
  'only a campaign manager can create a campaign link',
  'a moderator without the right cannot create a link');
reset role;

-- Manager (flag): full access.
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.campaign_links), 8,
  'a manager sees the links');

-- ---------- creation, slugs, uniqueness ----------
select is(
  (select slug from public.create_campaign_link(
    'cpam', 'print', 'Rentrée 2026-11', 'Dépliant Vélo Été')),
  'cpam-depliant',
  'slug = source + first word of the content');
select is(
  (select campaign || '/' || content from public.campaign_links where slug = 'cpam-depliant'),
  'rentree-2026-11/depliant-velo-ete',
  'campaign and content are normalized');
select is(
  (select slug from public.create_campaign_link(
    'cpam', 'print', 'rentree-2026-11', 'depliant-ecole')),
  'cpam-depliant-ecole',
  'first word taken -> whole content');
select is(
  (select slug from public.create_campaign_link(
    'cpam', 'print', 'autre-2026-12', 'depliant-ecole')),
  'cpam-depliant-ecole-2',
  'whole content taken -> numeric suffix');
select throws_ok(
  $$ select public.create_campaign_link('cpam', 'print', 'rentree-2026-11', 'depliant-ecole') $$,
  'a link for this source, medium, campaign and content already exists',
  'the same source/medium/campaign/content cannot be created twice');
select is(
  (select slug from public.create_campaign_link('presse', 'press', 'autre-2026-12', '')),
  'presse-2',
  'empty content: source alone, then suffix');
select throws_ok(
  $$ select public.create_campaign_link('unknown', 'print', 'x-2026-10', 'a') $$,
  'unknown campaign source', 'unknown source rejected');
select throws_ok(
  $$ select public.create_campaign_link('cpam', 'print', '  ', 'a') $$,
  'a campaign is required', 'empty campaign rejected');
select throws_ok(
  $$ select public.create_campaign_link('cpam', 'print', 'c-2026', 'a', '//evil.example') $$,
  null, 'a protocol-relative destination is rejected');

-- A slug truncated to 64 characters never ends with a hyphen.
select is(
  (select slug from public.create_campaign_link(
    'cpam', 'print', 'long-2026-12', repeat('a', 58) || ' b c')),
  'cpam-' || repeat('a', 58),
  'first-word slug of a long content is valid');
select is(
  (select slug from public.create_campaign_link(
    'cpam', 'email', 'long-2026-12', repeat('a', 58) || ' b c')),
  'cpam-' || repeat('a', 57) || '-2',
  'a truncated slug gets its suffix within 64 characters, without a double hyphen');

-- ---------- immutability ----------
select throws_ok(
  $$ update public.campaign_links set slug = 'other' where slug = 'cpam-mail' $$,
  42501, null, 'slug cannot be updated (no column privilege)');
reset role;
-- Even a superuser path (postgres) cannot rewrite the identity or delete.
select throws_ok(
  $$ update public.campaign_links set campaign = 'x' where slug = 'cpam-mail' $$,
  'only the destination and the active flag of a campaign link can change',
  'the utm values are frozen for everyone');
select throws_ok(
  $$ delete from public.campaign_links where slug = 'cpam-mail' $$,
  'a campaign link cannot be deleted, only deactivated',
  'a link cannot be deleted');

-- Deleting the account that created a link keeps the link (author cleared).
select lives_ok(
  $$ delete from auth.users where id = 'cccccccc-0000-4000-8000-000000000003' $$,
  'the creator of a link can be deleted');

-- ---------- resolution ----------
select is(
  (select source || '|' || medium || '|' || campaign || '|' || content || '|' || destination
     from public.resolve_campaign_link('cpam-papillon')),
  'cpam|print|lancement-2026-10|papillon-velo|/',
  'an active link resolves');
select is((select count(*)::int from public.campaign_link_scans
            where slug = 'cpam-papillon' and link_was_active), 1,
  'the pass is logged');

update public.campaign_links set is_active = false where slug = 'cpam-affiche';
select is((select count(*)::int from public.resolve_campaign_link('cpam-affiche')), 0,
  'a deactivated link resolves to nothing');
select is((select count(*)::int from public.campaign_link_scans
            where slug = 'cpam-affiche' and not link_was_active), 1,
  'a pass on a deactivated link is logged as inactive');
select is((select count(*)::int from public.resolve_campaign_link('nope')), 0,
  'an unknown slug resolves to nothing');

select * from finish();
rollback;
