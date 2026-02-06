# Complete VPS Deployment Guide - Library Management App

This guide covers deploying the Library Management Application on a Linux VPS with Docker, PostgreSQL, and persistent volumes.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Initial VPS Setup](#initial-vps-setup)
3. [Install Docker & Docker Compose](#install-docker--docker-compose)
4. [Deploy the Application](#deploy-the-application)
5. [Configure Firewall](#configure-firewall)
6. [Verify Deployment](#verify-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Linux VPS (Ubuntu 20.04+ or Debian 11+ recommended)
- Root or sudo access
- At least 2GB RAM, 20GB disk space
- Public IP address
- Domain name (optional, for production)

---

## Initial VPS Setup

### 1. Update System Packages

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl git wget nano ufw
```

### 2. Create Application User (Optional but Recommended)

```bash
# Create a dedicated user for the application
sudo adduser libraryadmin

# Add user to sudo group
sudo usermod -aG sudo libraryadmin

# Switch to the new user
su - libraryadmin
```

---

## Install Docker & Docker Compose

### 1. Install Docker

```bash
# Remove old versions (if any)
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group (logout/login required after this)
sudo usermod -aG docker $USER

# Verify installation
docker --version
```

### 2. Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### 3. Logout and Login Again

```bash
# Logout to apply docker group membership
exit

# SSH back into your VPS
ssh your-user@your-vps-ip
```

---

## Deploy the Application

### 1. Clone the Repository

```bash
# Navigate to home directory or desired location
cd ~

# Clone your repository
git clone https://github.com/your-username/library_app.git

# Navigate to project directory
cd library_app
```

### 2. Configure Environment Variables

```bash
# Copy and edit the .env file
nano .env
```

Update the following values:

```bash
# Database Configuration
DB_HOST=postgres_library_app
DB_PORT=5432
DB_NAME=library_app_db
DB_USER=libraryuser
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE  # CHANGE THIS!

# Application Ports
FRONTEND_PORT=3002
BACKEND_PORT=5002

# Flask Configuration
SECRET_KEY=YOUR_RANDOM_SECRET_KEY_HERE  # CHANGE THIS!
FLASK_ENV=production

# Azure AD Configuration
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_REQUIRED_GROUP_ID=your-group-id
```

**Security Note:** Generate strong passwords and secret keys:
```bash
# Generate a strong password
openssl rand -base64 32

# Generate a secret key
python3 -c 'import secrets; print(secrets.token_hex(32))'
```

### 3. Create Backup Directory

```bash
# Create backup directory with proper permissions
mkdir -p ~/library_app/backups
chmod 755 ~/library_app/backups
```

### 4. Create Docker Volume for PostgreSQL

```bash
# Create named volume for persistent database storage
docker volume create library_app_data

# Verify volume creation
docker volume ls | grep library_app_data

# Inspect volume details
docker volume inspect library_app_data
```

**Expected Output:**
```json
[
    {
        "CreatedAt": "2026-02-06T...",
        "Driver": "local",
        "Labels": null,
        "Mountpoint": "/var/lib/docker/volumes/library_app_data/_data",
        "Name": "library_app_data",
        "Options": null,
        "Scope": "local"
    }
]
```

### 5. Build and Start All Services

```bash
# Build and start all containers (postgres, backend, frontend)
docker-compose up --build -d

# View logs to ensure everything started correctly
docker-compose logs -f
```

Press `Ctrl+C` to exit logs (containers keep running).

### 6. Verify All Services Are Running

```bash
# Check running containers
docker ps

# You should see 3 containers:
# - postgres_library_app
# - library_app_backend
# - library_app_frontend

# Check specific service logs
docker-compose logs postgres
docker-compose logs backend
docker-compose logs frontend
```

---

## Configure Firewall

### 1. Configure UFW (Uncomplicated Firewall)

```bash
# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp

# Allow frontend port
sudo ufw allow 3002/tcp

# Allow backend API port (if needed externally)
sudo ufw allow 5002/tcp

# DO NOT expose PostgreSQL port externally (security best practice)
# PostgreSQL (5432) should only be accessible within Docker network

# Enable firewall
sudo ufw enable

# Check firewall status
sudo ufw status numbered
```

**Expected Output:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
3002/tcp                   ALLOW       Anywhere
5002/tcp                   ALLOW       Anywhere
```

### 2. Configure Cloud Provider Firewall (if applicable)

If using AWS, DigitalOcean, Linode, etc., also configure their firewall:

- **SSH:** Port 22 (from your IP only)
- **Frontend:** Port 3002 (from anywhere)
- **Backend API:** Port 5002 (from anywhere or frontend only)
- **PostgreSQL:** Port 5432 (DO NOT expose externally)

---

## Verify Deployment

### 1. Test Database Connection

```bash
# Connect to PostgreSQL inside container
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db

# Run a test query
\dt  # List all tables
SELECT * FROM users;  # Check if users table exists
\q   # Quit
```

### 2. Test Backend API

```bash
# Health check endpoint
curl http://localhost:5002/api/health

# Expected response: {"status": "healthy"}
```

### 3. Test Frontend

Open a web browser and navigate to:
```
http://YOUR_VPS_IP:3002
```

You should see the Library Management login page.

### 4. Test Full Stack Integration

1. Login with Azure AD
2. Navigate to Dashboard
3. Try creating a book, borrower, or checkout
4. Verify data is saved by refreshing the page

---

## Verify Data Persistence

### 1. Test Volume Persistence

```bash
# Create a test user via backend API or frontend
# Then stop all containers
docker-compose down

# Volume still exists
docker volume ls | grep library_app_data

# Start containers again
docker-compose up -d

# Data should still be there - verify in frontend or:
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db -c "SELECT * FROM users;"
```

### 2. Check Volume Size

```bash
# Check volume disk usage
docker system df -v | grep library_app_data
```

---

## Useful Commands

### Docker Compose Commands

```bash
# Start all services
docker-compose up -d

# Stop all services (keeps data)
docker-compose down

# Stop and remove volumes (DELETES ALL DATA!)
docker-compose down -v

# Restart a specific service
docker-compose restart backend

# View logs
docker-compose logs -f [service_name]

# Rebuild a service
docker-compose up -d --build backend

# Scale a service (if needed)
docker-compose up -d --scale backend=2
```

### Container Management

```bash
# List all containers
docker ps -a

# Stop a container
docker stop library_app_backend

# Start a container
docker start library_app_backend

# Remove a container
docker rm library_app_backend

# Execute command in container
docker exec -it postgres_library_app bash
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect library_app_data

# Remove unused volumes (CAREFUL!)
docker volume prune

# Backup volume (see backup guide)
# Covered in 02-GOOGLE-DRIVE-BACKUP.md
```

---

## Troubleshooting

### Issue: Containers Won't Start

```bash
# Check logs for errors
docker-compose logs

# Check if ports are already in use
sudo lsof -i :3002
sudo lsof -i :5002
sudo lsof -i :5432

# Kill processes using the ports
sudo kill -9 <PID>
```

### Issue: Database Connection Failed

```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker-compose logs postgres

# Test connection from backend container
docker exec -it library_app_backend ping postgres_library_app

# Verify environment variables
docker exec -it library_app_backend env | grep DB_
```

### Issue: Volume Not Persisting Data

```bash
# Check if volume is mounted correctly
docker inspect postgres_library_app | grep -A 10 Mounts

# Verify volume exists
docker volume inspect library_app_data

# Check PostgreSQL data directory permissions
docker exec -it postgres_library_app ls -la /var/lib/postgresql/data
```

### Issue: Frontend Can't Reach Backend

```bash
# Check if backend is accessible from frontend container
docker exec -it library_app_frontend curl http://library_app_backend:5002/api/health

# Verify network
docker network inspect library-app-network

# Check Nginx configuration in frontend
docker exec -it library_app_frontend cat /etc/nginx/conf.d/default.conf
```

### Issue: Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker system
docker system prune -a

# Remove unused volumes
docker volume prune

# Remove old images
docker image prune -a
```

---

## Security Best Practices

1. **Change Default Passwords:** Always change DB_PASSWORD and SECRET_KEY
2. **Firewall Configuration:** Only expose necessary ports
3. **SSL/TLS:** Use a reverse proxy (Nginx/Caddy) with Let's Encrypt for HTTPS
4. **Regular Updates:** Keep Docker, system packages, and application updated
5. **Backup Regularly:** Set up automated backups (see next guide)
6. **Monitor Logs:** Regularly check logs for suspicious activity
7. **Database Access:** Never expose PostgreSQL port (5432) to the internet

---

## Next Steps

1. **Set up automated backups:** See [02-GOOGLE-DRIVE-BACKUP.md](./02-GOOGLE-DRIVE-BACKUP.md)
2. **Configure domain name:** Set up A record pointing to your VPS IP
3. **Enable HTTPS:** Use Certbot or Caddy for SSL certificates
4. **Set up monitoring:** Use tools like Uptime Kuma, Grafana, or Prometheus
5. **Configure log rotation:** Prevent log files from filling up disk

---

## Support

For issues or questions:
- Check application logs: `docker-compose logs`
- Review Docker documentation: https://docs.docker.com/
- PostgreSQL documentation: https://www.postgresql.org/docs/

---

**Last Updated:** February 2026
