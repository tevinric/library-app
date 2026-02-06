# Google Drive Backup Setup Guide - PostgreSQL Database

Complete step-by-step guide for setting up automated PostgreSQL backups to Google Drive on a Linux VPS using rclone.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Install and Configure rclone](#install-and-configure-rclone)
3. [Create Backup Script](#create-backup-script)
4. [Test Manual Backup](#test-manual-backup)
5. [Set Up Automated Backups](#set-up-automated-backups)
6. [Monitor Backups](#monitor-backups)
7. [Backup Rotation Strategy](#backup-rotation-strategy)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Running Library Management App with PostgreSQL container
- Google Account with Google Drive access
- Root or sudo access on Linux VPS
- At least 1GB free space on VPS for temporary backup files

---

## Install and Configure rclone

### 1. Install rclone

```bash
# Download and install rclone
curl https://rclone.org/install.sh | sudo bash

# Verify installation
rclone version

# Expected output: rclone v1.xx.x
```

### 2. Configure rclone for Google Drive

**Option A: Interactive Configuration (Recommended for beginners)**

```bash
# Start rclone configuration
rclone config

# Follow the prompts:
# n) New remote
# name> gdrive_backup
# Storage> 18 (Google Drive)
# client_id> (Press Enter - leave blank)
# client_secret> (Press Enter - leave blank)
# scope> 1 (Full access)
# root_folder_id> (Press Enter - leave blank)
# service_account_file> (Press Enter - leave blank)
# Edit advanced config? n
# Use web browser to automatically authenticate? y
```

A browser window will open. Sign in with your Google account and authorize rclone.

**Option B: Remote Configuration (For VPS without browser)**

If your VPS doesn't have a graphical interface:

```bash
# On your LOCAL machine (with browser):
rclone authorize "drive"

# This will open a browser and generate a token
# Copy the entire token output

# On your VPS, run:
rclone config

# Follow prompts and paste the token when asked
```

### 3. Test Google Drive Connection

```bash
# List Google Drive root directory
rclone lsd gdrive_backup:

# Create backup folder on Google Drive
rclone mkdir gdrive_backup:LibraryApp_Backups

# Verify folder was created
rclone lsd gdrive_backup:

# You should see: LibraryApp_Backups folder
```

---

## Create Backup Script

### 1. Create Backup Script File

```bash
# Create scripts directory
mkdir -p ~/library_app/scripts
cd ~/library_app/scripts

# Create backup script
nano postgresql_backup.sh
```

### 2. Add Backup Script Content

Copy and paste the following script:

```bash
#!/bin/bash

################################################################################
# PostgreSQL Backup Script for Google Drive
# Backs up PostgreSQL database from Docker container to Google Drive via rclone
################################################################################

# Configuration
CONTAINER_NAME="postgres_library_app"
DB_NAME="library_app_db"
DB_USER="libraryuser"
BACKUP_DIR="/home/$USER/library_app/backups"
RCLONE_REMOTE="gdrive_backup:LibraryApp_Backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="library_app_backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"
LOG_FILE="$BACKUP_DIR/backup_log.txt"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    log_message "SUCCESS: $1"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    log_message "ERROR: $1"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
    log_message "INFO: $1"
}

# Start backup process
log_message "========================================="
log_message "Starting backup process"
print_info "Starting PostgreSQL backup..."

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    print_error "PostgreSQL container '$CONTAINER_NAME' is not running!"
    exit 1
fi

print_success "PostgreSQL container is running"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create database dump
print_info "Creating database dump..."
if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE"; then
    print_success "Database dump created: $BACKUP_FILE"
else
    print_error "Failed to create database dump"
    exit 1
fi

# Check if dump file is not empty
if [ ! -s "$BACKUP_DIR/$BACKUP_FILE" ]; then
    print_error "Backup file is empty!"
    rm -f "$BACKUP_DIR/$BACKUP_FILE"
    exit 1
fi

FILE_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
print_info "Backup file size: $FILE_SIZE"

# Compress backup file
print_info "Compressing backup file..."
if gzip "$BACKUP_DIR/$BACKUP_FILE"; then
    print_success "Backup compressed: $BACKUP_FILE_GZ"
else
    print_error "Failed to compress backup"
    exit 1
fi

COMPRESSED_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE_GZ" | cut -f1)
print_info "Compressed file size: $COMPRESSED_SIZE"

# Upload to Google Drive
print_info "Uploading to Google Drive..."
if rclone copy "$BACKUP_DIR/$BACKUP_FILE_GZ" "$RCLONE_REMOTE" --progress; then
    print_success "Backup uploaded to Google Drive successfully"
else
    print_error "Failed to upload backup to Google Drive"
    exit 1
fi

# Verify upload
print_info "Verifying upload..."
if rclone lsf "$RCLONE_REMOTE" | grep -q "$BACKUP_FILE_GZ"; then
    print_success "Backup verified on Google Drive"
else
    print_error "Backup verification failed"
    exit 1
fi

# Clean up local backups older than 7 days
print_info "Cleaning up old local backups (older than 7 days)..."
find "$BACKUP_DIR" -name "library_app_backup_*.sql.gz" -type f -mtime +7 -delete
print_success "Old local backups cleaned up"

# Optional: Clean up old backups on Google Drive (keep last 30 days)
print_info "Cleaning up old Google Drive backups (older than 30 days)..."
rclone delete "$RCLONE_REMOTE" --min-age 30d --include "library_app_backup_*.sql.gz"
print_success "Old Google Drive backups cleaned up"

# Calculate total backup time
log_message "Backup completed successfully"
print_success "Backup process completed!"
print_info "Backup file: $BACKUP_FILE_GZ"
print_info "Location: Google Drive -> LibraryApp_Backups"

# Send summary to log
echo "==========================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit 0
```

### 3. Make Script Executable

```bash
# Make script executable
chmod +x ~/library_app/scripts/postgresql_backup.sh

# Verify permissions
ls -l ~/library_app/scripts/postgresql_backup.sh

# Expected output: -rwxr-xr-x ... postgresql_backup.sh
```

---

## Test Manual Backup

### 1. Run Backup Script Manually

```bash
# Navigate to scripts directory
cd ~/library_app/scripts

# Run backup script
./postgresql_backup.sh
```

**Expected Output:**
```
ℹ Starting PostgreSQL backup...
✓ PostgreSQL container is running
ℹ Creating database dump...
✓ Database dump created: library_app_backup_20260206_143022.sql
ℹ Backup file size: 2.4M
ℹ Compressing backup file...
✓ Backup compressed: library_app_backup_20260206_143022.sql.gz
ℹ Compressed file size: 487K
ℹ Uploading to Google Drive...
✓ Backup uploaded to Google Drive successfully
ℹ Verifying upload...
✓ Backup verified on Google Drive
ℹ Cleaning up old local backups (older than 7 days)...
✓ Old local backups cleaned up
✓ Backup process completed!
```

### 2. Verify Backup on Google Drive

**Method 1: Via rclone**
```bash
# List backups on Google Drive
rclone ls gdrive_backup:LibraryApp_Backups

# Check backup details
rclone lsl gdrive_backup:LibraryApp_Backups

# Download and verify a backup (optional)
rclone copy gdrive_backup:LibraryApp_Backups/library_app_backup_20260206_143022.sql.gz /tmp/
gunzip /tmp/library_app_backup_20260206_143022.sql.gz
head -n 20 /tmp/library_app_backup_20260206_143022.sql
```

**Method 2: Via Web Browser**
1. Go to https://drive.google.com
2. Navigate to `LibraryApp_Backups` folder
3. Verify backup files are present

### 3. Check Backup Logs

```bash
# View backup log
cat ~/library_app/backups/backup_log.txt

# View last 50 lines of log
tail -n 50 ~/library_app/backups/backup_log.txt

# Monitor log in real-time (during backup)
tail -f ~/library_app/backups/backup_log.txt
```

---

## Set Up Automated Backups

### 1. Configure Cron Job

```bash
# Edit crontab
crontab -e

# If asked to choose an editor, select nano (usually option 1)
```

### 2. Add Cron Schedule

Add one of the following lines based on your backup frequency needs:

**Daily at 2:00 AM (Recommended)**
```bash
0 2 * * * /home/$USER/library_app/scripts/postgresql_backup.sh >> /home/$USER/library_app/backups/cron_log.txt 2>&1
```

**Every 12 hours (2:00 AM and 2:00 PM)**
```bash
0 2,14 * * * /home/$USER/library_app/scripts/postgresql_backup.sh >> /home/$USER/library_app/backups/cron_log.txt 2>&1
```

**Every 6 hours**
```bash
0 */6 * * * /home/$USER/library_app/scripts/postgresql_backup.sh >> /home/$USER/library_app/backups/cron_log.txt 2>&1
```

**Weekly on Sunday at 3:00 AM**
```bash
0 3 * * 0 /home/$USER/library_app/scripts/postgresql_backup.sh >> /home/$USER/library_app/backups/cron_log.txt 2>&1
```

**Cron Schedule Format:**
```
* * * * * command
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### 3. Save and Exit

- Press `Ctrl + O` to save
- Press `Enter` to confirm
- Press `Ctrl + X` to exit

### 4. Verify Cron Job

```bash
# List current cron jobs
crontab -l

# Expected output: Your scheduled backup command

# Check cron service status
sudo systemctl status cron

# Restart cron service (if needed)
sudo systemctl restart cron
```

### 5. Test Cron Execution (Optional)

```bash
# Edit crontab to run in 2 minutes
crontab -e

# Add temporary line (runs 2 minutes from now):
*/2 * * * * /home/$USER/library_app/scripts/postgresql_backup.sh >> /home/$USER/library_app/backups/cron_log.txt 2>&1

# Wait 2-3 minutes and check log
tail -f ~/library_app/backups/cron_log.txt

# Remove test cron job after successful test
crontab -e
```

---

## Monitor Backups

### 1. Check Backup Status

```bash
# View recent cron job output
tail -n 100 ~/library_app/backups/cron_log.txt

# View backup script log
tail -n 100 ~/library_app/backups/backup_log.txt

# Count backups on Google Drive
rclone lsf gdrive_backup:LibraryApp_Backups | wc -l

# List all backups with sizes
rclone lsl gdrive_backup:LibraryApp_Backups

# Check last backup time
rclone lsl gdrive_backup:LibraryApp_Backups | tail -1
```

### 2. Create Monitoring Script

```bash
# Create monitoring script
nano ~/library_app/scripts/check_backup_status.sh
```

Add the following content:

```bash
#!/bin/bash

echo "=== Backup Status Report ==="
echo ""

# Check last local backup
LAST_LOCAL=$(ls -t ~/library_app/backups/library_app_backup_*.sql.gz 2>/dev/null | head -1)
if [ -n "$LAST_LOCAL" ]; then
    echo "Last local backup:"
    ls -lh "$LAST_LOCAL"
else
    echo "No local backups found"
fi

echo ""

# Check last Google Drive backup
echo "Last 3 Google Drive backups:"
rclone lsl gdrive_backup:LibraryApp_Backups | tail -3

echo ""

# Check cron log for errors
echo "Recent errors in cron log (if any):"
grep -i "error\|failed" ~/library_app/backups/cron_log.txt | tail -5

echo ""
echo "=== End of Report ==="
```

Make it executable:

```bash
chmod +x ~/library_app/scripts/check_backup_status.sh

# Run it
./check_backup_status.sh
```

### 3. Set Up Email Notifications (Optional)

Install mail utilities:

```bash
# Install mailutils
sudo apt install -y mailutils

# Test email
echo "Test email from VPS" | mail -s "Test Subject" your-email@example.com
```

Modify backup script to send email on failure:

```bash
# Edit backup script
nano ~/library_app/scripts/postgresql_backup.sh

# Add at the end of the script (before exit 0):
# Send email notification
if [ $? -eq 0 ]; then
    echo "Backup completed successfully at $(date)" | mail -s "Library App Backup Success" your-email@example.com
else
    echo "Backup failed at $(date). Check logs." | mail -s "Library App Backup FAILED" your-email@example.com
fi
```

---

## Backup Rotation Strategy

The script automatically implements a rotation strategy:

- **Local Backups:** Kept for 7 days, then deleted
- **Google Drive Backups:** Kept for 30 days, then deleted

### Customize Retention Period

Edit the backup script to change retention:

```bash
nano ~/library_app/scripts/postgresql_backup.sh

# Find and modify these lines:

# For local backups (currently 7 days):
find "$BACKUP_DIR" -name "library_app_backup_*.sql.gz" -type f -mtime +7 -delete
# Change +7 to +14 for 14 days, +30 for 30 days, etc.

# For Google Drive backups (currently 30 days):
rclone delete "$RCLONE_REMOTE" --min-age 30d --include "library_app_backup_*.sql.gz"
# Change 30d to 60d for 60 days, 90d for 90 days, etc.
```

### Calculate Storage Requirements

**Example calculation for daily backups:**

- Backup size: ~500KB compressed
- Daily backups for 30 days: 500KB × 30 = 15MB
- Google Drive free tier: 15GB (plenty of space!)

---

## Troubleshooting

### Issue: rclone not found

```bash
# Reinstall rclone
curl https://rclone.org/install.sh | sudo bash

# Verify installation
which rclone
rclone version
```

### Issue: Google Drive authentication failed

```bash
# Reconfigure rclone
rclone config

# Delete old remote and create new one
# d) Delete remote
# name> gdrive_backup
# n) New remote
# ... (follow setup steps again)
```

### Issue: Backup script fails

```bash
# Check Docker container is running
docker ps | grep postgres_library_app

# Check database connection
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT 1;"

# Run script with verbose output
bash -x ~/library_app/scripts/postgresql_backup.sh

# Check script permissions
ls -l ~/library_app/scripts/postgresql_backup.sh
chmod +x ~/library_app/scripts/postgresql_backup.sh
```

### Issue: Cron job not running

```bash
# Check cron service
sudo systemctl status cron

# Start cron service
sudo systemctl start cron

# Check cron logs
grep CRON /var/log/syslog | tail -20

# Verify crontab syntax
crontab -l

# Make sure script has full paths (no relative paths)
crontab -e
# Use: /home/username/... instead of ~/...
```

### Issue: Upload to Google Drive slow

```bash
# Check bandwidth
rclone copy --progress --bwlimit 1M /path/to/file gdrive_backup:/path/

# Check Google Drive quota
rclone about gdrive_backup:

# Test connection speed
rclone test speed gdrive_backup:
```

### Issue: Backup file is empty

```bash
# Check PostgreSQL logs
docker logs postgres_library_app

# Verify database credentials in .env
cat ~/library_app/.env | grep DB_

# Test manual pg_dump
docker exec postgres_library_app pg_dump -U libraryuser -d library_app_db | head -20
```

---

## Security Considerations

1. **rclone Configuration:** Store in secure location (`~/.config/rclone/rclone.conf`)
2. **Backup Files:** Contain sensitive data - ensure proper permissions
3. **Google Drive:** Use dedicated service account for production
4. **Encryption:** Consider encrypting backups before upload:
   ```bash
   # Encrypt backup before upload
   openssl enc -aes-256-cbc -salt -in backup.sql.gz -out backup.sql.gz.enc -k YOUR_PASSWORD
   ```
5. **Access Control:** Limit who has access to Google Drive backup folder

---

## Next Steps

1. **Set up restore procedure:** See [03-RESTORE-FROM-BACKUP.md](./03-RESTORE-FROM-BACKUP.md)
2. **Test restore process:** Regularly test that backups can be restored
3. **Monitor backup health:** Set up alerts for failed backups
4. **Document passwords:** Securely store encryption passwords and credentials

---

## Useful Commands Reference

```bash
# List all backups on Google Drive
rclone lsl gdrive_backup:LibraryApp_Backups

# Download specific backup
rclone copy gdrive_backup:LibraryApp_Backups/backup_file.sql.gz ~/downloads/

# Delete specific backup
rclone delete gdrive_backup:LibraryApp_Backups/backup_file.sql.gz

# Check Google Drive space
rclone about gdrive_backup:

# Sync local to Google Drive (careful - can delete files!)
rclone sync ~/library_app/backups gdrive_backup:LibraryApp_Backups

# Run backup manually
~/library_app/scripts/postgresql_backup.sh

# Check backup status
~/library_app/scripts/check_backup_status.sh
```

---

**Last Updated:** February 2026
