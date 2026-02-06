# Library Database Schema

## Overview

PostgreSQL database for the Library Management System with 7 main tables.

## Tables

### 1. users
Core authentication table (required for all apps).
```sql
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- username (VARCHAR)
- password_hash (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### 2. borrowers
Library patrons who borrow books.
```sql
- id (UUID, PK)
- user_id (UUID, FK to users)
- first_name (VARCHAR)
- last_name (VARCHAR)
- email (VARCHAR)
- phone (VARCHAR)
- alt_phone (VARCHAR, optional)
- address (TEXT, optional)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```
**Indexes**: user_id, (first_name, last_name), email

### 3. books
Master book records.
```sql
- id (UUID, PK)
- user_id (UUID, FK to users)
- title (VARCHAR)
- author (VARCHAR)
- isbn (VARCHAR)
- publisher (VARCHAR)
- publication_year (INT)
- genre (VARCHAR)
- description (TEXT)
- language (VARCHAR, default 'English')
- pages (INT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```
**Indexes**: user_id, title, author, isbn

### 4. book_copies
Individual physical copies of books.
```sql
- id (UUID, PK)
- book_id (UUID, FK to books, CASCADE)
- user_id (UUID, FK to users)
- copy_number (INT)
- condition (VARCHAR: Excellent, Good, Fair, Poor)
- location (VARCHAR)
- status (VARCHAR: Available, Checked Out, Reserved, Damaged, Lost)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```
**Indexes**: book_id, user_id, status
**Unique Constraint**: (book_id, copy_number)

### 5. checkouts
Checkout records (current and historical).
```sql
- id (UUID, PK)
- copy_id (UUID, FK to book_copies, CASCADE)
- borrower_id (UUID, FK to borrowers, CASCADE)
- user_id (UUID, FK to users)
- checkout_date (TIMESTAMP, default NOW)
- due_date (DATE)
- return_date (TIMESTAMP, nullable)
- status (VARCHAR: Checked Out, Returned, Overdue)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```
**Indexes**: copy_id, borrower_id, user_id, status, checkout_date

### 6. book_wishlist
Requested books not currently in library.
```sql
- id (UUID, PK)
- user_id (UUID, FK to users)
- title (VARCHAR)
- author (VARCHAR)
- isbn (VARCHAR)
- requested_by (VARCHAR)
- request_notes (TEXT)
- priority (VARCHAR: Low, Medium, High)
- status (VARCHAR: Requested, Ordered, Received, Cancelled)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```
**Indexes**: user_id, status

### 7. follow_ups
Checkouts requiring librarian follow-up.
```sql
- id (UUID, PK)
- checkout_id (UUID, FK to checkouts, CASCADE)
- user_id (UUID, FK to users)
- reason (TEXT)
- status (VARCHAR: Pending, Contacted, Resolved, Escalated)
- contacted_date (TIMESTAMP, nullable)
- resolution_notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```
**Indexes**: checkout_id, user_id, status

## Triggers

All tables (except users) have an `updated_at` trigger that automatically updates the timestamp on record modification.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

## Cascade Behavior

- Deleting a **user** cascades to all their data
- Deleting a **book** cascades to all copies and their checkouts
- Deleting a **book_copy** cascades to its checkouts
- Deleting a **borrower** cascades to their checkouts (blocked if active)
- Deleting a **checkout** cascades to its follow-ups

## Key Features

1. **UUID Primary Keys**: All tables use UUID for security and uniqueness
2. **Automatic Timestamps**: created_at and updated_at on all tables
3. **Data Integrity**: Foreign key constraints with appropriate cascade rules
4. **Performance**: Strategic indexes on frequently queried columns
5. **Check Constraints**: Enum-like validation for status fields

## Sample Queries

### Books with availability
```sql
SELECT b.*,
       COUNT(bc.id) as total_copies,
       COUNT(CASE WHEN bc.status = 'Available' THEN 1 END) as available_copies
FROM books b
LEFT JOIN book_copies bc ON b.id = bc.book_id
WHERE b.user_id = '<user_id>'
GROUP BY b.id;
```

### Active checkouts with borrower info
```sql
SELECT co.*,
       b.title, b.author,
       bc.copy_number,
       br.first_name, br.last_name, br.email
FROM checkouts co
JOIN book_copies bc ON co.copy_id = bc.id
JOIN books b ON bc.book_id = b.id
JOIN borrowers br ON co.borrower_id = br.id
WHERE co.status = 'Checked Out'
ORDER BY co.checkout_date ASC;
```

### Overdue checkouts
```sql
SELECT * FROM checkouts
WHERE status = 'Checked Out'
  AND due_date < CURRENT_DATE;
```

## Initialization

Database is initialized automatically via `sql_init.sql` when the PostgreSQL container starts.

To re-initialize:
```bash
# Stop and remove database container
docker-compose down
docker volume rm library_app_data

# Recreate volume and restart
docker volume create library_app_data
docker-compose up -d
```

## Maintenance

### Backup
```bash
docker exec postgres_library_app pg_dump -U libraryuser library_app_db > backup.sql
```

### Restore
```bash
cat backup.sql | docker exec -i postgres_library_app psql -U libraryuser -d library_app_db
```

### Statistics
```sql
-- Total books
SELECT COUNT(*) FROM books;

-- Total copies
SELECT COUNT(*) FROM book_copies;

-- Active checkouts
SELECT COUNT(*) FROM checkouts WHERE status = 'Checked Out';

-- Overdue
SELECT COUNT(*) FROM checkouts WHERE status = 'Checked Out' AND due_date < CURRENT_DATE;
```
