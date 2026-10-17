-- Administrative area of a klash: INSEE code and name of the commune, SIREN and
-- name of its EPCI (intercommunalité), for the public export (spec §6.7).
--
-- The four columns are derived from `location` by trigger and can never be
-- written by a client: on insert and whenever the position changes they are
-- recomputed from `communes`; on any other update the old values are put
-- back. They are frozen at report time on purpose — a later merge of two
-- communes must not rewrite what was true when the klash was reported.
-- refresh_klash_admin_areas() recomputes them all, for the migration that
-- loads a new communes vintage.

alter table public.klashes
  add column insee_code   char(5),
  add column commune_name text,
  add column epci_siren   char(9),
  add column epci_name    text;

-- The commune containing the point; failing that, the nearest one within
-- 0.001° (about 100 m). The fallback absorbs the simplification of the stored
-- contours (slivers between neighbours, a pin on a seafront a few metres
-- outside the polygon) without ever attaching a point abroad to a French
-- commune. Nothing within reach: no row.
create function public.find_commune(point extensions.geography)
returns table (insee_code char(5), name text, epci_siren char(9), epci_name text)
language sql
stable
set search_path = ''
as $$
  with pt as (select point::extensions.geometry as g)
  select c.insee_code, c.name, c.epci_siren, c.epci_name
    from public.communes c, pt
   where extensions.st_dwithin(c.geom, pt.g, 0.001)
   order by extensions.st_contains(c.geom, pt.g) desc,
            c.geom operator(extensions.<->) pt.g
   limit 1;
$$;

-- Internal helpers: only the trigger / refresh function below (security
-- definer, so they run as the owner) call it; not an API endpoint.
revoke execute on function public.find_commune(extensions.geography)
  from public, anon, authenticated;

create function public.set_klash_admin_area()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  found record;
begin
  if tg_op = 'UPDATE' and new.location is not distinct from old.location then
    new.insee_code   := old.insee_code;
    new.commune_name := old.commune_name;
    new.epci_siren   := old.epci_siren;
    new.epci_name    := old.epci_name;
    return new;
  end if;

  select * into found from public.find_commune(new.location);
  new.insee_code   := found.insee_code;
  new.commune_name := found.name;
  new.epci_siren   := found.epci_siren;
  new.epci_name    := found.epci_name;
  return new;
end;
$$;

revoke execute on function public.set_klash_admin_area()
  from public, anon, authenticated;

-- Not "of location": it must also fire when a client updates the area
-- columns alone, to put them back.
create trigger klashes_set_admin_area
  before insert or update on public.klashes
  for each row execute function public.set_klash_admin_area();

-- Recomputes the area of every klash from the current communes. Both triggers
-- are switched off for the statement: set_klash_admin_area would restore the
-- old values, and updated_at must not move for a derived-data refresh. Owner
-- only (it disables triggers); migrations run as the owner.
create function public.refresh_klash_admin_areas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  alter table public.klashes disable trigger klashes_set_admin_area;
  alter table public.klashes disable trigger klashes_set_updated_at;

  update public.klashes k
     set insee_code   = f.insee_code,
         commune_name = f.name,
         epci_siren   = f.epci_siren,
         epci_name    = f.epci_name
    from (select id, location from public.klashes) l
    left join lateral public.find_commune(l.location) f on true
   where k.id = l.id;

  alter table public.klashes enable trigger klashes_set_admin_area;
  alter table public.klashes enable trigger klashes_set_updated_at;
end;
$$;

revoke execute on function public.refresh_klash_admin_areas() from public, anon, authenticated;

-- ---------- klashes_public: the same view plus the four columns ----------
-- Bodies below are copied verbatim from 20260923071551_rename_urgency_to_importance.sql
-- (view, klashes_in_bbox, klashes_nearby, create_klash, change_klash_status);
-- only the view gains columns. The functions return `setof klashes_public`
-- and so have to be dropped and recreated with it.
drop function public.create_klash(
  double precision, double precision, public.klash_category, public.klash_importance, text, text,
  text, text
);
drop function public.klashes_in_bbox(
  double precision, double precision, double precision, double precision
);
drop function public.klashes_nearby(double precision, double precision, double precision);
drop function public.change_klash_status(uuid, public.klash_status, text);

drop view public.klashes_public;

create view public.klashes_public
  with (security_invoker = on) as
select
  k.id,
  k.author_id,
  extensions.st_y(k.location::extensions.geometry) as lat,
  extensions.st_x(k.location::extensions.geometry) as lng,
  k.category,
  k.category_other,
  k.importance,
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
  p.role         as author_role,
  k.insee_code,
  k.commune_name,
  k.epci_siren,
  k.epci_name
from public.klashes k
join public.profiles p on p.id = k.author_id;

grant select on public.klashes_public to anon, authenticated;

-- ---------- klashes_in_bbox: verbatim, unchanged besides the view above ----------
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

-- ---------- klashes_nearby: verbatim, unchanged besides the view above ----------
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

-- ---------- create_klash: verbatim, unchanged besides the view above ----------
create function public.create_klash(
  lat double precision,
  lng double precision,
  category public.klash_category,
  importance public.klash_importance,
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
    author_id, location, category, category_other, importance, title, description,
    proposed_solution
  )
  values (
    auth.uid(),
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
    category,
    category_other,
    importance,
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
  double precision, double precision, public.klash_category, public.klash_importance, text, text,
  text, text
) to authenticated;

-- ---------- change_klash_status: verbatim, unchanged besides the view above ----------
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

  perform set_config('app.status_change', 'off', true);

  insert into public.status_changes (klash_id, changed_by, from_status, to_status, note)
  values (change_klash_status.klash_id, actor, from_state, to_status,
          nullif(btrim(note), ''));

  select * into result from public.klashes_public v
   where v.id = change_klash_status.klash_id;
  return result;
end;
$$;

revoke execute on function public.change_klash_status(
  uuid, public.klash_status, text
) from public, anon;
grant execute on function public.change_klash_status(
  uuid, public.klash_status, text
) to authenticated;
