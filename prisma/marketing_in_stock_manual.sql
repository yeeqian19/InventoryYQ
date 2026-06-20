-- Phase 7: Smart auto carry forward.
-- Adds a flag to each inventory row marking whether in_stock was set by the
-- user (✋ manual) or by the system (🤖 auto). Auto-carry-forward only updates
-- rows flagged as auto, so user-typed values are never overwritten.
-- Idempotent: safe to re-run.

ALTER TABLE public.fa_marketing_inventory
  ADD COLUMN IF NOT EXISTS in_stock_manual BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve existing user input: any row whose in_stock is already non-zero
-- was almost certainly typed by the user, so mark it as manual.
UPDATE public.fa_marketing_inventory
  SET in_stock_manual = TRUE
  WHERE in_stock > 0 AND in_stock_manual = FALSE;
