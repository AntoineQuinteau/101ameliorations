-- Removes every row created by supabase/seed.sql from a database (typically
-- production), ahead of opening the app to the public. Safe to run any time
-- before real users exist: it only touches the fixed seed-user ids below.
--
-- Must stay in sync with the seed-user ids and tables supabase/seed.sql
-- writes to (currently: 12 regular accounts + 3 step-7 staff accounts, and
-- klashes/confirmations/comments/status_changes). author_contact_lookups
-- needs no explicit delete here: both its FKs (looked_up_by, author_id) are
-- `references public.profiles (id) on delete cascade`, so it is cleared by
-- the auth.users delete below for any row a seed user appears in — as
-- looked_up_by or as author_id — regardless of which klash it references.
--
-- Usage: npx supabase db query --linked -f scripts/cleanup-seed-data.sql

begin;

create temporary table seed_user_ids (id uuid primary key);
insert into seed_user_ids (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000005'),
  ('10000000-0000-4000-8000-000000000006'),
  ('10000000-0000-4000-8000-000000000007'),
  ('10000000-0000-4000-8000-000000000008'),
  ('10000000-0000-4000-8000-000000000009'),
  ('10000000-0000-4000-8000-000000000010'),
  ('10000000-0000-4000-8000-000000000011'),
  ('10000000-0000-4000-8000-000000000012'),
  -- Step 7 staff accounts (moderator/authority/admin) seeded alongside the
  -- 12 regular accounts above.
  ('10000000-0000-4000-8000-000000000013'),
  ('10000000-0000-4000-8000-000000000014'),
  ('10000000-0000-4000-8000-000000000015');

update public.klashes set duplicate_of = null
 where author_id in (select id from seed_user_ids);
delete from public.confirmations
 where user_id in (select id from seed_user_ids)
    or klash_id in (select id from public.klashes where author_id in (select id from seed_user_ids));
-- Comments authored by a seed user are also covered by the klashes cascade
-- below when they're on a seed klash, but this delete is kept independent
-- so a seed user's comment on a non-seed klash doesn't survive (mirrors
-- supabase/seed.sql's own cleanup step).
delete from public.comments where author_id in (select id from seed_user_ids);
-- status_changes rows are written by the staff seed accounts on klashs
-- authored by other seed accounts, so — same reasoning as comments above —
-- this delete is independent of the klashes cascade below.
delete from public.status_changes where changed_by in (select id from seed_user_ids);
delete from public.klashes where author_id in (select id from seed_user_ids);
delete from auth.users where id in (select id from seed_user_ids); -- cascades profiles, author_contact_lookups

drop table seed_user_ids;

commit;
