-- ============================================================
-- DATABASE CLEANUP & ACCURACY SCRIPT
-- Business rules:
--   NEW     → type='New',     package IN ('3M','6M','9M','12M')
--             SK always. EG if 12M (SMARTWATCH).
--   RENEWAL → type='Renewal', package IN ('3M','6M','9M','12M')
--             NO SK, NO EG. Student already received kit when they were New.
--             Only used for extending enrolment. Not tracked in inventory.
--   TRIAL   → type='Trial',   package='Trial'
--             NO SK, NO EG. Trial students don't receive inventory.
--
-- Run in TablePlus / DBeaver. BACKUP first.
-- ============================================================


-- ── STEP 1: Normalize `type` column to Title Case ────────────
-- Fixes: 'NEW', 'new', 'trial', 'TRIAL', 'renewal', 'RENEWAL', etc.

UPDATE inventory_distribution_new
SET type = CASE
  WHEN UPPER(TRIM(type)) LIKE '%RENEWAL%' THEN 'Renewal'
  WHEN UPPER(TRIM(type)) LIKE '%TRIAL%'   THEN 'Trial'
  WHEN UPPER(TRIM(type)) LIKE '%NEW%'     THEN 'New'
  ELSE type
END
WHERE type IS NOT NULL
  AND type NOT IN ('New', 'Trial', 'Renewal');

-- ── STEP 2: Normalize `package` column ───────────────────────
-- Fixes: '6m', '6M ', ' 9M', 'TRIAL', 'trial', '12m', etc.

UPDATE inventory_distribution_new
SET package = CASE
  WHEN UPPER(TRIM(package)) LIKE '%12M%'  THEN '12M'
  WHEN UPPER(TRIM(package)) LIKE '%9M%'   THEN '9M'
  WHEN UPPER(TRIM(package)) LIKE '%6M%'   THEN '6M'
  WHEN UPPER(TRIM(package)) LIKE '%3M%'   THEN '3M'
  WHEN UPPER(TRIM(package)) LIKE '%TRIAL%' THEN 'Trial'
  ELSE package
END
WHERE package IS NOT NULL
  AND package NOT IN ('3M', '6M', '9M', '12M', 'Trial');

-- ── STEP 3: Fill NULL/empty types using business rules ───────
-- If package = 'Trial'           → type must be 'Trial'
-- If package is a real duration  → type must be 'New' (default new enrolment)
-- If both NULL                   → type = 'Trial' (unconfirmed, no package)

UPDATE inventory_distribution_new
SET type = CASE
  WHEN UPPER(TRIM(COALESCE(package, ''))) = 'TRIAL'                  THEN 'Trial'
  WHEN package IN ('3M', '6M', '9M', '12M')                         THEN 'New'
  ELSE 'Trial'
END
WHERE type IS NULL OR TRIM(type) = '';

-- ── STEP 4: Fix type/package mismatches ──────────────────────
-- Trial student with a real package → fix package to 'Trial'
UPDATE inventory_distribution_new
SET package = 'Trial'
WHERE UPPER(TRIM(type)) = 'TRIAL'
  AND package IN ('3M', '6M', '9M', '12M');

-- New/Renewal student with package = 'Trial' → fix type to 'Trial'
UPDATE inventory_distribution_new
SET type = 'Trial'
WHERE UPPER(TRIM(type)) IN ('NEW', 'RENEWAL')
  AND UPPER(TRIM(COALESCE(package, ''))) = 'TRIAL';

-- ── STEP 5: Fix NULL booleans → false ────────────────────────
UPDATE inventory_distribution_new
SET
  sk_prep          = COALESCE(sk_prep, false),
  eg_prep          = COALESCE(eg_prep, false),
  bm_pickup        = COALESCE(bm_pickup, false),
  student_received = COALESCE(student_received, false)
WHERE
  sk_prep IS NULL OR eg_prep IS NULL
  OR bm_pickup IS NULL OR student_received IS NULL;

-- ── STEP 6: Normalize branch_code ────────────────────────────
UPDATE inventory_distribution_new
SET branch_code = CASE
  WHEN UPPER(TRIM(branch_code)) = 'PJ'           THEN 'PJY'
  WHEN UPPER(TRIM(branch_code)) = 'KL'           THEN 'KLG'
  WHEN UPPER(TRIM(branch_code)) = 'KUALA LUMPUR' THEN 'KLG'
  ELSE UPPER(TRIM(branch_code))
END
WHERE branch_code IS NOT NULL
  AND (branch_code <> UPPER(TRIM(branch_code))
    OR UPPER(TRIM(branch_code)) IN ('PJ', 'KL', 'KUALA LUMPUR'));

-- ── STEP 7: Add CHECK constraints ────────────────────────────
-- These prevent bad data from entering in the future.
-- Run AFTER steps 1-6 have cleaned existing data.

-- Drop constraints first if they already exist (safe re-run)
ALTER TABLE inventory_distribution_new DROP CONSTRAINT IF EXISTS chk_type;
ALTER TABLE inventory_distribution_new DROP CONSTRAINT IF EXISTS chk_package;
ALTER TABLE inventory_distribution_new DROP CONSTRAINT IF EXISTS chk_branch_code;

ALTER TABLE inventory_distribution_new
  ADD CONSTRAINT chk_type
  CHECK (type IN ('New', 'Trial', 'Renewal'));

ALTER TABLE inventory_distribution_new
  ADD CONSTRAINT chk_package
  CHECK (package IS NULL OR package IN ('3M', '6M', '9M', '12M', 'Trial'));

ALTER TABLE inventory_distribution_new
  ADD CONSTRAINT chk_branch_code
  CHECK (branch_code IS NULL OR branch_code IN (
    'AC','DA','EGR','KLG','RBY','SA','SBY','SHA','ST',
    'AMP','BTHO','DK','DSH','KD','KTG','SLY','SP','TSG',
    'BBB','BSP','CJY','DP','KW','ONL','PJY','SBN','SNT',
    'HQ'
  ));

-- ── STEP 8: Verify ───────────────────────────────────────────
SELECT type, package, COUNT(*) AS count
FROM inventory_distribution_new
GROUP BY type, package
ORDER BY type, package;

SELECT
  SUM(CASE WHEN type NOT IN ('New','Trial','Renewal') OR type IS NULL THEN 1 ELSE 0 END) AS bad_type,
  SUM(CASE WHEN package NOT IN ('3M','6M','9M','12M','Trial') AND package IS NOT NULL THEN 1 ELSE 0 END) AS bad_package,
  SUM(CASE WHEN sk_prep IS NULL THEN 1 ELSE 0 END) AS null_sk_prep,
  SUM(CASE WHEN eg_prep IS NULL THEN 1 ELSE 0 END) AS null_eg_prep
FROM inventory_distribution_new;
