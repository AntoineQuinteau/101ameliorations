-- Step 9 (hardening, spec §9). Three independent pieces that share one
-- migration because the second cannot be written without the third:
--
-- A. get_klash_author_contact() + author_contact_lookups — the audited
--    email lookup promised by spec §2 line 39, deferred from step 7.
-- B. delete_my_account() — the RGPD deletion of spec §6.5, which
--    anonymises rather than deletes.
-- C. Four RLS gaps found by auditing every policy in the initial schema
--    against the permissions table in spec §2. One of them
--    (guard_klash_authority_columns having no self-exemption) is also the
--    thing that made B impossible for an `authority` account, which is why
--    they ship together.

-- ========================================================================
-- C.1 — A moderator/admin could reassign a klash's author_id, and any
--       author could forge their own klash's counters and timestamps.
-- ========================================================================
-- Verified locally before this migration, as `authenticated` with a real
-- JWT claim:
--
--   * as a moderator: `update klashes set author_id = <self>` on someone
--     else's klash returned UPDATE 1 and the theft stuck. klashes_update_
--     staff grants moderator/admin a blanket UPDATE on every column, and
--     nothing narrowed it. Spec §2 grants staff "modifier n'importe quel
--     klash" — editing its content, not taking it over. A reassigned klash
--     vanishes from its real author's /me and is misattributed in
--     klashes_public.author_display_name.
--
--   * as a plain author on their own 'new' klash: `update klashes set
--     confirmations_count = 9999, comments_count = 9999, created_at =
--     now() - interval '5 years'` returned UPDATE 1 and all three stuck.
--     Same for `resolved_at = now() + interval '10 years'`. These columns
--     are maintained by triggers (refresh_confirmations_count,
--     refresh_comments_count, enforce_status_transition) and feed the
--     "plus confirmé" sort (§6.1), the export (§6.7), the /admin
--     statistics (§6.6) and the map's 90-day resolved filter (§11.4).
--     An RLS policy cannot say "not these columns", so — as with
--     guard_klash_authority_columns — a trigger does.
--
-- Three exemptions, each one load-bearing and each one verified:
--
--   1. pg_trigger_depth() > 1. refresh_confirmations_count() and
--      refresh_comments_count() are themselves SECURITY DEFINER UPDATEs
--      against klashes, fired from a trigger on confirmations/comments, so
--      they run at depth 2. Without this exemption, posting a comment
--      raised 'klash identity, counters and timestamps are maintained by
--      the database' from inside refresh_comments_count() and aborted the
--      insert — verified, and exactly the class of failure that
--      20260916001117 had to revert.
--
--   2. resolved_at is guarded *only when status is unchanged*. It is NOT
--      exempt via pg_trigger_depth: change_klash_status()'s own
--      `update klashes set status` is a top-level statement inside a
--      function body, i.e. depth 1, not 2 — verified, guarding resolved_at
--      unconditionally broke in_progress -> resolved outright. Pairing it
--      with `status is not distinct from old.status` lets
--      enforce_status_transition's legitimate set/clear through (that
--      trigger sorts alphabetically before this one, so its write is
--      already in `new` by the time this runs) while still rejecting a
--      direct poke at resolved_at with no status change — which is the
--      only way to forge it.
--
--   3. app.anonymising_account. delete_my_account() below is the one
--      legitimate author_id reassignment. Same transaction-local GUC idiom
--      as change_klash_status's app.status_change, set immediately before
--      the reassignments and cleared immediately after, for the same
--      reason: set_config(..., true) is transaction-scoped and PostgREST
--      runs a whole request in one transaction, so leaving it on would
--      hand a free pass to any later statement.
--
-- Not guarded here: updated_at, which set_updated_at() overwrites on every
-- UPDATE anyway (a caller's value never survives), and duplicate_of, which
-- guard_klash_authority_columns already reserves to moderator/admin.
--
-- Deliberately no "is this a real end-user session" escape hatch (unlike
-- guard_profiles_role/guard_comment_hidden/guard_klash_authority_columns,
-- which coalesce current_user_role() to 'user' so postgres/service_role
-- fall through as harmless). auth.uid() reads request.jwt.claims, a
-- session GUC independent of the Postgres role -- `set local role
-- postgres` does NOT clear it (verified locally), so this guard cannot
-- reliably tell "a fixture running as postgres" apart from "an
-- authenticated attacker who also happened to acquire the postgres role",
-- and a guard whose entire job is to stop forgery should not trust that
-- distinction. A fixture or maintenance script that legitimately needs to
-- write one of these columns disables this trigger for the statement, the
-- same established idiom already used for klashes_enforce_status_
-- transition (see docs/handoff.md's status-transition piège and
-- klash_lifecycle_test.sql's own fixtures).
create function public.guard_klash_system_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if coalesce(current_setting('app.anonymising_account', true), '') = 'on' then
    return new;
  end if;

  if new.id                  is distinct from old.id
     or new.author_id           is distinct from old.author_id
     or new.created_at          is distinct from old.created_at
     or new.confirmations_count is distinct from old.confirmations_count
     or new.comments_count      is distinct from old.comments_count
     or (new.status is not distinct from old.status
         and new.resolved_at is distinct from old.resolved_at) then
    raise exception
      'klash identity, counters and timestamps are maintained by the database';
  end if;

  return new;
end;
$$;

-- Name chosen so it sorts after klashes_enforce_status_transition among the
-- BEFORE UPDATE triggers (Postgres fires same-timing triggers in name
-- order): this one must observe the resolved_at that the transition trigger
-- has already written, not the caller's original row.
create trigger klashes_guard_system_columns
  before update on public.klashes
  for each row execute function public.guard_klash_system_columns();

-- ========================================================================
-- C.2 — An `authority` could not edit their own klash.
-- ========================================================================
-- Spec §2, row "Modifier / supprimer **son** klash, ses photos, ses
-- commentaires": ✓ for `authority`, like every other signed-in role. An
-- authority account is a person at the agglo who may also report a pothole
-- on their own commute. guard_klash_authority_columns had no self-exemption,
-- so `update klashes set title = ...` on their *own* klash raised 'an
-- authority can only change a klash status' — verified locally.
--
-- This is not only a spec deviation: it is what made delete_my_account()
-- below impossible for an authority account. That function reassigns
-- author_id, and because SECURITY DEFINER switches the *Postgres* user but
-- not auth.uid(), current_user_role() inside it still returns 'authority' —
-- so this very guard fired from inside the deletion RPC and aborted it.
-- Verified before writing the exemption.
--
-- The exemption tests old.author_id, not new.author_id: an authority must
-- not be able to grab someone else's klash by setting author_id to
-- themselves in the same statement (C.1's guard already blocks that
-- independently, but this guard should not depend on that one for its own
-- correctness). author_id also drops out of the forbidden-column list
-- below, now that C.1 owns it for every role.
create or replace function public.guard_klash_authority_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), 'user') <> 'authority' then
    return new;
  end if;

  -- Their own klash: they act as its author, not as the agglo (spec §2).
  if old.author_id = auth.uid() then
    return new;
  end if;

  if new.location            is distinct from old.location
     or new.category           is distinct from old.category
     or new.category_other     is distinct from old.category_other
     or new.urgency            is distinct from old.urgency
     or new.title              is distinct from old.title
     or new.description        is distinct from old.description
     or new.proposed_solution  is distinct from old.proposed_solution
     or new.duplicate_of       is distinct from old.duplicate_of then
    raise exception 'an authority can only change a klash status';
  end if;

  return new;
end;
$$;

-- ========================================================================
-- C.3 — klash_photos.storage_path was not validated against klash_id.
-- ========================================================================
-- A user could insert a klash_photos row whose storage_path pointed at a
-- different klash's Storage folder than the klash_id column named —
-- verified: `insert into klash_photos (klash_id, author_id, storage_path)
-- values (<own klash>, auth.uid(), '<someone else klash id>/x.jpg')`
-- returned INSERT 1. The bucket is public read either way (spec §5), so
-- nothing is disclosed that was not already — this is a display-integrity
-- bug (a photo rendered under the wrong klash), not a privacy one. Same
-- regex-then-cast idiom the storage.objects policies already use, and the
-- same reasoning for it: casting a malformed prefix straight to uuid
-- raises rather than just failing the comparison, so the regex guard must
-- short-circuit first.
alter table public.klash_photos
  add constraint klash_photos_storage_path_prefix_check
  check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  );

create or replace function public.guard_klash_photo_storage_path()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if ((string_to_array(new.storage_path, '/'))[1])::uuid <> new.klash_id then
    raise exception 'a photo storage_path must be under its own klash_id folder';
  end if;
  return new;
end;
$$;

create trigger klash_photos_guard_storage_path
  before insert on public.klash_photos
  for each row execute function public.guard_klash_photo_storage_path();

-- ========================================================================
-- A — get_klash_author_contact() and its audit trail (spec §2 line 39)
-- ========================================================================
-- "Les rôles moderator, authority et admin peuvent consulter l'email de
-- l'auteur d'un klash depuis la page détail (RPC get_klash_author_contact
-- (klash_id), security definer, journalisée). Cette consultation est
-- mentionnée dans la politique de confidentialité."
--
-- The audit table is what makes that sentence true. Design notes:
--
--  * Readable by `admin` only, not by all staff. A moderator able to read
--    this log would see which authority contacted which author and when —
--    a second-order disclosure the privacy policy would then also have to
--    cover. Admin-only keeps the promise to exactly what §2 states.
--
--  * No INSERT, UPDATE or DELETE policy at all. The only writer is the
--    SECURITY DEFINER function below, whose owner (postgres) has
--    BYPASSRLS. So the log is append-only *from the function*, and nobody
--    — including an admin — can forge or erase an entry. Verified locally:
--    an admin's `delete from author_contact_lookups` reports DELETE 0, and
--    an `insert` raises 'new row violates row-level security policy'.
--
--  * The email itself is deliberately NOT stored here. The log records
--    that a lookup happened, by whom, on which klash; the address is
--    already one join away in auth.users for anyone who may legitimately
--    read it. Copying it in would create a second, longer-lived store of
--    personal data with weaker access control than auth.users itself.
--
--  * looked_up_role is denormalised on purpose. profiles.role is mutable
--    by an admin; the log must say what the actor's role *was* at the
--    moment of the lookup, which is what an RGPD access request or an
--    abuse investigation actually asks.
--
--  * The audit row lives in the caller's transaction, deliberately. If the
--    transaction rolls back, the function's return value never reached the
--    client either — nothing was disclosed, so there is nothing to
--    journal. Making the row survive a rollback would require an
--    autonomous transaction (dblink is available on this platform but not
--    installed), i.e. a new extension dependency whose only effect would
--    be to record disclosures that did not happen. PostgREST runs one RPC
--    per request and commits it, so in the real path the row lands.
create table public.author_contact_lookups (
  id             uuid primary key default gen_random_uuid(),
  klash_id       uuid not null references public.klashes (id) on delete cascade,
  looked_up_by   uuid not null references public.profiles (id) on delete cascade,
  author_id      uuid not null references public.profiles (id) on delete cascade,
  looked_up_role public.user_role not null,
  created_at     timestamptz not null default now()
);

create index author_contact_lookups_created_at_idx
  on public.author_contact_lookups (created_at desc);
create index author_contact_lookups_klash_id_idx
  on public.author_contact_lookups (klash_id, created_at desc);

alter table public.author_contact_lookups enable row level security;

create policy author_contact_lookups_select_admin on public.author_contact_lookups
  for select using (public.current_user_role() = 'admin');

-- SECURITY DEFINER for one reason: auth.users is not reachable from the
-- client (no RLS policies exist on Supabase's own auth schema, so
-- PostgREST does not expose it) and holds the only copy of the email. Same
-- shape as find_profile_by_email (20260915081200_admin_role_management.sql).
--
-- Being SECURITY DEFINER, it never trusts an argument for identity: the
-- actor is always auth.uid(). And it returns exactly one email for one
-- klash id — never a list, never a search — so it cannot be turned into an
-- enumeration oracle by a staff account.
create function public.get_klash_author_contact(klash_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor       uuid := auth.uid();
  actor_role  public.user_role;
  target      uuid;
  contact     text;
begin
  if actor is null then
    raise exception 'authentication required to look up a klash author contact';
  end if;

  actor_role := public.current_user_role();

  if coalesce(actor_role, 'user') not in ('moderator', 'authority', 'admin') then
    raise exception
      'only a moderator, an authority or an admin can look up a klash author contact';
  end if;

  select k.author_id into target
    from public.klashes k
   where k.id = get_klash_author_contact.klash_id;

  if target is null then
    raise exception 'klash % not found', get_klash_author_contact.klash_id;
  end if;

  select u.email into contact from auth.users u where u.id = target;

  -- Journalised before returning, not after: a failure to write the audit
  -- row must abort the disclosure, not follow it.
  insert into public.author_contact_lookups
    (klash_id, looked_up_by, author_id, looked_up_role)
  values
    (get_klash_author_contact.klash_id, actor, target, actor_role);

  return contact;
end;
$$;

-- SECURITY DEFINER functions are granted EXECUTE to PUBLIC by default in
-- Postgres; revoke that explicitly before granting only to authenticated.
revoke execute on function public.get_klash_author_contact(uuid) from public, anon;
grant execute on function public.get_klash_author_contact(uuid) to authenticated;

-- ---------- purge_author_contact_lookups() ----------
-- The audit log otherwise grows without bound. The privacy policy commits
-- to a 12-month retention window for it; this function is what makes that
-- true, but nothing in this step schedules it — it exists to be called
-- (from a future pg_cron job or an operator running it by hand), not to run
-- itself. admin-gated for the same reason the table's own SELECT policy is:
-- purging is also a form of controlling what the audit trail shows.
create function public.purge_author_contact_lookups()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), 'user') <> 'admin' then
    raise exception 'only an admin can purge author contact lookups';
  end if;

  delete from public.author_contact_lookups
   where created_at < now() - interval '12 months';
end;
$$;

revoke execute on function public.purge_author_contact_lookups() from public, anon;
grant execute on function public.purge_author_contact_lookups() to authenticated;

-- ========================================================================
-- B — Account deletion (RGPD, spec §6.5)
-- ========================================================================
-- "suppression de compte (RGPD : anonymise les klashs — author_id vers un
-- profil « compte supprimé » — plutôt que les supprimer, pour préserver la
-- donnée collective ; l'utilisateur en est informé)."
--
-- The sentinel profile. profiles.id references auth.users(id), so a
-- profiles row cannot exist on its own — verified: inserting one directly
-- raises 'violates foreign key constraint "profiles_id_fkey"'. The
-- sentinel therefore has to be a real auth.users row, seeded here with a
-- fixed uuid so delete_my_account() can name it as a constant.
--
-- It is seeded unloginable rather than merely unused:
--   * email is a reserved-TLD address, deleted-account@101ameliorations
--     .invalid. RFC 2606 reserves .invalid so it can never resolve or
--     receive mail — no OTP can ever reach this account. Chosen over a
--     NULL email (which is equally unreachable today, since Supabase Auth
--     looks accounts up by email and NULL matches nothing) because a NULL
--     email depends on auth.users.email staying nullable; a real,
--     unreachable address survives a future NOT NULL constraint on that
--     column without orphaning every anonymised klash's author_id.
--   * encrypted_password is NULL and email_confirmed_at is NULL — no
--     password path, no confirmed session.
--
-- handle_new_user() fires on this insert and creates the matching profiles
-- row (verified), so only display_name has to be filled in afterwards. The
-- update runs with profiles_guard_role left alone: it only guards `role`
-- and `organization`, neither of which is touched. Both statements are
-- written to be re-runnable.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'deleted-account@101ameliorations.invalid', null, null,
  '{"provider":"email","providers":[]}'::jsonb,
  '{}'::jsonb,
  false, false, now(), now(), '', '', '', ''
)
on conflict (id) do nothing;

-- The label is user-visible, so it is French — it is data, not UI text, and
-- so does not belong in src/i18n/fr.ts (same reasoning as supabase/seed.sql).
update public.profiles
   set display_name = 'Compte supprimé'
 where id = '00000000-0000-4000-8000-000000000001';

-- ---------- delete_my_account() ----------
-- Order of operations is forced by the foreign keys, not chosen:
--
--   profiles.id references auth.users on delete cascade, while
--   klashes.author_id, klash_photos.author_id, comments.author_id and
--   status_changes.changed_by all reference profiles(id) with NO cascade.
--   So deleting the auth.users row cascades to profiles and then hits
--   'update or delete on table "profiles" violates foreign key constraint
--   "klashes_author_id_fkey"' — verified locally. Reassignment must
--   therefore complete before the auth.users delete, not after.
--
--   confirmations.user_id is the one FK with on delete cascade, so those
--   rows do not need reassigning. They are deleted explicitly anyway,
--   before the cascade would do it, so that refresh_confirmations_count()
--   fires while the klashes rows are still there and the counters land
--   correctly. A "+1" is a personal endorsement, not collective data: it
--   is withdrawn, not transferred. Transferring them would also break
--   confirmations' primary key the moment two deleted accounts had
--   confirmed the same klash.
--
-- SECURITY DEFINER is required twice over: the reassignments touch rows the
-- caller has no UPDATE policy for (a comment they left on someone else's
-- klash is covered, but status_changes has no UPDATE policy at all), and
-- the auth.users delete needs the owner's BYPASSRLS — auth.users has RLS
-- enabled with zero policies, so even a grant-holding non-owner sees no
-- rows. Verified: a postgres-owned definer function called as
-- `authenticated` does delete the row, and profiles cascades with it.
--
-- The row lock (select ... for update on the caller's own profile) is the
-- same insurance change_klash_status takes on the klash it is about to
-- change: it serialises this against a concurrent staff edit landing
-- mid-anonymisation, at the cost of one row lock the caller already owns
-- the right to take.
--
-- Three trigger interactions, all verified against a live database:
--
--   1. guard_klash_authority_columns fired on the klashes reassignment and
--      aborted the whole function for an `authority` caller —
--      current_user_role() reads the caller's JWT, which SECURITY DEFINER
--      does not change. Fixed in C.2 above (own-klash exemption), which
--      covers it: by definition every klash being reassigned here is the
--      caller's own.
--   2. guard_klash_system_columns (C.1) guards author_id for every role,
--      so it would block this too. Hence app.anonymising_account, set and
--      cleared around the reassignments only.
--   3. guard_comment_hidden does not fire: it triggers on `hidden`
--      changing, and this only touches author_id. A moderator-hidden
--      comment stays hidden after anonymisation — verified.
--
-- Known and accepted: set_updated_at() fires on every reassigned klash and
-- comment, stamping updated_at = now(). Every anonymised klash therefore
-- reads as "Modifié" on the day the account was deleted. This is the same
-- cosmetic debt already logged in docs/handoff.md for hidden comments. It
-- is not worked around here: suppressing it would mean either disabling
-- the trigger (which needs table ownership and is not transaction-safe
-- under concurrent writes) or adding a second GUC to set_updated_at, and
-- neither is worth it for a timestamp on an anonymised row.
--
-- Storage photos are NOT deleted, and cannot be: storage.protect_objects_
-- delete rejects any direct DELETE on storage.objects even from a SECURITY
-- DEFINER function, and because that raise happens inside the caller's
-- statement it aborts the whole thing — this is precisely what
-- 20260916001117_drop_klash_photo_objects_trigger.sql had to revert. The
-- photos stay attached to the now-anonymous klash, which is the intended
-- outcome anyway: spec §6.5 preserves the collective data, and a photo of
-- a pothole carries no identity (EXIF is stripped client-side, §6.2). The
-- client must still remove any object it wants gone before calling this
-- RPC, via the Storage API.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor    uuid := auth.uid();
  sentinel constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  if actor is null then
    raise exception 'authentication required to delete an account';
  end if;

  if actor = sentinel then
    raise exception 'the deleted-account profile cannot be deleted';
  end if;

  perform 1 from public.profiles where id = actor for update;

  perform set_config('app.anonymising_account', 'on', true);

  update public.klashes        set author_id  = sentinel where author_id  = actor;
  update public.klash_photos   set author_id  = sentinel where author_id  = actor;
  update public.comments       set author_id  = sentinel where author_id  = actor;
  update public.status_changes set changed_by = sentinel where changed_by = actor;

  -- Cleared immediately, not left for end of transaction — same reasoning
  -- as change_klash_status's app.status_change: set_config(..., true) is
  -- transaction-scoped and PostgREST runs a whole request in one
  -- transaction, so leaving it on would exempt any later statement.
  perform set_config('app.anonymising_account', 'off', true);

  -- Withdrawn, not transferred (see the header note).
  delete from public.confirmations where user_id = actor;

  -- Cascades to public.profiles and to every auth.* table (identities,
  -- sessions, refresh tokens, one_time_tokens, mfa_factors, …), all of
  -- which reference auth.users with on delete cascade.
  delete from auth.users where id = actor;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- The sentinel must stay a plain, unpromotable account ----------
-- It owns every anonymised klash, so promoting it to `moderator` or
-- `authority` would silently relabel all of them (klashes_public exposes
-- author_role and author_organization next to every klash) and, worse,
-- current_user_role() would grant those powers to anyone who ever managed
-- to authenticate as it. Belt and braces on top of the unreachable email:
-- profiles_update_admin gives an admin an unrestricted UPDATE on any
-- profile, and this is the one row where that is not wanted.
create function public.guard_deleted_account_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id = '00000000-0000-4000-8000-000000000001'
     and (new.role is distinct from old.role
          or new.organization is distinct from old.organization) then
    raise exception 'the deleted-account profile cannot be given a role or an organization';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_deleted_account
  before update on public.profiles
  for each row execute function public.guard_deleted_account_profile();
