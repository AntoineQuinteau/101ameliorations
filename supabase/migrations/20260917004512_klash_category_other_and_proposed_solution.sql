-- Two independent additions to `klashes`, done together because both need
-- the same drop/recreate cycle of klashes_public + the three functions that
-- return `setof public.klashes_public` — doing it twice would mean two
-- chances for a verbatim recreation to drift.
--
-- 1. category_other: a free-text precision, required when category is
--    'category_7' ("Autre (préciser)") and forbidden otherwise. The enum
--    values themselves were added in the previous migration (must be
--    committed before use — see that file).
-- 2. proposed_solution: an optional free-text field, same shape as
--    description, letting the reporter suggest a fix.

alter table public.klashes
  add column category_other text check (char_length(category_other) <= 120);

-- Named explicitly: Postgres would otherwise auto-name a column-level check
-- "klashes_category_other_check" too, colliding with the length check just
-- above (verified locally — "constraint already exists").
alter table public.klashes add constraint klashes_category_other_required_check check (
  (category = 'category_7' and category_other is not null
     and char_length(btrim(category_other)) > 0)
  or (category <> 'category_7' and category_other is null)
);

alter table public.klashes
  add column proposed_solution text check (char_length(proposed_solution) <= 2000);

-- ---------- Drop the four functions that return klashes_public ----------
-- Must go before the view can be dropped and recreated. change_klash_status
-- (20260915075244_klash_lifecycle.sql) is the fourth one — easy to miss
-- since it postdates the other three by a separate migration.
drop function public.create_klash(
  double precision, double precision, public.klash_category, public.klash_urgency, text, text
);
drop function public.klashes_in_bbox(
  double precision, double precision, double precision, double precision
);
drop function public.klashes_nearby(double precision, double precision, double precision);
drop function public.change_klash_status(uuid, public.klash_status, text);

drop view public.klashes_public;

-- ---------- klashes_public: recreated with the two new columns ----------
create view public.klashes_public
  with (security_invoker = on) as
select
  k.id,
  k.author_id,
  extensions.st_y(k.location::extensions.geometry) as lat,
  extensions.st_x(k.location::extensions.geometry) as lng,
  k.category,
  k.category_other,
  k.urgency,
  k.status,
  k.title,
  k.description,
  k.proposed_solution,
  k.duplicate_of,
  k.confirmations_count,
  k.comments_count,
  k.created_at,
  k.updated_at,
  k.resolved_at,
  p.display_name as author_display_name,
  p.organization as author_organization,
  p.role         as author_role
from public.klashes k
join public.profiles p on p.id = k.author_id;

grant select on public.klashes_public to anon, authenticated;

-- ---------- klashes_in_bbox: klashes visible on the map for a viewport ----------
-- Verbatim from 20260908184555_klashes_public_view_and_bbox_rpc.sql, unchanged
-- besides selecting through the widened klashes_public.
create function public.klashes_in_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
returns setof public.klashes_public
language sql
stable
set search_path = ''
as $$
  select v.*
  from public.klashes_public v
  join public.klashes k on k.id = v.id
  where extensions.st_intersects(
          k.location,
          extensions.st_makeenvelope(
            least(min_lng, max_lng), least(min_lat, max_lat),
            greatest(min_lng, max_lng), greatest(min_lat, max_lat),
            4326
          )::extensions.geography
        )
    and v.status not in ('rejected', 'duplicate')
    and (v.status <> 'resolved' or v.resolved_at > now() - interval '90 days')
  order by v.created_at desc
  limit 2000;
$$;

grant execute on function public.klashes_in_bbox(
  double precision, double precision, double precision, double precision
) to anon, authenticated;

-- ---------- klashes_nearby: duplicate-detection radius search ----------
-- Verbatim from 20260912064457_create_klash_behaviour.sql.
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

-- ---------- create_klash: two new trailing default params ----------
-- category_other and proposed_solution are appended last with defaults so
-- the call stays backward-compatible through PostgREST.
create function public.create_klash(
  lat double precision,
  lng double precision,
  category public.klash_category,
  urgency public.klash_urgency,
  title text,
  description text,
  category_other text default null,
  proposed_solution text default null
)
returns public.klashes_public
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
  result public.klashes_public;
begin
  insert into public.klashes (
    author_id, location, category, category_other, urgency, title, description,
    proposed_solution
  )
  values (
    auth.uid(),
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
    category,
    category_other,
    urgency,
    title,
    description,
    proposed_solution
  )
  returning id into new_id;

  select * into result from public.klashes_public where id = new_id;
  return result;
end;
$$;

grant execute on function public.create_klash(
  double precision, double precision, public.klash_category, public.klash_urgency, text, text,
  text, text
) to authenticated;

-- ---------- change_klash_status: verbatim from 20260915075244_klash_lifecycle.sql ----------
-- Unchanged body — only its return type (public.klashes_public) picks up the
-- two new columns, which is why it has to be dropped and recreated here at all.
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
-- Postgres; revoke that explicitly before granting only to authenticated —
-- same as the original migration (easy to lose in a drop/recreate).
revoke execute on function public.change_klash_status(
  uuid, public.klash_status, text
) from public, anon;
grant execute on function public.change_klash_status(
  uuid, public.klash_status, text
) to authenticated;

-- ---------- guard_klash_authority_columns: extend the forbidden-column list ----------
-- An authority may only change a klash's status; category_other and
-- proposed_solution join the existing list. coalesce(..., 'user') is kept
-- deliberately (not rewritten as a negated form) — see the original
-- migration's comment: current_user_role() returns NULL outside an
-- authenticated session (service_role, the seed, postgres), and a negated
-- comparison against NULL is NULL, which plpgsql treats as false, letting
-- those callers fall through into the rejection below.
create or replace function public.guard_klash_authority_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), 'user') <> 'authority' then
    return new;
  end if;

  if new.location         is distinct from old.location
     or new.category          is distinct from old.category
     or new.category_other    is distinct from old.category_other
     or new.urgency            is distinct from old.urgency
     or new.title              is distinct from old.title
     or new.description        is distinct from old.description
     or new.proposed_solution  is distinct from old.proposed_solution
     or new.duplicate_of       is distinct from old.duplicate_of
     or new.author_id          is distinct from old.author_id then
    raise exception 'an authority can only change a klash status';
  end if;

  return new;
end;
$$;

-- ---------- prevent_duplicate_klash: category_other joins the identity check ----------
-- Two "Autre" reports with different precisions are different problems, not
-- a double-submit of the same one.
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
       and k.category_other is not distinct from new.category_other
       and k.created_at > now() - interval '60 seconds'
       and extensions.st_dwithin(k.location, new.location, 0.1)
  ) into duplicate_exists;

  if duplicate_exists then
    raise exception 'duplicate klash: an identical klash was created less than 60 seconds ago';
  end if;

  return new;
end;
$$;
