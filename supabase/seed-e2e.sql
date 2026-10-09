-- Staff accounts for the Playwright suite (e2e/), loaded after seed.sql by
-- `npx supabase db reset` (local and CI, see [db.seed] in config.toml). Never
-- replayed on staging or production: only seed.sql is (see README.md).
--
-- One moderator, authority and admin per Playwright worker slot
-- (`testInfo.parallelIndex`, see e2e/support/staff.ts). Supabase keeps a
-- single OTP per user, so two workers logging in to the same address at once
-- overwrite each other's code; giving every worker its own accounts means
-- concurrent logins never share an address. Keep E2E_STAFF_SLOTS in
-- e2e/support/staff.ts equal to the number of slots below, and at least
-- `workers` in playwright.config.ts.
--
-- Idempotent: existing accounts are left as they are.

begin;

SET search_path TO public, extensions;

drop table if exists e2e_staff;
create temporary table e2e_staff (
  id           uuid primary key,
  email        text not null,
  role         public.user_role not null,
  organization text,
  can_manage_campaigns boolean not null default false
);

insert into e2e_staff (id, email, role, organization, can_manage_campaigns)
select
  format('20000000-0000-4000-8000-0000000000%s%s', r.n, slot)::uuid,
  format('e2e-%s-%s@101ameliorations.test', r.label, slot),
  r.role::public.user_role,
  r.organization,
  r.can_manage_campaigns
from generate_series(0, 3) as slot
cross join (values
  (1, 'moderator', 'moderator', null, false),
  (2, 'authority', 'authority', 'CAPB', false),
  (3, 'admin', 'admin', null, false),
  -- A plain user holding only the campaign-manager right.
  (4, 'campaigner', 'user', null, true)
) as r (n, label, role, organization, can_manage_campaigns);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', s.id, 'authenticated', 'authenticated',
  s.email, crypt('seed-not-a-real-password', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  false, false, now(), now(),
  '', '', '', ''
from e2e_staff s
on conflict (id) do nothing;

-- Same trigger bypass as the staff accounts in seed.sql. A display name keeps
-- the nickname step from appearing (shouldPromptForPseudo).
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles p
set role = s.role, organization = s.organization,
    can_manage_campaigns = s.can_manage_campaigns,
    display_name = 'E2E ' || s.role::text
from e2e_staff s
where p.id = s.id;
alter table public.profiles enable trigger profiles_guard_role;

commit;
