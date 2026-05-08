-- Run this on your PostgreSQL database (inv_db) to apply the fixed trigger.
-- Fixes: barcode_sk now uses cleaned branch_code, not the raw value.

CREATE OR REPLACE FUNCTION master_inventory_sync_logic()
RETURNS TRIGGER AS $$
DECLARE
    combined_text TEXT;
    name_part     TEXT;
    name_parts    TEXT[];
BEGIN
    -- 1. SIBLING SPLITTER
    IF pg_trigger_depth() = 1 THEN
        IF NEW.student_name ~* '\s*[&,]\s*|\s+and\s+' THEN
            name_parts := regexp_split_to_array(NEW.student_name, '(?i)\s*[&,]\s*|\s+and\s+');
            FOREACH name_part IN ARRAY name_parts LOOP
                name_part := trim(name_part);
                IF char_length(name_part) > 0 THEN
                    INSERT INTO inventory_distribution_new
                        (student_name, branch_code, doc_no, package, type, doc_date, remark)
                    VALUES
                        (name_part, NEW.branch_code, NEW.doc_no, NEW.package, NEW.type, NEW.doc_date, NEW.remark)
                    ON CONFLICT (doc_no, student_name) DO NOTHING;
                END IF;
            END LOOP;
            RETURN NULL;
        END IF;
    END IF;

    -- 2. BRANCH CLEANER & SWAP (removes ALL digits anywhere in the code)
    NEW.branch_code := REGEXP_REPLACE(NEW.branch_code, '[0-9]', '', 'g');
    IF NEW.branch_code = 'TTDI' THEN NEW.branch_code := 'KTG'; END IF;

    -- 3. DEPOSIT BOUNCER
    IF (
        NEW.remark ILIKE '%Deposit%' OR
        NEW.remark ILIKE '%First Payment%' OR
        NEW.remark ILIKE '%Booking%'
    ) THEN
        RETURN NULL;
    END IF;

    -- 4. DATA UNTANGLER
    combined_text := CONCAT_WS(' ', NEW.package, NEW.type);
    NEW.type    := INITCAP(SUBSTRING(combined_text FROM '(?i)(New|Renewal|Trial)'));
    NEW.package := UPPER(SUBSTRING(combined_text FROM '(?i)([0-9]+M)'));

    -- 5. JUNK NAME FILTER
    IF (NEW.student_name IS NULL OR trim(NEW.student_name) = '' OR NEW.student_name = 'NAME MISSING') THEN
        RETURN NULL;
    END IF;

    -- 6. BARCODE GENERATOR (FIX: both barcodes now use the CLEANED branch_code from step 2)
    NEW.barcode_sk := NEW.branch_code || '-SK-' || LPAD(NEW.student_id::text, 6, '0');

    IF NEW.package ILIKE '12M%' THEN
        NEW.barcode_eg := NEW.branch_code || '-EG-' || LPAD(NEW.student_id::text, 6, '0');
    ELSE
        NEW.barcode_eg := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill barcodes for ALL existing rows where branch_code is already clean
UPDATE inventory_distribution_new
SET
    barcode_sk = branch_code || '-SK-' || LPAD(student_id::text, 6, '0'),
    barcode_eg = CASE
        WHEN package ILIKE '12M%'
        THEN branch_code || '-EG-' || LPAD(student_id::text, 6, '0')
        ELSE NULL
    END
WHERE branch_code IS NOT NULL;
