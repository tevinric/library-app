#!/bin/bash

################################################################################
# PostgreSQL Backup Script for Google Drive
# Backs up PostgreSQL database from Docker container to Google Drive via rclone
################################################################################

# Prevent script from being sourced (which would close terminal on exit)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed normally
    :
else
    echo "ERROR: Do not source this script! Run it with: ./postgresql_backup.sh"
    return 1 2>/dev/null || exit 1
fi

# Detect script directory and calculate project root if not already set
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DETECTED_PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Try to load environment variables from .env or env.sh
if [ -f "$DETECTED_PROJECT_ROOT/.env" ]; then
    set -a
    source "$DETECTED_PROJECT_ROOT/.env"
    set +a
    echo "Loaded environment from .env"
elif [ -f "$DETECTED_PROJECT_ROOT/env.sh" ]; then
    source "$DETECTED_PROJECT_ROOT/env.sh"
    echo "Loaded environment from env.sh"
else
    echo "WARNING: No .env or env.sh file found at $DETECTED_PROJECT_ROOT"
fi

# Use PROJECT_ROOT from env.sh if set, otherwise use detected path
PROJECT_ROOT="${PROJECT_ROOT:-$DETECTED_PROJECT_ROOT}"
echo "Project root: $PROJECT_ROOT"

# Enable strict error handling after loading environment
set -o pipefail

# Configuration
CONTAINER_NAME="postgres_library_app"
DB_NAME="${ZOELIBRARYAPP_DB_NAME:-}"
DB_USER="${ZOELIBRARYAPP_DB_USER:-}"
BACKUP_DIR="$PROJECT_ROOT/backups"
RCLONE_REMOTE="gdrive_backup:LibraryApp_Backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="library_app_backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

# Create backup directory first
mkdir -p "$BACKUP_DIR"
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

# Validate required environment variables
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    print_error "Missing required environment variables!"
    print_error "Please ensure ZOELIBRARYAPP_DB_NAME and ZOELIBRARYAPP_DB_USER are set."
    print_error "Check your .env file at: $PROJECT_ROOT/.env"
    exit 1
fi

print_info "Database: $DB_NAME"
print_info "User: $DB_USER"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    print_error "PostgreSQL container '$CONTAINER_NAME' is not running!"
    print_error "Start it with: docker-compose up -d"
    exit 1
fi

print_success "PostgreSQL container is running"

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

# Upload log file to Google Drive
print_info "Uploading log file to Google Drive..."
if rclone copy "$LOG_FILE" "$RCLONE_REMOTE/logs/"; then
    print_success "Log file uploaded to Google Drive (LibraryApp_Backups/logs/)"
else
    print_error "Failed to upload log file to Google Drive"
fi