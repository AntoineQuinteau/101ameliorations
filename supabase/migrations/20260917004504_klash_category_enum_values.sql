-- Adds the two new klash_category enum values used by the real category
-- list (see the follow-up migration for the labels, the category_other
-- column, and the rest of the wiring).
--
-- Split into its own migration on purpose: Postgres requires a new enum
-- value to be committed before it can be referenced (e.g. in a CHECK
-- constraint or a comparison) — "unsafe use of new value ... New enum
-- values must be committed before they can be used", verified locally.
-- ALTER TYPE ... ADD VALUE is itself transactional since PG12, so this file
-- alone is safe; the constraint that uses 'category_7' lives in the next
-- migration, in a separate transaction.
alter type public.klash_category add value 'category_6';
alter type public.klash_category add value 'category_7';
