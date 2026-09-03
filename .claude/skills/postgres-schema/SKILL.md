---
name: postgres-schema
description: Use when designing or changing the PostgreSQL schema for an app in this house style — creating tables, adding columns, writing migrations, or adding indexes. Covers the two-file init/migrations model, UUID primary keys, the updated_at trigger, ownership columns, indexing rules, and how to ship schema changes to an already-populated production database without data loss.
---

# Postgres schema conventions

## The two-file model

This is the part people get wrong. There are two schema files and they have
different jobs:

| File | Runs when | Contains |
|---|---|---|
| `database/sql_init.sql` | Only on a **brand-new, empty volume**, via Postgres's `docker-entrypoint-initdb.d` | The full schema, as documentation of a fresh install |
| `backend/migrations.sql` | On **every backend startup**, executed by `run_migrations()` in `app.py` | The same objects, written idempotently |

`sql_init.sql` never runs again once the volume has data. That's a Postgres
behaviour, not a choice — which means **a schema change added only to
`sql_init.sql` will never reach your production database.** Every change goes
in `migrations.sql`, and is mirrored into `sql_init.sql` so a fresh install
still reads as one coherent schema.

### Migration rules

- **Idempotent, always.** `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT
  EXISTS`, `CREATE OR REPLACE FUNCTION`, `INSERT ... ON CONFLICT DO NOTHING`.
  The file runs on every boot of every worker; running it twice must be a no-op.
- **Purely additive by default** — new tables, new indexes, new seed rows. No
  `ALTER`/`DROP` on existing columns.
- **A destructive change needs a guard and a written reason.** When one is
  genuinely required, wrap it so it only fires when the old state exists:

  ```sql
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
  ```

  Put a dated comment above it saying what changed and why. The example above
  is the real PII-removal migration from `library-app`.
- **Concurrency is handled with an advisory lock.** Gunicorn starts N workers
  that each import the module and each try to migrate. `run_migrations()`
  takes `pg_advisory_lock(<constant>)` first so they serialize, and retries
  with backoff while Postgres is still coming up. Copy that function as-is.

## Table conventions

Every table follows this shape:

```sql
CREATE TABLE IF NOT EXISTS {entity} (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- domain columns here
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_{entity}_updated_at ON {entity};
CREATE TRIGGER update_{entity}_updated_at
    BEFORE UPDATE ON {entity}
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_{entity}_user_id ON {entity}(user_id);
```

- **UUID primary keys**, not serial integers. IDs appear in URLs; sequential
  integers leak volume and invite enumeration. Requires
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` at the top of `sql_init.sql`.
- **`user_id` on every domain table**, referencing the acting user. This is
  provenance: every row records who created it. `ON DELETE CASCADE` so removing
  a user removes their data.
- **`created_at` / `updated_at` on every table.** `created_at` is what lists
  sort by (newest first is the usual default); `updated_at` is maintained by
  the shared trigger, never by application code.
- **The trigger function is defined once** in both schema files:

  ```sql
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
  END;
  $$ language 'plpgsql';
  ```

## Indexing

Index these, and stop there until a slow query proves otherwise:

- every foreign key (`user_id`, and any `{parent}_id`)
- any column used in a `WHERE` from the UI (title, author, isbn, barcode)
- any `status`-style column that queries filter on
- any date column that lists sort or range-filter by

Name them `idx_{table}_{column}`. Always `IF NOT EXISTS`.

## Documenting intent

Use `COMMENT ON COLUMN` where a column's meaning or constraint isn't obvious
from its name — especially where the reason is a policy decision:

```sql
COMMENT ON COLUMN borrowers.borrower_id IS 'Unique random 8-character
alphanumeric identifier. The borrower''s only identifier — no name or other
PII is ever stored.';
```

That comment is why the next person doesn't "helpfully" add a name column.

## Data minimisation is a schema decision

The strongest privacy control is a column that doesn't exist. Before adding a
column that holds personal data, ask whether a generated opaque identifier
would do the job. `library-app` identifies borrowers solely by a random
8-character `borrower_id` generated in the backend, checked for uniqueness
against the table, with no name, email, or contact detail stored anywhere.

If a column must hold personal data, note in a `COMMENT` why it's necessary.

## Status columns

Use `VARCHAR` with a `CHECK` constraint rather than a Postgres `ENUM` —
enums require a migration to extend, checks don't:

```sql
status VARCHAR(20) NOT NULL DEFAULT 'Available'
    CHECK (status IN ('Available', 'Checked Out', 'Lost'))
```

## Money

`NUMERIC(10,2)`, never `float`. Note that psycopg2 returns `NUMERIC` as
Python `Decimal`, which Flask's default JSON encoder cannot serialize — the
backend skill covers the JSON provider that handles this.
