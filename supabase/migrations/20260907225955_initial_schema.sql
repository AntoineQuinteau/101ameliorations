-- Initial schema: extensions, enums, tables, indexes, structural triggers, full RLS.
-- Behaviour-gating triggers (service area, status transitions, rate limits,
-- photo/comment moderation) are added in their own migration at the relevant step.

create extension if not exists postgis with schema extensions;

-- ---------- Enums ----------
create type public.user_role as enum ('user', 'moderator', 'authority', 'admin');

create type public.klash_category as enum
  ('category_1', 'category_2', 'category_3', 'category_4', 'category_5');

create type public.klash_urgency as enum ('low', 'medium', 'high');

create type public.klash_status as enum
  ('new', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'duplicate');

-- ---------- settings: adjustable key/value config ----------
create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('service_area_bbox',
   '{"min_lat": 43.25, "min_lng": -1.80, "max_lat": 43.80, "max_lng": -0.90}');

-- ---------- profiles: one row per auth user ----------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 2 and 40),
  role         public.user_role not null default 'user',
  organization text,
  created_at   timestamptz not null default now()
);

-- ---------- klashes ----------
create table public.klashes (
  id                  uuid primary key default gen_random_uuid(),
  author_id           uuid not null references public.profiles (id),
  location            geography(point, 4326) not null,
  category            public.klash_category not null,
  urgency             public.klash_urgency not null default 'medium',
  status              public.klash_status not null default 'new',
  title               text not null check (char_length(title) between 5 and 120),
  description         text check (char_length(description) <= 2000),
  duplicate_of        uuid references public.klashes (id),
  confirmations_count integer not null default 0,
  comments_count      integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resolved_at         timestamptz
);
create index klashes_location_idx   on public.klashes using gist (location);
create index klashes_created_at_idx on public.klashes (created_at desc);
create index klashes_status_idx     on public.klashes (status);

create table public.klash_photos (
  id           uuid primary key default gen_random_uuid(),
  klash_id     uuid not null references public.klashes (id) on delete cascade,
  author_id    uuid not null references public.profiles (id),
  storage_path text not null,
  width        integer,
  height       integer,
  created_at   timestamptz not null default now()
);
create index klash_photos_klash_id_idx on public.klash_photos (klash_id);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  klash_id   uuid not null references public.klashes (id) on delete cascade,
  author_id  uuid not null references public.profiles (id),
  body       text not null check (char_length(body) between 1 and 1000),
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_klash_id_idx on public.comments (klash_id, created_at);

create table public.confirmations (
  klash_id   uuid not null references public.klashes (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (klash_id, user_id)
);

create table public.status_changes (
  id          uuid primary key default gen_random_uuid(),
  klash_id    uuid not null references public.klashes (id) on delete cascade,
  changed_by  uuid not null references public.profiles (id),
  from_status public.klash_status not null,
  to_status   public.klash_status not null,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now()
);
create index status_changes_klash_id_idx on public.status_changes (klash_id, created_at);

-- ---------- Helper: current user's role (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_user_role() to anon, authenticated;

-- ---------- Trigger: create a profile row on new auth user ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Trigger: maintain updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger klashes_set_updated_at
  before update on public.klashes
  for each row execute function public.set_updated_at();

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- ---------- Triggers: keep counters in sync (hidden comments excluded) ----------
create or replace function public.refresh_confirmations_count()
returns trigger
language plpgsql
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

create trigger confirmations_count_trg
  after insert or delete on public.confirmations
  for each row execute function public.refresh_confirmations_count();

create or replace function public.refresh_comments_count()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.klash_id, old.klash_id);
begin
  update public.klashes k
     set comments_count = (
       select count(*) from public.comments c
        where c.klash_id = target and c.hidden = false
     )
   where k.id = target;
  return null;
end;
$$;

create trigger comments_count_trg
  after insert or delete or update of hidden, klash_id on public.comments
  for each row execute function public.refresh_comments_count();

-- ---------- Trigger: only an admin may change profiles.role ----------
create or replace function public.guard_profiles_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and coalesce(public.current_user_role(), 'user') <> 'admin' then
    raise exception 'only an admin can change a profile role';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profiles_role();

-- ================= Row Level Security =================
alter table public.settings       enable row level security;
alter table public.profiles       enable row level security;
alter table public.klashes        enable row level security;
alter table public.klash_photos   enable row level security;
alter table public.comments       enable row level security;
alter table public.confirmations  enable row level security;
alter table public.status_changes enable row level security;

-- settings: world-readable, admin-writable
create policy settings_select_all on public.settings
  for select using (true);
create policy settings_write_admin on public.settings
  for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- profiles
create policy profiles_select_all on public.profiles
  for select using (true);
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles
  for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- klashes
create policy klashes_select_all on public.klashes
  for select using (true);
create policy klashes_insert_own on public.klashes
  for insert with check (author_id = auth.uid());
create policy klashes_update_author_new on public.klashes
  for update
  using (author_id = auth.uid() and status = 'new')
  with check (author_id = auth.uid());
create policy klashes_update_staff on public.klashes
  for update
  using (public.current_user_role() in ('moderator', 'admin'))
  with check (public.current_user_role() in ('moderator', 'admin'));
create policy klashes_update_authority on public.klashes
  for update
  using (public.current_user_role() = 'authority')
  with check (public.current_user_role() = 'authority');
create policy klashes_delete_author_or_staff on public.klashes
  for delete
  using (author_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'));

-- klash_photos
create policy klash_photos_select_all on public.klash_photos
  for select using (true);
create policy klash_photos_insert_klash_author on public.klash_photos
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.klashes k
       where k.id = klash_id and k.author_id = auth.uid()
    )
  );
create policy klash_photos_delete_author_or_staff on public.klash_photos
  for delete
  using (author_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'));

-- comments
create policy comments_select_visible on public.comments
  for select
  using (hidden = false or public.current_user_role() in ('moderator', 'admin'));
create policy comments_insert_own on public.comments
  for insert with check (author_id = auth.uid());
create policy comments_update_author_or_staff on public.comments
  for update
  using (author_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'))
  with check (author_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'));
create policy comments_delete_author_or_staff on public.comments
  for delete
  using (author_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'));

-- confirmations (an author cannot confirm their own klash)
create policy confirmations_select_all on public.confirmations
  for select using (true);
create policy confirmations_insert_self on public.confirmations
  for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.klashes k
       where k.id = klash_id and k.author_id = auth.uid()
    )
  );
create policy confirmations_delete_self on public.confirmations
  for delete using (user_id = auth.uid());

-- status_changes: readable by all, written only by SECURITY DEFINER trigger (step 7)
create policy status_changes_select_all on public.status_changes
  for select using (true);
