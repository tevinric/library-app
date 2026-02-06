# Library Management System - Quick Start Guide

## What Was Created

A complete full-stack library management application with:

### ✅ Backend (Flask on port 5002)
- Complete REST API with 30+ endpoints
- PostgreSQL database integration
- User authentication support
- Comprehensive CRUD operations for all entities

### ✅ Frontend (React on port 3002)
- 10 fully functional pages with sidebar navigation
- Responsive design with Tailwind CSS
- Modern UI with modals and forms
- Real-time search and autocomplete

### ✅ Database (PostgreSQL 16)
- 7 comprehensive tables
- Automatic timestamps and triggers
- Strategic indexes for performance
- Data integrity with foreign keys

### ✅ Pages & Features

1. **Dashboard** (`/`) - Overview with stats and quick actions
2. **Register Books** (`/books/register`) - Add books and copies
3. **Book Search** (`/books/search`) - Search with wishlist/follow-up
4. **Checkout Books** (`/checkout`) - 3-step checkout process
5. **Checked Out Books** (`/checked-out`) - Monitor active checkouts
6. **Check In** (`/check-in`) - Return books to inventory
7. **Checkout History** (`/history`) - Complete checkout records
8. **Users** (`/users`) - Manage borrowers
9. **Wishlist** (`/wishlist`) - Requested books
10. **Follow Ups** (`/follow-ups`) - Books needing attention

## Quick Setup (3 Steps)

### Step 1: Configure Environment

**For Development (No Authentication Required):**
The application is pre-configured for DEV mode. Just update database passwords:

Edit `.env` file:
```bash
ZOELIBRARYAPP_DB_PASSWORD=your_secure_password
ZOELIBRARYAPP_SECRET_KEY=your_secret_key
```

Edit `frontend/.env` (already set to DEV mode by default):
```bash
VITE_ZOELIBRARYAPP_ENV_TYPE=DEV
VITE_ZOELIBRARYAPP_DEV_USER_EMAIL=dev@library.local
```

**For Production (Azure AD Authentication):**
See `ENV_SETUP.md` for Azure AD configuration.

### Step 2: Run Setup Script

```bash
chmod +x setup.sh
./setup.sh
```

This will:
- Create Docker network and volume
- Start PostgreSQL database
- Build and start application containers

### Step 3: Access Application

Open browser to: **http://localhost:3002**

## Manual Setup (if script fails)

```bash
# 1. Create Docker infrastructure
docker network create library-app-network
docker volume create library_app_data

# 2. Start database
cd database
docker-compose up -d
cd ..

# 3. Wait for database (30 seconds)
sleep 30

# 4. Start application
docker-compose up -d

# 5. Access at http://localhost:3002
```

## Development Mode

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
source ../env.sh
python app.py
```
Backend runs on port 5002.

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```
Frontend dev server on port 3000 (proxies to backend).

## Testing the Application

### 1. Health Check
```bash
curl http://localhost:5002/api/health
```
Should return: `{"status":"healthy","database":"connected"}`

### 2. Test Book Registration
1. Go to http://localhost:3002
2. Click "Register Books" in sidebar
3. Search for existing books first
4. Click "Register New Book" to add one
5. Fill in book details and submit

### 3. Test Checkout Flow
1. First, register a book and add a copy
2. Go to "Users" and add a borrower
3. Go to "Checkout Books"
4. Follow 3-step checkout process
5. View result in "Checked Out" page

### 4. Test Dashboard
- Dashboard auto-updates with statistics
- Shows alerts for overdue books
- Quick action links to all features

## Common Commands

```bash
# View all container logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend

# Restart a service
docker-compose restart backend

# Stop everything
docker-compose down

# Database access
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db

# Remove everything and start fresh
docker-compose down
docker volume rm library_app_data
./setup.sh
```

## Ports Used

- **3002** - Frontend (React/Nginx)
- **5002** - Backend (Flask/Gunicorn)
- **5432** - Database (PostgreSQL) - mapped to localhost

## Database Details

| Field | Value |
|-------|-------|
| Database | library_app_db |
| User | libraryuser |
| Password | (from .env file) |
| Host | localhost (dev) or postgres_library_app (docker) |
| Port | 5432 |

## API Testing with curl

```bash
# Health check
curl http://localhost:5002/api/health

# Get dashboard stats (requires auth header)
curl -H "X-User-Email: test@example.com" http://localhost:5002/api/dashboard/stats

# Search books
curl -H "X-User-Email: test@example.com" http://localhost:5002/api/books?search=python

# Get borrowers
curl -H "X-User-Email: test@example.com" http://localhost:5002/api/borrowers
```

## Troubleshooting

### Can't access frontend
- Check if container is running: `docker ps | grep library_app_frontend`
- Check logs: `docker logs library_app_frontend`
- Try rebuilding: `docker-compose build frontend --no-cache`

### Backend API errors
- Check logs: `docker logs library_app_backend`
- Verify database is running: `docker ps | grep postgres_library_app`
- Test health endpoint: `curl http://localhost:5002/api/health`

### Database connection issues
- Check database logs: `docker logs postgres_library_app`
- Verify credentials in `.env` match database settings
- Ensure database has finished initializing (wait 30 seconds after start)

### Port conflicts
If ports 3002 or 5002 are in use, edit `.env`:
```bash
ZOELIBRARYAPP_FRONTEND_PORT=3003
ZOELIBRARYAPP_BACKEND_PORT=5003
```
Then restart: `docker-compose down && docker-compose up -d`

## Next Steps

1. **Add Sample Data**
   - Register a few books
   - Add multiple copies
   - Create some borrowers
   - Test checkout flow

2. **Customize**
   - Update colors in `frontend/tailwind.config.js`
   - Modify due date defaults in backend
   - Add custom fields to forms

3. **Configure Authentication**
   - Set up Azure AD credentials (optional)
   - Or use simple email-based auth

4. **Production Deployment**
   - Update environment variables
   - Use proper secrets management
   - Configure SSL/HTTPS
   - Set up backups

## Features Highlights

### Smart Borrower Autocomplete
- Type borrower name during checkout
- Case-insensitive search
- Quick selection from previous borrowers
- Or create new borrower on the fly

### Follow-up System
- Flag checkouts that need attention
- Automatic ordering by longest checkout
- Track contact attempts
- Resolution notes

### Wishlist Management
- Request books not in library
- Priority levels (High/Medium/Low)
- Track who requested
- Status updates (Requested → Ordered → Received)

### Complete History
- Every checkout tracked
- Duration calculations
- Search by book or borrower
- Export-ready table view

## File Structure

```
library_app/
├── backend/           # Flask API
├── frontend/          # React UI
├── database/          # PostgreSQL setup
├── .env              # Configuration
├── docker-compose.yml # Container orchestration
├── setup.sh          # Auto setup script
├── README.md         # Full documentation
└── QUICKSTART.md     # This file
```

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Verify .env configuration
3. Test API endpoints with curl
4. Check database connection

---

🎉 **You're ready to manage your library!**

Visit http://localhost:3002 to get started.
