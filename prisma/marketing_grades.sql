-- Phase 6: Per-item configurable grade breakdowns.
-- Idempotent migration: safe to re-run.

-- 1. Items can optionally carry a list of grades they break down by.
--    Empty array = no breakdown (single row per event, as before).
ALTER TABLE public.fa_marketing_items
  ADD COLUMN IF NOT EXISTS grades INTEGER[] NOT NULL DEFAULT '{}';

-- 2. Inventory rows now carry a grade. NULL = ungraded item row.
ALTER TABLE public.fa_marketing_inventory
  ADD COLUMN IF NOT EXISTS grade INTEGER;

-- 3. The old UNIQUE(event_id, item_id) constraint blocks multiple rows per
--    (event, item). Replace with a unique index that includes grade and
--    treats NULL as a real value (so non-graded items still get one row).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fa_marketing_inventory_event_id_item_id_key'
  ) THEN
    ALTER TABLE public.fa_marketing_inventory
      DROP CONSTRAINT fa_marketing_inventory_event_id_item_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_fa_marketing_inv_event_item_grade
  ON public.fa_marketing_inventory(event_id, item_id, grade)
  NULLS NOT DISTINCT;

-- 4. Seed Medal with grades 1-8.
UPDATE public.fa_marketing_items
  SET grades = '{1,2,3,4,5,6,7,8}'
  WHERE name = 'Medal';
