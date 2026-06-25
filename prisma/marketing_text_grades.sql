-- Phase 10: Generalize grade columns from INTEGER to TEXT.
-- Lets items use text-based grade labels like "A1", "B2" alongside numeric.
-- Existing numeric values are preserved by casting (1 → "1", etc.).
-- Uses a temp-column approach because PostgreSQL doesn't allow subqueries in
-- ALTER COLUMN USING expressions for the array conversion.
-- Idempotent: no-ops when run a second time.

BEGIN;

-- 1. Drop the unique index that references the old grade INT type.
DROP INDEX IF EXISTS uniq_fa_marketing_inv_event_item_grade_branch;

-- 2. Convert fa_marketing_inventory.grade INTEGER → TEXT (simple cast).
ALTER TABLE public.fa_marketing_inventory
  ALTER COLUMN grade TYPE TEXT USING (grade::TEXT);

-- 3. Convert fa_marketing_items.grades INTEGER[] → TEXT[] via a temp column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fa_marketing_items'
      AND column_name = 'grades'
      AND data_type = 'ARRAY'
      AND udt_name = '_int4'
  ) THEN
    ALTER TABLE public.fa_marketing_items
      ADD COLUMN grades_new TEXT[] NOT NULL DEFAULT '{}';
    UPDATE public.fa_marketing_items
      SET grades_new = COALESCE(
        (SELECT array_agg(g::TEXT ORDER BY ord)
         FROM unnest(grades) WITH ORDINALITY AS u(g, ord)),
        '{}'::TEXT[]
      );
    ALTER TABLE public.fa_marketing_items DROP COLUMN grades;
    ALTER TABLE public.fa_marketing_items RENAME COLUMN grades_new TO grades;
  END IF;
END $$;

-- 4. Recreate the unique index with the new grade type.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fa_marketing_inv_event_item_grade_branch
  ON public.fa_marketing_inventory(event_id, item_id, grade, branch)
  NULLS NOT DISTINCT;

-- 5. Expand Medal to the full 16-grade list.
UPDATE public.fa_marketing_items
  SET grades = ARRAY['1','2','3','4','5','6','7','8','A1','A2','A3','A4','B1','B2','B3','B4']
  WHERE name = 'Medal';

COMMIT;
