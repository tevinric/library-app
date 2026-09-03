---
name: backup-and-restore
description: Use when setting up, changing, or auditing backups for an app in this house style. Covers the backup philosophy (automated, verified, offsite, tested), the pg_dump-from-container script pattern with rclone offsite copy, retention rules, cron scheduling, the restore procedure, and restore drills. Set this up before an app holds real data, not after.
---

# Backup and restore

## Philosophy

Four rules, in priority order. A backup setup missing any one of them is
providing reassurance rather than recovery.

1. **Automated.** A backup that depends on someone remembering is not a
   backup. Cron it.
2. **Verified at write time.** Check the dump is non-empty and the upload
   actually landed. A silently truncated dump is worse than no dump, because
   it removes the urgency to make a real one.
3. **Offsite.** A backup on the same VPS dies with the VPS. Local copies are
   for fast restores; the remote copy is the actual backup.
4. **Tested by restoring.** Until a restore has succeeded, you have untested
   files. Drill it on a schedule, not during an incident.

The data lives in a named Docker volume. `docker-compose down -v` destroys it
permanently. That command should never appear in a runbook without a warning
next to it.

## The backup script

`scripts/postgresql_backup.sh` — the shape that matters:

```bash
# 1. Locate the project and load config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DETECTED_PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
if [ -f "$DETECTED_PROJECT_ROOT/.env" ]; then
    set -a; source "$DETECTED_PROJECT_ROOT/.env"; set +a
elif [ -f "$DETECTED_PROJECT_ROOT/env.sh" ]; then
    source "$DETECTED_PROJECT_ROOT/env.sh"
fi
PROJECT_ROOT="${PROJECT_ROOT:-$DETECTED_PROJECT_ROOT}"
```

Note the two sourcing styles: `.env` is `KEY=value` so it needs `set -a` to
export; `env.sh` already carries `export` keywords so it's sourced plainly.
Auto-detecting the root means the script works from cron, where the working
directory isn't what you expect.

```bash
# 2. Dump from inside the running container
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" \
    > "$BACKUP_DIR/$BACKUP_FILE"

# 3. Verify it isn't empty — this is the step people skip
if [ ! -s "$BACKUP_DIR/$BACKUP_FILE" ]; then
    rm -f "$BACKUP_DIR/$BACKUP_FILE"     # don't keep a zero-byte "backup"
    exit 1
fi

# 4. Compress
gzip "$BACKUP_DIR/$BACKUP_FILE"

# 5. Copy offsite
rclone copy "$BACKUP_DIR/$BACKUP_FILE_GZ" "$RCLONE_REMOTE"

# 6. Verify it arrived
rclone lsf "$RCLONE_REMOTE" | grep -q "$BACKUP_FILE_GZ" || exit 1

# 7. Retention: local short, remote long
find "$BACKUP_DIR" -name "{app}_backup_*.sql.gz" -type f -mtime +7 -delete
rclone delete "$RCLONE_REMOTE" --min-age 30d --include "{app}_backup_*.sql.gz"

# 8. Ship the log too, so failures are visible from the remote
rclone copy "$LOG_FILE" "$RCLONE_REMOTE/logs/"
```

Why `docker exec pg_dump` rather than dumping from the host: the container
already has the client tools and the network path to the database, so no
Postgres client is needed on the host and no port has to be exposed. This is
why the backend Dockerfile installs `postgresql-client`.

Timestamped filenames (`{app}_backup_YYYYMMDD_HHMMSS.sql.gz`) make retention
by age straightforward and let you identify a specific point in time.

## Retention

- **Local: 7 days.** Enough for a fast restore from a recent mistake, without
  filling the disk.
- **Remote: 30 days.** The real retention window.

Tune these to the data, not to the defaults. Ask: how long could a corruption
go unnoticed? The retention window must be longer than that, or the only
copies you keep will all contain the corruption.

## Scheduling

```cron
0 2 * * * /path/to/{app}/scripts/postgresql_backup.sh >> /path/to/{app}/backups/cron_log.txt 2>&1
```

Cron has a minimal environment — the script's config loading and root
detection exist precisely because of this. Always redirect both stdout and
stderr to a log; a cron job that fails silently is the default outcome.

Check the log ships offsite too, so you can tell backups stopped without
logging into the box.

## Restore

The dump is plain SQL, so restoring is straightforward — the risk is doing it
to the wrong database.

```bash
# 1. Stop the app so nothing writes mid-restore
docker-compose stop backend frontend

# 2. Decompress
gunzip -c {app}_backup_20260903_020000.sql.gz > /tmp/restore.sql

# 3. Restore into the running Postgres container
docker exec -i postgres_{app}_app psql -U "$DB_USER" -d "$DB_NAME" < /tmp/restore.sql

# 4. Start up and verify
docker-compose start backend frontend
curl http://localhost:{BACKEND_PORT}/api/health
```

Before overwriting anything, **take a fresh dump of the current state first**,
even if you believe it's corrupt. The one thing worse than a bad restore is a
bad restore with nothing to go back to.

For a full rebuild onto a new host: create the volume and network, bring up
Postgres alone, restore, then start the rest. `migrations.sql` runs on backend
startup and is idempotent, so schema objects added since the dump are
recreated automatically.

## Restore drills

Schedule one. Quarterly is a reasonable default for a small internal app.

1. Restore the most recent remote backup into a **throwaway** database or host.
2. Start the app against it.
3. Confirm the health endpoint, then confirm real data — row counts on key
   tables, and one recent record you can recognise.
4. Write down how long it took. That number is your actual RTO, and it's
   usually longer than people guess.

A drill that reveals a broken backup has done its job. Rehearsing on a copy is
what makes the real restore boring.

## Handling backup data

Dumps contain everything the database contains, so they inherit its
sensitivity — and they sit outside the app's access controls.

- Restrict the remote to the fewest people who need it.
- `backups/*.sql`, `*.sql.gz`, and the log files are gitignored. Never commit
  a dump.
- Data minimisation pays off here too: a database that never stored personal
  data produces backups that can't leak it.
- If the data is sensitive enough to warrant it, encrypt before upload
  (`gpg --symmetric`) — and then make sure the passphrase is stored somewhere
  that survives losing the server, or the backups are decorative.

## Checklist

- [ ] Backup script exists and runs from cron
- [ ] Dump verified non-empty before it's kept
- [ ] Offsite copy verified present after upload
- [ ] Local and remote retention set deliberately
- [ ] Log file written and shipped offsite
- [ ] `backups/*.sql*` gitignored
- [ ] Restore procedure documented in `guides/`
- [ ] A restore has actually been performed at least once
- [ ] Remote storage access limited to who needs it
- [ ] Everyone touching the runbook knows `down -v` destroys the data
