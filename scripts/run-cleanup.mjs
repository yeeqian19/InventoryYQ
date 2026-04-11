import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://optidept:ebrightoptidept2025@103.209.156.174:5433/inv_db',
  ssl: false,
});

const steps = [
  {
    name: 'STEP 1: Normalize type column casing',
    sql: `
      UPDATE inventory_distribution_new
      SET type = CASE
        WHEN UPPER(TRIM(type)) LIKE '%RENEWAL%' THEN 'Renewal'
        WHEN UPPER(TRIM(type)) LIKE '%TRIAL%'   THEN 'Trial'
        WHEN UPPER(TRIM(type)) LIKE '%NEW%'     THEN 'New'
        ELSE type
      END
      WHERE type IS NOT NULL
        AND type NOT IN ('New', 'Trial', 'Renewal');
    `,
  },
  {
    name: 'STEP 2: Normalize package column',
    sql: `
      UPDATE inventory_distribution_new
      SET package = CASE
        WHEN UPPER(TRIM(package)) LIKE '%12M%'   THEN '12M'
        WHEN UPPER(TRIM(package)) LIKE '%9M%'    THEN '9M'
        WHEN UPPER(TRIM(package)) LIKE '%6M%'    THEN '6M'
        WHEN UPPER(TRIM(package)) LIKE '%3M%'    THEN '3M'
        WHEN UPPER(TRIM(package)) LIKE '%TRIAL%' THEN 'Trial'
        ELSE package
      END
      WHERE package IS NOT NULL
        AND package NOT IN ('3M', '6M', '9M', '12M', 'Trial');
    `,
  },
  {
    name: 'STEP 3: Fill NULL/empty types using package as signal',
    sql: `
      UPDATE inventory_distribution_new
      SET type = CASE
        WHEN UPPER(TRIM(COALESCE(package, ''))) = 'TRIAL' THEN 'Trial'
        WHEN package IN ('3M', '6M', '9M', '12M')        THEN 'New'
        ELSE 'Trial'
      END
      WHERE type IS NULL OR TRIM(type) = '';
    `,
  },
  {
    name: 'STEP 4a: Fix mismatch — Trial type with real package → set package to Trial',
    sql: `
      UPDATE inventory_distribution_new
      SET package = 'Trial'
      WHERE UPPER(TRIM(type)) = 'TRIAL'
        AND package IN ('3M', '6M', '9M', '12M');
    `,
  },
  {
    name: 'STEP 4b: Fix mismatch — New/Renewal type with package=Trial → set type to Trial',
    sql: `
      UPDATE inventory_distribution_new
      SET type = 'Trial'
      WHERE UPPER(TRIM(type)) IN ('NEW', 'RENEWAL')
        AND UPPER(TRIM(COALESCE(package, ''))) = 'TRIAL';
    `,
  },
  {
    name: 'STEP 5: Fix NULL booleans → false',
    sql: `
      UPDATE inventory_distribution_new
      SET
        sk_prep          = COALESCE(sk_prep, false),
        eg_prep          = COALESCE(eg_prep, false),
        bm_pickup        = COALESCE(bm_pickup, false),
        student_received = COALESCE(student_received, false)
      WHERE
        sk_prep IS NULL OR eg_prep IS NULL
        OR bm_pickup IS NULL OR student_received IS NULL;
    `,
  },
  {
    name: 'STEP 6: Normalize branch_code aliases',
    sql: `
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
    `,
  },
  {
    name: 'STEP 7: Drop old constraints if exist',
    sql: `
      ALTER TABLE inventory_distribution_new DROP CONSTRAINT IF EXISTS chk_type;
      ALTER TABLE inventory_distribution_new DROP CONSTRAINT IF EXISTS chk_package;
      ALTER TABLE inventory_distribution_new DROP CONSTRAINT IF EXISTS chk_branch_code;
    `,
  },
  {
    name: 'STEP 7: Add CHECK constraint on type',
    sql: `
      ALTER TABLE inventory_distribution_new
        ADD CONSTRAINT chk_type
        CHECK (type IN ('New', 'Trial', 'Renewal'));
    `,
  },
  {
    name: 'STEP 7: Add CHECK constraint on package',
    sql: `
      ALTER TABLE inventory_distribution_new
        ADD CONSTRAINT chk_package
        CHECK (package IS NULL OR package IN ('3M', '6M', '9M', '12M', 'Trial'));
    `,
  },
  {
    name: 'STEP 7: Add CHECK constraint on branch_code',
    sql: `
      ALTER TABLE inventory_distribution_new
        ADD CONSTRAINT chk_branch_code
        CHECK (branch_code IS NULL OR branch_code IN (
          'AC','DA','EGR','KLG','RBY','SA','SBY','SHA','ST',
          'AMP','BTHO','DK','DSH','KD','KTG','SLY','SP','TSG',
          'BBB','BSP','CJY','DP','KW','ONL','PJY','SBN','SNT',
          'HQ'
        ));
    `,
  },
];

const verifySQL = `
  SELECT type, package, COUNT(*) AS count
  FROM inventory_distribution_new
  GROUP BY type, package
  ORDER BY type, package;
`;

const verifyNulls = `
  SELECT
    SUM(CASE WHEN type NOT IN ('New','Trial','Renewal') OR type IS NULL THEN 1 ELSE 0 END) AS bad_type,
    SUM(CASE WHEN package NOT IN ('3M','6M','9M','12M','Trial') AND package IS NOT NULL THEN 1 ELSE 0 END) AS bad_package,
    SUM(CASE WHEN sk_prep IS NULL THEN 1 ELSE 0 END) AS null_sk_prep,
    SUM(CASE WHEN eg_prep IS NULL THEN 1 ELSE 0 END) AS null_eg_prep
  FROM inventory_distribution_new;
`;

async function run() {
  await client.connect();
  console.log('✅ Connected to database\n');

  for (const step of steps) {
    try {
      const res = await client.query(step.sql);
      const affected = res.rowCount ?? 0;
      console.log(`✅ ${step.name} — ${affected} rows affected`);
    } catch (err) {
      console.error(`❌ ${step.name} FAILED:`, err.message);
    }
  }

  console.log('\n── VERIFICATION ──────────────────────');
  const r1 = await client.query(verifySQL);
  console.table(r1.rows);

  const r2 = await client.query(verifyNulls);
  console.log('Data quality check:', r2.rows[0]);

  await client.end();
  console.log('\n✅ Done. Database is clean.');
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
