# Library App Setup Order

## ✅ Prerequisites Created
The Docker network and volume have been created:
- Network: `library-app-network` ✓
- Volume: `library_app_data` ✓

## 📋 Correct Setup Order

### Option 1: Automated Setup (Recommended)
```bash
cd /media/tevinric/Github/linux_budgetapp/library_app
./setup.sh
```

### Option 2: Manual Setup

**Step 1: Verify Prerequisites**
```bash
# Check if network exists
docker network ls | grep library-app-network

# Check if volume exists
docker volume ls | grep library_app_data

# If either is missing, create them:
docker network create library-app-network
docker volume create library_app_data
```

**Step 2: Start Database**
```bash
cd database
docker-compose up -d
cd ..

# Wait for database to initialize (30 seconds)
sleep 30

# Verify database is running
docker ps | grep postgres_library_app
```

**Step 3: Start Application (Backend + Frontend)**
```bash
# From the library_app root directory
docker-compose up -d

# Verify services are running
docker-compose ps
```

**Step 4: Verify Everything Works**
```bash
# Check all containers
docker ps | grep library_app

# Test backend health
curl http://localhost:5002/api/health

# Open frontend in browser
# http://localhost:3002
```

## 🔧 Troubleshooting

### Error: "network library-app-network not found"
```bash
docker network create library-app-network
```

### Error: "volume library_app_data not found"
```bash
docker volume create library_app_data
```

### Database won't start
```bash
# Check logs
docker logs postgres_library_app

# Remove and recreate
docker-compose -f database/docker-compose.yml down
docker volume rm library_app_data
docker volume create library_app_data
cd database && docker-compose up -d && cd ..
```

### Backend can't connect to database
```bash
# Make sure database is running first
docker ps | grep postgres_library_app

# Check backend logs
docker logs library_app_backend

# Verify .env file has correct credentials
cat .env
```

## 🎯 Quick Commands

```bash
# Start everything (from library_app directory)
cd database && docker-compose up -d && cd .. && sleep 30 && docker-compose up -d

# Stop everything
docker-compose down
cd database && docker-compose down && cd ..

# View all logs
docker-compose logs -f

# Restart a service
docker-compose restart backend
docker-compose restart frontend

# Complete cleanup (removes data!)
docker-compose down
cd database && docker-compose down && cd ..
docker volume rm library_app_data
docker network rm library-app-network
```

## ✅ Current Status
- ✅ Network created
- ✅ Volume created
- Ready to start services!

## Next Steps
1. Update `.env` file with your passwords
2. Run `./setup.sh` OR follow manual steps above
3. Access http://localhost:3002
