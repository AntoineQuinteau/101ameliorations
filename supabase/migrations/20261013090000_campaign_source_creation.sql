-- Campaign managers can create an emitter (campaign source) themselves.
--
-- `label` is the display name typed by the manager. It stays null for the
-- historical sources (txdo, presse, cpam), whose labels live in the front-end
-- translations. The key (`source`) is frozen once a link uses it (see
-- guard_campaign_links); only the label can be corrected, by a migration.

alter table public.campaign_sources
  add column label text
    check (label is null or (label = btrim(label) and char_length(label) between 1 and 60)),
  -- 'direct' and 'referral' are the synthetic sources of the attribution
  -- tables: a homonymous emitter would skew the results tab.
  add constraint campaign_sources_not_reserved check (source not in ('direct', 'referral'));

revoke truncate on public.campaign_sources from authenticated;

-- ---------- create_campaign_source() ----------
-- The only write path. Normalizes the key from the label, like
-- create_campaign_link normalizes its inputs. Idempotent: an existing key
-- returns the existing row without touching its label.
create function public.create_campaign_source(p_label text)
returns public.campaign_sources
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label  text;
  v_source text;
  v_row    public.campaign_sources;
begin
  if not public.current_user_can_manage_campaigns() then
    raise exception 'only a campaign manager can create a campaign source';
  end if;

  v_label := btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g'));
  v_source := public.normalize_campaign_token(v_label);

  if v_source = '' then
    raise exception 'a campaign source name is required';
  end if;
  if char_length(v_label) > 60 then
    raise exception 'campaign source name too long';
  end if;
  if v_source in ('direct', 'referral') then
    raise exception 'reserved campaign source';
  end if;

  insert into public.campaign_sources (source, label)
  values (v_source, v_label)
  on conflict (source) do nothing;

  select * into v_row from public.campaign_sources where source = v_source;
  return v_row;
end;
$$;

revoke execute on function public.create_campaign_source(text) from public, anon;
grant execute on function public.create_campaign_source(text) to authenticated;
