-- Migration: Add barcode field to books table
-- Date: 2026-02-08
-- Purpose: Enable barcode scanning for book identification during registration, checkout, and check-in

-- Add barcode column to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

-- Create unique partial index: allows NULL values, but enforces uniqueness for non-NULL barcodes
-- This prevents duplicate barcodes while allowing books without barcodes
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_barcode_unique
  ON books(barcode) WHERE barcode IS NOT NULL;

-- Create regular index for fast barcode lookups during scanning operations
CREATE INDEX IF NOT EXISTS idx_books_barcode ON books(barcode);

-- Add column comment for documentation
COMMENT ON COLUMN books.barcode IS 'Barcode identifier (ISBN, UPC, EAN, or custom barcode). Used for scanner integration during book registration, checkout, and check-in operations.';
