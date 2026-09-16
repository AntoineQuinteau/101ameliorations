-- Widens the service area from CAPB + sud Landes only to the whole of
-- south-west Nouvelle-Aquitaine, at the association's request.
--
-- enforce_service_area() (20260912064457_create_klash_behaviour.sql) already
-- reads this row on every insert, so the trigger picks up the new bounds
-- immediately. What did NOT pick it up automatically is the frontend: it
-- mirrors this value in a compile-time constant
-- (src/config/serviceArea.ts) — this migration is paired with a frontend
-- change that reads the row at runtime instead, so future edits to this row
-- alone are enough.
update public.settings
   set value = '{"min_lat": 42.70, "min_lng": -2.30, "max_lat": 45.00, "max_lng": 0.50}'::jsonb,
       updated_at = now()
 where key = 'service_area_bbox';
