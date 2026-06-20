-- Seed Sash branch in_stock values across all events.
-- Phase 8 follow-up. Run AFTER marketing_branches.sql.
--
-- Workflow:
--   1. Remove any existing Sash rows with branch IS NULL (legacy ungrouped data).
--   2. Insert one row per (event, Sash, branch) with the user-provided in_stock value.
--   3. Mark in_stock_manual=FALSE so future auto-carry-forward can re-sync if
--      the user edits values on an earlier completed event.
--
-- Re-runnable: safe to re-run; existing branch rows are upserted, not duplicated.

BEGIN;

-- 1. Clean up legacy Sash rows (branch IS NULL) so the UI doesn't show
--    both a "Sash" total row AND the per-branch rows side-by-side.
DELETE FROM public.fa_marketing_inventory
WHERE item_id = (SELECT id FROM public.fa_marketing_items WHERE name = 'Sash')
  AND branch IS NULL;

-- 2. Insert per-branch rows across all known events.
WITH sash AS (SELECT id FROM public.fa_marketing_items WHERE name = 'Sash'),
events AS (
  SELECT unnest(ARRAY[
    'a98d1a08-9983-4947-930f-6e5130912ea9'::uuid, -- 16-17 May Weekly Showcase
    '586ae9d2-3618-431f-998e-47b26ba36cbd'::uuid, -- 18-19 July Weekly Showcase
    '0167bf71-693c-48ee-adca-36924bff52a4'::uuid, -- 20-21 June Weekly Showcase
    'fb1dce34-944d-4467-bd35-8803bd928b28'::uuid, -- 25-26 July Weekly Showcase
    'bf1ff3e9-25f4-4ce6-b16d-ed3908eb4864'::uuid, -- 27-28 June Weekly Showcase
    'c084a8fe-dad8-4821-9746-307eb51800ad'::uuid  -- 30-31 May Weekly Showcase
  ]) AS event_id
),
branches AS (
  SELECT * FROM (VALUES
    ('ST', 20), ('BTHO', 21), ('BBB', 21), ('SHA', 21), ('AMP', 20),
    ('BSP', 17), ('KTG', 20), ('DA', 33),  ('DK', 19),  ('SP', 19),
    ('RBY', 29),('ONL', 21), ('CJY', 28), ('KLG', 18), ('EGR', 18),
    ('KD', 20), ('TSG', 21), ('KW', 20)
  ) AS t(branch, in_stock_val)
)
INSERT INTO public.fa_marketing_inventory (event_id, item_id, grade, branch, in_stock, in_stock_manual)
SELECT e.event_id, s.id, NULL, b.branch, b.in_stock_val, FALSE
FROM events e CROSS JOIN sash s CROSS JOIN branches b
ON CONFLICT (event_id, item_id, grade, branch)
DO UPDATE SET in_stock = EXCLUDED.in_stock, in_stock_manual = EXCLUDED.in_stock_manual;

COMMIT;
