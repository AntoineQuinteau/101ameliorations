-- Step 7: klash lifecycle (spec §3, §4, §5). Closes the status transition
-- graph, the history it must produce, and three access-control gaps the
-- graph exposes once it exists. In order:
--
-- 1. can_change_klash_status(): the single source of truth for the graph in
--    spec §3, shared by the trigger and the RPC below (and callable by the
--    front-end via RPC, so a future admin UI can ask the database what is
--    allowed instead of duplicating the rule).
-- 2. enforce_status_transition(): a BEFORE UPDATE OF status trigger on
--    klashes, and change_klash_status(): the SECURITY DEFINER RPC that is
--    the only supported way to call it.
--
--    Design choice — the RPC does the work, the trigger only guards it.
--    enforce_status_transition() has no access to the application's
--    optional note: a BEFORE UPDATE trigger sees only the old/new rows, and
--    `note` is not a klashes column. The alternative was smuggling the note
--    through a transaction-local GUC that the trigger reads. Rejected,
--    for three reasons:
--      a. A GUC carrying the note can't tell "the RPC passed no note" apart
--         from "nobody called the RPC" — both read back NULL. Distinguishing
--         them needs a second, boolean GUC, which is this design with an
--         extra moving part.
--      b. set_config(..., true) is transaction-local, not statement-local.
--         Every pgTAP test file is one transaction (see
--         supabase/tests/klash_lifecycle_test.sql), so a note set by one
--         test would still be live for the next — the same hazard
--         comments_rls_test.sql already documents for request.jwt.claims.
--      c. status_changes has no INSERT policy (spec §5: "insert uniquement
--         via trigger"), so the write needs SECURITY DEFINER regardless.
--         Doing it where the note already is, rather than shipping the note
--         to a trigger to do it there, is one fewer hop.
--
--    The trigger is not a rubber stamp: it re-validates the whole graph via
--    can_change_klash_status(), so a bug in the RPC still cannot produce an
--    illegal transition. It additionally rejects any status change that did
--    not come through the RPC (checked via a transaction-local boolean GUC,
--    set immediately before the RPC's UPDATE and cleared immediately after),
--    which is what keeps status_changes a complete history.
--
-- 3. Closing the author escape hatch verified locally before this migration:
--    klashes_update_author_new's WITH CHECK didn't reassert status = 'new',
--    so an author could take their own 'new' klash straight to 'resolved'.
-- 4. guard_klash_authority_columns(): spec §5 restricts an authority to the
--    status column alone; RLS can't express "these columns only", so a
--    trigger does.
-- 5. duplicate_of guards: a CHECK against self-reference, an index, and an
--    ON DELETE SET NULL FK so deleting a klash that is some other klash's
--    duplicate target no longer raises (a moderator's "delete" action is
--    otherwise one FK violation away from failing).
-- 6. Orphaned Storage objects on klash delete (flagged as debt in
--    20260913140000_klash_photos_storage.sql): an AFTER DELETE trigger
--    removes the photo objects a moderator's deletion would otherwise leave
--    behind.

-- ---------- Which transitions each role may make (spec §3) ----------
create function public.can_change_klash_status(
  role        public.user_role,
  from_status public.klash_status,
  to_status   public.klash_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when role is null then false
    when from_status = to_status then false
    -- moderator: sorting mistakes only (spec §2, §3).
    when role in ('moderator', 'admin')
         and (
              (from_status = 'new' and to_status in ('rejected', 'duplicate'))
           or (from_status in ('rejected', 'duplicate') and to_status = 'new')
         ) then true
    -- authority: the processing pipeline, plus reopening (spec §2, §3).
    when role in ('authority', 'admin')
         and (
              (from_status = 'new'          and to_status = 'acknowledged')
           or (from_status = 'acknowledged' and to_status = 'in_progress')
           or (from_status = 'in_progress'  and to_status = 'resolved')
           or (from_status = 'resolved'     and to_status = 'in_progress')
         ) then true
    else false
  end;
$$;

grant execute on function public.can_change_klash_status(
  public.user_role, public.klash_status, public.klash_status
) to anon, authenticated;

-- ---------- Trigger: gate every status change (spec §4) ----------
create function public.enforce_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.user_role;
begin
  -- `before update of status` fires whenever the column is *named* in the
  -- SET list, even when its value is unchanged (Postgres checks the column
  -- list, not the values) — a client that PATCHes a whole row would hit this
  -- on every title edit, so the no-op case exits first, untouched.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Only change_klash_status() sets this flag, and it clears it on the very
  -- next statement. Anything else reaching here is a direct UPDATE that
  -- would leave status_changes with a hole in it.
  if coalesce(current_setting('app.status_change', true), '') <> 'on' then
    raise exception
      'a klash status can only be changed through change_klash_status()';
  end if;

  actor_role := public.current_user_role();

  if not public.can_change_klash_status(actor_role, old.status, new.status) then
    raise exception 'role % cannot change a klash status from % to %',
      coalesce(actor_role::text, 'anonymous'), old.status, new.status;
  end if;

  -- resolved_at is owned by this trigger, never by the caller: set on
  -- arrival at 'resolved', cleared on reopening. klashes_in_bbox and
  -- klashes_nearby both filter resolved klashs on
  -- `resolved_at > now() - interval '...'`, so a resolved klash with a null
  -- resolved_at silently vanishes from the map — this is the exact bug
  -- verified against klashes_update_author_new before this migration.
  if new.status = 'resolved' then
    new.resolved_at := now();
  elsif old.status = 'resolved' then
    new.resolved_at := null;
  end if;

  return new;
end;
$$;

create trigger klashes_enforce_status_transition
  before update of status on public.klashes
  for each row execute function public.enforce_status_transition();

-- ---------- RPC: change_klash_status (spec §3, §6.3) ----------
-- The only supported way to move a klash through its lifecycle. SECURITY
-- DEFINER for one reason: status_changes has a SELECT policy and no INSERT
-- policy (spec §5), so the history row cannot be written under the caller's
-- own rights. This does not widen who may change a status: the function
-- re-checks the role and the graph itself before touching anything, and the
-- trigger above checks again independently.
--
-- Being SECURITY DEFINER, it must never trust its arguments for identity:
-- the actor is always auth.uid(), never a parameter.
create function public.change_klash_status(
  klash_id  uuid,
  to_status public.klash_status,
  note      text default null
)
returns public.klashes_public
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor      uuid := auth.uid();
  actor_role public.user_role;
  from_state public.klash_status;
  result     public.klashes_public;
begin
  if actor is null then
    raise exception 'authentication required to change a klash status';
  end if;

  actor_role := public.current_user_role();

  select k.status into from_state
    from public.klashes k
   where k.id = change_klash_status.klash_id
   for update; -- serialises two concurrent moderator/authority clicks

  if from_state is null then
    raise exception 'klash % not found', change_klash_status.klash_id;
  end if;

  if not public.can_change_klash_status(actor_role, from_state, to_status) then
    raise exception 'role % cannot change a klash status from % to %',
      coalesce(actor_role::text, 'anonymous'), from_state, to_status;
  end if;

  if note is not null and char_length(note) > 500 then
    raise exception 'a status note is limited to 500 characters';
  end if;

  perform set_config('app.status_change', 'on', true);

  update public.klashes k
     set status = to_status
   where k.id = change_klash_status.klash_id;

  -- Cleared immediately, not left for end of transaction: set_config with
  -- is_local = true is transaction-scoped, and PostgREST runs a whole
  -- request in one transaction. Leaving it on would hand a free pass to any
  -- later statement against klashes in the same request.
  perform set_config('app.status_change', 'off', true);

  insert into public.status_changes (klash_id, changed_by, from_status, to_status, note)
  values (change_klash_status.klash_id, actor, from_state, to_status,
          nullif(btrim(note), ''));

  select * into result from public.klashes_public v
   where v.id = change_klash_status.klash_id;
  return result;
end;
$$;

-- SECURITY DEFINER functions are granted EXECUTE to PUBLIC by default in
-- Postgres; revoke that explicitly before granting only to authenticated.
revoke execute on function public.change_klash_status(
  uuid, public.klash_status, text
) from public, anon;
grant execute on function public.change_klash_status(
  uuid, public.klash_status, text
) to authenticated;

-- ---------- Fix: an author could take their own klash out of 'new' ----------
-- klashes_update_author_new checked `status = 'new'` in USING (the old row)
-- but not in WITH CHECK (the new row). For UPDATE, Postgres tests USING
-- against the old row and WITH CHECK against the new one, and multiple
-- permissive policies are OR-combined separately on each side — so an
-- author whose only matching policy is this one passed USING because their
-- klash was 'new', then passed WITH CHECK with *any* new status. Verified
-- locally before this migration: a plain user moved their own 'new' klash
-- straight to 'resolved', with resolved_at left null (see the trigger
-- above for why that specifically breaks the map).
--
-- Only WITH CHECK changes; USING is already correct and left untouched.
-- This fix matters only for a plain `user`: klashes_update_staff and
-- klashes_update_authority both match moderator/admin and authority
-- unconditionally on both sides regardless of this policy, which is why
-- their limits are enforced by triggers (the transition trigger above, and
-- the column guard below) rather than by narrowing this policy further.
alter policy klashes_update_author_new on public.klashes
  with check (author_id = auth.uid() and status = 'new');

-- ---------- Trigger: an authority may change only the status (spec §5) ----------
-- klashes_update_authority grants `authority` a blanket UPDATE on every
-- klash — an RLS policy cannot say "these columns only". This closes it to
-- the status column alone. duplicate_of is included in the forbidden set:
-- marking a duplicate is a moderator's sorting job (spec §2, §3), not the
-- agglo's. resolved_at is deliberately excluded: klashes_enforce_status_
-- transition sorts alphabetically before this trigger and has already set
-- or cleared it for a legitimate resolve/reopen by the time this runs, and
-- it is never caller-settable regardless. confirmations_count/
-- comments_count are excluded too: their refresh triggers are themselves
-- SECURITY DEFINER updates against klashes and must not be blocked by an
-- authority's own status change landing in the same statement.
--
-- Phrased as "raise only when the actor IS an authority", never as "raise
-- unless the actor is staff": current_user_role() returns NULL whenever
-- auth.uid() is null, which is every statement run as `postgres` or
-- service_role — including supabase/seed.sql's cleanup and duplicate_of
-- updates, and the postgres-run fixtures in supabase/tests/. Written as
-- `if current_user_role() <> 'authority'`, the comparison against NULL
-- itself evaluates to NULL, and plpgsql treats a NULL condition as false —
-- so the branch would be skipped and the seed's updates would fall through
-- into the rejection below. coalesce(..., 'user') is the same idiom already
-- used by guard_profiles_role and guard_comment_hidden.
create function public.guard_klash_authority_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), 'user') <> 'authority' then
    return new;
  end if;

  if new.location    is distinct from old.location
     or new.category     is distinct from old.category
     or new.urgency      is distinct from old.urgency
     or new.title        is distinct from old.title
     or new.description  is distinct from old.description
     or new.duplicate_of is distinct from old.duplicate_of
     or new.author_id    is distinct from old.author_id then
    raise exception 'an authority can only change a klash status';
  end if;

  return new;
end;
$$;

create trigger klashes_guard_authority_columns
  before update on public.klashes
  for each row execute function public.guard_klash_authority_columns();

-- ---------- duplicate_of guards (spec §6.6 "marquer doublon") ----------
-- No constraint stopped a klash from pointing at itself, no index backed
-- the "view original" lookup, and the FK had no ON DELETE behaviour — so
-- deleting a klash that some other klash points to as its duplicate target
-- raised a foreign key violation (supabase/seed.sql's cleanup already works
-- around this by nulling duplicate_of first). A moderator's delete action
-- needs this to just work.
alter table public.klashes
  add constraint klashes_duplicate_of_not_self check (duplicate_of is distinct from id);

create index klashes_duplicate_of_idx on public.klashes (duplicate_of);

alter table public.klashes drop constraint klashes_duplicate_of_fkey;
alter table public.klashes
  add constraint klashes_duplicate_of_fkey
  foreign key (duplicate_of) references public.klashes (id) on delete set null;

-- ---------- Orphaned Storage objects on klash delete ----------
-- Flagged as debt in 20260913140000_klash_photos_storage.sql: deleting a
-- klash cascades its klash_photos rows but leaves the Storage objects
-- behind. A moderator's delete action (spec §2) makes this reachable in
-- practice, not just in theory, so it closes here. SECURITY DEFINER because
-- deleting from storage.objects follows storage's own RLS, under which the
-- deleting user (author or moderator) may not own every photo in the set
-- (a moderator deleting someone else's klash, or a klash with photos from
-- more than one uploader once that becomes possible).
--
-- Objects are stored as '{klash_id}/{uuid}.jpg' (see the storage migration),
-- so every object for this klash shares the same first folder segment.
create function public.delete_klash_photo_objects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from storage.objects
   where bucket_id = 'klash-photos'
     and (storage.foldername(name))[1] = old.id::text;
  return old;
end;
$$;

create trigger klashes_delete_photo_objects
  after delete on public.klashes
  for each row execute function public.delete_klash_photo_objects();
