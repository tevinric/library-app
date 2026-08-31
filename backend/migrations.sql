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
