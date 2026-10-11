-- Campaign tracking, part 1: who may manage campaigns, the short links
-- (/r/:slug) and the anonymous scan log.
--
-- Naming convention (docs/campaign-tracking.md): source = who communicates,
-- medium = closed list, campaign = operation + date, content = the precise
-- medium. Every value is lowercase ASCII words joined by single hyphens;
-- is_campaign_token() is that rule, reused by every check below so the
-- convention is enforced by the database, not trusted from any client.

create extension if not exists unaccent with schema extensions;

-- ---------- Convention helpers ----------

create function public.is_campaign_token(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is not null
    and char_length(value) <= 64
    and value ~ '^[a-z0-9]+(-[a-z0-9]+)*$';
$$;

-- Free text -> convention: lowercase, no accents, anything that is not a
-- letter or digit becomes a hyphen. Returns '' when nothing usable is left.
create function public.normalize_campaign_token(value text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(
    left(
      btrim(
        regexp_replace(lower(extensions.unaccent(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'),
        '-'
      ),
      64
    ),
    '-'
  );
$$;

-- ---------- The campaign-manager right ----------
-- A separate flag rather than a new user_role value: roles are exclusive, and
-- a moderator of the association may also manage campaigns. Admin-only, like
-- role and organization.
alter table public.profiles
  add column can_manage_campaigns boolean not null default false;

create or replace function public.guard_profiles_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and coalesce(public.current_user_role(), 'user') <> 'admin' then
    raise exception 'only an admin can change a profile role';
  end if;

  if new.organization is distinct from old.organization
     and coalesce(public.current_user_role(), 'user') <> 'admin' then
    raise exception 'only an admin can change a profile organization';
  end if;

  if new.can_manage_campaigns is distinct from old.can_manage_campaigns
     and coalesce(public.current_user_role(), 'user') <> 'admin' then
    raise exception 'only an admin can change a profile campaign right';
  end if;

  return new;
end;
$$;

create or replace function public.guard_deleted_account_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id = '00000000-0000-4000-8000-000000000001'
     and (new.role is distinct from old.role
          or new.organization is distinct from old.organization
          or new.can_manage_campaigns is distinct from old.can_manage_campaigns) then
    raise exception 'the deleted-account profile cannot be given a role or an organization';
  end if;
  return new;
end;
$$;

-- Admins always can; anyone else needs the flag. SECURITY DEFINER for the
-- same reason as current_user_role(): policies call it on tables that
-- themselves depend on profiles.
create function public.current_user_can_manage_campaigns()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' or p.can_manage_campaigns
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;

revoke execute on function public.current_user_can_manage_campaigns() from public, anon;
grant execute on function public.current_user_can_manage_campaigns() to authenticated;

-- ---------- Sources and mediums ----------
create type public.campaign_medium as enum ('social', 'email', 'print', 'press');

-- Extensible by migration; the French labels live in src/i18n/fr.ts.
create table public.campaign_sources (
  source text primary key check (public.is_campaign_token(source))
);
insert into public.campaign_sources (source) values ('txdo'), ('presse'), ('cpam');

alter table public.campaign_sources enable row level security;
create policy campaign_sources_select_managers on public.campaign_sources
  for select using (public.current_user_can_manage_campaigns());
revoke all on public.campaign_sources from anon;
revoke insert, update, delete on public.campaign_sources from authenticated;

-- ---------- Links ----------
create table public.campaign_links (
  slug         text primary key check (public.is_campaign_token(slug)),
  source       text not null references public.campaign_sources (source),
  medium       public.campaign_medium not null,
  campaign     text not null check (public.is_campaign_token(campaign)),
  -- '' rather than null: keeps the uniqueness index below plain.
  content      text not null default '' check (content = '' or public.is_campaign_token(content)),
  -- An internal path only: /r must never become an open redirect.
  destination  text not null default '/'
    check (
      destination ~ '^/[A-Za-z0-9._~%@:,;=+!$&''()*/-]*$'
      and destination !~ '^//'
      and char_length(destination) <= 200
    ),
  is_active    boolean not null default true,
  -- set null: deleting an account must not delete (or be blocked by) a link
  -- whose printed QR codes are still in circulation.
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- One link per (source, medium, campaign, content): this is what lets sign-ups
-- and installs, which carry only those four values, be attributed to a link.
create unique index campaign_links_utm_key
  on public.campaign_links (source, medium, campaign, content);
create index campaign_links_campaign_idx on public.campaign_links (campaign);

-- A printed QR must keep its meaning: only destination and is_active can ever
-- change, and a link can never be deleted, only deactivated. Applies to every
-- role, admin and postgres included.
create function public.guard_campaign_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'a campaign link cannot be deleted, only deactivated';
  end if;

  if new.slug is distinct from old.slug
     or new.source is distinct from old.source
     or new.medium is distinct from old.medium
     or new.campaign is distinct from old.campaign
     or new.content is distinct from old.content
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'only the destination and the active flag of a campaign link can change';
  end if;
  return new;
end;
$$;

create trigger campaign_links_guard
  before update or delete on public.campaign_links
  for each row execute function public.guard_campaign_links();

alter table public.campaign_links enable row level security;
create policy campaign_links_select_managers on public.campaign_links
  for select using (public.current_user_can_manage_campaigns());
create policy campaign_links_update_managers on public.campaign_links
  for update using (public.current_user_can_manage_campaigns())
  with check (public.current_user_can_manage_campaigns());

-- Creation goes through create_campaign_link() only.
revoke all on public.campaign_links from anon;
revoke insert, delete, truncate on public.campaign_links from authenticated;
revoke update on public.campaign_links from authenticated;
grant update (destination, is_active) on public.campaign_links to authenticated;

-- ---------- Scan log ----------
-- No IP, no user agent, no identifier of any kind: a slug and a timestamp.
create table public.campaign_link_scans (
  id               bigint generated always as identity primary key,
  slug             text not null references public.campaign_links (slug),
  scanned_at       timestamptz not null default now(),
  -- False for a deactivated link: a QR that is off but still scanned is worth
  -- knowing about, yet must not count as a scan.
  link_was_active  boolean not null
);
create index campaign_link_scans_slug_idx on public.campaign_link_scans (slug, scanned_at);

-- No policy at all: only the security definer functions below touch it.
alter table public.campaign_link_scans enable row level security;
revoke all on public.campaign_link_scans from anon, authenticated;

-- ---------- create_campaign_link() ----------
-- Normalizes the free text, refuses a duplicate, and picks the shortest
-- readable slug: source + first word of the content, else source + the whole
-- content, else that with -2, -3... A slug is never reused (links are never
-- deleted, and the slug is the primary key).
create function public.create_campaign_link(
  p_source text,
  p_medium public.campaign_medium,
  p_campaign text,
  p_content text default '',
  p_destination text default '/'
)
returns public.campaign_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign text := public.normalize_campaign_token(p_campaign);
  v_content  text := public.normalize_campaign_token(p_content);
  v_full     text;
  v_candidate text;
  v_n        integer := 1;
  v_row      public.campaign_links;
begin
  if not public.current_user_can_manage_campaigns() then
    raise exception 'only a campaign manager can create a campaign link';
  end if;
  if v_campaign = '' then
    raise exception 'a campaign is required';
  end if;
  if not exists (select 1 from public.campaign_sources where source = p_source) then
    raise exception 'unknown campaign source';
  end if;
  if exists (
    select 1 from public.campaign_links
     where source = p_source and medium = p_medium
       and campaign = v_campaign and content = v_content
  ) then
    raise exception 'a link for this source, medium, campaign and content already exists';
  end if;

  v_full := left(
    case when v_content = '' then p_source else p_source || '-' || v_content end,
    64
  );
  v_candidate := left(
    case when v_content = '' then p_source
         else p_source || '-' || split_part(v_content, '-', 1) end,
    64
  );

  while exists (select 1 from public.campaign_links where slug = v_candidate) loop
    if v_candidate <> v_full and v_n = 1 then
      v_candidate := v_full;
    else
      v_n := v_n + 1;
      v_candidate := left(v_full, 64 - char_length('-' || v_n)) || '-' || v_n;
    end if;
  end loop;

  insert into public.campaign_links
    (slug, source, medium, campaign, content, destination, created_by)
  values
    (v_candidate, p_source, p_medium, v_campaign, v_content,
     coalesce(p_destination, '/'), auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.create_campaign_link(
  text, public.campaign_medium, text, text, text
) from public, anon;
grant execute on function public.create_campaign_link(
  text, public.campaign_medium, text, text, text
) to authenticated;

-- ---------- resolve_campaign_link() ----------
-- The one thing an anonymous caller (the /r/:slug Worker) may do with links.
-- Returns the redirect parameters of an ACTIVE link and nothing otherwise, so
-- an unknown and a deactivated slug are indistinguishable. Logs the pass when
-- p_count is true (the Worker passes false for link-preview bots).
create function public.resolve_campaign_link(p_slug text, p_count boolean default true)
returns table (
  source      text,
  medium      public.campaign_medium,
  campaign    text,
  content     text,
  destination text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.campaign_links;
begin
  if not public.is_campaign_token(p_slug) then
    return;
  end if;

  select * into v_link from public.campaign_links l where l.slug = p_slug;
  if not found then
    return;
  end if;

  if p_count then
    insert into public.campaign_link_scans (slug, link_was_active)
    values (v_link.slug, v_link.is_active);
  end if;

  if v_link.is_active then
    return query
      select v_link.source, v_link.medium, v_link.campaign, v_link.content, v_link.destination;
  end if;
end;
$$;

grant execute on function public.resolve_campaign_link(text, boolean) to anon, authenticated;

-- ---------- Initial links (launch campaign) ----------
insert into public.campaign_links (slug, source, medium, campaign, content) values
  ('txdo-facebook',   'txdo',   'social', 'lancement-2026-10', 'facebook'),
  ('txdo-newsletter', 'txdo',   'email',  'lancement-2026-10', 'newsletter'),
  ('txdo-flyer',      'txdo',   'print',  'lancement-2026-10', 'flyer'),
  ('txdo-affiche',    'txdo',   'print',  'lancement-2026-10', 'affiche-locaux'),
  ('presse',          'presse', 'press',  'lancement-2026-10', ''),
  ('cpam-papillon',   'cpam',   'print',  'lancement-2026-10', 'papillon-velo'),
  ('cpam-affiche',    'cpam',   'print',  'lancement-2026-10', 'affiche-parking'),
  ('cpam-mail',       'cpam',   'email',  'lancement-2026-10', 'mail-salaries');
