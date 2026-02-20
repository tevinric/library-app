-- Migration: Add OpenLibrary API fields to books table
-- Date: 2026-02-12
-- Description: Adds cover images, subjects, and OpenLibrary metadata fields

-- Add OpenLibrary API fields to books table
ALTER TABLE books
ADD COLUMN IF NOT EXISTS cover_small TEXT,
ADD COLUMN IF NOT EXISTS cover_medium TEXT,
ADD COLUMN IF NOT EXISTS cover_large TEXT,
ADD COLUMN IF NOT EXISTS subjects TEXT,
ADD COLUMN IF NOT EXISTS openlibrary_key VARCHAR(100),
ADD COLUMN IF NOT EXISTS openlibrary_url TEXT,
ADD COLUMN IF NOT EXISTS excerpt TEXT,
ADD COLUMN IF NOT EXISTS dewey_decimal VARCHAR(50),
ADD COLUMN IF NOT EXISTS lc_classification VARCHAR(100);

-- Add index for OpenLibrary key for faster lookups
CREATE INDEX IF NOT EXISTS idx_books_openlibrary_key ON books(openlibrary_key);

-- Add comment explaining the subjects field format
COMMENT ON COLUMN books.subjects IS 'JSON array of subject strings from OpenLibrary API';
COMMENT ON COLUMN books.cover_small IS 'Small cover image URL from OpenLibrary (S size)';
COMMENT ON COLUMN books.cover_medium IS 'Medium cover image URL from OpenLibrary (M size)';
COMMENT ON COLUMN books.cover_large IS 'Large cover image URL from OpenLibrary (L size)';
COMMENT ON COLUMN books.openlibrary_key IS 'OpenLibrary book key (e.g., /books/OL26690126M)';
COMMENT ON COLUMN books.openlibrary_url IS 'Full URL to OpenLibrary book page';
COMMENT ON COLUMN books.excerpt IS 'First sentence or excerpt from the book';
