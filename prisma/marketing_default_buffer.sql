-- Phase 11: Default Backup Stock (buffer) = 10 for consumable items.
-- Returnable items (Sash) stay at 0 because they don't need a safety margin
-- (every item comes back).
--
-- Only updates rows that are currently at 0 — if a user explicitly set a
-- different value, we don't touch it.
-- Re-runnable.

UPDATE public.fa_marketing_inventory inv
   SET buffer = 10
  WHERE buffer = 0
    AND item_id IN (
      SELECT id FROM public.fa_marketing_items WHERE NOT returnable
    );
