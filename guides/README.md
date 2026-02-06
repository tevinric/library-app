# Library Management App - Deployment & Operations Guides

Complete documentation for deploying and managing the Library Management Application on a Linux VPS.

## 📚 Available Guides

### [00-QUICK-REFERENCE.md](./00-QUICK-REFERENCE.md)
**Quick reference for common operations**
- Essential commands for daily operations
- Docker and database commands
- Troubleshooting quick fixes
- Emergency procedures
- **Use this first** for quick lookups!

### [01-VPS-DEPLOYMENT.md](./01-VPS-DEPLOYMENT.md)
**Complete VPS deployment guide**
- Initial VPS setup and security
- Docker and Docker Compose installation
- Application deployment with all 3 services (PostgreSQL, Backend, Frontend)
- Persistent volume configuration
- Firewall setup
- Verification and testing
- **Start here** for new deployments!

### [02-GOOGLE-DRIVE-BACKUP.md](./02-GOOGLE-DRIVE-BACKUP.md)
**Automated backup to Google Drive**
- Installing and configuring rclone
- Creating automated backup scripts
- Scheduling backups with cron
- Backup rotation and retention
- Monitoring backup health
- **Essential** for data protection!

### [03-RESTORE-FROM-BACKUP.md](./03-RESTORE-FROM-BACKUP.md)
**Restore database from backups**
- Full database restore procedures
- Restore to new database for testing
- Selective table restore
- Disaster recovery scenarios
- Verification procedures
- **Test regularly** to ensure backups work!

---

## 🚀 Quick Start

### For New Deployments

1. **Read** [01-VPS-DEPLOYMENT.md](./01-VPS-DEPLOYMENT.md)
2. **Follow** deployment steps to set up your VPS
3. **Configure** backups using [02-GOOGLE-DRIVE-BACKUP.md](./02-GOOGLE-DRIVE-BACKUP.md)
4. **Test** restore process with [03-RESTORE-FROM-BACKUP.md](./03-RESTORE-FROM-BACKUP.md)
5. **Bookmark** [00-QUICK-REFERENCE.md](./00-QUICK-REFERENCE.md) for daily operations

**Time Required:** 2-3 hours for complete setup

### For Daily Operations

Use [00-QUICK-REFERENCE.md](./00-QUICK-REFERENCE.md) for:
- Starting/stopping services
- Checking logs
- Database operations
- Backup verification
- Troubleshooting

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] VPS provisioned (2GB+ RAM, 20GB+ disk)
- [ ] Root/sudo access available
- [ ] Domain name configured (optional)
- [ ] Azure AD app configured
- [ ] Google account for backups

### Initial Deployment
- [ ] VPS system updated
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Application cloned
- [ ] .env file configured with strong passwords
- [ ] Docker volume created
- [ ] All services started
- [ ] Firewall configured
- [ ] Application accessible

### Backup Configuration
- [ ] rclone installed
- [ ] Google Drive connected
- [ ] Backup script created and tested
- [ ] Cron job scheduled
- [ ] Backup monitoring script created
- [ ] First backup verified on Google Drive

### Post-Deployment
- [ ] Restore process tested
- [ ] Documentation reviewed
- [ ] Emergency contacts documented
- [ ] Monitoring set up
- [ ] SSL/TLS configured (if using domain)
- [ ] Users notified of application URL

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Linux VPS                         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │          Docker Compose                     │   │
│  │                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │   Frontend   │  │   Backend    │        │   │
│  │  │   (Nginx)    │◄─┤   (Flask)    │        │   │
│  │  │   Port 3002  │  │   Port 5002  │        │   │
│  │  └──────────────┘  └──────┬───────┘        │   │
│  │                           │                 │   │
│  │                           ▼                 │   │
│  │                  ┌──────────────┐           │   │
│  │                  │  PostgreSQL  │           │   │
│  │                  │   Port 5432  │           │   │
│  │                  └──────┬───────┘           │   │
│  │                         │                   │   │
│  └─────────────────────────┼───────────────────┘   │
│                            │                       │
│                            ▼                       │
│                   ┌─────────────────┐              │
│                   │ Docker Volume   │              │
│                   │  (Persistent)   │              │
│                   └────────┬────────┘              │
│                            │                       │
└────────────────────────────┼───────────────────────┘
                             │
                             │ rclone backup
                             ▼
                    ┌─────────────────┐
                    │  Google Drive   │
                    │  (Backups)      │
                    └─────────────────┘
```

---

## 🔒 Security Best Practices

1. **Strong Passwords**
   - Generate unique passwords for DB_PASSWORD and SECRET_KEY
   - Use `openssl rand -base64 32` for generation
   - Never commit passwords to git

2. **Firewall Configuration**
   - Only expose necessary ports (3002 for frontend)
   - Never expose PostgreSQL (5432) to the internet
   - Use SSH key authentication, disable password auth

3. **Regular Updates**
   - Keep system packages updated: `sudo apt update && sudo apt upgrade`
   - Update Docker images regularly
   - Pull application updates from git

4. **Backup Security**
   - Keep backups in multiple locations
   - Test restore process monthly
   - Encrypt sensitive backups
   - Restrict Google Drive folder access

5. **Monitoring**
   - Check logs regularly
   - Monitor disk space
   - Set up alerts for backup failures
   - Review access logs

---

## 🛠️ Common Operations

### Starting the Application
```bash
cd ~/library_app
docker-compose up -d
```

### Stopping the Application
```bash
cd ~/library_app
docker-compose down
```

### Viewing Logs
```bash
docker-compose logs -f
```

### Manual Backup
```bash
~/library_app/scripts/postgresql_backup.sh
```

### Check Backup Status
```bash
rclone lsl gdrive_backup:LibraryApp_Backups
```

### Database Access
```bash
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db
```

---

## 🚨 Emergency Procedures

### Application Down
1. Check container status: `docker ps`
2. Check logs: `docker-compose logs`
3. Restart: `docker-compose restart`
4. If still down, full restart: `docker-compose down && docker-compose up -d`

### Data Loss
1. Stop application immediately: `docker-compose down`
2. List backups: `rclone lsl gdrive_backup:LibraryApp_Backups`
3. Follow [03-RESTORE-FROM-BACKUP.md](./03-RESTORE-FROM-BACKUP.md)

### Server Compromise
1. Disconnect from network
2. Change all passwords
3. Review logs for unauthorized access
4. Restore from clean backup on new VPS
5. Update security measures

### Disk Space Full
1. Check usage: `df -h`
2. Clean Docker: `docker system prune -a`
3. Remove old backups: `find ~/library_app/backups -mtime +30 -delete`
4. Check logs size: `du -sh /var/lib/docker/containers/*`

---

## 📊 Monitoring Checklist

**Daily:**
- [ ] Application accessible
- [ ] No error logs
- [ ] Disk space adequate (>20% free)

**Weekly:**
- [ ] Review backup logs
- [ ] Check backup file sizes
- [ ] Verify latest backup on Google Drive
- [ ] Review system logs

**Monthly:**
- [ ] Test restore process
- [ ] Update system packages
- [ ] Review security settings
- [ ] Clean up old backups

---

## 📞 Support and Resources

### Documentation
- Application README: [../README.md](../README.md)
- Docker Documentation: https://docs.docker.com/
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- rclone Documentation: https://rclone.org/docs/

### Troubleshooting
1. Check [00-QUICK-REFERENCE.md](./00-QUICK-REFERENCE.md) troubleshooting section
2. Review logs: `docker-compose logs`
3. Check individual service guides
4. Search Docker/PostgreSQL documentation

### Getting Help
- Review error messages in logs
- Check system resource availability
- Verify network connectivity
- Consult relevant guide for specific issue

---

## 🔄 Maintenance Schedule

### Weekly Tasks (15 minutes)
- Check application health
- Review backup status
- Check disk space
- Review error logs

### Monthly Tasks (1 hour)
- Test backup restore process
- Update system packages
- Review security settings
- Clean up old backups
- Update Docker images
- Pull latest application code

### Quarterly Tasks (2 hours)
- Full security audit
- Review and update documentation
- Test disaster recovery procedures
- Review monitoring and alerting
- Optimize database performance

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial guide creation |
| | | - VPS deployment guide |
| | | - Google Drive backup setup |
| | | - Restore procedures |
| | | - Quick reference |

---

## 🤝 Contributing

Found an error or have a suggestion?
1. Document the issue clearly
2. Suggest the fix or improvement
3. Update the relevant guide
4. Test the changes

---

**Last Updated:** February 2026

**Maintained By:** Library Management App Team

**Questions?** Review the guides or check the [Quick Reference](./00-QUICK-REFERENCE.md)
