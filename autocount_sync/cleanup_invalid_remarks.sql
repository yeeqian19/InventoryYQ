-- One-off cleanup: remove rows that were wrongly created from invoices
-- whose remark indicates they were Deposit / Booking / 2nd Payment /
-- 3rd Payment / Nth Payment / etc. — anything that the new trigger
-- (see fix_trigger.sql step 3) would now BLOCK.
--
-- Safety: rows with ANY scan progress are kept untouched, in case staff
-- already started working on a wrongly-created row.
--
-- Run in two steps:
--   STEP 1 — preview what will be deleted (read-only)
--   STEP 2 — actually delete (only after reviewing the preview)


-- ============================================================
-- STEP 1: PREVIEW (read-only, safe to run repeatedly)
-- ============================================================
SELECT
    student_id,
    doc_no,
    doc_date,
    branch_code,
    student_name,
    package,
    type,
    remark
FROM inventory_distribution_new
WHERE remark IS NOT NULL
  AND TRIM(remark) <> ''
  AND NOT (
      remark ILIKE '%first%' OR
      remark ILIKE '%balance%' OR
      remark ILIKE '%new%'
  )
  AND COALESCE(sk_prep,         FALSE) = FALSE
  AND COALESCE(eg_prep,         FALSE) = FALSE
  AND COALESCE(bm_pickup,       FALSE) = FALSE
  AND COALESCE(student_received, FALSE) = FALSE
ORDER BY doc_date DESC, doc_no;


-- ============================================================
-- STEP 2: DELETE — uncomment the block below and run only after
-- the preview above looks correct. Wrap in a transaction so you
-- can ROLLBACK if anything is off.
-- ============================================================
-- BEGIN;
--
-- DELETE FROM inventory_distribution_new
-- WHERE remark IS NOT NULL
--   AND TRIM(remark) <> ''
--   AND NOT (
--       remark ILIKE '%first%' OR
--       remark ILIKE '%balance%' OR
--       remark ILIKE '%new%'
--   )
--   AND COALESCE(sk_prep,         FALSE) = FALSE
--   AND COALESCE(eg_prep,         FALSE) = FALSE
--   AND COALESCE(bm_pickup,       FALSE) = FALSE
--   AND COALESCE(student_received, FALSE) = FALSE;
--
-- -- If the row count looks right:
-- COMMIT;
-- -- Otherwise:
-- -- ROLLBACK;
