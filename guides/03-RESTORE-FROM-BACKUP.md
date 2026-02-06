# Restore from Google Drive Backup Guide

Complete step-by-step guide for restoring PostgreSQL database from Google Drive backups on a Linux VPS.

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
2. **Downtime Required:** Application should be stopped during restore
3. **Backup Current State:** Always backup current database before restoring
4. **Test First:** Test restore in a separate environment if possible

### Prerequisites

- Access to VPS with sudo privileges
- rclone configured and connected to Google Drive (see [02-GOOGLE-DRIVE-BACKUP.md](./02-GOOGLE-DRIVE-BACKUP.md))
- Docker and docker-compose installed
- PostgreSQL container running (or stopped, depending on restore method)

---

## Preparation

### 1. Stop the Application

```bash
# Navigate to application directory
cd ~/library_app

# Stop all containers
docker-compose down

# Verify containers are stopped
docker ps | grep library_app
# Should show no results
```

### 2. Backup Current Database (Safety First!)

```bash
# Create emergency backup of current state
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker-compose up -d postgres  # Start only PostgreSQL

# Wait for PostgreSQL to be ready
sleep 10

# Create backup
docker exec postgres_library_app pg_dump -U libraryuser -d library_app_db > ~/library_app/backups/emergency_backup_${TIMESTAMP}.sql

# Compress backup
gzip ~/library_app/backups/emergency_backup_${TIMESTAMP}.sql

# Verify backup was created
ls -lh ~/library_app/backups/emergency_backup_${TIMESTAMP}.sql.gz

echo "Emergency backup created: emergency_backup_${TIMESTAMP}.sql.gz"
```

### 3. List Available Backups on Google Drive

```bash
# List all available backups
rclone lsl gdrive_backup:LibraryApp_Backups

# List only backup files with timestamps
rclone lsl gdrive_backup:LibraryApp_Backups | grep "library_app_backup_"

# Show last 5 backups
rclone lsl gdrive_backup:LibraryApp_Backups | grep "library_app_backup_" | tail -5
```

**Example Output:**
```
   487234 2026-02-05 14:30:22 library_app_backup_20260205_143022.sql.gz
   485123 2026-02-04 14:30:15 library_app_backup_20260204_143015.sql.gz
   490001 2026-02-03 14:30:18 library_app_backup_20260203_143018.sql.gz
```

### 4. Download Backup from Google Drive

```bash
# Choose a backup file from the list above
BACKUP_FILE="library_app_backup_20260205_143022.sql.gz"

# Download from Google Drive to local backups directory
rclone copy "gdrive_backup:LibraryApp_Backups/$BACKUP_FILE" ~/library_app/backups/

# Verify download
ls -lh ~/library_app/backups/$BACKUP_FILE

# Decompress backup
gunzip ~/library_app/backups/$BACKUP_FILE

# Remove .gz extension from filename for next steps
BACKUP_FILE_SQL="${BACKUP_FILE%.gz}"

# Verify decompressed file
ls -lh ~/library_app/backups/$BACKUP_FILE_SQL
head -20 ~/library_app/backups/$BACKUP_FILE_SQL
```

---

## Restore Process Overview

```
┌─────────────────────┐
│  Google Drive       │
│  Backup Storage     │
└──────────┬──────────┘
           │
           │ rclone copy
           ▼
┌─────────────────────┐
│  Local VPS          │
│  Backup Directory   │
└──────────┬──────────┘
           │
           │ gunzip
           ▼
┌─────────────────────┐
│  Decompressed       │
│  SQL File           │
└──────────┬──────────┘
           │
           │ psql restore
           ▼
┌─────────────────────┐
│  PostgreSQL         │
│  Database           │
└─────────────────────┘
```

---

## Method 1: Full Database Restore

This method completely replaces the existing database with the backup.

### Step 1: Start PostgreSQL Container

```bash
# Start only PostgreSQL (not backend/frontend)
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
sleep 10

# Verify PostgreSQL is running
docker ps | grep postgres_library_app
```

### Step 2: Drop Existing Database (⚠️ DESTRUCTIVE!)

```bash
# Connect to PostgreSQL as superuser
docker exec -it postgres_library_app psql -U libraryuser -d postgres

# Inside PostgreSQL shell, run:
DROP DATABASE IF EXISTS library_app_db;
CREATE DATABASE library_app_db;
GRANT ALL PRIVILEGES ON DATABASE library_app_db TO libraryuser;
\q
```

### Step 3: Restore Database from Backup

```bash
# Set backup filename (use your actual backup file)
BACKUP_FILE_SQL="library_app_backup_20260205_143022.sql"

# Restore database
docker exec -i postgres_library_app psql -U libraryuser -d library_app_db < ~/library_app/backups/$BACKUP_FILE_SQL

# Check for errors
echo "Restore exit code: $?"
# Exit code 0 = success
```

### Step 4: Verify Restore

```bash
# Connect to database
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db

# Run verification queries
\dt                    -- List all tables
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM books;
SELECT COUNT(*) FROM borrowers;
SELECT COUNT(*) FROM checkouts;

# Check last updated timestamp (should match backup date)
SELECT MAX(updated_at) FROM users;
SELECT MAX(created_at) FROM books;

# Exit
\q
```

### Step 5: Restart All Services

```bash
# Stop PostgreSQL
docker-compose down

# Start all services
docker-compose up -d

# Verify all containers are running
docker ps

# Check logs
docker-compose logs -f
```

### Step 6: Test Application

1. Open browser: `http://YOUR_VPS_IP:3002`
2. Login with Azure AD
3. Check Dashboard shows correct data
4. Verify books, borrowers, and checkouts are present
5. Try creating a new record to ensure write operations work

---

## Method 2: Restore to New Database

This method creates a new database alongside the existing one (safer for testing).

### Step 1: Create New Database

```bash
# Start PostgreSQL
docker-compose up -d postgres
sleep 10

# Create new database with different name
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "CREATE DATABASE library_app_restored;"

# Grant permissions
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE library_app_restored TO libraryuser;"
```

### Step 2: Restore to New Database

```bash
# Restore backup to new database
BACKUP_FILE_SQL="library_app_backup_20260205_143022.sql"

docker exec -i postgres_library_app psql -U libraryuser -d library_app_restored < ~/library_app/backups/$BACKUP_FILE_SQL
```

### Step 3: Compare Databases

```bash
# Count records in original database
echo "Original database:"
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT COUNT(*) FROM users;"
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT COUNT(*) FROM books;"

# Count records in restored database
echo "Restored database:"
docker exec -it postgres_library_app psql -U libraryuser -d library_app_restored -c "SELECT COUNT(*) FROM users;"
docker exec -it postgres_library_app psql -U libraryuser -d library_app_restored -c "SELECT COUNT(*) FROM books;"
```

### Step 4: Switch Application to New Database

```bash
# Edit .env file
nano ~/library_app/.env

# Change DB_NAME from:
DB_NAME=library_app_db

# To:
DB_NAME=library_app_restored

# Save and exit (Ctrl+O, Enter, Ctrl+X)

# Restart services
docker-compose down
docker-compose up -d

# Test application
```

### Step 5: Clean Up (After Verification)

```bash
# Once verified, drop old database
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "DROP DATABASE library_app_db;"

# Optional: Rename restored database to original name
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "ALTER DATABASE library_app_restored RENAME TO library_app_db;"

# Update .env back to original
nano ~/library_app/.env
# Change DB_NAME back to: library_app_db

# Restart services
docker-compose down
docker-compose up -d
```

---

## Method 3: Selective Table Restore

Restore specific tables only (advanced).

### Step 1: Extract Specific Table from Backup

```bash
# Extract single table dump
BACKUP_FILE_SQL="library_app_backup_20260205_143022.sql"
TABLE_NAME="books"

# Create table-specific backup file
grep -A 10000 "CREATE TABLE.*$TABLE_NAME" ~/library_app/backups/$BACKUP_FILE_SQL > ~/library_app/backups/restore_${TABLE_NAME}.sql
```

### Step 2: Restore Specific Table

```bash
# Start PostgreSQL
docker-compose up -d postgres
sleep 10

# Drop and restore specific table
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "DROP TABLE IF EXISTS $TABLE_NAME CASCADE;"

docker exec -i postgres_library_app psql -U libraryuser -d library_app_db < ~/library_app/backups/restore_${TABLE_NAME}.sql
```

### Step 3: Verify Table Restore

```bash
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT COUNT(*) FROM $TABLE_NAME;"
```

---

## Verify Restore

### 1. Database Health Check

```bash
# Check database size
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT pg_size_pretty(pg_database_size('library_app_db'));"

# Check table counts
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Check for missing indexes
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "\di"

# Check for missing triggers
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "
SELECT tgname, tgrelid::regclass, prosrc
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid;
"
```

### 2. Application Health Check

```bash
# Check backend health
curl http://localhost:5002/api/health

# Expected: {"status": "healthy"}

# Check backend logs
docker-compose logs backend | tail -50

# Check frontend logs
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

### Issue: "psql: FATAL: database does not exist"

```bash
# Create database first
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "CREATE DATABASE library_app_db;"

# Then retry restore
```

### Issue: "permission denied for database"

```bash
# Grant permissions
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE library_app_db TO libraryuser;"

# Also try connecting as postgres superuser
docker exec -it postgres_library_app psql -U postgres -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE library_app_db TO libraryuser;"
```

### Issue: Restore hangs or takes very long

```bash
# Kill restore process
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'library_app_db' AND pid <> pg_backend_pid();
"

# Try restore with verbose output
docker exec -i postgres_library_app psql -U libraryuser -d library_app_db -v ON_ERROR_STOP=1 < ~/library_app/backups/$BACKUP_FILE_SQL
```

### Issue: "relation already exists" errors

```bash
# Either drop database completely first:
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "DROP DATABASE library_app_db;"
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "CREATE DATABASE library_app_db;"

# OR restore with --clean flag (drops objects before recreating):
docker exec -i postgres_library_app psql -U libraryuser -d library_app_db --clean < ~/library_app/backups/$BACKUP_FILE_SQL
```

### Issue: Backup file is corrupted

```bash
# Test backup file integrity
gunzip -t ~/library_app/backups/$BACKUP_FILE

# If corrupted, download again from Google Drive
rm ~/library_app/backups/$BACKUP_FILE
rclone copy "gdrive_backup:LibraryApp_Backups/$BACKUP_FILE" ~/library_app/backups/

# Verify file checksum (if available)
md5sum ~/library_app/backups/$BACKUP_FILE
```

### Issue: Missing tables after restore

```bash
# Check what tables exist
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "\dt"

# Check backup file content
head -100 ~/library_app/backups/$BACKUP_FILE_SQL | grep "CREATE TABLE"

# Verify backup file is complete
tail -20 ~/library_app/backups/$BACKUP_FILE_SQL
# Should end with something like "-- PostgreSQL database dump complete"
```

### Issue: Application can't connect after restore

```bash
# Check backend environment variables
docker exec -it library_app_backend env | grep DB_

# Restart backend to reconnect
docker-compose restart backend

# Check backend logs
docker-compose logs backend
```

---

## Disaster Recovery Scenarios

### Scenario 1: Complete Server Failure

**Steps:**
1. Provision new VPS
2. Follow [01-VPS-DEPLOYMENT.md](./01-VPS-DEPLOYMENT.md) to set up environment
3. Install rclone and configure Google Drive (see [02-GOOGLE-DRIVE-BACKUP.md](./02-GOOGLE-DRIVE-BACKUP.md))
4. Download latest backup from Google Drive
5. Follow Method 1 (Full Database Restore) above
6. Update DNS to point to new VPS
7. Test application thoroughly

**Time Estimate:** 1-2 hours

### Scenario 2: Accidental Data Deletion

**Steps:**
1. Immediately stop application: `docker-compose down`
2. Create emergency backup (see Preparation step 2)
3. Download recent backup from Google Drive (before deletion occurred)
4. Follow Method 2 (Restore to New Database) to compare data
5. Follow Method 1 to restore if comparison looks good
6. Restart application

**Time Estimate:** 30 minutes

### Scenario 3: Database Corruption

**Steps:**
1. Stop application
2. Try to backup current state (may fail if corrupted)
3. Check PostgreSQL logs: `docker logs postgres_library_app`
4. Download latest good backup from Google Drive
5. Follow Method 1 (Full Database Restore)
6. Restart and verify

**Time Estimate:** 20-30 minutes

### Scenario 4: Rollback to Previous Date

**Steps:**
1. List backups from desired date range
2. Download backup from specific date
3. Follow Method 2 (Restore to New Database) for testing
4. Compare restored data with current data
5. If satisfied, follow Method 1 to fully restore
6. Restart application

**Time Estimate:** 30-45 minutes

---

## Best Practices

1. **Regular Testing:** Test restore process monthly to ensure backups are valid
2. **Document Recovery Time Objective (RTO):** Know how long recovery takes
3. **Document Recovery Point Objective (RPO):** Know maximum acceptable data loss
4. **Keep Multiple Backups:** Don't rely on a single backup file
5. **Test in Staging First:** If possible, test restore in a separate environment
6. **Communicate Downtime:** Inform users before starting restore process
7. **Verify Thoroughly:** Don't skip verification steps
8. **Keep Emergency Contacts:** Document who to contact for help

---

## Automated Restore Script (Optional)

Create a script for quick restore:

```bash
# Create restore script
nano ~/library_app/scripts/restore_from_gdrive.sh
```

Add content:

```bash
#!/bin/bash

# Quick Restore Script
# Usage: ./restore_from_gdrive.sh <backup_filename>

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_filename>"
    echo "Example: $0 library_app_backup_20260205_143022.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"
BACKUP_DIR="$HOME/library_app/backups"

set -e  # Exit on error

echo "Starting restore process..."

# Download from Google Drive
echo "Downloading backup from Google Drive..."
rclone copy "gdrive_backup:LibraryApp_Backups/$BACKUP_FILE" "$BACKUP_DIR/"

# Decompress
echo "Decompressing backup..."
gunzip "$BACKUP_DIR/$BACKUP_FILE"
BACKUP_FILE_SQL="${BACKUP_FILE%.gz}"

# Stop services
echo "Stopping services..."
cd ~/library_app
docker-compose down

# Start only PostgreSQL
echo "Starting PostgreSQL..."
docker-compose up -d postgres
sleep 10

# Create emergency backup
echo "Creating emergency backup..."
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker exec postgres_library_app pg_dump -U libraryuser -d library_app_db | gzip > "$BACKUP_DIR/emergency_before_restore_${TIMESTAMP}.sql.gz"

# Drop and recreate database
echo "Dropping and recreating database..."
docker exec postgres_library_app psql -U libraryuser -d postgres -c "DROP DATABASE IF EXISTS library_app_db;"
docker exec postgres_library_app psql -U libraryuser -d postgres -c "CREATE DATABASE library_app_db;"

# Restore
echo "Restoring database..."
docker exec -i postgres_library_app psql -U libraryuser -d library_app_db < "$BACKUP_DIR/$BACKUP_FILE_SQL"

# Start all services
echo "Starting all services..."
docker-compose up -d

echo "Restore complete! Please verify the application."
echo "Emergency backup saved as: emergency_before_restore_${TIMESTAMP}.sql.gz"
```

Make executable:

```bash
chmod +x ~/library_app/scripts/restore_from_gdrive.sh
```

Use it:

```bash
./restore_from_gdrive.sh library_app_backup_20260205_143022.sql.gz
```

---

## Quick Reference Commands

```bash
# List backups on Google Drive
rclone lsl gdrive_backup:LibraryApp_Backups

# Download latest backup
rclone copy "gdrive_backup:LibraryApp_Backups/$(rclone lsf gdrive_backup:LibraryApp_Backups | grep library_app_backup | tail -1)" ~/library_app/backups/

# Decompress backup
gunzip ~/library_app/backups/library_app_backup_*.sql.gz

# Full restore (one-liner)
docker exec -i postgres_library_app psql -U libraryuser -d library_app_db < ~/library_app/backups/library_app_backup_*.sql

# Verify record counts
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT 'users' AS table_name, COUNT(*) FROM users UNION SELECT 'books', COUNT(*) FROM books UNION SELECT 'borrowers', COUNT(*) FROM borrowers;"
```

---

**Last Updated:** February 2026
