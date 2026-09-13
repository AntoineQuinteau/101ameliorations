-- Step 6: comments get a write path (form on /k/:id, spec §6.3). Four
-- things needed before that path opens, none of them new schema:
--
-- 1. refresh_comments_count() gets the same security definer fix that
--    refresh_confirmations_count() got at step 4 (see
--    20260912064457_create_klash_behaviour.sql). Commenting on someone
--    else's klash is the normal case (most klashs aren't yours), and no
--    klashes UPDATE policy grants a plain `user` write access to a klash
--    they don't own — so the trigger's own `update klashes`, run under RLS
--    as the commenting user, touched 0 rows and comments_count silently
--    stayed at 0. This was invisible until now because comments had no
--    write path yet.
-- 2. A rate limit on comment creation (spec §4: 50 / 24h per user),
--    deferred from 20260912064457_create_klash_behaviour.sql "until step 6,
--    once comments have a write path". A dedicated function rather than a
--    generalised enforce_rate_limit(): that function is hardcoded to
--    public.klashes and its exact message is matched literally by
--    klash_creation_rls_test.sql, so branching it on TG_TABLE_NAME would
--    risk that test for no real gain.
-- 3. An index supporting the new trigger's lookup (author_id, created_at),
--    mirroring klashes_author_id_idx for the same query shape on klashes.
-- 4. A tightened comments_update_author_or_staff: the original policy let
--    an author flip `hidden` on their own comment, i.e. un-hide a comment a
--    moderator hid — spec §5 reserves hiding to moderator/admin. A trigger
--    (not a `with check`, which never sees the old row and so can't express
--    "hidden did not change") blocks a non-staff author from changing it.

-- ---------- Fix: comments_count never updated for a comment on someone else's klash ----------
create or replace function public.refresh_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.klash_id, old.klash_id);
begin
  update public.klashes k
     set comments_count = (
       select count(*) from public.comments c
        where c.klash_id = target and c.hidden = false
     )
   where k.id = target;
  return null;
end;
$$;

-- ---------- Trigger: rate limit comment creation (spec §4: 50 / 24h) ----------
create function public.enforce_comment_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
    from public.comments
   where author_id = new.author_id
     and created_at > now() - interval '24 hours';

  if recent_count >= 50 then
    raise exception 'rate limit exceeded: max 50 comments per 24h';
  end if;

  return new;
end;
$$;

create trigger comments_enforce_rate_limit
  before insert on public.comments
  for each row execute function public.enforce_comment_rate_limit();

-- ---------- Index: supports the rate limit trigger's per-author lookup ----------
create index comments_author_id_idx on public.comments (author_id, created_at desc);

-- ---------- Trigger: only staff may change a comment's `hidden` flag ----------
create function public.guard_comment_hidden()
returns trigger
language plpgsql
as $$
begin
  if new.hidden is distinct from old.hidden
     and coalesce(public.current_user_role(), 'user') not in ('moderator', 'admin') then
    raise exception 'only a moderator can hide a comment';
  end if;
  return new;
end;
$$;

create trigger comments_guard_hidden
  before update on public.comments
  for each row execute function public.guard_comment_hidden();
