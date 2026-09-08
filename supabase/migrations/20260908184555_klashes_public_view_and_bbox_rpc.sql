-- Public read surface for the map (step 2): a view that can never expose an
-- author's email, and a bbox RPC built on top of it for the map viewport.

-- ---------- klashes_public: safe join of klashes + profiles ----------
-- security_invoker makes the view respect the querying role's RLS instead of
-- the view owner's, so it carries no more access than querying the base
-- tables directly would.
create view public.klashes_public
  with (security_invoker = on) as
select
  k.id,
  k.author_id,
  extensions.st_y(k.location::extensions.geometry) as lat,
  extensions.st_x(k.location::extensions.geometry) as lng,
  k.category,
  k.urgency,
  k.status,
  k.title,
  k.description,
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
-- Excludes rejected/duplicate, and resolved klashs older than 90 days
-- (spec §6.1, §11.4). A `filters` argument is added at step 6.
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
