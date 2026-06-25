-- Phase 9: Editable Total to Bring + Closing Stock for returnable items.
-- These two columns let the user override the derived values:
--   - total_to_bring_set: how many to bring (Sash brings everything; defaults to in_stock)
--   - closing_stock_set:  user counts at event end (auto-carries into next event)
-- Both are nullable; when NULL, the formula derivation is used.
-- Idempotent: safe to re-run.

ALTER TABLE public.fa_marketing_inventory
  ADD COLUMN IF NOT EXISTS total_to_bring_set INTEGER,
  ADD COLUMN IF NOT EXISTS closing_stock_set  INTEGER;
