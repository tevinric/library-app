# Quick Reference Guide - Library Management App

One-page reference for common operations on your Linux VPS.

## Service Management

### Start/Stop All Services
```bash
cd ~/library_app

# Start all services (postgres, backend, frontend)
docker-compose up -d

# Stop all services
docker-compose down

# Restart all services
docker-compose restart

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f postgres
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Individual Service Control
```bash
# Restart specific service
docker-compose restart backend

# Rebuild and restart
docker-compose up -d --build backend

# Stop specific service
docker-compose stop frontend

# Start specific service
docker-compose start frontend
```

## Database Operations

### Connect to Database
```bash
# PostgreSQL shell
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db

# Inside psql:
\dt                    # List tables
\d table_name          # Describe table
\du                    # List users
\l                     # List databases
\q                     # Quit

# Run query from command line
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT COUNT(*) FROM users;"
```

### Database Backups

#### Manual Backup
```bash
# Create backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker exec postgres_library_app pg_dump -U libraryuser -d library_app_db | gzip > ~/library_app/backups/manual_backup_${TIMESTAMP}.sql.gz

# Upload to Google Drive
rclone copy ~/library_app/backups/manual_backup_${TIMESTAMP}.sql.gz gdrive_backup:LibraryApp_Backups/
```

#### Automated Backup
```bash
# Run backup script manually
~/library_app/scripts/postgresql_backup.sh

# Check backup status
~/library_app/scripts/check_backup_status.sh

# View backup logs
tail -n 50 ~/library_app/backups/backup_log.txt

# List backups on Google Drive
rclone lsl gdrive_backup:LibraryApp_Backups
```

### Database Restore
```bash
# List available backups
rclone lsl gdrive_backup:LibraryApp_Backups

# Download specific backup
rclone copy "gdrive_backup:LibraryApp_Backups/library_app_backup_20260206_143022.sql.gz" ~/library_app/backups/

# Decompress
gunzip ~/library_app/backups/library_app_backup_20260206_143022.sql.gz

# Stop services
docker-compose down

# Start PostgreSQL only
docker-compose up -d postgres
sleep 10

# Drop and recreate database
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "DROP DATABASE library_app_db;"
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "CREATE DATABASE library_app_db;"

# Restore backup
docker exec -i postgres_library_app psql -U libraryuser -d library_app_db < ~/library_app/backups/library_app_backup_20260206_143022.sql

# Start all services
docker-compose up -d
```

## Volume Management

### Check Volume Status
```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect library_app_data

# Check volume size
docker system df -v | grep library_app_data
```

### Backup Volume (Alternative Method)
```bash
# Backup volume to tar file
docker run --rm \
  -v library_app_data:/data \
  -v ~/library_app/backups:/backup \
  alpine tar czf /backup/volume_backup_$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Volume (Alternative Method)
```bash
# Restore volume from tar file
docker run --rm \
  -v library_app_data:/data \
  -v ~/library_app/backups:/backup \
  alpine tar xzf /backup/volume_backup_20260206.tar.gz -C /data
```

## Monitoring

### Container Health
```bash
# List running containers
docker ps

# Container resource usage
docker stats

# Detailed container info
docker inspect postgres_library_app
docker inspect library_app_backend
docker inspect library_app_frontend

# Health check
curl http://localhost:5002/api/health
curl http://localhost:3002
```

### System Resources
```bash
# Disk space
df -h

# Memory usage
free -h

# Docker disk usage
docker system df

# Container logs size
du -sh /var/lib/docker/containers/*

# Clean up Docker
docker system prune -a  # WARNING: Removes unused images!
```

### Application Logs
```bash
# Follow all logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Logs from last hour
docker-compose logs --since 1h

# Logs for specific service
docker-compose logs -f backend | grep ERROR
```

## Network

### Port Management
```bash
# Check what's using ports
sudo lsof -i :3002  # Frontend
sudo lsof -i :5002  # Backend
sudo lsof -i :5432  # PostgreSQL

# Kill process on port
sudo kill -9 $(sudo lsof -t -i:3002)

# Check firewall rules
sudo ufw status numbered

# Open port
sudo ufw allow 3002/tcp

# Close port
sudo ufw delete <rule_number>
```

### Network Debugging
```bash
# Test container connectivity
docker exec -it library_app_backend ping postgres_library_app
docker exec -it library_app_frontend curl http://library_app_backend:5002/api/health

# Inspect Docker network
docker network inspect library-app-network

# Test from host
curl http://localhost:5002/api/health
curl http://localhost:3002
```

## Updates and Maintenance

### Update Application Code
```bash
cd ~/library_app

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up --build -d

# Watch logs
docker-compose logs -f
```

### Update Docker Images
```bash
# Pull latest PostgreSQL image
docker pull postgres:16

# Rebuild all services
docker-compose build --no-cache

# Restart with new images
docker-compose up -d
```

### Clean Up
```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes (CAREFUL!)
docker volume prune

# Remove unused networks
docker network prune

# Full cleanup (CAREFUL!)
docker system prune -a --volumes
```

## Security

### Change Database Password
```bash
# Update .env file
nano ~/library_app/.env
# Change DB_PASSWORD value

# Restart PostgreSQL
docker-compose restart postgres

# Update password in PostgreSQL
docker exec -it postgres_library_app psql -U libraryuser -d postgres -c "ALTER USER libraryuser WITH PASSWORD 'new_password';"
```

### View Environment Variables
```bash
# Check .env file
cat ~/library_app/.env

# Check container environment
docker exec -it library_app_backend env | grep DB_
docker exec -it postgres_library_app env | grep POSTGRES_
```

### Check for Security Updates
```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Update Docker
sudo apt install docker-ce docker-ce-cli containerd.io

# Check application updates
cd ~/library_app
git fetch
git status
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs for errors
docker-compose logs postgres
docker-compose logs backend
docker-compose logs frontend

# Check if port is in use
sudo lsof -i :3002
sudo lsof -i :5002
sudo lsof -i :5432

# Remove container and recreate
docker-compose down
docker rm -f postgres_library_app
docker-compose up -d
```

### Database Connection Issues
```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker-compose logs postgres | tail -50

# Test connection
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT 1;"

# Verify network
docker network inspect library-app-network

# Check backend can reach database
docker exec -it library_app_backend ping postgres_library_app
```

### Application Not Loading
```bash
# Check all containers are running
docker ps

# Test endpoints
curl http://localhost:5002/api/health
curl http://localhost:3002

# Check backend logs
docker-compose logs backend | grep -i error

# Check frontend logs
docker-compose logs frontend | grep -i error

# Restart all services
docker-compose restart
```

### Disk Space Full
```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Clean up logs
sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log

# Remove old backups
find ~/library_app/backups -name "*.sql.gz" -mtime +30 -delete

# Prune Docker
docker system prune -a
```

### Backup/Restore Issues
```bash
# Test rclone connection
rclone lsd gdrive_backup:

# Re-authenticate rclone
rclone config reconnect gdrive_backup:

# Manual backup
docker exec postgres_library_app pg_dump -U libraryuser -d library_app_db > ~/backup_test.sql

# Check backup file
head -20 ~/backup_test.sql
tail -20 ~/backup_test.sql
```

## Performance Optimization

### Database Performance
```bash
# Check database size
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT pg_size_pretty(pg_database_size('library_app_db'));"

# Vacuum database
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "VACUUM ANALYZE;"

# Check slow queries (if logging enabled)
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

### Container Resource Limits
```bash
# Check current resource usage
docker stats --no-stream

# Add resource limits to docker-compose.yml
# Under each service:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## Cron Jobs

### Manage Backup Cron Job
```bash
# View cron jobs
crontab -l

# Edit cron jobs
crontab -e

# Example: Daily backup at 2 AM
0 2 * * * /home/$USER/library_app/scripts/postgresql_backup.sh >> /home/$USER/library_app/backups/cron_log.txt 2>&1

# Check cron logs
grep CRON /var/log/syslog | tail -20

# Check backup cron log
tail -f ~/library_app/backups/cron_log.txt
```

## Emergency Contacts and Resources

### Important File Locations
```
Application:        ~/library_app/
Docker Compose:     ~/library_app/docker-compose.yml
Environment:        ~/library_app/.env
Backups:           ~/library_app/backups/
Scripts:           ~/library_app/scripts/
Logs:              Use docker-compose logs
```

### Important Commands to Remember
```bash
# Emergency stop
docker-compose down

# Emergency backup
docker exec postgres_library_app pg_dump -U libraryuser -d library_app_db | gzip > ~/emergency_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Emergency restore (latest backup)
rclone copy "gdrive_backup:LibraryApp_Backups/$(rclone lsf gdrive_backup:LibraryApp_Backups | tail -1)" ~/library_app/backups/
```

### Documentation
- **VPS Deployment:** [01-VPS-DEPLOYMENT.md](./01-VPS-DEPLOYMENT.md)
- **Backup Setup:** [02-GOOGLE-DRIVE-BACKUP.md](./02-GOOGLE-DRIVE-BACKUP.md)
- **Restore Guide:** [03-RESTORE-FROM-BACKUP.md](./03-RESTORE-FROM-BACKUP.md)

### URLs
- **Application:** http://YOUR_VPS_IP:3002
- **API Health:** http://YOUR_VPS_IP:5002/api/health
- **Google Drive:** https://drive.google.com

---

**Last Updated:** February 2026
