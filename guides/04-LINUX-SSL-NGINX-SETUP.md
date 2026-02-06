# Complete SSL & Nginx Reverse Proxy Guide - Library Management App

Comprehensive guide for deploying the Library Management Application on a Linux VPS with SSL/TLS encryption and Nginx reverse proxy.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [DNS Configuration](#dns-configuration)
5. [Install Host Nginx](#install-host-nginx)
6. [Update Docker Configuration](#update-docker-configuration)
7. [SSL Certificate Setup](#ssl-certificate-setup)
8. [Configure Nginx Reverse Proxy](#configure-nginx-reverse-proxy)
9. [Security Hardening](#security-hardening)
10. [Testing & Verification](#testing--verification)
11. [Troubleshooting](#troubleshooting)
12. [Maintenance](#maintenance)

---

## Overview

This guide transforms your Library Management Application from HTTP-only access to a production-ready deployment with:

- ✅ HTTPS/SSL encryption (Let's Encrypt)
- ✅ Professional domain name (e.g., library.yourdomain.com)
- ✅ Nginx reverse proxy on the host
- ✅ Enhanced security (firewall, rate limiting, headers)
- ✅ Automatic HTTP to HTTPS redirect
- ✅ No exposed ports except 80/443

**What Changes:**

**Before:**
```
User → http://YOUR_VPS_IP:3002 → Docker Container (Frontend)
User → http://YOUR_VPS_IP:5002 → Docker Container (Backend API)
```

**After:**
```
User → https://library.yourdomain.com → Host Nginx (SSL) → Docker Container (Frontend)
User → https://library.yourdomain.com/api → Host Nginx (SSL) → Docker Container (Backend API)
```

---

## Prerequisites

### Required
- Linux VPS (Ubuntu 20.04+ or Debian 11+)
- Root or sudo access
- Domain name (purchased from registrar)
- Minimum 2GB RAM, 20GB disk
- Existing Library App deployment (from [01-VPS-DEPLOYMENT.md](./01-VPS-DEPLOYMENT.md))

### Optional
- Email for SSL renewal notifications
- Backup domain (for redundancy)

---

## Architecture

### Current Architecture (Before SSL)

```
┌─────────────────────────────────────────┐
│           Internet                       │
└────────────────┬────────────────────────┘
                 │
                 │ HTTP :3002, :5002
                 ▼
┌─────────────────────────────────────────┐
│         Ubuntu VPS Server               │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │     Docker Compose                │  │
│  │                                   │  │
│  │  ┌──────────┐    ┌─────────────┐ │  │
│  │  │ Frontend │    │   Backend   │ │  │
│  │  │  :3002   │    │    :5002    │ │  │
│  │  └─────┬────┘    └──────┬──────┘ │  │
│  │        │                 │        │  │
│  │        └────────┬────────┘        │  │
│  │                 │                 │  │
│  │        ┌────────▼────────┐        │  │
│  │        │   PostgreSQL    │        │  │
│  │        │     :5432       │        │  │
│  │        └─────────────────┘        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Target Architecture (After SSL)

```
┌─────────────────────────────────────────┐
│           Internet                       │
└────────────────┬────────────────────────┘
                 │
                 │ HTTPS :443 (SSL)
                 │ HTTP :80 → Redirect to HTTPS
                 ▼
┌─────────────────────────────────────────┐
│         Ubuntu VPS Server               │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   HOST Nginx Reverse Proxy        │  │
│  │   - SSL Termination               │  │
│  │   - Security Headers              │  │
│  │   - Rate Limiting                 │  │
│  │   library.yourdomain.com          │  │
│  └──────────────┬────────────────────┘  │
│                 │                       │
│                 │ HTTP (internal)       │
│                 ▼                       │
│  ┌───────────────────────────────────┐  │
│  │     Docker Compose                │  │
│  │                                   │  │
│  │  ┌──────────┐    ┌─────────────┐ │  │
│  │  │ Frontend │    │   Backend   │ │  │
│  │  │  :3002   │    │    :5002    │ │  │
│  │  └─────┬────┘    └──────┬──────┘ │  │
│  │        │                 │        │  │
│  │        └────────┬────────┘        │  │
│  │                 │                 │  │
│  │        ┌────────▼────────┐        │  │
│  │        │   PostgreSQL    │        │  │
│  │        │     :5432       │        │  │
│  │        └─────────────────┘        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## DNS Configuration

### Step 1: Obtain Your VPS IP Address

```bash
# Find your public IP
curl -4 ifconfig.me

# Example output: 203.0.113.45
```

### Step 2: Configure DNS Records

Log into your domain registrar's DNS panel (e.g., Namecheap, GoDaddy, 1Grid, Cloudflare).

**Option A: Main Domain**
```
Type: A Record
Host: @
Value: YOUR_VPS_IP
TTL: 300 (5 minutes)

Result: yourdomain.com → YOUR_VPS_IP
```

**Option B: Subdomain (Recommended)**
```
Type: A Record
Host: library
Value: YOUR_VPS_IP
TTL: 300

Result: library.yourdomain.com → YOUR_VPS_IP
```

**Example for 1Grid:**
```
DNS Zone Editor → Select Domain
Type: A
Name: library
TTL: 300
Address: YOUR_VPS_IP
```

### Step 3: Verify DNS Propagation

```bash
# Check DNS resolution
nslookup library.yourdomain.com

# Or use dig
dig library.yourdomain.com +short

# Should return: YOUR_VPS_IP
```

**Wait for DNS propagation:** Usually 5-30 minutes, can take up to 48 hours.

**Online Tools:**
- https://dnschecker.org
- https://www.whatsmydns.net

---

## Install Host Nginx

Nginx will run **directly on the host** (not in Docker) to handle SSL and reverse proxy.

### Step 1: Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Verify installation
nginx -v
# Expected: nginx version: nginx/1.18.0 or higher

# Check status
sudo systemctl status nginx
```

### Step 3: Stop Default Site

```bash
# Remove default configuration
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 4: Allow Nginx Through Firewall (Temporarily)

```bash
# If UFW is enabled
sudo ufw allow 'Nginx HTTP'
sudo ufw allow 'Nginx HTTPS'

# Or allow specific ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

---

## Update Docker Configuration

### Step 1: Modify Docker Compose Ports

The containers should **NOT** expose ports to the host. Nginx will connect via Docker network.

**Edit `docker-compose.yml`:**

```bash
cd ~/library_app
nano docker-compose.yml
```

**Update the services section:**

```yaml
services:
  # PostgreSQL Database Service
  postgres:
    image: postgres:16
    container_name: postgres_library_app
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
    volumes:
      - library_app_data:/var/lib/postgresql/data
      - ./database/sql_init.sql:/docker-entrypoint-initdb.d/sql_init.sql
      - ./backups:/backups
    # REMOVE port mapping - PostgreSQL should not be exposed
    # ports:
    #   - "5433:5432"
    restart: unless-stopped
    networks:
      - library_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API Service
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: library_app_backend
    # KEEP port mapping for host Nginx to access
    ports:
      - "127.0.0.1:5002:5002"  # Bind to localhost only
    environment:
      - DB_HOST=${DB_HOST}
      - DB_PORT=${DB_PORT}
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - SECRET_KEY=${SECRET_KEY}
      - FLASK_ENV=${FLASK_ENV:-production}
      - BACKEND_PORT=5002
      - AZURE_TENANT_ID=${AZURE_TENANT_ID}
      - AZURE_CLIENT_ID=${AZURE_CLIENT_ID}
      - AZURE_REQUIRED_GROUP_ID=${AZURE_REQUIRED_GROUP_ID}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - library_network

  # Frontend Web Service
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: library_app_frontend
    # KEEP port mapping for host Nginx to access
    ports:
      - "127.0.0.1:3002:80"  # Bind to localhost only
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - library_network

volumes:
  library_app_data:
    driver: local
    name: library_app_data

networks:
  library_network:
    driver: bridge
    name: library_network
```

**Key Changes:**
- PostgreSQL: **No ports exposed** (internal only)
- Backend: Port `127.0.0.1:5002:5002` (localhost only, accessible to host Nginx)
- Frontend: Port `127.0.0.1:3002:80` (localhost only, accessible to host Nginx)

### Step 2: Update Frontend Nginx Configuration

The frontend container's nginx config can remain simple since SSL is handled by host.

**Verify `frontend/nginx.conf` looks like this:**

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api {
        proxy_pass http://library_app_backend:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

### Step 3: Restart Docker Services

```bash
# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Verify containers are running
docker ps

# Check logs
docker-compose logs -f
```

### Step 4: Test Internal Access

```bash
# Test backend (should work)
curl http://localhost:5002/api/health

# Test frontend (should work)
curl http://localhost:3002

# Test from external (should NOT work)
curl http://YOUR_VPS_IP:5002/api/health
# Should fail or timeout
```

---

## SSL Certificate Setup

### Step 1: Install Certbot

```bash
# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Verify installation
certbot --version
```

### Step 2: Obtain SSL Certificate

**Important:** Ensure DNS is properly configured and pointing to your VPS before running this command.

```bash
# Get SSL certificate
sudo certbot certonly --nginx \
  --agree-tos \
  --no-eff-email \
  --email your-email@example.com \
  -d library.yourdomain.com

# Replace:
# - your-email@example.com with your actual email
# - library.yourdomain.com with your actual domain
```

**Expected Output:**
```
Congratulations! Your certificate and chain have been saved at:
/etc/letsencrypt/live/library.yourdomain.com/fullchain.pem

Your key file has been saved at:
/etc/letsencrypt/live/library.yourdomain.com/privkey.pem

Your certificate will expire on 2026-05-07.
```

**Certificate Locations:**
```
Certificate: /etc/letsencrypt/live/library.yourdomain.com/fullchain.pem
Private Key: /etc/letsencrypt/live/library.yourdomain.com/privkey.pem
```

### Step 3: Test Certificate Renewal

```bash
# Dry run to test renewal
sudo certbot renew --dry-run

# Expected: all renewals succeeded
```

**Automatic Renewal:** Certbot automatically sets up a systemd timer to renew certificates.

```bash
# Check renewal timer
sudo systemctl status certbot.timer

# View renewal configuration
sudo cat /etc/systemd/system/timers.target.wants/certbot.timer
```

---

## Configure Nginx Reverse Proxy

### Step 1: Create Nginx Configuration

```bash
# Create configuration file
sudo nano /etc/nginx/sites-available/library-app
```

### Step 2: Add Nginx Configuration

**Copy and paste the following configuration:**

```nginx
# Library Management App - Nginx Configuration
# Domain: library.yourdomain.com

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name library.yourdomain.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name library.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/library.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/library.yourdomain.com/privkey.pem;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/library-app-access.log;
    error_log /var/log/nginx/library-app-error.log;

    # Client upload size (for potential file uploads)
    client_max_body_size 10M;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Backend API - Proxy to Flask backend
    location /api {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        proxy_cache_bypass $http_upgrade;
        
        # Security
        proxy_hide_header X-Powered-By;
    }

    # Frontend - Proxy to React/Nginx frontend
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        proxy_cache_bypass $http_upgrade;
        
        # Security
        proxy_hide_header X-Powered-By;
    }

    # Health check endpoint (optional)
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

**Important:** Replace `library.yourdomain.com` with your actual domain in **4 places**:
1. Line 7: `server_name library.yourdomain.com;`
2. Line 23: `server_name library.yourdomain.com;`
3. Line 26: `ssl_certificate /etc/letsencrypt/live/library.yourdomain.com/fullchain.pem;`
4. Line 27: `ssl_certificate_key /etc/letsencrypt/live/library.yourdomain.com/privkey.pem;`

### Step 3: Enable Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/library-app /etc/nginx/sites-enabled/

# Verify symbolic link
ls -l /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Step 4: Reload Nginx

```bash
# Reload Nginx
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx

# If reload fails, check error log
sudo tail -50 /var/log/nginx/error.log
```

---

## Security Hardening

### Step 1: Configure Firewall (UFW)

```bash
# Reset UFW rules (if needed)
# sudo ufw --force reset

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (CRITICAL - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Verify rules
sudo ufw status numbered

# Expected output:
# [1] 22/tcp                     ALLOW IN    Anywhere
# [2] 80/tcp                     ALLOW IN    Anywhere
# [3] 443/tcp                    ALLOW IN    Anywhere
```

**Important:** Ports 3002 and 5002 should **NOT** be open to the public.

### Step 2: Install and Configure Fail2Ban

Fail2Ban protects against brute-force attacks.

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Start and enable
sudo systemctl start fail2ban
sudo systemctl enable fail2ban

# Create local configuration
sudo nano /etc/fail2ban/jail.local
```

**Add the following configuration:**

```ini
[DEFAULT]
# Ban time: 1 hour
bantime = 3600

# Find time window: 10 minutes
findtime = 600

# Max retries before ban
maxretry = 5

# Email notifications (optional)
destemail = your-email@example.com
sendername = Fail2Ban
action = %(action_mw)s

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10

[nginx-botsearch]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
```

```bash
# Restart Fail2Ban
sudo systemctl restart fail2ban

# Check status
sudo fail2ban-client status

# Check specific jail
sudo fail2ban-client status sshd
```

### Step 3: Rate Limiting in Nginx

Add rate limiting to prevent abuse.

**Edit `/etc/nginx/nginx.conf`:**

```bash
sudo nano /etc/nginx/nginx.conf
```

**Add in the `http` block (before any `server` blocks):**

```nginx
http {
    # ... existing config ...

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;
    
    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    limit_conn addr 10;

    # ... rest of config ...
}
```

**Update your site config:**

```bash
sudo nano /etc/nginx/sites-available/library-app
```

**Add rate limiting to the `/api` location:**

```nginx
    # Backend API - Proxy to Flask backend
    location /api {
        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;
        
        proxy_pass http://localhost:5002;
        # ... rest of proxy config ...
    }
```

**Test and reload:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Secure SSH

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config
```

**Update the following settings:**

```bash
# Disable root login
PermitRootLogin no

# Disable password authentication (use SSH keys only)
PasswordAuthentication no

# Disable empty passwords
PermitEmptyPasswords no

# Allow only specific user (optional)
AllowUsers your-username
```

```bash
# Restart SSH
sudo systemctl restart sshd
```

**Before disabling password auth, ensure you have SSH key access set up!**

### Step 5: Enable Automatic Security Updates

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades

# Enable automatic updates
sudo dpkg-reconfigure -plow unattended-upgrades

# Verify configuration
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

### Step 6: Disable Unused Services

```bash
# List running services
systemctl list-units --type=service --state=running

# Disable unnecessary services (examples)
# sudo systemctl disable bluetooth.service
# sudo systemctl disable cups.service
```

### Step 7: Install and Configure ModSecurity (Optional)

ModSecurity is a web application firewall.

```bash
# Install ModSecurity
sudo apt install -y libnginx-mod-security

# Enable ModSecurity
sudo nano /etc/nginx/modsec/modsecurity.conf
```

**Change `SecRuleEngine` to `On`:**

```
SecRuleEngine On
```

```bash
# Reload Nginx
sudo systemctl reload nginx
```

---

## Testing & Verification

### Step 1: Test SSL Certificate

**Browser Test:**
1. Open browser
2. Navigate to `https://library.yourdomain.com`
3. Click padlock icon
4. Verify certificate is valid
5. Check certificate issuer is "Let's Encrypt"

**Command Line Test:**

```bash
# Test SSL configuration
curl -I https://library.yourdomain.com

# Check SSL certificate
echo | openssl s_client -servername library.yourdomain.com -connect library.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Test with SSL Labs (online)
# Visit: https://www.ssllabs.com/ssltest/
# Enter your domain
```

### Step 2: Test HTTP to HTTPS Redirect

```bash
# Should redirect to HTTPS
curl -I http://library.yourdomain.com

# Expected: 301 Moved Permanently
# Location: https://library.yourdomain.com/
```

### Step 3: Test Application Functionality

**Frontend:**
1. Visit `https://library.yourdomain.com`
2. Login with Azure AD
3. Navigate through all pages
4. Check browser console for errors

**Backend API:**
```bash
# Health check
curl https://library.yourdomain.com/api/health

# Test authenticated endpoint
curl -H "X-User-Email: test@example.com" https://library.yourdomain.com/api/dashboard/stats
```

### Step 4: Test Security Headers

```bash
# Check security headers
curl -I https://library.yourdomain.com | grep -i "strict-transport-security\|x-frame-options\|x-content-type-options"

# Expected:
# strict-transport-security: max-age=31536000; includeSubDomains
# x-frame-options: SAMEORIGIN
# x-content-type-options: nosniff
```

### Step 5: Test Rate Limiting

```bash
# Test API rate limiting (should get 429 after 10 requests)
for i in {1..15}; do curl -s -o /dev/null -w "%{http_code}\n" https://library.yourdomain.com/api/health; sleep 0.1; done

# Expected: First 10 return 200, rest return 429
```

### Step 6: Check Logs

```bash
# Nginx access log
sudo tail -50 /var/log/nginx/library-app-access.log

# Nginx error log
sudo tail -50 /var/log/nginx/library-app-error.log

# Docker container logs
docker-compose logs -f

# Fail2Ban log
sudo tail -50 /var/log/fail2ban.log
```

---

## Troubleshooting

### Issue: "502 Bad Gateway"

**Cause:** Nginx can't reach backend containers.

**Solution:**

```bash
# Check if containers are running
docker ps

# Check container logs
docker-compose logs backend
docker-compose logs frontend

# Verify containers are accessible from host
curl http://localhost:5002/api/health
curl http://localhost:3002

# Check Nginx error log
sudo tail -50 /var/log/nginx/error.log

# Restart containers
docker-compose restart
```

### Issue: "Certificate Not Found"

**Cause:** SSL certificate path is incorrect.

**Solution:**

```bash
# List certificates
sudo ls -la /etc/letsencrypt/live/

# Verify certificate files exist
sudo ls -la /etc/letsencrypt/live/library.yourdomain.com/

# Check Nginx config has correct paths
sudo grep "ssl_certificate" /etc/nginx/sites-available/library-app

# Re-obtain certificate if needed
sudo certbot certonly --nginx -d library.yourdomain.com
```

### Issue: "Mixed Content Warnings"

**Cause:** Frontend is trying to load HTTP resources on HTTPS page.

**Solution:**

```bash
# Check frontend environment variables
cat ~/library_app/frontend/.env

# Ensure API URL uses relative path (not absolute HTTP)
# Should be: VITE_API_URL=/api
# NOT: VITE_API_URL=http://localhost:5002

# Rebuild frontend
cd ~/library_app
docker-compose build frontend --no-cache
docker-compose up -d
```

### Issue: "Connection Refused"

**Cause:** Docker ports not bound correctly.

**Solution:**

```bash
# Check port bindings
docker ps

# Should see:
# 127.0.0.1:3002->80/tcp
# 127.0.0.1:5002->5002/tcp

# If not, update docker-compose.yml and restart
docker-compose down
docker-compose up -d
```

### Issue: "Rate Limiting Too Strict"

**Cause:** Rate limits are triggering for normal usage.

**Solution:**

```bash
# Edit Nginx config
sudo nano /etc/nginx/nginx.conf

# Increase rate limit (e.g., from 10r/s to 50r/s)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;

# Or increase burst
# In site config:
limit_req zone=api_limit burst=50 nodelay;

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Issue: "Fail2Ban Banning Legitimate Users"

**Solution:**

```bash
# Unban IP address
sudo fail2ban-client set nginx-limit-req unbanip YOUR_IP

# Check ban list
sudo fail2ban-client status nginx-limit-req

# Whitelist IP (add to jail.local)
sudo nano /etc/fail2ban/jail.local

# Add under [DEFAULT]:
ignoreip = 127.0.0.1/8 ::1 YOUR_IP

# Restart Fail2Ban
sudo systemctl restart fail2ban
```

### Issue: "Certbot Renewal Fails"

**Solution:**

```bash
# Check renewal logs
sudo cat /var/log/letsencrypt/letsencrypt.log

# Test renewal manually
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal

# Check Nginx config
sudo nginx -t

# Ensure port 80 is accessible
sudo ufw status | grep 80
```

---

## Maintenance

### Regular Tasks

**Daily:**
- Check application is accessible
- Monitor logs for errors

**Weekly:**
- Review Nginx logs
- Check Fail2Ban bans
- Verify backup status

**Monthly:**
- Update system packages
- Review security headers
- Check SSL certificate expiry

### Update SSL Certificate (Manual)

Certbot handles renewals automatically, but to renew manually:

```bash
# Renew all certificates
sudo certbot renew

# Renew specific certificate
sudo certbot renew --cert-name library.yourdomain.com

# Reload Nginx after renewal
sudo systemctl reload nginx
```

### Update Application

```bash
cd ~/library_app

# Pull latest code
git pull origin main

# Rebuild containers
docker-compose down
docker-compose up --build -d

# Check logs
docker-compose logs -f
```

### Rotate Logs

```bash
# Nginx logs are rotated automatically by logrotate
# Check configuration:
cat /etc/logrotate.d/nginx

# Manually rotate logs
sudo logrotate -f /etc/logrotate.d/nginx

# Check log sizes
sudo du -sh /var/log/nginx/*
```

### Backup Nginx Configuration

```bash
# Backup Nginx config
sudo cp -r /etc/nginx /root/nginx-backup-$(date +%Y%m%d)

# Or create a script
sudo tar -czf /root/nginx-backup-$(date +%Y%m%d).tar.gz /etc/nginx

# Include in your regular backups
```

---

## Quick Reference Commands

### Nginx Management

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/library-app-access.log
sudo tail -f /var/log/nginx/library-app-error.log
```

### SSL Certificate Management

```bash
# List certificates
sudo certbot certificates

# Renew certificates
sudo certbot renew

# Revoke certificate
sudo certbot revoke --cert-name library.yourdomain.com

# Delete certificate
sudo certbot delete --cert-name library.yourdomain.com
```

### Firewall Management

```bash
# Check firewall status
sudo ufw status numbered

# Add rule
sudo ufw allow 8080/tcp

# Delete rule
sudo ufw delete <rule_number>

# Reset firewall
sudo ufw reset
```

### Fail2Ban Management

```bash
# Check status
sudo fail2ban-client status

# Check specific jail
sudo fail2ban-client status sshd

# Unban IP
sudo fail2ban-client set sshd unbanip <IP>

# Restart Fail2Ban
sudo systemctl restart fail2ban
```

---

## Security Checklist

- [ ] SSL certificate installed and valid
- [ ] HTTP redirects to HTTPS
- [ ] Firewall configured (only 22, 80, 443 open)
- [ ] Fail2Ban installed and configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] SSH password authentication disabled
- [ ] Root login disabled
- [ ] Docker ports bound to localhost only
- [ ] PostgreSQL not exposed to internet
- [ ] Automatic security updates enabled
- [ ] Regular backups configured
- [ ] Log rotation configured
- [ ] Monitoring in place

---

## Additional Resources

### Documentation
- Nginx Documentation: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/docs/
- Certbot: https://certbot.eff.org/
- Fail2Ban: https://www.fail2ban.org/wiki/index.php/Main_Page
- UFW: https://help.ubuntu.com/community/UFW

### Security Testing
- SSL Labs: https://www.ssllabs.com/ssltest/
- Security Headers: https://securityheaders.com/
- Mozilla Observatory: https://observatory.mozilla.org/

### Monitoring
- Uptime monitoring: UptimeRobot, Better Uptime
- Log aggregation: Papertrail, Loggly
- Server monitoring: Netdata, Prometheus + Grafana

---

**Congratulations!** Your Library Management Application is now:
- ✅ Secured with SSL/TLS
- ✅ Accessible via a professional domain
- ✅ Protected by firewall and rate limiting
- ✅ Hardened against common attacks
- ✅ Production-ready

**Next Steps:**
- Configure monitoring and alerting
- Set up automated backups (see [02-GOOGLE-DRIVE-BACKUP.md](./02-GOOGLE-DRIVE-BACKUP.md))
- Test disaster recovery procedures
- Document access credentials securely

---

**Last Updated:** February 2026