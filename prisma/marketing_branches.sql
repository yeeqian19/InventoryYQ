-- Phase 8: Per-branch breakdowns + returnable flag.
-- Branches are like grades but text-based (branch codes: ST, BTHO, BBB, ...).
-- Returnable items (Sash) don't get consumed; closing stock stays equal to
-- in_stock + ordered (no loss assumed).
-- Idempotent: safe to re-run.

-- 1. New columns on items.
ALTER TABLE public.fa_marketing_items
  ADD COLUMN IF NOT EXISTS branches   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS returnable BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. New branch column on inventory rows (NULL = ungrouped by branch).
ALTER TABLE public.fa_marketing_inventory
  ADD COLUMN IF NOT EXISTS branch TEXT;

-- 3. Replace the unique index to include branch.
DROP INDEX IF EXISTS uniq_fa_marketing_inv_event_item_grade;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_fa_marketing_inv_event_item_grade_branch
  ON public.fa_marketing_inventory(event_id, item_id, grade, branch)
  NULLS NOT DISTINCT;

-- 4. Configure Sash: 18 branches (in user's specified order) + mark returnable.
UPDATE public.fa_marketing_items
  SET
    branches   = ARRAY['ST','BTHO','BBB','SHA','AMP','BSP','KTG','DA','DK','SP','RBY','ONL','CJY','KLG','EGR','KD','TSG','KW'],
    returnable = TRUE
  WHERE name = 'Sash';
