# OpenLibrary API Integration Guide

## 🎉 Feature Overview

The ZOE Library application now integrates with OpenLibrary API to automatically fetch book details and cover images when registering new books.

## ✨ New Features

### 1. **Auto-Fetch Book Details**
When registering a new book:
- Enter or scan an ISBN
- Click "Fetch Details" button
- Book information automatically populates from OpenLibrary
- Cover images are displayed for verification

### 2. **Book Cover Images Throughout App**
- **Book Search**: Small thumbnails in search results
- **Book Registration**: Large cover image preview
- **Check-In**: Large cover for book verification
- **Edit Book**: Large cover in edit modal

### 3. **Enhanced Book Metadata**
New fields from OpenLibrary:
- Cover images (small, medium, large)
- Subjects/Categories
- Dewey Decimal Classification
- Library of Congress Classification
- Book excerpts
- OpenLibrary URL and Key

## 📋 Setup Instructions

### Step 1: Run Database Migration

Apply the database migration to add new columns:

```bash
# Connect to your PostgreSQL database
psql -U your_user -d your_database

# Run the migration script
\i database/migrations/add_openlibrary_fields.sql
```

Or using Docker:
```bash
docker exec -i your_postgres_container psql -U your_user -d your_database < database/migrations/add_openlibrary_fields.sql
```

### Step 2: Restart Application

```bash
# Stop the application
docker-compose down

# Start with updated schema
docker-compose up -d
```

## 🚀 How to Use

### Registering a New Book

1. **Navigate to Register Books page**

2. **Scan or Enter ISBN**:
   - Use barcode scanner to scan book barcode
   - OR manually enter ISBN in the auto-fetch section

3. **Click "Fetch Details"**:
   - Application queries OpenLibrary API
   - Book details auto-populate
   - Cover image appears on the right

4. **Verify Information**:
   - **IMPORTANT**: Check that cover image matches physical book
   - Review all auto-populated fields
   - Edit any incorrect information
   - Add additional details (genre, barcode, etc.)

5. **Register Book**:
   - Click "Register Book" button
   - Book is saved with all metadata and cover images

### Viewing Book Covers

**Book Search Results**:
- Small thumbnail appears on left side of each book
- Helps quickly identify books visually

**Check-In Process**:
- Large cover image displayed when checking in
- Librarian can verify correct book by cover

**Book Editing**:
- Large cover shown in edit modal
- Ensures editing correct book record

## 🔧 Technical Details

### OpenLibrary API Endpoint
```
https://openlibrary.org/api/books?bibkeys=ISBN:{ISBN}&format=json&jscmd=data
```

### Response Mapping

| OpenLibrary Field | Database Column | Usage |
|------------------|-----------------|-------|
| `title` | `title` | Book title |
| `authors[].name` | `author` | Comma-separated authors |
| `publishers[0].name` | `publisher` | Publisher name |
| `publish_date` | `publication_year` | Year published |
| `number_of_pages` | `pages` | Page count |
| `cover.small` | `cover_small` | Thumbnail (S) |
| `cover.medium` | `cover_medium` | Medium (M) |
| `cover.large` | `cover_large` | Large (L) |
| `subjects[].name` | `subjects` | JSON array |
| `key` | `openlibrary_key` | OpenLibrary ID |
| `url` | `openlibrary_url` | OpenLibrary page |

### Database Schema Changes

New columns added to `books` table:
```sql
cover_small TEXT           -- Small cover image URL
cover_medium TEXT          -- Medium cover image URL
cover_large TEXT           -- Large cover image URL
subjects TEXT              -- JSON array of subjects
openlibrary_key VARCHAR    -- OpenLibrary book key
openlibrary_url TEXT       -- Full OpenLibrary URL
excerpt TEXT               -- First sentence/excerpt
dewey_decimal VARCHAR      -- Dewey classification
lc_classification VARCHAR  -- LC classification
```

### API Integration Details

**Frontend**: `/frontend/src/api.js`
- `fetchBookFromOpenLibrary(isbn)` - Fetches and transforms OpenLibrary data

**Backend**: `/backend/app.py`
- Updated `create_book()` to accept new fields
- Updated `update_book()` to handle new fields

## 🎯 Benefits

1. **Time Savings**: No manual data entry for book details
2. **Accuracy**: Professional book data from OpenLibrary
3. **Visual Verification**: Cover images prevent check-in/out errors
4. **Rich Metadata**: Additional classification and subject data
5. **Professional Look**: Book covers enhance app appearance

## ⚠️ Important Notes

### For Librarians

1. **Always Verify Cover Image**:
   - OpenLibrary may return wrong edition
   - Check cover matches physical book before registering
   - Edit details if information is incorrect

2. **ISBN Requirements**:
   - Works with ISBN-10 and ISBN-13
   - Remove hyphens if present (auto-handled)
   - Some older books may not have OpenLibrary records

3. **Fallback to Manual Entry**:
   - If OpenLibrary doesn't have the book, manually enter details
   - Cover images are optional - app works without them

### For Administrators

1. **No API Key Required**:
   - OpenLibrary API is free and open
   - No rate limits for reasonable use
   - No authentication needed

2. **Error Handling**:
   - 10-second timeout on API calls
   - Graceful fallback to manual entry
   - User-friendly error messages

3. **Performance**:
   - API calls are client-side (no backend load)
   - Images loaded from OpenLibrary CDN
   - Cached by browser automatically

## 🔍 Troubleshooting

### "Book not found in OpenLibrary"
- Book may not be in OpenLibrary database
- Try alternative ISBN if book has multiple editions
- Manually enter book details

### Cover image not displaying
- OpenLibrary may not have cover for this edition
- Placeholder icon shown instead
- Book still registers normally without cover

### API call times out
- Check internet connection
- OpenLibrary may be temporarily down
- Proceed with manual entry

## 📚 Example Workflow

```
1. Librarian receives new book
2. Opens Register Books page
3. Scans ISBN barcode → 9780143038092
4. App searches local database (not found)
5. App queries OpenLibrary API
6. Cover image and details appear
7. Librarian verifies cover matches book
8. Librarian reviews/edits details
9. Clicks "Register Book"
10. Book saved with complete metadata
```

## 🎨 UI Enhancements

All UI elements use professional SVG icons (no emoticons):
- Book icons for placeholders
- Search icons for fetch buttons
- Smooth hover effects on covers
- Responsive design for all screen sizes

## 📖 Related Documentation

- OpenLibrary API Docs: https://openlibrary.org/dev/docs/api/books
- Original API guide: `/guides/api_call_book_details.md`
- Database schema: `/database/sql_init.sql`
- Migration script: `/database/migrations/add_openlibrary_fields.sql`

---

**Need Help?** Contact your system administrator or refer to the main README.md
