-- Server-side guard against a klash being created two or three times from a
-- single user action (double-tapped submit button, a re-entrant client, a
-- retried request). The client-side fixes that ship alongside this migration
-- close the known paths, but they are all bypassable — this is the guarantee.
--
-- Why a trigger and not a partial unique index: the rule is "no identical
-- klash from the same author within 60 seconds", and a unique index cannot
-- express that. Index predicates and expressions must be IMMUTABLE, and
-- `now()` is STABLE — `create unique index ... where created_at > now() -
-- interval '60 seconds'` is rejected outright by Postgres. A time window that
-- slides has to be evaluated per-insert, which is what a trigger does.
--
-- "Identical" is deliberately narrow: same author, same title, same category,
-- and the same position rounded to ~0.1 m. A genuine second report at the
-- same spot within 60s is almost always a different problem, and so differs
-- by title or category and passes freely.
create or replace function public.prevent_duplicate_klash()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  duplicate_exists boolean;
begin
  select exists (
    select 1
      from public.klashes k
     where k.author_id = new.author_id
       and k.title = new.title
       and k.category = new.category
       and k.created_at > now() - interval '60 seconds'
       -- Compare positions by distance rather than by geography equality:
       -- two taps send bit-identical coordinates, but a jittering GPS pin
       -- can shift the last decimal between retries. 0.1 m is far below any
       -- meaningful move of the pin and well under the 50 m duplicate radius.
       and extensions.st_dwithin(k.location, new.location, 0.1)
  ) into duplicate_exists;

  if duplicate_exists then
    raise exception 'duplicate klash: an identical klash was created less than 60 seconds ago';
  end if;

  return new;
end;
$$;

-- Runs before klashes_enforce_rate_limit (triggers of the same timing fire in
-- alphabetical order: klashes_enforce_* then klashes_prevent_*), so a genuine
-- rate-limit breach still reports as such.
create trigger klashes_prevent_duplicate
  before insert on public.klashes
  for each row execute function public.prevent_duplicate_klash();
