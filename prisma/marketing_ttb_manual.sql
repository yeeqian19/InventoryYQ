-- Phase 9.1: Track manual vs auto-carry for total_to_bring_set.
-- Mirrors the in_stock_manual pattern. Auto-carry propagates total_to_bring_set
-- forward between events only when the next event's value is still auto.
-- Idempotent: safe to re-run.

ALTER TABLE public.fa_marketing_inventory
  ADD COLUMN IF NOT EXISTS total_to_bring_set_manual BOOLEAN NOT NULL DEFAULT FALSE;
