-- =============================================================================
-- Migration: Remove PII from Borrowers Table
-- =============================================================================
-- Date: 2026-02-19
-- Description: Removes PII fields (last_name, email, phone, alt_phone, address)
--              and adds borrower_id for minimal identification
--
-- Changes:
--   - Add borrower_id VARCHAR(8) UNIQUE NOT NULL
--   - Generate borrower_ids for existing borrowers
--   - Drop PII columns
--   - Update indexes for new schema
--
-- Rollback: Restore from backup created before running this migration
-- =============================================================================

BEGIN;

-- Step 1: Add borrower_id column (nullable initially, will make NOT NULL after population)
ALTER TABLE borrowers
ADD COLUMN borrower_id VARCHAR(8);

-- Step 2: Create PostgreSQL function to generate unique borrower_id
CREATE OR REPLACE FUNCTION generate_borrower_id(name TEXT)
RETURNS VARCHAR(8) AS $$
DECLARE
    prefix VARCHAR(3);
    random_part VARCHAR(5);
    new_id VARCHAR(8);
    collision_count INT := 0;
BEGIN
    -- Extract first 3 characters from name (letters only, uppercase, pad with X if needed)
    prefix := UPPER(COALESCE(SUBSTRING(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g') FROM 1 FOR 3), ''));

    -- Pad with X if name is too short (less than 3 letters)
    WHILE LENGTH(prefix) < 3 LOOP
        prefix := prefix || 'X';
    END LOOP;

    -- Generate random 5-character alphanumeric string
    LOOP
        -- Generate random string using MD5 hash of random number + timestamp
        random_part := UPPER(
            SUBSTRING(
                REGEXP_REPLACE(
                    MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT),
                    '[^A-Z0-9]',
                    '',
                    'g'
                )
                FROM 1 FOR 5
            )
        );

        -- Ensure we have exactly 5 characters (MD5 should always provide enough)
        IF LENGTH(random_part) < 5 THEN
            random_part := RPAD(random_part, 5, '0');
        END IF;

        new_id := prefix || random_part;

        -- Check for uniqueness
        IF NOT EXISTS (SELECT 1 FROM borrowers WHERE borrower_id = new_id) THEN
            RETURN new_id;
        END IF;

        collision_count := collision_count + 1;
        IF collision_count > 100 THEN
            RAISE EXCEPTION 'Unable to generate unique borrower_id after 100 attempts for name: %', name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Populate borrower_id for all existing borrowers
UPDATE borrowers
SET borrower_id = generate_borrower_id(first_name)
WHERE borrower_id IS NULL;

-- Step 4: Make borrower_id NOT NULL and UNIQUE
ALTER TABLE borrowers
ALTER COLUMN borrower_id SET NOT NULL;

ALTER TABLE borrowers
ADD CONSTRAINT borrowers_borrower_id_unique UNIQUE (borrower_id);

-- Step 5: Create index on borrower_id for faster searches
CREATE INDEX IF NOT EXISTS idx_borrowers_borrower_id ON borrowers(borrower_id);

-- Step 6: Create composite index for search (first_name + borrower_id)
CREATE INDEX IF NOT EXISTS idx_borrowers_search ON borrowers(first_name, borrower_id);

-- Step 7: Drop old indexes that won't be used anymore
DROP INDEX IF EXISTS idx_borrowers_name;
DROP INDEX IF EXISTS idx_borrowers_email;

-- Step 8: Drop PII columns
ALTER TABLE borrowers
DROP COLUMN IF EXISTS last_name,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS alt_phone,
DROP COLUMN IF EXISTS address;

-- Step 9: Add column comment for documentation
COMMENT ON COLUMN borrowers.borrower_id IS 'Unique 8-character identifier: 3 letters from first_name + 5 random alphanumeric characters (e.g., JOH3X7K9). Used to minimize PII exposure.';

-- Optional: Drop the generation function if you don't want to keep it
-- We'll keep it for potential future use in application code
-- DROP FUNCTION IF EXISTS generate_borrower_id(TEXT);

COMMIT;

-- =============================================================================
-- Post-Migration Verification Queries
-- =============================================================================
-- Run these queries after migration to verify success:
--
-- 1. Check borrower_id generation:
--    SELECT first_name, borrower_id FROM borrowers LIMIT 10;
--
-- 2. Verify no duplicates:
--    SELECT borrower_id, COUNT(*) FROM borrowers
--    GROUP BY borrower_id HAVING COUNT(*) > 1;
--
-- 3. Verify format (3 uppercase letters + 5 uppercase alphanumeric):
--    SELECT borrower_id FROM borrowers
--    WHERE borrower_id !~ '^[A-Z]{3}[A-Z0-9]{5}$';
--
-- 4. Check foreign key integrity (should return 0):
--    SELECT COUNT(*) FROM checkouts c
--    LEFT JOIN borrowers b ON c.borrower_id = b.id
--    WHERE b.id IS NULL;
--
-- 5. Verify table structure:
--    \d borrowers
-- =============================================================================
