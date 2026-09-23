-- Rename the "urgency" concept to "importance" throughout: the enum type,
-- the klashes column, and every view/function whose definition freezes the
-- old name. `alter type … rename` and `alter column … rename` preserve data
-- and propagate to constraints/indexes automatically, but a view's column
-- list and a function's parameter/body text do not follow a rename — those
-- have to be dropped and recreated. Bodies below are copied verbatim from
-- their last-modified migration (20260917004512 for klashes_public,
-- klashes_in_bbox, klashes_nearby and create_klash; 20260915075244 for
-- change_klash_status; 20260918092650 for guard_klash_authority_columns),
-- with only `urgency` swapped to `importance`.

alter type public.klash_urgency rename to klash_importance;

alter table public.klashes rename column urgency to importance;

-- ---------- Drop every object whose definition freezes the old name ----------
-- klashes_nearby and change_klash_status don't mention "urgency" in their
-- own body, but both return `setof public.klashes_public` / `klashes_public`
-- and so still depend on the view being dropped below.
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

-- ---------- klashes_public: verbatim, urgency -> importance ----------
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
  p.role         as author_role
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

-- ---------- create_klash: urgency -> importance ----------
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

-- ---------- guard_klash_authority_columns: urgency -> importance ----------
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
     or new.importance         is distinct from old.importance
     or new.title              is distinct from old.title
     or new.description        is distinct from old.description
     or new.proposed_solution  is distinct from old.proposed_solution
     or new.duplicate_of       is distinct from old.duplicate_of then
    raise exception 'an authority can only change a klash status';
  end if;

  return new;
end;
$$;
