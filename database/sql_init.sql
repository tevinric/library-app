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
CREATE TABLE IF NOT EXISTS borrowers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    alt_phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_borrowers_updated_at ON borrowers;
CREATE TRIGGER update_borrowers_updated_at
    BEFORE UPDATE ON borrowers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_borrowers_user_id ON borrowers(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_name ON borrowers(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_borrowers_email ON borrowers(email);

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
