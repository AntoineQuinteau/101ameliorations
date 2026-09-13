-- Step 4 (create): the behaviour-gating triggers deferred by the initial
-- migration, plus the RPCs the creation flow needs (duplicate detection and
-- a safe insert path for a PostGIS point).

-- ---------- Fix: confirmations_count never updated for non-author confirms ----------
-- refresh_confirmations_count() (initial migration) runs its `update
-- public.klashes` as the calling role, under RLS. Confirming someone else's
-- klash is exactly the normal case (an author can't confirm their own), and
-- no klashes UPDATE policy grants a plain `user` write access to a klash they
-- don't own — so the trigger's update silently touched 0 rows and the
-- counter stayed stuck at 0. Only surfaced now: step 4 is the first write
-- path for `confirmations`. security definer makes the trigger's own update
-- bypass RLS, like current_user_role()/handle_new_user() already do for
-- other maintenance work.
create or replace function public.refresh_confirmations_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.klash_id, old.klash_id);
begin
  update public.klashes k
     set confirmations_count = (
       select count(*) from public.confirmations c where c.klash_id = target
     )
   where k.id = target;
  return null;
end;
$$;

-- ---------- Trigger: reject a klash outside the service area ----------
-- Reads the bbox from `settings` (never hardcoded) so it stays adjustable
-- without a migration, per spec §4.
create or replace function public.enforce_service_area()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  bbox jsonb;
  lng double precision;
  lat double precision;
begin
  select value into bbox from public.settings where key = 'service_area_bbox';

  lng := extensions.st_x(new.location::extensions.geometry);
  lat := extensions.st_y(new.location::extensions.geometry);

  if lat < (bbox->>'min_lat')::double precision
     or lat > (bbox->>'max_lat')::double precision
     or lng < (bbox->>'min_lng')::double precision
     or lng > (bbox->>'max_lng')::double precision then
    raise exception 'location outside service area';
  end if;

  return new;
end;
$$;

create trigger klashes_enforce_service_area
  before insert or update of location on public.klashes
  for each row execute function public.enforce_service_area();

-- ---------- Trigger: rate limit klash creation (spec §4: 10 / 24h) ----------
-- Comment creation gets the same treatment at step 6, once comments have a
-- write path — writing it now would be untestable dead code.
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
    from public.klashes
   where author_id = new.author_id
     and created_at > now() - interval '24 hours';

  if recent_count >= 10 then
    raise exception 'rate limit exceeded: max 10 klashes per 24h';
  end if;

  return new;
end;
$$;

create trigger klashes_enforce_rate_limit
  before insert on public.klashes
  for each row execute function public.enforce_rate_limit();

-- ---------- RPC: klashes_nearby (duplicate detection, spec §6.2) ----------
-- Active klashs within radius_m metres: excludes rejected/duplicate, and
-- resolved klashs older than 30 days (spec §4) — a shorter cutoff than
-- klashes_in_bbox's 90 days, since a long-resolved klash is a poor duplicate
-- candidate for someone reporting a fresh problem right now.
--
-- Parameters are prefixed (origin_lat/origin_lng) rather than bare lat/lng:
-- klashes_public has its own lat/lng columns, and inside `select v.*` a bare
-- identifier that matches both a column and a parameter name resolves to the
-- column — silently comparing every row's own position to itself instead of
-- to the query point.
create function public.klashes_nearby(
  origin_lat double precision,
  origin_lng double precision,
  radius_m double precision
)
returns setof public.klashes_public
language sql
stable
set search_path = ''
as $$
  select v.*
  from public.klashes_public v
  join public.klashes k on k.id = v.id
  where extensions.st_dwithin(
          k.location,
          extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography,
          radius_m
        )
    and v.status not in ('rejected', 'duplicate')
    and (v.status <> 'resolved' or v.resolved_at > now() - interval '30 days')
  order by v.created_at desc
  limit 50;
$$;

grant execute on function public.klashes_nearby(
  double precision, double precision, double precision
) to anon, authenticated;

-- ---------- RPC: create_klash ----------
-- A plain client-side insert on `klashes` can't cleanly build a
-- geography(point,4326) through PostgREST (the column types as `unknown`),
-- and wouldn't return the klashes_public shape (lat/lng/author_display_name)
-- the app needs to render the freshly created klash. This RPC builds the
-- point server-side, inserts as a normal row (still subject to
-- klashes_insert_own RLS and the two triggers above — no bypass), and hands
-- back the row re-read through klashes_public.
create function public.create_klash(
  lat double precision,
  lng double precision,
  category public.klash_category,
  urgency public.klash_urgency,
  title text,
  description text
)
returns public.klashes_public
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
  result public.klashes_public;
begin
  insert into public.klashes (author_id, location, category, urgency, title, description)
  values (
    auth.uid(),
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
    category,
    urgency,
    title,
    description
  )
  returning id into new_id;

  select * into result from public.klashes_public where id = new_id;
  return result;
end;
$$;

grant execute on function public.create_klash(
  double precision, double precision, public.klash_category, public.klash_urgency, text, text
) to authenticated;
