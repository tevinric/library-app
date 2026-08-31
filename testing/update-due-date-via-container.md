# Test Scenario: Manually Updating a Book's Due Date via the Postgres Container

## Scenario

While testing the library app, a test book has been checked out and now has a
due date assigned. To test overdue/due-date-related behavior (e.g. overdue
flags, fines, reminder emails), the due date needs to be changed to a custom
value without going through the application UI. This is done by connecting
directly to the `postgres_library_app` Docker container and updating the
`due_date` column on the relevant row in the `checkouts` table.

The `checkouts` table stores due dates like this:

```sql
CREATE TABLE checkouts (
    id UUID PRIMARY KEY,
    copy_id UUID NOT NULL REFERENCES book_copies(id),
    borrower_id UUID NOT NULL REFERENCES borrowers(id),
    checkout_date TIMESTAMP,
    due_date DATE,
    return_date TIMESTAMP,
    status VARCHAR(50), -- 'Checked Out', 'Returned', 'Overdue'
    ...
);
```

A checkout row is linked to a book indirectly: `checkouts.copy_id` ->
`book_copies.id` -> `book_copies.book_id` -> `books.id` (which has the
`title`).

## Prerequisites

- Docker Desktop running with the `library-app` stack up (`docker-compose up`)
- The `postgres_library_app` container running
- Know (or be able to guess) the title of the test book you checked out

## Step-by-Step Guide

### 1. Confirm the Postgres container is running

```bash
docker ps --filter "name=postgres_library_app"
```

### 2. Open a psql shell inside the container

```bash
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db
```

> Replace `libraryuser` / `library_app_db` if your `.env` uses different
> values for `ZOELIBRARYAPP_DB_USER` / `ZOELIBRARYAPP_DB_NAME`.

### 3. Find the checkout row for your test book

```sql
SELECT c.id AS checkout_id, b.title, c.due_date, c.status
FROM checkouts c
JOIN book_copies bc ON bc.id = c.copy_id
JOIN books b ON b.id = bc.book_id
WHERE b.title ILIKE '%your test book title%'
ORDER BY c.checkout_date DESC;
```

Note the `checkout_id` (UUID) for the row you want to change.

### 4. Update the due date to a custom value

```sql
UPDATE checkouts
SET due_date = '2026-01-01'
WHERE id = 'paste-the-checkout-id-here';
```

Replace `'2026-01-01'` with whatever date you want to test (e.g. a date in
the past to simulate an overdue book).

### 5. Verify the change

```sql
SELECT id, due_date, status FROM checkouts WHERE id = 'paste-the-checkout-id-here';
```

### 6. Exit psql

```sql
\q
```

## Notes

- This directly edits the database and bypasses application logic, so the
  `status` column (`Checked Out` / `Overdue`) will **not** auto-update just
  from changing `due_date` — check how/when the app computes overdue status
  (e.g. on read, or via a scheduled job) if you need `status` to reflect the
  new date too.
- This approach is only for local/test environments. Do not run manual SQL
  updates like this against a production database.
