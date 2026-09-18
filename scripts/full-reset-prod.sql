-- Full data reset for production: empties every business/user table while
-- keeping the schema, RLS policies and `public.settings` config untouched.
--
-- This does NOT remove storage objects (klash photos): storage.protect_
-- objects_delete rejects any direct DELETE on storage.objects, even from a
-- SECURITY DEFINER function (see 20260918092650_step9_hardening.sql,
-- "Storage photos are NOT deleted, and cannot be"). Empty the klash-photos
-- bucket separately via the Supabase dashboard or Storage API if you want
-- the files gone too — deleting the public.klash_photos rows below does
-- not remove the underlying files.
--
-- This is NOT the same script as cleanup-seed-data.sql: that one only
-- removes the fixed seed-user ids from supabase/seed.sql. This one removes
-- every row regardless of who created it, including real accounts. Use it
-- only when you intend to lose every real klash/account too (e.g. before
-- opening the app to the public, or to fully reset a staging project).
--
-- After running this, `auth.users` (and therefore `public.profiles`) is
-- empty, including your own admin account — see the "recreate your admin
-- account" steps in the accompanying message/runbook.
--
-- Usage: npx supabase db query --linked -f scripts/full-reset-prod.sql

begin;

-- Children first, even though most FKs already cascade from klashes/auth.users,
-- so this stays correct if a future migration removes a cascade.
delete from public.author_contact_lookups;
delete from public.status_changes;
delete from public.comments;
delete from public.confirmations;
delete from public.klash_photos;
-- duplicate_of is self-referencing; clear it before deleting klashes so no
-- row is held back by another row's still-live FK.
update public.klashes set duplicate_of = null;
delete from public.klashes;

-- Deleting auth.users cascades to public.profiles (profiles.id references
-- auth.users(id) on delete cascade).
delete from auth.users;

-- public.settings is intentionally left untouched — it is config, not data.

commit;
