-- Enable UUID extension (REQUIRED)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS TABLE (REQUIRED FOR ALL APPS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION (REQUIRED)
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- BORROWERS TABLE
-- =============================================================================
-- Modified: 2026-09-02 - No PII is collected or stored for borrowers. Each
-- borrower is identified solely by a randomly generated borrower_id, used to
-- track their activity in the application (POPIA compliance).
CREATE TABLE IF NOT EXISTS borrowers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    borrower_id VARCHAR(8) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_borrowers_updated_at ON borrowers;
CREATE TRIGGER update_borrowers_updated_at
    BEFORE UPDATE ON borrowers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_borrowers_user_id ON borrowers(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_borrower_id ON borrowers(borrower_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_search ON borrowers(borrower_id);

COMMENT ON COLUMN borrowers.borrower_id IS 'Unique random 8-character alphanumeric identifier. The borrower''s only identifier — no name or other PII is ever stored.';

-- =============================================================================
-- BOOKS TABLE (Master book records)
-- =============================================================================
CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(50),
    barcode VARCHAR(100),
    publisher VARCHAR(255),
    publication_year INT,
    genre VARCHAR(100),
    description TEXT,
    language VARCHAR(50) DEFAULT 'English',
    pages INT,
    -- OpenLibrary API fields
    cover_small TEXT,
    cover_medium TEXT,
    cover_large TEXT,
    subjects TEXT,
    openlibrary_key VARCHAR(100),
    openlibrary_url TEXT,
    excerpt TEXT,
    dewey_decimal VARCHAR(50),
    lc_classification VARCHAR(100),
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_books_updated_at ON books;
CREATE TRIGGER update_books_updated_at
    BEFORE UPDATE ON books
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_barcode ON books(barcode);
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_barcode_unique ON books(barcode) WHERE barcode IS NOT NULL;

COMMENT ON COLUMN books.barcode IS 'Barcode identifier (ISBN, UPC, EAN, or custom barcode). Used for scanner integration during book registration, checkout, and check-in operations.';

-- =============================================================================
-- BOOK COPIES TABLE (Individual physical copies)
-- =============================================================================
CREATE TABLE IF NOT EXISTS book_copies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    copy_number INT NOT NULL,
    condition VARCHAR(50) DEFAULT 'Good' CHECK (condition IN ('Excellent', 'Good', 'Fair', 'Poor')),
    location VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Available' CHECK (status IN ('Available', 'Checked Out', 'Reserved', 'Damaged', 'Lost')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, copy_number)
);

DROP TRIGGER IF EXISTS update_book_copies_updated_at ON book_copies;
CREATE TRIGGER update_book_copies_updated_at
    BEFORE UPDATE ON book_copies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_book_copies_book_id ON book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_user_id ON book_copies(user_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status);

-- =============================================================================
-- CHECKOUTS TABLE (Checkout history and current checkouts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS checkouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    copy_id UUID NOT NULL REFERENCES book_copies(id) ON DELETE CASCADE,
    borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkout_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date DATE,
    return_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Checked Out' CHECK (status IN ('Checked Out', 'Returned', 'Overdue')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_checkouts_updated_at ON checkouts;
CREATE TRIGGER update_checkouts_updated_at
    BEFORE UPDATE ON checkouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_checkouts_copy_id ON checkouts(copy_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_borrower_id ON checkouts(borrower_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_user_id ON checkouts(user_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_status ON checkouts(status);
CREATE INDEX IF NOT EXISTS idx_checkouts_checkout_date ON checkouts(checkout_date);

-- =============================================================================
-- BOOK WISHLIST TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS book_wishlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255),
    isbn VARCHAR(50),
    requested_by VARCHAR(255),
    request_notes TEXT,
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    status VARCHAR(50) DEFAULT 'Requested' CHECK (status IN ('Requested', 'Ordered', 'Received', 'Cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_book_wishlist_updated_at ON book_wishlist;
CREATE TRIGGER update_book_wishlist_updated_at
    BEFORE UPDATE ON book_wishlist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_book_wishlist_user_id ON book_wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_book_wishlist_status ON book_wishlist(status);

-- =============================================================================
-- FOLLOW UPS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkout_id UUID NOT NULL REFERENCES checkouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Contacted', 'Resolved', 'Escalated')),
    contacted_date TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_follow_ups_updated_at ON follow_ups;
CREATE TRIGGER update_follow_ups_updated_at
    BEFORE UPDATE ON follow_ups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_follow_ups_checkout_id ON follow_ups(checkout_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================================
-- LATE FEES / SETTINGS / FINES
-- =============================================================================
-- Added: 2026-08-30 - Late fee configuration, overdue fine tracking, and
-- payment auditing. This block is identical to backend/migrations.sql, which
-- re-runs it (idempotently) on every backend startup so existing deployments
-- pick it up without needing this init script to run again. Keep both in sync.
-- =============================================================================

-- SETTINGS TABLE (global key/value config — not user-scoped)
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

-- FINES TABLE (one row per overdue checkout; upserted while checked out,
-- frozen once the checkout is Returned)
CREATE TABLE IF NOT EXISTS fines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- ON DELETE RESTRICT is deliberate: prevents deleting a book/copy/borrower/
    -- checkout that has fine history, preserving the audit trail.
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

CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status);
CREATE INDEX IF NOT EXISTS idx_fines_checkout_id ON fines(checkout_id);

DROP TRIGGER IF EXISTS update_fines_updated_at ON fines;
CREATE TRIGGER update_fines_updated_at
    BEFORE UPDATE ON fines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- FINE PAYMENTS TABLE (append-only audit ledger of every settle/reverse action)
CREATE TABLE IF NOT EXISTS fine_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fine_id UUID NOT NULL REFERENCES fines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('Paid', 'Reversed')),
    amount NUMERIC(10,2) NOT NULL,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fine_payments_fine_id ON fine_payments(fine_id);

-- ACTIVITY LOG TABLE (one row per authenticated API request — data provenance)
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
