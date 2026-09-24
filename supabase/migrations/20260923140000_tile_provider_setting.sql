-- Admin-controlled tile source override (spec §6.1 follow-up): lets the map's basemap
-- be forced onto the quota-free IGN fallback (src/features/map/tileProviders.ts)
-- without a redeploy, on the same pattern service_area_bbox already uses (world-
-- readable, admin-writable — see settings_select_all / settings_write_admin in the
-- initial migration, both already cover this new row with no further policy needed).
--
-- Automatic failover on a detected MapTiler outage (src/features/map/tileFailover.ts)
-- does NOT touch this row — that's tracked per-device, in the browser's own
-- localStorage. This row is only for a deliberate admin override (e.g. to preserve the
-- rest of the month's MapTiler quota after an early warning).
--
-- Value is 'maptiler' | 'ign' (a plain jsonb string, unlike service_area_bbox's jsonb
-- object) — validated client-side by tileProviderFromValue() (src/types/settings.ts).
-- Nothing in Postgres enforces the value here, matching service_area_bbox's own lack of
-- a CHECK constraint.
insert into public.settings (key, value)
values ('tile_provider', '"maptiler"'::jsonb)
on conflict (key) do nothing;
