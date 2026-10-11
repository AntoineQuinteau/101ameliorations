-- Two fixes to 20261009090000_campaign_links.sql (already applied, so not
-- edited in place).

-- 1. campaign_links.created_by is `on delete set null`, and that foreign-key
--    action is itself an UPDATE: the guard refused it, which made deleting the
--    account of anyone who had created a link fail. Clearing the author is now
--    allowed; replacing it with someone else still is not.
create or replace function public.guard_campaign_links()
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
     or (new.created_by is distinct from old.created_by and new.created_by is not null)
     or new.created_at is distinct from old.created_at then
    raise exception 'only the destination and the active flag of a campaign link can change';
  end if;
  return new;
end;
$$;

-- 2. Truncating a slug to 64 characters could cut right after a hyphen, giving
--    a slug the is_campaign_token check rejects. Trailing hyphens are now
--    trimmed after every truncation.
create or replace function public.create_campaign_link(
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

  v_full := rtrim(left(
    case when v_content = '' then p_source else p_source || '-' || v_content end,
    64
  ), '-');
  v_candidate := rtrim(left(
    case when v_content = '' then p_source
         else p_source || '-' || split_part(v_content, '-', 1) end,
    64
  ), '-');

  while exists (select 1 from public.campaign_links where slug = v_candidate) loop
    if v_candidate <> v_full and v_n = 1 then
      v_candidate := v_full;
    else
      v_n := v_n + 1;
      v_candidate := rtrim(left(v_full, 64 - char_length('-' || v_n)), '-') || '-' || v_n;
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
