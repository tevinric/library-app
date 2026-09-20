-- =============================================================================
-- RUNTIME MIGRATIONS (idempotent — safe to run on every backend startup)
-- =============================================================================
-- sql_init.sql only runs via docker-entrypoint-initdb.d on a brand-new, empty
-- Postgres volume. This file is executed by backend/app.py (run_migrations())
-- on every startup so existing, already-populated deployments pick up new
-- schema objects without any manual DB work or data loss.
--
-- Keep this file's CREATE TABLE / seed statements in sync with the matching
-- block appended to database/sql_init.sql (kept there for fresh-install docs).
-- Everything here must remain purely additive: new tables only, no ALTERs on
-- existing tables/columns.
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- BORROWER PII REMOVAL (2026-09-02) — POPIA compliance
-- =============================================================================
-- Deliberate exception to the "purely additive" rule above: borrowers.first_name
-- previously stored admin-entered PII. Borrowers are now identified only by a
-- randomly generated borrower_id (see generate_borrower_id() in app.py), so the
-- name column is dropped — no PII can ever be captured or stored for a borrower.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'borrowers' AND column_name = 'first_name'
    ) THEN
        DROP INDEX IF EXISTS idx_borrowers_search;
        ALTER TABLE borrowers DROP COLUMN first_name;
        CREATE INDEX IF NOT EXISTS idx_borrowers_search ON borrowers(borrower_id);
    END IF;
END $$;

-- =============================================================================
-- SETTINGS TABLE (global key/value config — not user-scoped)
-- =============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO settings (key, value, description) VALUES
    ('late_fee_per_day', '0.00', 'Late fee charged per day a book is overdue (Rands)'),
    ('default_lending_days', '14', 'Default number of days a book may be borrowed before it is due')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- FINES TABLE (one row per overdue checkout; upserted while checked out,
-- frozen once the checkout is Returned)
-- =============================================================================
CREATE TABLE IF NOT EXISTS fines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkout_id UUID NOT NULL UNIQUE REFERENCES checkouts(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    days_overdue INT NOT NULL CHECK (days_overdue > 0),
    rate_applied NUMERIC(10,2) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Paid')),
    paid_at TIMESTAMP,
    paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- checkout_id uses ON DELETE RESTRICT deliberately: it prevents deleting a
-- book/copy/borrower/checkout that has fine history, preserving the audit trail.

CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status);
CREATE INDEX IF NOT EXISTS idx_fines_checkout_id ON fines(checkout_id);

DROP TRIGGER IF EXISTS update_fines_updated_at ON fines;
CREATE TRIGGER update_fines_updated_at
    BEFORE UPDATE ON fines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FINE PAYMENTS TABLE (append-only audit ledger of every settle/reverse action)
-- =============================================================================
CREATE TABLE IF NOT EXISTS fine_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fine_id UUID NOT NULL REFERENCES fines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('Paid', 'Reversed')),
    amount NUMERIC(10,2) NOT NULL,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fine_payments_fine_id ON fine_payments(fine_id);

-- =============================================================================
-- ACTIVITY LOG TABLE (one row per authenticated API request — data provenance)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    query_string TEXT,
    request_body TEXT,
    status_code INT NOT NULL,
    error_message TEXT,
    ip_address VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_email ON activity_log(user_email);

-- =============================================================================
-- DELETED BOOK COPIES TABLE (2026-09-20) — provenance for copy removals
-- =============================================================================
-- A physical copy that is lost/destroyed/withdrawn can be deleted from
-- book_copies without touching the parent book or its other copies. The copy
-- row itself disappears (and checkouts cascade with it), so a snapshot of what
-- was removed, by whom and why is written here first. Append-only: nothing in
-- the app ever updates or deletes rows in this table.
--
-- No foreign key on copy_id/book_id on purpose — the copy is gone by the time
-- the row is read, and the parent book may itself be deleted later; the audit
-- record must outlive both.
CREATE TABLE IF NOT EXISTS deleted_book_copies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    copy_id UUID NOT NULL,
    book_id UUID,
    book_title VARCHAR(500),
    book_author VARCHAR(255),
    book_isbn VARCHAR(50),
    copy_number INT NOT NULL,
    condition VARCHAR(50),
    location VARCHAR(100),
    status VARCHAR(50),
    notes TEXT,
    checkout_count INT NOT NULL DEFAULT 0,
    reason VARCHAR(100),
    reason_notes TEXT,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_by_email VARCHAR(255),
    copy_created_at TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deleted_book_copies_book_id ON deleted_book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_deleted_book_copies_deleted_at ON deleted_book_copies(deleted_at DESC);
