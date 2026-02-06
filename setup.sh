#!/bin/bash

echo "================================================"
echo "Library Management System - Setup Script"
echo "================================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Create Docker network
echo "📡 Creating Docker network..."
if docker network inspect library-app-network >/dev/null 2>&1; then
    echo "ℹ️  Network already exists"
else
    docker network create library-app-network && echo "✅ Network created" || {
        echo "❌ Failed to create network"
        exit 1
    }
fi
echo ""

# Create Docker volume
echo "💾 Creating Docker volume..."
if docker volume inspect library_app_data >/dev/null 2>&1; then
    echo "ℹ️  Volume already exists"
else
    docker volume create library_app_data && echo "✅ Volume created" || {
        echo "❌ Failed to create volume"
        exit 1
    }
fi
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Please create .env file with the following variables:"
    echo "  DB_NAME=library_app_db"
    echo "  DB_USER=libraryuser"
    echo "  DB_PASSWORD=your_password"
    echo "  SECRET_KEY=your_secret_key"
    echo "  FRONTEND_PORT=3002"
    echo "  BACKEND_PORT=5002"
    exit 1
fi

echo "✅ Environment file found"
echo ""

# Start database
echo "🗄️  Starting PostgreSQL database..."
cd database
docker-compose up -d
cd ..

# Wait for database to be ready
echo "⏳ Waiting for database to initialize (30 seconds)..."
sleep 30

echo ""
echo "🐘 Database is ready!"
echo ""

# Build and start application
echo "🏗️  Building and starting application containers..."
docker-compose build
docker-compose up -d

echo ""
echo "✅ Setup complete!"
echo ""
echo "================================================"
echo "📋 Application URLs:"
echo "================================================"
echo "Frontend:  http://localhost:3002"
echo "Backend:   http://localhost:5002"
echo "Health:    http://localhost:5002/api/health"
echo ""
echo "================================================"
echo "🐳 Useful Docker Commands:"
echo "================================================"
echo "View logs:        docker-compose logs -f"
echo "Stop services:    docker-compose down"
echo "Restart:          docker-compose restart"
echo "Database access:  docker exec -it postgres_library_app psql -U libraryuser -d library_app_db"
echo ""
echo "================================================"
echo "Happy library managing! 📚"
echo "================================================"
