# Library Management System

A comprehensive full-stack library management application for tracking books, managing checkouts, and organizing library operations.

## Features

### 📚 Book Management
- Register new books with detailed information (title, author, ISBN, publisher, etc.)
- Search existing books before registration
- Support for multiple physical copies of the same book
- Track book condition and location

### 🔍 Book Search & Discovery
- Advanced search by title, author, or ISBN
- Real-time availability status
- View all copies and their checkout status
- Add missing books to wishlist
- Flag checkouts for follow-up

### 📤 Checkout System
- Easy book checkout with borrower selection
- Borrower autocomplete (case-insensitive)
- New borrower registration during checkout
- Configurable due dates
- Checkout notes and tracking

### 📋 Monitoring & Management
- View all checked out books (oldest first)
- Overdue tracking and alerts
- Quick check-in process
- Complete checkout history with metrics
- Duration tracking for each checkout

### 👥 Borrower Management
- Comprehensive borrower database
- Search and filter borrowers
- Track active checkouts per borrower
- Update borrower information
- Contact management (email, phone, alt phone, address)

### ⭐ Wishlist
- Request books not in library
- Priority levels (Low, Medium, High)
- Status tracking (Requested, Ordered, Received, Cancelled)
- Track who requested each book

### 🔔 Follow-ups
- Automatic follow-up flagging
- Prioritized by checkout duration
- Status tracking (Pending, Contacted, Resolved, Escalated)
- Contact date and resolution notes

### 📊 Dashboard
- Real-time statistics
- Total books and copies
- Active checkouts
- Overdue alerts
- Utilization rate
- Quick action links

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React + Vite | React 18.2.0, Vite 5.x |
| **Backend** | Flask + Gunicorn | Flask 3.0.0 |
| **Database** | PostgreSQL | 16.x |
| **Containerization** | Docker + Docker Compose | Latest |
| **Authentication** | Azure AD (MSAL) | Optional |
| **Styling** | Tailwind CSS | 3.4.x |

## Database Schema

### Core Tables
- **users** - User accounts for authentication
- **books** - Master book records (title, author, ISBN, etc.)
- **book_copies** - Individual physical copies of books
- **borrowers** - Library patrons who borrow books
- **checkouts** - Checkout records (current and historical)
- **book_wishlist** - Requested books not in library
- **follow_ups** - Checkouts requiring follow-up

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Ports 3002 (frontend) and 5002 (backend) available

### 1. Create Docker Network and Volume

```bash
docker network create library-app-network
docker volume create library_app_data
```

### 2. Configure Environment

Edit `.env` file:
```bash
ZOELIBRARYAPP_DB_NAME=library_app_db
ZOELIBRARYAPP_DB_USER=libraryuser
ZOELIBRARYAPP_DB_PASSWORD=your_secure_password
ZOELIBRARYAPP_SECRET_KEY=your_secret_key
```

### 3. Start Database

```bash
cd database
docker-compose up -d
```

### 4. Start Application

```bash
cd ..
docker-compose up -d
```

### 5. Access Application

- **Frontend**: http://localhost:3002
- **Backend API**: http://localhost:5002
- **Health Check**: http://localhost:5002/api/health

## Development Setup

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Load environment variables
source ../env.sh  # On Windows: set variables manually

# Run development server
python app.py
```

Backend runs on port 5002 by default.

### Frontend Development

```bash
cd frontend
npm install

# Run development server
npm run dev
```

Frontend development server runs on port 3000 with proxy to backend.

### Database Access

```bash
docker exec -it postgres_library_app psql -U libraryuser -d library_app_db
```

## API Endpoints

### Books
- `GET /api/books?search=query` - Search books
- `GET /api/books/<id>` - Get book details
- `POST /api/books` - Register new book
- `PUT /api/books/<id>` - Update book
- `DELETE /api/books/<id>` - Delete book
- `GET /api/books/<id>/copies` - Get book copies

### Book Copies
- `POST /api/book-copies` - Add book copy
- `PUT /api/book-copies/<id>` - Update copy
- `DELETE /api/book-copies/<id>` - Delete copy

### Borrowers
- `GET /api/borrowers?search=query` - Search borrowers
- `GET /api/borrowers/<id>` - Get borrower details
- `GET /api/borrowers/autocomplete?q=query` - Autocomplete search
- `POST /api/borrowers` - Create borrower
- `PUT /api/borrowers/<id>` - Update borrower
- `DELETE /api/borrowers/<id>` - Delete borrower

### Checkouts
- `GET /api/checkouts?search=query` - Get active checkouts
- `POST /api/checkouts` - Checkout book
- `PUT /api/checkouts/<id>/return` - Check in book
- `DELETE /api/checkouts/<id>` - Delete checkout record

### Checkout History
- `GET /api/checkout-history?search=query` - Get all checkout history
- `GET /api/checkout-history?book_id=<id>` - Filter by book
- `GET /api/checkout-history?borrower_id=<id>` - Filter by borrower

### Wishlist
- `GET /api/wishlist` - Get wishlist items
- `POST /api/wishlist` - Add to wishlist
- `PUT /api/wishlist/<id>` - Update wishlist item
- `DELETE /api/wishlist/<id>` - Delete wishlist item

### Follow-ups
- `GET /api/follow-ups` - Get all follow-ups
- `POST /api/follow-ups` - Create follow-up
- `PUT /api/follow-ups/<id>` - Update follow-up
- `DELETE /api/follow-ups/<id>` - Delete follow-up

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

## Docker Commands

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Restart a service
docker-compose restart backend

# View running containers
docker-compose ps
```

## Project Structure

```
library_app/
├── backend/              # Flask backend
│   ├── app.py           # Main Flask application
│   ├── requirements.txt # Python dependencies
│   ├── Dockerfile       # Backend container
│   └── gunicorn_config.py
├── frontend/            # React frontend
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable components
│   │   ├── App.jsx     # Main app component
│   │   ├── api.js      # API client
│   │   └── main.jsx    # Entry point
│   ├── Dockerfile      # Frontend container
│   ├── nginx.conf      # Nginx config
│   └── package.json
├── database/           # Database setup
│   ├── sql_init.sql   # Database schema
│   └── docker-compose.yml
├── docker-compose.yml  # Main orchestration
├── .env               # Environment variables
└── README.md          # This file
```

## Pages & Navigation

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview with statistics and quick actions |
| Register Books | `/books/register` | Register new books and add copies |
| Book Search | `/books/search` | Search books, view copies, add to wishlist |
| Checkout Books | `/checkout` | Check out books to borrowers |
| Checked Out | `/checked-out` | View all checked out books |
| Check In | `/check-in` | Return books to inventory |
| Checkout History | `/history` | View complete checkout history |
| Users | `/users` | Manage borrowers |
| Wishlist | `/wishlist` | Requested books not in library |
| Follow Ups | `/follow-ups` | Checkouts requiring follow-up |

## Authentication (Optional)

The application supports Azure AD authentication via MSAL. To enable:

1. Register app in Azure Portal
2. Configure `.env` with Azure credentials
3. Update `frontend/.env` with Azure settings
4. Set required security group ID

Users without Azure AD setup can use the simple email-based auth (X-User-Email header).

## Troubleshooting

### Database Connection Issues
```bash
# Check if database is running
docker ps | grep postgres_library_app

# View database logs
docker logs postgres_library_app
```

### Backend Issues
```bash
# Check backend logs
docker logs library_app_backend

# Test health endpoint
curl http://localhost:5002/api/health
```

### Frontend Issues
```bash
# Check frontend logs
docker logs library_app_frontend

# Rebuild frontend
docker-compose build frontend --no-cache
```

## Contributing

1. Follow existing code patterns
2. Test changes locally before committing
3. Update README if adding features
4. Use proper git commit messages

## License

MIT License - feel free to use and modify for your needs.

## Support

For issues or questions:
1. Check the README
2. Review Docker logs
3. Test API endpoints with curl
4. Check database connectivity

---

Built with ❤️ for libraries everywhere
