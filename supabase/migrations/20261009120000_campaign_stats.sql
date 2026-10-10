-- Campaign tracking, part 4: statistics for the /admin "Campagnes" tab, and
-- the campaign right in the role-management lookup.

-- ---------- campaign_stats() ----------
-- One row per (source, medium, campaign, content): scans (passes on an active
-- link), sign-ups (accounts with a confirmed email) and installs, attributed
-- to the first or the last touch (p_touch). Rows that match a link carry its
-- slug; attributions with no link (direct, referral, an old campaign...) come
-- through with a null slug so the per-source / per-campaign summary adds up.
-- Only campaign managers may call it; nothing here identifies a person.
create function public.campaign_stats(p_touch text default 'first')
returns table (
  slug         text,
  source       text,
  medium       text,
  campaign     text,
  content      text,
  destination  text,
  is_active    boolean,
  created_at   timestamptz,
  scans        bigint,
  signups      bigint,
  installs     bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_can_manage_campaigns() then
    raise exception 'only a campaign manager can read campaign statistics';
  end if;
  if p_touch not in ('first', 'last') then
    raise exception 'p_touch must be first or last';
  end if;

  return query
  with links as (
    select l.slug, l.source, l.medium::text as medium, l.campaign, l.content,
           l.destination, l.is_active, l.created_at,
           (select count(*) from public.campaign_link_scans s
             where s.slug = l.slug and s.link_was_active) as scans
    from public.campaign_links l
  ),
  signups as (
    select case when p_touch = 'first' then pa.first_source else pa.last_source end as source,
           (case when p_touch = 'first' then pa.first_medium else pa.last_medium end)::text as medium,
           coalesce(case when p_touch = 'first' then pa.first_campaign else pa.last_campaign end, '') as campaign,
           coalesce(case when p_touch = 'first' then pa.first_content else pa.last_content end, '') as content,
           count(*) as n
    from public.profile_attributions pa
    join auth.users u on u.id = pa.profile_id
    where u.email_confirmed_at is not null
    group by 1, 2, 3, 4
  ),
  installs as (
    select case when p_touch = 'first' then e.first_source else e.last_source end as source,
           (case when p_touch = 'first' then e.first_medium else e.last_medium end)::text as medium,
           coalesce(case when p_touch = 'first' then e.first_campaign else e.last_campaign end, '') as campaign,
           coalesce(case when p_touch = 'first' then e.first_content else e.last_content end, '') as content,
           count(*) as n
    from public.install_events e
    group by 1, 2, 3, 4
  ),
  keys as (
    select k.source, k.medium, k.campaign, k.content from links k
    union select k.source, k.medium, k.campaign, k.content from signups k
    union select k.source, k.medium, k.campaign, k.content from installs k
  )
  select l.slug, k.source, k.medium, k.campaign, k.content,
         l.destination, l.is_active, l.created_at,
         coalesce(l.scans, 0), coalesce(s.n, 0), coalesce(i.n, 0)
  from keys k
  left join links l
    on l.source = k.source and l.medium is not distinct from k.medium
   and l.campaign = k.campaign and l.content = k.content
  left join signups s
    on s.source = k.source and s.medium is not distinct from k.medium
   and s.campaign = k.campaign and s.content = k.content
  left join installs i
    on i.source = k.source and i.medium is not distinct from k.medium
   and i.campaign = k.campaign and i.content = k.content
  order by l.created_at desc nulls last, k.source, k.campaign, k.content;
end;
$$;

revoke execute on function public.campaign_stats(text) from public, anon;
grant execute on function public.campaign_stats(text) to authenticated;

-- ---------- find_profile_by_email() also reports the campaign right ----------
drop function public.find_profile_by_email(text);

create function public.find_profile_by_email(email text)
returns table (
  id                   uuid,
  display_name         text,
  role                 public.user_role,
  organization         text,
  can_manage_campaigns boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), 'user') <> 'admin' then
    raise exception 'only an admin can search for a profile by email';
  end if;

  return query
    select p.id, p.display_name, p.role, p.organization, p.can_manage_campaigns
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email = find_profile_by_email.email;
end;
$$;

revoke execute on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;
