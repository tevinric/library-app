# Restore from Google Drive Backup Guide

Complete step-by-step guide for restoring the PostgreSQL database from Google Drive backups on a Linux VPS.

## Table of Contents
1. [Before You Begin](#before-you-begin)
2. [Preparation](#preparation)
3. [Restore Process Overview](#restore-process-overview)
4. [Method 1: Full Database Restore](#method-1-full-database-restore)
5. [Method 2: Restore to New Database](#method-2-restore-to-new-database)
6. [Method 3: Selective Table Restore](#method-3-selective-table-restore)
7. [Verify Restore](#verify-restore)
8. [Troubleshooting](#troubleshooting)
9. [Disaster Recovery Scenarios](#disaster-recovery-scenarios)

---

## Before You Begin

### ⚠️ IMPORTANT WARNINGS

1. **Data Loss Risk:** Restoring a backup will OVERWRITE current database data
2. **Downtime Required:** The application should be stopped during restore
3. **Backup Current State:** Always backup the current database before restoring
4. **Test First:** Test restore in a separate environment if possible

### Prerequisites

- Access to VPS with sudo privileges
- rclone configured and connected to Google Drive as `zoe_library` (see [02-GOOGLE-DRIVE-BACKUP.md](./02-GOOGLE-DRIVE-BACKUP.md))
- Docker and docker-compose installed
- PostgreSQL container available

### Key Docker Compose Details

For reference, these are the relevant names and values from `docker-compose.yml` used throughout this guide:

| Detail | Value |
|---|---|
| PostgreSQL container | `postgres_library_app` |
| Backend container | `library_app_backend` |
| Frontend container | `library_app_frontend` |
| DB name env var | `ZOELIBRARYAPP_DB_NAME` |
| DB user env var | `ZOELIBRARYAPP_DB_USER` |
| DB password env var | `ZOELIBRARYAPP_DB_PASSWORD` |
| Host backups directory | `~/library-app/backups/` |
| Container backups mount | `/backups/` |
| Docker network | `library_network` |
| Frontend port | `3002` (default) |
| Backend port | `5002` (default) |

> **Important:** The `backups/` directory on the host is mounted directly into the PostgreSQL container at `/backups`. This means all restore commands use `-f /backups/<filename>` to read the SQL file from inside the container — no stdin piping required.

> **`stop` vs `down`:** This guide uses `docker-compose stop` instead of `docker-compose down` throughout. `stop` halts containers but preserves the network and container definitions. `down` tears everything down including the network, which causes `docker-compose start postgres` to fail on the next step. Only use `docker-compose down` when you intentionally want a full teardown (e.g. redeploying the app from scratch).

---

## Preparation

### 1. Load Environment Variables

All commands in this guide use environment variables from your `.env` file. Load them into your shell session first so you do not need to hardcode credentials anywhere:

```bash
cd ~/library-app

# Load env vars into current shell session
set -a
source .env
set +a

# Verify the key variables are loaded
echo "DB Name: $ZOELIBRARYAPP_DB_NAME"
echo "DB User: $ZOELIBRARYAPP_DB_USER"
# Both should print your actual values, not blank lines
```

> Keep this shell session open for all subsequent steps. If you open a new terminal, re-run the `source .env` step.

### 2. Stop the Application

```bash
cd ~/library-app

# Stop all containers — preserves the network and container definitions
docker-compose stop

# Verify all containers are stopped
docker ps | grep library_app
# Should show no results
```

### 3. Backup Current Database (Safety First!)

```bash
cd ~/library-app

# Start only PostgreSQL — network already exists so this works cleanly
docker-compose start postgres

# Wait for the healthcheck to pass
sleep 15

# Verify PostgreSQL is healthy before proceeding
docker ps | grep postgres_library_app
# Look for "(healthy)" in the STATUS column

# Create an emergency backup using the mounted /backups volume
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker exec postgres_library_app pg_dump \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -f /backups/emergency_backup_${TIMESTAMP}.sql

# Compress it on the host
gzip ~/library-app/backups/emergency_backup_${TIMESTAMP}.sql

# Verify backup was created
ls -lh ~/library-app/backups/emergency_backup_${TIMESTAMP}.sql.gz

echo "Emergency backup created: emergency_backup_${TIMESTAMP}.sql.gz"
```

### 4. List Available Backups on Google Drive

```bash
# List all available backups
rclone lsl zoe_library:zoe_library

# Filter to backup files only
rclone lsl zoe_library:zoe_library | grep "library_app_backup_"

# Show the last 5 backups
rclone lsl zoe_library:zoe_library | grep "library_app_backup_" | tail -5
```

**Example Output:**
```
   487234 2026-02-05 14:30:22 library_app_backup_20260205_143022.sql.gz
   485123 2026-02-04 14:30:15 library_app_backup_20260204_143015.sql.gz
   490001 2026-02-03 14:30:18 library_app_backup_20260203_143018.sql.gz
```

### 5. Download Backup from Google Drive

```bash
# Set the backup file you want to restore (choose from the list above)
BACKUP_FILE="library_app_backup_20260205_143022.sql.gz"

# Download from Google Drive into the local backups directory
rclone copy "zoe_library:zoe_library/$BACKUP_FILE" ~/library-app/backups/

# Verify download
ls -lh ~/library-app/backups/$BACKUP_FILE

# Decompress — the decompressed file will be available inside the container at /backups/
gunzip ~/library-app/backups/$BACKUP_FILE

# Set the SQL filename for use in subsequent steps
BACKUP_FILE_SQL="${BACKUP_FILE%.gz}"

# Verify decompressed file exists and looks correct
ls -lh ~/library-app/backups/$BACKUP_FILE_SQL
head -20 ~/library-app/backups/$BACKUP_FILE_SQL
```

---

## Restore Process Overview

```
┌─────────────────────┐
│  Google Drive       │
│  zoe_library folder │
└──────────┬──────────┘
           │
           │ rclone copy
           ▼
┌─────────────────────────────────────────┐
│  Host: ~/library-app/backups/           │
│  Container mount: /backups/             │
│  (same directory, visible from both)    │
└──────────┬──────────────────────────────┘
           │
           │ gunzip (on host)
           ▼
┌─────────────────────┐
│  Decompressed       │
│  SQL File           │
│  (host + container) │
└──────────┬──────────┘
           │
           │ psql -f /backups/<file>
           │ (runs inside container)
           ▼
┌─────────────────────┐
│  PostgreSQL         │
│  $ZOELIBRARYAPP_    │
│  DB_NAME            │
└─────────────────────┘
```

---

## Method 1: Full Database Restore

This method completely replaces the existing database with the backup.

### Step 1: Start PostgreSQL Container

```bash
cd ~/library-app

# Start only PostgreSQL (not backend or frontend)
docker-compose start postgres

# Wait for the healthcheck to pass
sleep 15

# Verify PostgreSQL is healthy
docker ps | grep postgres_library_app
# Look for "(healthy)" in the STATUS column
```

### Step 2: Drop Existing Database (⚠️ DESTRUCTIVE!)

Run as one-liners from the host to use your env vars directly:

```bash
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "DROP DATABASE IF EXISTS $ZOELIBRARYAPP_DB_NAME;"

docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "CREATE DATABASE $ZOELIBRARYAPP_DB_NAME;"

docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "GRANT ALL PRIVILEGES ON DATABASE $ZOELIBRARYAPP_DB_NAME TO $ZOELIBRARYAPP_DB_USER;"
```

### Step 3: Restore Database from Backup

The backup file is already visible inside the container at `/backups/` due to the volume mount in `docker-compose.yml`.

```bash
# Confirm the file is visible inside the container
docker exec postgres_library_app ls -lh /backups/$BACKUP_FILE_SQL

# Restore the database using the mounted file
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -f /backups/$BACKUP_FILE_SQL

# Check the exit code
echo "Restore exit code: $?"
# Exit code 0 = success
```

### Step 4: Verify Restore

```bash
# Connect to the restored database
docker exec -it postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME

# Inside the psql shell, run verification queries:
\dt                         -- List all tables (confirms schema restored)
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM books;
SELECT COUNT(*) FROM borrowers;
SELECT COUNT(*) FROM checkouts;

-- Check timestamps match the backup date
SELECT MAX(updated_at) FROM users;
SELECT MAX(created_at) FROM books;

\q
```

### Step 5: Restart All Services

```bash
cd ~/library-app

# Start all services — containers and network already exist
docker-compose start

# Verify all containers are running and healthy
docker ps

# Watch logs to confirm clean startup
docker-compose logs -f
```

### Step 6: Test Application

1. Open browser: `http://YOUR_VPS_IP:3002`
2. Login with Azure AD
3. Check Dashboard shows correct data
4. Verify books, borrowers, and checkouts are present
5. Try creating a new record to confirm write operations work

---

## Method 2: Restore to New Database

This method creates a new database alongside the existing one — safer for testing before committing.

### Step 1: Create New Database

```bash
cd ~/library-app

# Start only PostgreSQL
docker-compose start postgres
sleep 15

# Create a parallel database for the restore
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "CREATE DATABASE ${ZOELIBRARYAPP_DB_NAME}_restored;"

docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "GRANT ALL PRIVILEGES ON DATABASE ${ZOELIBRARYAPP_DB_NAME}_restored TO $ZOELIBRARYAPP_DB_USER;"
```

### Step 2: Restore to New Database

```bash
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d ${ZOELIBRARYAPP_DB_NAME}_restored \
  -f /backups/$BACKUP_FILE_SQL
```

### Step 3: Compare Databases

```bash
# Record counts from the LIVE database
echo "=== Live database ==="
docker exec postgres_library_app psql -U $ZOELIBRARYAPP_DB_USER -d $ZOELIBRARYAPP_DB_NAME \
  -c "SELECT 'users' AS tbl, COUNT(*) FROM users
      UNION ALL SELECT 'books', COUNT(*) FROM books
      UNION ALL SELECT 'borrowers', COUNT(*) FROM borrowers
      UNION ALL SELECT 'checkouts', COUNT(*) FROM checkouts;"

# Record counts from the RESTORED database
echo "=== Restored database ==="
docker exec postgres_library_app psql -U $ZOELIBRARYAPP_DB_USER -d ${ZOELIBRARYAPP_DB_NAME}_restored \
  -c "SELECT 'users' AS tbl, COUNT(*) FROM users
      UNION ALL SELECT 'books', COUNT(*) FROM books
      UNION ALL SELECT 'borrowers', COUNT(*) FROM borrowers
      UNION ALL SELECT 'checkouts', COUNT(*) FROM checkouts;"
```

### Step 4: Switch Application to Restored Database

```bash
# Edit .env file
nano ~/library-app/.env

# Change the DB name line from:
ZOELIBRARYAPP_DB_NAME=<current_value>

# To:
ZOELIBRARYAPP_DB_NAME=<current_value>_restored

# Save and exit (Ctrl+O, Enter, Ctrl+X)

# Recreate containers to pick up the .env change, then start
# (docker-compose up -d is used here specifically because .env changed)
docker-compose stop
docker-compose up -d

# Test the application at http://YOUR_VPS_IP:3002
```

### Step 5: Clean Up (After Verification)

```bash
# Reload env vars to pick up the current DB name
set -a && source ~/library-app/.env && set +a

# Drop the old database (its name is the current value minus _restored)
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "DROP DATABASE ${ZOELIBRARYAPP_DB_NAME%_restored};"

# Rename the restored database back to the original name
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "ALTER DATABASE $ZOELIBRARYAPP_DB_NAME RENAME TO ${ZOELIBRARYAPP_DB_NAME%_restored};"

# Revert .env to the original DB name
nano ~/library-app/.env
# Remove the _restored suffix from ZOELIBRARYAPP_DB_NAME

# Recreate containers to pick up the reverted .env
docker-compose stop
docker-compose up -d
```

---

## Method 3: Selective Table Restore

Restore a specific table only (advanced).

### Step 1: Extract Specific Table from Backup

```bash
TABLE_NAME="books"

# Extract the CREATE TABLE + INSERT statements for this table only
grep -A 10000 "CREATE TABLE.*$TABLE_NAME" \
  ~/library-app/backups/$BACKUP_FILE_SQL \
  > ~/library-app/backups/restore_${TABLE_NAME}.sql
```

### Step 2: Restore Specific Table

```bash
cd ~/library-app

# Start only PostgreSQL
docker-compose start postgres
sleep 15

# Drop the existing table and restore from the extracted backup
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -c "DROP TABLE IF EXISTS $TABLE_NAME CASCADE;"

docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -f /backups/restore_${TABLE_NAME}.sql
```

### Step 3: Verify Table Restore

```bash
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -c "SELECT COUNT(*) FROM $TABLE_NAME;"
```

---

## Verify Restore

### 1. Database Health Check

```bash
# Check database size
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -c "SELECT pg_size_pretty(pg_database_size('$ZOELIBRARYAPP_DB_NAME'));"

# Check table row counts and sizes
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -c "
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Check indexes are present
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -c "\di"

# Check triggers are present
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -c "
SELECT tgname, tgrelid::regclass, prosrc
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid;
"
```

### 2. Application Health Check

```bash
# Check backend API health endpoint
curl http://localhost:5002/api/health

# Expected: {"status": "healthy"}

# Check backend container logs
docker-compose logs backend | tail -50

# Check frontend container logs
docker-compose logs frontend | tail -50
```

### 3. Functional Testing Checklist

- [ ] Login with Azure AD works
- [ ] Dashboard displays data
- [ ] Books page loads
- [ ] Borrowers page loads
- [ ] Checkouts page loads
- [ ] Can create new book
- [ ] Can edit existing book
- [ ] Can delete book (test with dummy data)
- [ ] Can create new borrower
- [ ] Can checkout a book
- [ ] Can check in a book
- [ ] Wishlist loads
- [ ] Follow-ups load

---

## Troubleshooting

### Issue: "No such service: postgres" or container not found on `docker-compose start`

This means the containers were removed with `docker-compose down` rather than stopped with `docker-compose stop`. The containers no longer exist, so `start` has nothing to start. Use `up` instead to recreate them:

```bash
cd ~/library-app

# Recreate and start all containers (also recreates the network)
docker-compose up -d

# Then stop the backend and frontend, leaving only postgres running
docker-compose stop backend frontend
```

From this point forward, use `docker-compose stop` / `docker-compose start` for the rest of the restore process.

### Issue: "psql: FATAL: database does not exist"

```bash
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "CREATE DATABASE $ZOELIBRARYAPP_DB_NAME;"

# Then retry restore
```

### Issue: "permission denied for database"

```bash
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "GRANT ALL PRIVILEGES ON DATABASE $ZOELIBRARYAPP_DB_NAME TO $ZOELIBRARYAPP_DB_USER;"

# If still failing, try as the postgres superuser
docker exec postgres_library_app psql \
  -U postgres \
  -d postgres \
  -c "GRANT ALL PRIVILEGES ON DATABASE $ZOELIBRARYAPP_DB_NAME TO $ZOELIBRARYAPP_DB_USER;"
```

### Issue: Restore hangs or takes very long

```bash
# Terminate other connections to the database
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d postgres \
  -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$ZOELIBRARYAPP_DB_NAME' AND pid <> pg_backend_pid();
"

# Retry with ON_ERROR_STOP to see exactly where it fails
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -v ON_ERROR_STOP=1 \
  -f /backups/$BACKUP_FILE_SQL
```

### Issue: "relation already exists" errors

```bash
# Option A — drop and recreate the database completely:
docker exec postgres_library_app psql -U $ZOELIBRARYAPP_DB_USER -d postgres \
  -c "DROP DATABASE $ZOELIBRARYAPP_DB_NAME;"
docker exec postgres_library_app psql -U $ZOELIBRARYAPP_DB_USER -d postgres \
  -c "CREATE DATABASE $ZOELIBRARYAPP_DB_NAME;"

# Option B — restore with --clean flag (drops objects before recreating):
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  --clean \
  -f /backups/$BACKUP_FILE_SQL
```

### Issue: Backup file is corrupted

```bash
# Test backup file integrity on the host
gunzip -t ~/library-app/backups/$BACKUP_FILE

# If corrupted, delete and re-download from Google Drive
rm ~/library-app/backups/$BACKUP_FILE
rclone copy "zoe_library:zoe_library/$BACKUP_FILE" ~/library-app/backups/

# Verify checksum if available
md5sum ~/library-app/backups/$BACKUP_FILE
```

### Issue: Missing tables after restore

```bash
# Check what tables exist in the database
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -c "\dt"

# Check the backup file contains CREATE TABLE statements
head -100 ~/library-app/backups/$BACKUP_FILE_SQL | grep "CREATE TABLE"

# Check the backup file is complete
tail -20 ~/library-app/backups/$BACKUP_FILE_SQL
# Should end with: "-- PostgreSQL database dump complete"
```

### Issue: Application can't connect after restore

```bash
# Check the backend container's env vars are correct
docker exec -it library_app_backend env | grep ZOELIBRARYAPP_DB

# Restart the backend to force a fresh connection pool
docker-compose restart backend

# Watch backend logs for connection errors
docker-compose logs backend
```

### Issue: PostgreSQL container not reaching healthy status

```bash
# Check what the healthcheck sees
docker inspect postgres_library_app | grep -A 10 '"Health"'

# Check PostgreSQL container logs for startup errors
docker logs postgres_library_app

# Manually run the healthcheck command
docker exec postgres_library_app pg_isready \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME
```

---

## Disaster Recovery Scenarios

### Scenario 1: Complete Server Failure

When rebuilding on a new server there are no existing containers or network, so `docker-compose up -d` is used to create everything from scratch.

**Steps:**
1. Provision new VPS
2. Follow `01-VPS-DEPLOYMENT.md` to set up the environment
3. Clone or redeploy the `library-app` project
4. Restore your `.env` file with all `ZOELIBRARYAPP_` variables
5. Install rclone and configure the Google Drive remote as `zoe_library` (see `02-GOOGLE-DRIVE-BACKUP.md`)
6. Start the full stack for the first time: `docker-compose up -d`
7. Stop backend and frontend, leaving only postgres: `docker-compose stop backend frontend`
8. Follow Method 1 from Step 2 (Drop Existing Database) onwards
9. Start all services: `docker-compose start`
10. Update DNS to point to new VPS
11. Test application thoroughly

**Time Estimate:** 1–2 hours

### Scenario 2: Accidental Data Deletion

**Steps:**
1. Immediately stop the application: `docker-compose stop`
2. Create an emergency backup (see Preparation step 3)
3. Download the most recent Google Drive backup taken before the deletion occurred
4. Follow Method 2 (Restore to New Database) for side-by-side comparison
5. Follow Method 1 to fully restore once you have confirmed the backup looks correct
6. Start all services: `docker-compose start`

**Time Estimate:** 30 minutes

### Scenario 3: Database Corruption

**Steps:**
1. Stop the application: `docker-compose stop`
2. Check PostgreSQL logs: `docker logs postgres_library_app`
3. Start only postgres: `docker-compose start postgres`
4. Attempt an emergency backup (may fail if severely corrupted — that is OK)
5. Download the latest known-good backup from Google Drive
6. Follow Method 1 (Full Database Restore) from Step 2 onwards
7. Start all services: `docker-compose start`

**Time Estimate:** 20–30 minutes

### Scenario 4: Rollback to Previous Date

**Steps:**
1. Stop the application: `docker-compose stop`
2. List available backups on Google Drive to identify the right date
3. Start only postgres: `docker-compose start postgres`
4. Download the backup from that specific date
5. Follow Method 2 (Restore to New Database) for a side-by-side comparison
6. If the data looks correct, follow Method 1 to fully replace the live database
7. Start all services: `docker-compose start`

**Time Estimate:** 30–45 minutes

---

## Best Practices

1. **Regular Testing:** Test the restore process monthly to confirm backups are valid
2. **Use `stop` not `down`:** During restore operations always use `docker-compose stop` to preserve the network and container definitions
3. **Document Recovery Time Objective (RTO):** Know how long recovery takes
4. **Document Recovery Point Objective (RPO):** Know the maximum acceptable data loss window
5. **Keep Multiple Backups:** Don't rely on a single backup file
6. **Test in Staging First:** If possible, test restore in a separate environment before touching production
7. **Communicate Downtime:** Inform users before starting the restore process
8. **Verify Thoroughly:** Never skip the verification steps

---

## Automated Restore Script (Optional)

Create a script for quick restore:

```bash
cd ~/library-app
nano scripts/restore_from_gdrive.sh
```

Add the following content:

```bash
#!/bin/bash

# Quick Restore Script
# Usage: ./scripts/restore_from_gdrive.sh <backup_filename>
# Example: ./scripts/restore_from_gdrive.sh library_app_backup_20260205_143022.sql.gz

set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <backup_filename>"
    echo "Example: $0 library_app_backup_20260205_143022.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
elif [ -f "$PROJECT_ROOT/env.sh" ]; then
    source "$PROJECT_ROOT/env.sh"
else
    echo "ERROR: No .env or env.sh found at $PROJECT_ROOT"
    exit 1
fi

# Validate required variables
if [ -z "${ZOELIBRARYAPP_DB_NAME:-}" ] || [ -z "${ZOELIBRARYAPP_DB_USER:-}" ]; then
    echo "ERROR: ZOELIBRARYAPP_DB_NAME or ZOELIBRARYAPP_DB_USER not set in .env"
    exit 1
fi

echo "========================================="
echo "Starting restore process..."
echo "Database : $ZOELIBRARYAPP_DB_NAME"
echo "User     : $ZOELIBRARYAPP_DB_USER"
echo "Backup   : $BACKUP_FILE"
echo "========================================="

# Download from Google Drive
echo "[1/7] Downloading backup from Google Drive..."
rclone copy "zoe_library:zoe_library/$BACKUP_FILE" "$BACKUP_DIR/"
echo "      ✓ Downloaded"

# Decompress
echo "[2/7] Decompressing backup..."
gunzip "$BACKUP_DIR/$BACKUP_FILE"
BACKUP_FILE_SQL="${BACKUP_FILE%.gz}"
echo "      ✓ Decompressed: $BACKUP_FILE_SQL"

# Stop all services — use stop (not down) to preserve network and containers
echo "[3/7] Stopping all services..."
cd "$PROJECT_ROOT"
docker-compose stop
echo "      ✓ Services stopped"

# Start only PostgreSQL
echo "[4/7] Starting PostgreSQL..."
docker-compose start postgres
echo "      Waiting for healthcheck..."
sleep 15
docker exec postgres_library_app pg_isready \
  -U "$ZOELIBRARYAPP_DB_USER" \
  -d "$ZOELIBRARYAPP_DB_NAME" \
  && echo "      ✓ PostgreSQL is ready"

# Create emergency backup using the mounted volume
echo "[5/7] Creating emergency backup of current state..."
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker exec postgres_library_app pg_dump \
  -U "$ZOELIBRARYAPP_DB_USER" \
  -d "$ZOELIBRARYAPP_DB_NAME" \
  -f "/backups/emergency_before_restore_${TIMESTAMP}.sql"
gzip "$BACKUP_DIR/emergency_before_restore_${TIMESTAMP}.sql"
echo "      ✓ Emergency backup: emergency_before_restore_${TIMESTAMP}.sql.gz"

# Drop and recreate database
echo "[6/7] Dropping and recreating database..."
docker exec postgres_library_app psql \
  -U "$ZOELIBRARYAPP_DB_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS $ZOELIBRARYAPP_DB_NAME;"
docker exec postgres_library_app psql \
  -U "$ZOELIBRARYAPP_DB_USER" -d postgres \
  -c "CREATE DATABASE $ZOELIBRARYAPP_DB_NAME;"
docker exec postgres_library_app psql \
  -U "$ZOELIBRARYAPP_DB_USER" -d postgres \
  -c "GRANT ALL PRIVILEGES ON DATABASE $ZOELIBRARYAPP_DB_NAME TO $ZOELIBRARYAPP_DB_USER;"
echo "      ✓ Database recreated"

# Restore from the mounted /backups directory
echo "[7/7] Restoring database from backup..."
docker exec postgres_library_app psql \
  -U "$ZOELIBRARYAPP_DB_USER" \
  -d "$ZOELIBRARYAPP_DB_NAME" \
  -f "/backups/$BACKUP_FILE_SQL"
echo "      ✓ Database restored"

# Start all services
echo "Starting all services..."
docker-compose start

echo ""
echo "========================================="
echo "✓ Restore complete!"
echo "  Emergency backup : emergency_before_restore_${TIMESTAMP}.sql.gz"
echo "  Please verify the application at http://YOUR_VPS_IP:3002"
echo "========================================="
```

Make executable:

```bash
chmod +x ~/library-app/scripts/restore_from_gdrive.sh
```

Use it:

```bash
cd ~/library-app
./scripts/restore_from_gdrive.sh library_app_backup_20260205_143022.sql.gz
```

---

## Quick Reference Commands

```bash
# Load env vars first
cd ~/library-app && set -a && source .env && set +a

# List all backups on Google Drive
rclone lsl zoe_library:zoe_library

# Download the latest backup
LATEST=$(rclone lsf zoe_library:zoe_library | grep library_app_backup | tail -1)
rclone copy "zoe_library:zoe_library/$LATEST" ~/library-app/backups/

# Decompress (replace filename with actual downloaded file)
gunzip ~/library-app/backups/$LATEST

# Stop all services cleanly (preserves network)
docker-compose stop

# Start only postgres
docker-compose start postgres

# Full restore via mounted volume (use exact filename, not wildcard)
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -f /backups/library_app_backup_20260205_143022.sql

# Verify record counts
docker exec postgres_library_app psql \
  -U $ZOELIBRARYAPP_DB_USER \
  -d $ZOELIBRARYAPP_DB_NAME \
  -c "SELECT 'users' AS tbl, COUNT(*) FROM users
      UNION ALL SELECT 'books', COUNT(*) FROM books
      UNION ALL SELECT 'borrowers', COUNT(*) FROM borrowers
      UNION ALL SELECT 'checkouts', COUNT(*) FROM checkouts;"

# Start all services
docker-compose start

# Check all containers are running with their status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

**Last Updated:** February 2026