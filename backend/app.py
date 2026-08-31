from flask import Flask, request, jsonify, g
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from functools import wraps
import psycopg2
import psycopg2.errors
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import logging
from datetime import datetime, timedelta
from decimal import Decimal
import random
import string
import re
import time

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('ZOELIBRARYAPP_SECRET_KEY', 'dev-secret-key')

# Flask's default JSON provider can't serialize Decimal (returned by psycopg2
# for NUMERIC columns like fines.amount) — teach it to encode as float.
class DecimalSafeJSONProvider(DefaultJSONProvider):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

app.json = DecimalSafeJSONProvider(app)

# CORS Configuration
CORS(app, resources={
    r"/api/*": {
        "origins": [
            f"http://localhost:{os.getenv('ZOELIBRARYAPP_FRONTEND_PORT', '3002')}",
            "http://localhost:3000",  # Development
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-User-Email"]
    }
})

# =============================================================================
# DATABASE CONNECTION
# =============================================================================

def get_db_connection():
    """Create and return a database connection with RealDictCursor."""
    return psycopg2.connect(
        host=os.getenv('ZOELIBRARYAPP_DB_HOST'),
        port=os.getenv('ZOELIBRARYAPP_DB_PORT'),
        database=os.getenv('ZOELIBRARYAPP_DB_NAME'),
        user=os.getenv('ZOELIBRARYAPP_DB_USER'),
        password=os.getenv('ZOELIBRARYAPP_DB_PASSWORD'),
        cursor_factory=RealDictCursor
    )

# =============================================================================
# STARTUP MIGRATIONS
# =============================================================================
# sql_init.sql only runs on a brand-new, empty Postgres volume. This runs the
# same (idempotent) schema additions against an already-populated database on
# every backend startup, so new features ship without manual DB intervention
# or any risk to existing data. Safe to run repeatedly — every statement is
# CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING.
MIGRATION_LOCK_ID = 918273645

def run_migrations():
    migration_path = os.path.join(os.path.dirname(__file__), 'migrations.sql')
    with open(migration_path, 'r') as f:
        migration_sql = f.read()

    max_attempts = 10
    for attempt in range(1, max_attempts + 1):
        try:
            conn = get_db_connection()
            conn.autocommit = False
            cur = conn.cursor()
            # Advisory lock serializes migrations across gunicorn worker
            # processes, which each import this module independently on boot.
            cur.execute('SELECT pg_advisory_lock(%s)', (MIGRATION_LOCK_ID,))
            cur.execute(migration_sql)
            conn.commit()
            cur.execute('SELECT pg_advisory_unlock(%s)', (MIGRATION_LOCK_ID,))
            cur.close()
            conn.close()
            logger.info("Database migrations applied successfully")
            return
        except Exception as e:
            logger.warning(f"Migration attempt {attempt}/{max_attempts} failed: {str(e)}")
            time.sleep(2)

    raise RuntimeError("Could not apply database migrations after retries")

run_migrations()

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def sanitize_input(value, field_type='str'):
    """
    Sanitize input values to handle empty strings for numeric fields.
    Convert empty strings to None for integer and decimal fields.
    """
    if value == '' or value is None:
        return None

    if field_type == 'int':
        try:
            return int(value) if value else None
        except (ValueError, TypeError):
            return None
    elif field_type == 'float' or field_type == 'decimal':
        try:
            return float(value) if value else None
        except (ValueError, TypeError):
            return None

    return value

def generate_borrower_id(first_name, conn):
    """
    Generate unique borrower_id in format: XXX#####
    - XXX: First 3 uppercase letters from first_name (pad with X if needed)
    - #####: 5 random uppercase alphanumeric characters

    Args:
        first_name (str): Borrower's first name
        conn: Database connection to check uniqueness

    Returns:
        str: Unique 8-character borrower_id

    Raises:
        Exception: If unable to generate unique ID after 100 attempts
    """
    # Extract letters only from first name
    letters_only = re.sub(r'[^A-Za-z]', '', first_name)

    # Get first 3 characters (uppercase), pad with X if needed
    prefix = letters_only[:3].upper() if letters_only else ''
    prefix = prefix.ljust(3, 'X')

    # Generate random 5-character alphanumeric suffix
    max_attempts = 100
    for attempt in range(max_attempts):
        random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
        borrower_id = prefix + random_part

        # Check uniqueness
        cur = conn.cursor()
        cur.execute('SELECT id FROM borrowers WHERE borrower_id = %s', (borrower_id,))
        exists = cur.fetchone()
        cur.close()

        if not exists:
            return borrower_id

    raise Exception(f'Unable to generate unique borrower_id after {max_attempts} attempts for name: {first_name}')

def get_settings_dict(cur):
    """Fetch all settings as a {key: value} dict (raw string values)."""
    cur.execute('SELECT key, value FROM settings')
    return {row['key']: row['value'] for row in cur.fetchall()}

def get_late_fee_rate(cur):
    """Current late fee rate (Rands/day) as a Decimal."""
    cur.execute("SELECT value FROM settings WHERE key = 'late_fee_per_day'")
    row = cur.fetchone()
    return Decimal(row['value']) if row else Decimal('0.00')

def sync_overdue_fines(cur, user_id):
    """
    Create/refresh a fines row for every checkout that is currently overdue
    and still checked out. Recalculates days_overdue/amount using the current
    late fee rate on every call (lazy, on-read recalculation — no background
    job). Never touches a fine that has already been marked Paid.
    """
    rate = get_late_fee_rate(cur)
    cur.execute('''
        INSERT INTO fines (checkout_id, user_id, days_overdue, rate_applied, amount, status)
        SELECT co.id, %s, (CURRENT_DATE - co.due_date),
               %s, (CURRENT_DATE - co.due_date) * %s, 'Unpaid'
        FROM checkouts co
        WHERE co.status = 'Checked Out' AND co.due_date < CURRENT_DATE
        ON CONFLICT (checkout_id) DO UPDATE
          SET days_overdue = EXCLUDED.days_overdue,
              rate_applied = EXCLUDED.rate_applied,
              amount = EXCLUDED.amount
          WHERE fines.status = 'Unpaid'
    ''', (str(user_id), rate, rate))

# =============================================================================
# AUTHENTICATION DECORATORS
# =============================================================================

def token_required(f):
    """
    Simple authentication decorator using X-User-Email header.
    Creates user if not exists. Sets g.user_id and g.user_email.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        email = request.headers.get('X-User-Email')

        if not email:
            return jsonify({'error': 'Authentication required'}), 401

        try:
            conn = get_db_connection()
            cur = conn.cursor()

            # Get or create user
            cur.execute('SELECT id, email FROM users WHERE email = %s', (email,))
            user = cur.fetchone()

            if not user:
                cur.execute(
                    'INSERT INTO users (email, username) VALUES (%s, %s) RETURNING id, email',
                    (email, email.split('@')[0])
                )
                user = cur.fetchone()
                conn.commit()

            g.user_id = user['id']
            g.user_email = user['email']

            cur.close()
            conn.close()

            return f(*args, **kwargs)

        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return jsonify({'error': 'Authentication failed'}), 401

    return decorated

# =============================================================================
# HEALTH CHECK ENDPOINT
# =============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for container orchestration."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

# =============================================================================
# PUBLIC ENDPOINTS (no authentication required)
# =============================================================================

@app.route('/api/public/books', methods=['GET'])
def get_public_books():
    """Public endpoint: returns safe book fields for visitor browsing only."""
    try:
        search = request.args.get('search', '').strip()
        conn = get_db_connection()
        cur = conn.cursor()

        if search:
            cur.execute('''
                SELECT DISTINCT ON (LOWER(b.title), b.author)
                       b.title, b.author, b.isbn, b.publication_year,
                       b.publisher, b.cover_medium
                FROM books b
                WHERE LOWER(b.title) LIKE LOWER(%s)
                   OR LOWER(b.author) LIKE LOWER(%s)
                   OR LOWER(b.isbn) LIKE LOWER(%s)
                ORDER BY LOWER(b.title), b.author ASC
            ''', (f'%{search}%', f'%{search}%', f'%{search}%'))
        else:
            cur.execute('''
                SELECT DISTINCT ON (LOWER(b.title), b.author)
                       b.title, b.author, b.isbn, b.publication_year,
                       b.publisher, b.cover_medium
                FROM books b
                ORDER BY LOWER(b.title), b.author ASC
            ''')

        books = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(books)

    except Exception as e:
        logger.error(f"Error fetching public books: {str(e)}")
        return jsonify({'error': 'Failed to fetch books'}), 500

# =============================================================================
# USER ENDPOINTS
# =============================================================================

@app.route('/api/user', methods=['GET'])
@token_required
def get_current_user():
    """Get current authenticated user information."""
    return jsonify({
        'id': str(g.user_id),
        'email': g.user_email
    })

# =============================================================================
# BOOKS ENDPOINTS
# =============================================================================

@app.route('/api/books', methods=['GET'])
@token_required
def get_books():
    """Get all books in the library."""
    try:
        search = request.args.get('search', '').strip()
        conn = get_db_connection()
        cur = conn.cursor()

        if search:
            cur.execute('''
                SELECT b.*,
                       COUNT(DISTINCT bc.id) as total_copies,
                       COUNT(DISTINCT CASE WHEN bc.status = 'Available' THEN bc.id END) as available_copies
                FROM books b
                LEFT JOIN book_copies bc ON b.id = bc.book_id
                WHERE (LOWER(b.title) LIKE LOWER(%s)
                       OR LOWER(b.author) LIKE LOWER(%s)
                       OR LOWER(b.isbn) LIKE LOWER(%s)
                       OR LOWER(b.barcode) LIKE LOWER(%s))
                GROUP BY b.id
                ORDER BY b.title ASC
            ''', (f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%'))
        else:
            cur.execute('''
                SELECT b.*,
                       COUNT(DISTINCT bc.id) as total_copies,
                       COUNT(DISTINCT CASE WHEN bc.status = 'Available' THEN bc.id END) as available_copies
                FROM books b
                LEFT JOIN book_copies bc ON b.id = bc.book_id
                GROUP BY b.id
                ORDER BY b.title ASC
            ''')

        books = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(books)

    except Exception as e:
        logger.error(f"Error fetching books: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/books/<book_id>', methods=['GET'])
@token_required
def get_book(book_id):
    """Get a specific book by ID with copy information."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            SELECT b.*,
                   COUNT(DISTINCT bc.id) as total_copies,
                   COUNT(DISTINCT CASE WHEN bc.status = 'Available' THEN bc.id END) as available_copies
            FROM books b
            LEFT JOIN book_copies bc ON b.id = bc.book_id
            WHERE b.id = %s
            GROUP BY b.id
        ''', (book_id,))

        book = cur.fetchone()
        cur.close()
        conn.close()

        if not book:
            return jsonify({'error': 'Book not found'}), 404

        return jsonify(book)

    except Exception as e:
        logger.error(f"Error fetching book: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/books', methods=['POST'])
@token_required
def create_book():
    """Create a new book."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            INSERT INTO books (user_id, title, author, isbn, barcode, publisher, publication_year,
                             genre, description, language, pages, cover_small, cover_medium,
                             cover_large, subjects, openlibrary_key, openlibrary_url, excerpt,
                             dewey_decimal, lc_classification)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        ''', (
            str(g.user_id),
            data.get('title'),
            data.get('author'),
            sanitize_input(data.get('isbn')),
            sanitize_input(data.get('barcode')),
            sanitize_input(data.get('publisher')),
            sanitize_input(data.get('publication_year'), 'int'),
            sanitize_input(data.get('genre')),
            sanitize_input(data.get('description')),
            data.get('language', 'English'),
            sanitize_input(data.get('pages'), 'int'),
            sanitize_input(data.get('cover_small')),
            sanitize_input(data.get('cover_medium')),
            sanitize_input(data.get('cover_large')),
            sanitize_input(data.get('subjects')),
            sanitize_input(data.get('openlibrary_key')),
            sanitize_input(data.get('openlibrary_url')),
            sanitize_input(data.get('excerpt')),
            sanitize_input(data.get('dewey_decimal')),
            sanitize_input(data.get('lc_classification'))
        ))

        book = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify(book), 201

    except Exception as e:
        logger.error(f"Error creating book: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/books/<book_id>', methods=['PUT'])
@token_required
def update_book(book_id):
    """Update an existing book."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            UPDATE books
            SET title = %s, author = %s, isbn = %s, barcode = %s, publisher = %s,
                publication_year = %s, genre = %s, description = %s,
                language = %s, pages = %s, cover_small = %s, cover_medium = %s,
                cover_large = %s, subjects = %s, openlibrary_key = %s,
                openlibrary_url = %s, excerpt = %s, dewey_decimal = %s,
                lc_classification = %s
            WHERE id = %s
            RETURNING *
        ''', (
            data.get('title'),
            data.get('author'),
            sanitize_input(data.get('isbn')),
            sanitize_input(data.get('barcode')),
            sanitize_input(data.get('publisher')),
            sanitize_input(data.get('publication_year'), 'int'),
            sanitize_input(data.get('genre')),
            sanitize_input(data.get('description')),
            data.get('language'),
            sanitize_input(data.get('pages'), 'int'),
            sanitize_input(data.get('cover_small')),
            sanitize_input(data.get('cover_medium')),
            sanitize_input(data.get('cover_large')),
            sanitize_input(data.get('subjects')),
            sanitize_input(data.get('openlibrary_key')),
            sanitize_input(data.get('openlibrary_url')),
            sanitize_input(data.get('excerpt')),
            sanitize_input(data.get('dewey_decimal')),
            sanitize_input(data.get('lc_classification')),
            book_id
        ))

        book = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not book:
            return jsonify({'error': 'Book not found'}), 404

        return jsonify(book)

    except Exception as e:
        logger.error(f"Error updating book: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/books/<book_id>', methods=['DELETE'])
@token_required
def delete_book(book_id):
    """Delete a book (cascades to copies and checkouts)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            DELETE FROM books
            WHERE id = %s
            RETURNING id
        ''', (book_id,))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Book not found'}), 404

        return jsonify({'message': 'Book deleted successfully'})

    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': 'Cannot delete — this book has fine history that must be preserved for audit purposes.'}), 400
    except Exception as e:
        logger.error(f"Error deleting book: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/books/by-barcode/<barcode>', methods=['GET'])
@token_required
def get_book_by_barcode(barcode):
    """Get book by barcode or ISBN with copy availability information."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Search by barcode OR ISBN (since ISBNs can be scanned as barcodes)
        cur.execute('''
            SELECT b.*,
                   COUNT(DISTINCT bc.id) as total_copies,
                   COUNT(DISTINCT CASE WHEN bc.status = 'Available'
                         THEN bc.id END) as available_copies,
                   json_agg(
                       json_build_object(
                           'id', bc.id,
                           'copy_number', bc.copy_number,
                           'status', bc.status,
                           'condition', bc.condition,
                           'location', bc.location
                       ) ORDER BY bc.copy_number
                   ) FILTER (WHERE bc.id IS NOT NULL) as copies
            FROM books b
            LEFT JOIN book_copies bc ON b.id = bc.book_id
            WHERE (b.barcode = %s OR b.isbn = %s)
            GROUP BY b.id
        ''', (barcode, barcode))

        book = cur.fetchone()
        cur.close()
        conn.close()

        if not book:
            return jsonify({'error': 'Book not found'}), 404

        return jsonify(book)

    except Exception as e:
        logger.error(f"Error fetching book by barcode: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# BOOK COPIES ENDPOINTS
# =============================================================================

@app.route('/api/books/<book_id>/copies', methods=['GET'])
@token_required
def get_book_copies(book_id):
    """Get all copies of a specific book."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            SELECT bc.*, b.title, b.author,
                   CASE
                       WHEN co.id IS NOT NULL AND co.status = 'Checked Out'
                       THEN json_build_object(
                           'id', co.id,
                           'borrower_name', br.first_name,
                           'borrower_id', br.borrower_id,
                           'checkout_date', co.checkout_date,
                           'due_date', co.due_date
                       )
                       ELSE NULL
                   END as checkout_info
            FROM book_copies bc
            JOIN books b ON bc.book_id = b.id
            LEFT JOIN checkouts co ON bc.id = co.copy_id AND co.status = 'Checked Out'
            LEFT JOIN borrowers br ON co.borrower_id = br.id
            WHERE bc.book_id = %s
            ORDER BY bc.copy_number ASC
        ''', (book_id,))

        copies = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(copies)

    except Exception as e:
        logger.error(f"Error fetching book copies: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/book-copies', methods=['POST'])
@token_required
def create_book_copy():
    """Create a new book copy."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        # Get next copy number
        cur.execute('''
            SELECT COALESCE(MAX(copy_number), 0) + 1 as next_number
            FROM book_copies
            WHERE book_id = %s
        ''', (data.get('book_id'),))

        next_number = cur.fetchone()['next_number']

        cur.execute('''
            INSERT INTO book_copies (book_id, user_id, copy_number, condition, location, status, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        ''', (
            data.get('book_id'),
            str(g.user_id),
            next_number,
            data.get('condition', 'Good'),
            data.get('location'),
            data.get('status', 'Available'),
            data.get('notes')
        ))

        copy = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify(copy), 201

    except Exception as e:
        logger.error(f"Error creating book copy: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/book-copies/<copy_id>', methods=['PUT'])
@token_required
def update_book_copy(copy_id):
    """Update a book copy."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            UPDATE book_copies
            SET condition = %s, location = %s, status = %s, notes = %s
            WHERE id = %s
            RETURNING *
        ''', (
            data.get('condition'),
            data.get('location'),
            data.get('status'),
            data.get('notes'),
            copy_id
        ))

        copy = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not copy:
            return jsonify({'error': 'Book copy not found'}), 404

        return jsonify(copy)

    except Exception as e:
        logger.error(f"Error updating book copy: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/book-copies/<copy_id>', methods=['DELETE'])
@token_required
def delete_book_copy(copy_id):
    """Delete a book copy."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Check if copy is currently checked out
        cur.execute('''
            SELECT id FROM checkouts
            WHERE copy_id = %s AND status = 'Checked Out'
        ''', (copy_id,))

        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'Cannot delete a copy that is currently checked out'}), 400

        cur.execute('''
            DELETE FROM book_copies
            WHERE id = %s
            RETURNING id
        ''', (copy_id,))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Book copy not found'}), 404

        return jsonify({'message': 'Book copy deleted successfully'})

    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': 'Cannot delete — this copy has fine history that must be preserved for audit purposes.'}), 400
    except Exception as e:
        logger.error(f"Error deleting book copy: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# BORROWERS ENDPOINTS
# =============================================================================

@app.route('/api/borrowers', methods=['GET'])
@token_required
def get_borrowers():
    """Get all borrowers with optional search."""
    try:
        search = request.args.get('search', '').strip()
        conn = get_db_connection()
        cur = conn.cursor()

        if search:
            cur.execute('''
                SELECT b.*,
                       COUNT(DISTINCT CASE WHEN co.status = 'Checked Out' THEN co.id END) as active_checkouts
                FROM borrowers b
                LEFT JOIN checkouts co ON b.id = co.borrower_id
                WHERE (LOWER(b.first_name) LIKE LOWER(%s)
                       OR LOWER(b.borrower_id) LIKE LOWER(%s))
                GROUP BY b.id
                ORDER BY b.borrower_id ASC
            ''', (f'%{search}%', f'%{search}%'))
        else:
            cur.execute('''
                SELECT b.*,
                       COUNT(DISTINCT CASE WHEN co.status = 'Checked Out' THEN co.id END) as active_checkouts
                FROM borrowers b
                LEFT JOIN checkouts co ON b.id = co.borrower_id
                GROUP BY b.id
                ORDER BY b.borrower_id ASC
            ''')

        borrowers = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(borrowers)

    except Exception as e:
        logger.error(f"Error fetching borrowers: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/borrowers/autocomplete', methods=['GET'])
@token_required
def autocomplete_borrowers():
    """Autocomplete borrowers by name for quick selection."""
    try:
        query = request.args.get('q', '').strip()
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            SELECT id, first_name, borrower_id
            FROM borrowers
            WHERE (LOWER(first_name) LIKE LOWER(%s) OR LOWER(borrower_id) LIKE LOWER(%s))
            ORDER BY borrower_id ASC
            LIMIT 10
        ''', (f'%{query}%', f'%{query}%'))

        borrowers = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(borrowers)

    except Exception as e:
        logger.error(f"Error autocompleting borrowers: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/borrowers/<borrower_id>', methods=['GET'])
@token_required
def get_borrower(borrower_id):
    """Get a specific borrower."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            SELECT b.*,
                   COUNT(DISTINCT CASE WHEN co.status = 'Checked Out' THEN co.id END) as active_checkouts,
                   COUNT(DISTINCT CASE WHEN co.status = 'Returned' THEN co.id END) as total_checkouts
            FROM borrowers b
            LEFT JOIN checkouts co ON b.id = co.borrower_id
            WHERE b.id = %s
            GROUP BY b.id
        ''', (borrower_id,))

        borrower = cur.fetchone()
        cur.close()
        conn.close()

        if not borrower:
            return jsonify({'error': 'Borrower not found'}), 404

        return jsonify(borrower)

    except Exception as e:
        logger.error(f"Error fetching borrower: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/borrowers', methods=['POST'])
@token_required
def create_borrower():
    """Create a new borrower."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        # Generate unique borrower_id
        borrower_id = generate_borrower_id(data.get('first_name', ''), conn)

        cur.execute('''
            INSERT INTO borrowers (user_id, first_name, borrower_id)
            VALUES (%s, %s, %s)
            RETURNING *
        ''', (
            str(g.user_id),
            data.get('first_name'),
            borrower_id
        ))

        borrower = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify(borrower), 201

    except Exception as e:
        logger.error(f"Error creating borrower: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/borrowers/<borrower_id>', methods=['PUT'])
@token_required
def update_borrower(borrower_id):
    """Update a borrower. Note: borrower_id remains immutable for stability."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            UPDATE borrowers
            SET first_name = %s
            WHERE id = %s
            RETURNING *
        ''', (
            data.get('first_name'),
            borrower_id
        ))

        borrower = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not borrower:
            return jsonify({'error': 'Borrower not found'}), 404

        return jsonify(borrower)

    except Exception as e:
        logger.error(f"Error updating borrower: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/borrowers/<borrower_id>', methods=['DELETE'])
@token_required
def delete_borrower(borrower_id):
    """Delete a borrower."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Check for active checkouts
        cur.execute('''
            SELECT id FROM checkouts
            WHERE borrower_id = %s AND status = 'Checked Out'
        ''', (borrower_id,))

        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'Cannot delete borrower with active checkouts'}), 400

        cur.execute('''
            DELETE FROM borrowers
            WHERE id = %s
            RETURNING id
        ''', (borrower_id,))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Borrower not found'}), 404

        return jsonify({'message': 'Borrower deleted successfully'})

    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': 'Cannot delete — this borrower has fine history that must be preserved for audit purposes.'}), 400
    except Exception as e:
        logger.error(f"Error deleting borrower: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# CHECKOUTS ENDPOINTS
# =============================================================================

@app.route('/api/checkouts', methods=['GET'])
@token_required
def get_checkouts():
    """Get all active checkouts."""
    try:
        search = request.args.get('search', '').strip()
        conn = get_db_connection()
        cur = conn.cursor()

        if search:
            cur.execute('''
                SELECT co.*,
                       b.title, b.author, b.isbn, b.barcode,
                       b.cover_medium, b.cover_large,
                       bc.copy_number, bc.condition, bc.location, bc.notes as copy_notes,
                       br.first_name, br.borrower_id,
                       EXTRACT(DAY FROM (CURRENT_TIMESTAMP - co.checkout_date)) as days_checked_out
                FROM checkouts co
                JOIN book_copies bc ON co.copy_id = bc.id
                JOIN books b ON bc.book_id = b.id
                JOIN borrowers br ON co.borrower_id = br.id
                WHERE co.status = 'Checked Out'
                  AND (LOWER(b.title) LIKE LOWER(%s)
                       OR LOWER(br.first_name) LIKE LOWER(%s)
                       OR LOWER(br.borrower_id) LIKE LOWER(%s)
                       OR b.barcode LIKE %s)
                ORDER BY co.checkout_date ASC
            ''', (f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%'))
        else:
            cur.execute('''
                SELECT co.*,
                       b.title, b.author, b.isbn, b.barcode,
                       b.cover_medium, b.cover_large,
                       bc.copy_number, bc.condition, bc.location, bc.notes as copy_notes,
                       br.first_name, br.borrower_id,
                       EXTRACT(DAY FROM (CURRENT_TIMESTAMP - co.checkout_date)) as days_checked_out
                FROM checkouts co
                JOIN book_copies bc ON co.copy_id = bc.id
                JOIN books b ON bc.book_id = b.id
                JOIN borrowers br ON co.borrower_id = br.id
                WHERE co.status = 'Checked Out'
                ORDER BY co.checkout_date ASC
            ''')

        checkouts = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(checkouts)

    except Exception as e:
        logger.error(f"Error fetching checkouts: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/checkouts', methods=['POST'])
@token_required
def create_checkout():
    """Create a new checkout."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        # Verify copy is available
        cur.execute('''
            SELECT status FROM book_copies
            WHERE id = %s
        ''', (data.get('copy_id'),))

        copy = cur.fetchone()
        if not copy:
            cur.close()
            conn.close()
            return jsonify({'error': 'Book copy not found'}), 404

        if copy['status'] != 'Available':
            cur.close()
            conn.close()
            return jsonify({'error': 'Book copy is not available'}), 400

        # Calculate due date (default 14 days)
        due_days = sanitize_input(data.get('due_days', 14), 'int') or 14
        due_date = datetime.now() + timedelta(days=due_days)

        # Create checkout
        cur.execute('''
            INSERT INTO checkouts (copy_id, borrower_id, user_id, due_date, notes)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
        ''', (
            data.get('copy_id'),
            data.get('borrower_id'),
            str(g.user_id),
            due_date.date(),
            data.get('notes')
        ))

        checkout = cur.fetchone()

        # Update copy status
        cur.execute('''
            UPDATE book_copies
            SET status = 'Checked Out'
            WHERE id = %s
        ''', (data.get('copy_id'),))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify(checkout), 201

    except Exception as e:
        logger.error(f"Error creating checkout: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/checkouts/<checkout_id>/return', methods=['PUT'])
@token_required
def return_checkout(checkout_id):
    """Mark a checkout as returned."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Get checkout info
        cur.execute('''
            SELECT copy_id, due_date FROM checkouts
            WHERE id = %s AND status = 'Checked Out'
        ''', (checkout_id,))

        checkout = cur.fetchone()
        if not checkout:
            cur.close()
            conn.close()
            return jsonify({'error': 'Active checkout not found'}), 404

        # Update checkout
        cur.execute('''
            UPDATE checkouts
            SET status = 'Returned', return_date = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *
        ''', (checkout_id,))

        updated = cur.fetchone()

        # Update copy status
        cur.execute('''
            UPDATE book_copies
            SET status = 'Available'
            WHERE id = %s
        ''', (checkout['copy_id'],))

        # If returned late, finalize the fine for this checkout (frozen from
        # here on, since sync_overdue_fines only ever touches 'Checked Out'
        # checkouts). Guarded so an already-Paid fine is never overwritten.
        finalized_fine = None
        due_date = checkout.get('due_date')
        if due_date:
            days_overdue = (updated['return_date'].date() - due_date).days
            if days_overdue > 0:
                rate = get_late_fee_rate(cur)
                amount = Decimal(days_overdue) * rate
                cur.execute('''
                    INSERT INTO fines (checkout_id, user_id, days_overdue, rate_applied, amount, status)
                    VALUES (%s, %s, %s, %s, %s, 'Unpaid')
                    ON CONFLICT (checkout_id) DO UPDATE
                      SET days_overdue = EXCLUDED.days_overdue,
                          rate_applied = EXCLUDED.rate_applied,
                          amount = EXCLUDED.amount
                      WHERE fines.status = 'Unpaid'
                    RETURNING *
                ''', (checkout_id, str(g.user_id), days_overdue, rate, amount))
                finalized_fine = cur.fetchone()
                if not finalized_fine:
                    # Conflict existed but fine was already Paid — report its
                    # current (unchanged) state instead of silently dropping it.
                    cur.execute('SELECT * FROM fines WHERE checkout_id = %s', (checkout_id,))
                    finalized_fine = cur.fetchone()

        # Auto-resolve any linked follow-up still in progress, preserving it
        # as history rather than deleting it (full audit trail requirement).
        cur.execute('''
            UPDATE follow_ups
            SET status = 'Resolved',
                resolution_notes = COALESCE(resolution_notes || ' ', '') || '[Auto-resolved: book returned]'
            WHERE checkout_id = %s AND status IN ('Pending', 'Contacted', 'Escalated')
        ''', (checkout_id,))

        conn.commit()
        cur.close()
        conn.close()

        result = dict(updated)
        if finalized_fine:
            result['fine'] = finalized_fine

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error returning checkout: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/checkouts/<checkout_id>', methods=['DELETE'])
@token_required
def delete_checkout(checkout_id):
    """Delete a checkout record."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            DELETE FROM checkouts
            WHERE id = %s
            RETURNING id
        ''', (checkout_id,))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Checkout not found'}), 404

        return jsonify({'message': 'Checkout deleted successfully'})

    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': 'Cannot delete — this checkout has fine history that must be preserved for audit purposes.'}), 400
    except Exception as e:
        logger.error(f"Error deleting checkout: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# CHECKOUT HISTORY ENDPOINTS
# =============================================================================

@app.route('/api/checkout-history', methods=['GET'])
@token_required
def get_checkout_history():
    """Get checkout history with optional filters."""
    try:
        book_id = request.args.get('book_id')
        borrower_id = request.args.get('borrower_id')
        search = request.args.get('search', '').strip()

        conn = get_db_connection()
        cur = conn.cursor()

        query = '''
            SELECT co.*,
                   b.title, b.author, b.isbn,
                   bc.copy_number,
                   br.first_name, br.borrower_id,
                   EXTRACT(DAY FROM (COALESCE(co.return_date, CURRENT_TIMESTAMP) - co.checkout_date)) as duration_days
            FROM checkouts co
            JOIN book_copies bc ON co.copy_id = bc.id
            JOIN books b ON bc.book_id = b.id
            JOIN borrowers br ON co.borrower_id = br.id
            WHERE 1=1
        '''

        params = []

        if book_id:
            query += ' AND b.id = %s'
            params.append(book_id)

        if borrower_id:
            query += ' AND br.id = %s'
            params.append(borrower_id)

        if search:
            query += ''' AND (LOWER(b.title) LIKE LOWER(%s)
                           OR LOWER(b.author) LIKE LOWER(%s)
                           OR LOWER(br.first_name) LIKE LOWER(%s)
                           OR LOWER(br.borrower_id) LIKE LOWER(%s))'''
            search_param = f'%{search}%'
            params.extend([search_param, search_param, search_param, search_param])

        query += ' ORDER BY co.checkout_date DESC'

        cur.execute(query, params)
        history = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(history)

    except Exception as e:
        logger.error(f"Error fetching checkout history: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# WISHLIST ENDPOINTS
# =============================================================================

@app.route('/api/wishlist', methods=['GET'])
@token_required
def get_wishlist():
    """Get all wishlist items."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            SELECT * FROM book_wishlist
            ORDER BY
                CASE priority
                    WHEN 'High' THEN 1
                    WHEN 'Medium' THEN 2
                    WHEN 'Low' THEN 3
                END,
                created_at DESC
        ''')

        wishlist = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(wishlist)

    except Exception as e:
        logger.error(f"Error fetching wishlist: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/wishlist', methods=['POST'])
@token_required
def create_wishlist_item():
    """Add item to wishlist."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            INSERT INTO book_wishlist (user_id, title, author, isbn, requested_by, request_notes, priority)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        ''', (
            str(g.user_id),
            data.get('title'),
            data.get('author'),
            data.get('isbn'),
            data.get('requested_by'),
            data.get('request_notes'),
            data.get('priority', 'Medium')
        ))

        item = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify(item), 201

    except Exception as e:
        logger.error(f"Error creating wishlist item: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/wishlist/<item_id>', methods=['PUT'])
@token_required
def update_wishlist_item(item_id):
    """Update wishlist item."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            UPDATE book_wishlist
            SET title = %s, author = %s, isbn = %s, requested_by = %s,
                request_notes = %s, priority = %s, status = %s
            WHERE id = %s
            RETURNING *
        ''', (
            data.get('title'),
            data.get('author'),
            data.get('isbn'),
            data.get('requested_by'),
            data.get('request_notes'),
            data.get('priority'),
            data.get('status'),
            item_id
        ))

        item = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not item:
            return jsonify({'error': 'Wishlist item not found'}), 404

        return jsonify(item)

    except Exception as e:
        logger.error(f"Error updating wishlist item: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/wishlist/<item_id>', methods=['DELETE'])
@token_required
def delete_wishlist_item(item_id):
    """Delete wishlist item."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            DELETE FROM book_wishlist
            WHERE id = %s
            RETURNING id
        ''', (item_id,))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Wishlist item not found'}), 404

        return jsonify({'message': 'Wishlist item deleted successfully'})

    except Exception as e:
        logger.error(f"Error deleting wishlist item: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# FOLLOW UPS ENDPOINTS
# =============================================================================

@app.route('/api/follow-ups', methods=['GET'])
@token_required
def get_follow_ups():
    """Get follow-ups ordered by checkout date (oldest first).

    ?view=active (default) - status not yet Resolved
    ?view=history           - status = Resolved
    """
    try:
        view = request.args.get('view', 'active')
        conn = get_db_connection()
        cur = conn.cursor()

        status_clause = "fu.status = 'Resolved'" if view == 'history' else "fu.status != 'Resolved'"

        cur.execute(f'''
            SELECT fu.*,
                   co.checkout_date, co.due_date,
                   b.title, b.author,
                   bc.copy_number,
                   br.first_name, br.borrower_id,
                   EXTRACT(DAY FROM (CURRENT_TIMESTAMP - co.checkout_date)) as days_checked_out
            FROM follow_ups fu
            JOIN checkouts co ON fu.checkout_id = co.id
            JOIN book_copies bc ON co.copy_id = bc.id
            JOIN books b ON bc.book_id = b.id
            JOIN borrowers br ON co.borrower_id = br.id
            WHERE {status_clause}
            ORDER BY co.checkout_date ASC, fu.status ASC
        ''')

        follow_ups = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(follow_ups)

    except Exception as e:
        logger.error(f"Error fetching follow-ups: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/follow-ups', methods=['POST'])
@token_required
def create_follow_up():
    """Create a follow-up for a checkout."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        # Check if follow-up already exists
        cur.execute('''
            SELECT id FROM follow_ups
            WHERE checkout_id = %s
        ''', (data.get('checkout_id'),))

        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'Follow-up already exists for this checkout'}), 400

        cur.execute('''
            INSERT INTO follow_ups (checkout_id, user_id, reason)
            VALUES (%s, %s, %s)
            RETURNING *
        ''', (
            data.get('checkout_id'),
            str(g.user_id),
            data.get('reason')
        ))

        follow_up = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify(follow_up), 201

    except Exception as e:
        logger.error(f"Error creating follow-up: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/follow-ups/<follow_up_id>', methods=['PUT'])
@token_required
def update_follow_up(follow_up_id):
    """Update a follow-up."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            UPDATE follow_ups
            SET status = %s, contacted_date = %s, resolution_notes = %s
            WHERE id = %s
            RETURNING *
        ''', (
            data.get('status'),
            data.get('contacted_date'),
            data.get('resolution_notes'),
            follow_up_id
        ))

        follow_up = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not follow_up:
            return jsonify({'error': 'Follow-up not found'}), 404

        return jsonify(follow_up)

    except Exception as e:
        logger.error(f"Error updating follow-up: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/follow-ups/<follow_up_id>', methods=['DELETE'])
@token_required
def delete_follow_up(follow_up_id):
    """Delete a follow-up."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            DELETE FROM follow_ups
            WHERE id = %s
            RETURNING id
        ''', (follow_up_id,))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Follow-up not found'}), 404

        return jsonify({'message': 'Follow-up deleted successfully'})

    except Exception as e:
        logger.error(f"Error deleting follow-up: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# SETTINGS ENDPOINTS
# =============================================================================

@app.route('/api/settings', methods=['GET'])
@token_required
def get_settings():
    """Get all app settings (late fee rate, default lending period, etc.)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        raw = get_settings_dict(cur)
        cur.close()
        conn.close()

        return jsonify({
            'late_fee_per_day': float(raw.get('late_fee_per_day', '0.00')),
            'default_lending_days': int(raw.get('default_lending_days', '14'))
        })

    except Exception as e:
        logger.error(f"Error fetching settings: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings', methods=['PUT'])
@token_required
def update_settings():
    """Update one or more app settings. Body may include late_fee_per_day and/or default_lending_days."""
    try:
        data = request.json or {}
        conn = get_db_connection()
        cur = conn.cursor()

        if 'late_fee_per_day' in data:
            rate = sanitize_input(data.get('late_fee_per_day'), 'decimal')
            if rate is None or rate < 0:
                cur.close()
                conn.close()
                return jsonify({'error': 'late_fee_per_day must be a number >= 0'}), 400
            cur.execute('''
                INSERT INTO settings (key, value, updated_by)
                VALUES ('late_fee_per_day', %s, %s)
                ON CONFLICT (key) DO UPDATE
                  SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
            ''', (str(rate), str(g.user_id)))

        if 'default_lending_days' in data:
            days = sanitize_input(data.get('default_lending_days'), 'int')
            if days is None or days < 1:
                cur.close()
                conn.close()
                return jsonify({'error': 'default_lending_days must be an integer >= 1'}), 400
            cur.execute('''
                INSERT INTO settings (key, value, updated_by)
                VALUES ('default_lending_days', %s, %s)
                ON CONFLICT (key) DO UPDATE
                  SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
            ''', (str(days), str(g.user_id)))

        conn.commit()

        raw = get_settings_dict(cur)
        cur.close()
        conn.close()

        return jsonify({
            'late_fee_per_day': float(raw.get('late_fee_per_day', '0.00')),
            'default_lending_days': int(raw.get('default_lending_days', '14'))
        })

    except Exception as e:
        logger.error(f"Error updating settings: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# OVERDUE BOOKS ENDPOINTS
# =============================================================================

def _group_fines_by_borrower(rows):
    """Group flat fine/book rows (each already carrying borrower_id, first_name,
    borrower_code) into a list of per-borrower objects with a nested 'books' list."""
    groups = {}
    order = []
    for row in rows:
        bid = row['borrower_id']
        if bid not in groups:
            groups[bid] = {
                'borrower_id': bid,
                'first_name': row['first_name'],
                'borrower_code': row['borrower_code'],
                'books': []
            }
            order.append(bid)
        groups[bid]['books'].append(row)
    return [groups[bid] for bid in order]

@app.route('/api/overdue/active', methods=['GET'])
@token_required
def get_overdue_active():
    """Borrowers with currently overdue (still checked-out) books, ranked
    longest-overdue-first. Carries the same fine/payment columns as
    /api/fines so payment actions (mark paid / undo) work directly from this
    view — this endpoint is the single home for overdue + fine management."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        sync_overdue_fines(cur, g.user_id)
        conn.commit()

        cur.execute('''
            SELECT br.id as borrower_id, br.first_name, br.borrower_id as borrower_code,
                   f.id as fine_id, co.id as checkout_id,
                   co.checkout_date, co.due_date,
                   f.days_overdue, f.rate_applied, f.amount,
                   f.status, f.paid_at, pu.email as paid_by_email,
                   b.title, b.author, b.cover_medium, b.cover_large,
                   bc.copy_number,
                   fu.id as follow_up_id, fu.status as follow_up_status
            FROM fines f
            JOIN checkouts co ON f.checkout_id = co.id
            JOIN book_copies bc ON co.copy_id = bc.id
            JOIN books b ON bc.book_id = b.id
            JOIN borrowers br ON co.borrower_id = br.id
            LEFT JOIN follow_ups fu ON fu.checkout_id = co.id
            LEFT JOIN users pu ON f.paid_by = pu.id
            WHERE co.status = 'Checked Out'
            ORDER BY f.days_overdue DESC, co.due_date ASC
        ''')

        rows = cur.fetchall()
        cur.close()
        conn.close()

        groups = _group_fines_by_borrower(rows)
        for grp in groups:
            grp['book_count'] = len(grp['books'])
            grp['max_days_overdue'] = max(bk['days_overdue'] for bk in grp['books'])
            grp['total_outstanding'] = sum(bk['amount'] for bk in grp['books'] if bk['status'] == 'Unpaid')
            grp['total_paid'] = sum(bk['amount'] for bk in grp['books'] if bk['status'] == 'Paid')

        groups.sort(key=lambda grp: grp['max_days_overdue'], reverse=True)

        return jsonify(groups)

    except Exception as e:
        logger.error(f"Error fetching overdue books: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# FINES ENDPOINTS
# =============================================================================

@app.route('/api/fines', methods=['GET'])
@token_required
def get_fines():
    """All fines (books still out and already returned), grouped by borrower."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        sync_overdue_fines(cur, g.user_id)
        conn.commit()

        cur.execute('''
            SELECT br.id as borrower_id, br.first_name, br.borrower_id as borrower_code,
                   f.id as fine_id, co.id as checkout_id,
                   co.checkout_date, co.due_date, co.return_date,
                   co.status as checkout_status,
                   f.days_overdue, f.rate_applied, f.amount, f.status,
                   f.paid_at, pu.email as paid_by_email,
                   b.title, b.author, b.cover_medium, b.cover_large,
                   bc.copy_number
            FROM fines f
            JOIN checkouts co ON f.checkout_id = co.id
            JOIN book_copies bc ON co.copy_id = bc.id
            JOIN books b ON bc.book_id = b.id
            JOIN borrowers br ON co.borrower_id = br.id
            LEFT JOIN users pu ON f.paid_by = pu.id
            ORDER BY br.first_name ASC, f.created_at ASC
        ''')

        rows = cur.fetchall()
        cur.close()
        conn.close()

        groups = _group_fines_by_borrower(rows)
        for grp in groups:
            grp['total_outstanding'] = sum(bk['amount'] for bk in grp['books'] if bk['status'] == 'Unpaid')
            grp['total_paid'] = sum(bk['amount'] for bk in grp['books'] if bk['status'] == 'Paid')

        groups.sort(key=lambda grp: grp['total_outstanding'], reverse=True)

        return jsonify(groups)

    except Exception as e:
        logger.error(f"Error fetching fines: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fines/settle', methods=['POST'])
@token_required
def settle_fines():
    """Mark one or more currently-Unpaid fines as Paid (full settlement per book)."""
    try:
        data = request.json or {}
        fine_ids = data.get('fine_ids') or []
        if not fine_ids:
            return jsonify({'error': 'fine_ids is required'}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            UPDATE fines
            SET status = 'Paid', paid_at = CURRENT_TIMESTAMP, paid_by = %s
            WHERE id = ANY(%s::uuid[]) AND status = 'Unpaid'
            RETURNING id, amount
        ''', (str(g.user_id), fine_ids))

        settled = cur.fetchall()

        for fine in settled:
            cur.execute('''
                INSERT INTO fine_payments (fine_id, user_id, action, amount)
                VALUES (%s, %s, 'Paid', %s)
            ''', (fine['id'], str(g.user_id), fine['amount']))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'settled': [str(f['id']) for f in settled]})

    except Exception as e:
        logger.error(f"Error settling fines: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fines/<fine_id>/unpay', methods=['PUT'])
@token_required
def unpay_fine(fine_id):
    """Revert a Paid fine back to Unpaid, logging the reversal for audit."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            UPDATE fines
            SET status = 'Unpaid', paid_at = NULL, paid_by = NULL
            WHERE id = %s AND status = 'Paid'
            RETURNING id, amount
        ''', (fine_id,))

        fine = cur.fetchone()
        if not fine:
            cur.close()
            conn.close()
            return jsonify({'error': 'Fine not found or not currently paid'}), 400

        cur.execute('''
            INSERT INTO fine_payments (fine_id, user_id, action, amount)
            VALUES (%s, %s, 'Reversed', %s)
        ''', (fine['id'], str(g.user_id), fine['amount']))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'message': 'Payment reversed', 'fine_id': str(fine['id'])})

    except Exception as e:
        logger.error(f"Error reversing fine payment: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fines/transactions', methods=['GET'])
@token_required
def get_fine_transactions():
    """Append-only audit ledger of every fine payment/reversal action, newest
    first — who processed it and when. A row is reversible only when it's the
    most recent action on its fine AND that fine is currently Paid, which
    mirrors the guard in unpay_fine (so the button here never 400s)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            SELECT fp.id as payment_id, fp.fine_id, fp.action, fp.amount, fp.occurred_at,
                   u.email as processed_by_email,
                   f.status as fine_status, co.id as checkout_id, co.status as checkout_status,
                   b.title, b.author, bc.copy_number,
                   br.id as borrower_id, br.first_name, br.borrower_id as borrower_code,
                   ROW_NUMBER() OVER (PARTITION BY fp.fine_id ORDER BY fp.occurred_at DESC, fp.id DESC) as rn
            FROM fine_payments fp
            JOIN fines f ON fp.fine_id = f.id
            JOIN checkouts co ON f.checkout_id = co.id
            JOIN book_copies bc ON co.copy_id = bc.id
            JOIN books b ON bc.book_id = b.id
            JOIN borrowers br ON co.borrower_id = br.id
            LEFT JOIN users u ON fp.user_id = u.id
            ORDER BY fp.occurred_at DESC, fp.id DESC
        ''')

        rows = cur.fetchall()
        cur.close()
        conn.close()

        transactions = []
        for row in rows:
            row['reversible'] = row['action'] == 'Paid' and row['fine_status'] == 'Paid' and row['rn'] == 1
            del row['rn']
            transactions.append(row)

        return jsonify(transactions)

    except Exception as e:
        logger.error(f"Error fetching fine transactions: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# DASHBOARD / STATS ENDPOINTS
# =============================================================================

@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats():
    """Get dashboard statistics."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Total books
        cur.execute('SELECT COUNT(*) as total FROM books')
        total_books = cur.fetchone()['total']

        # Total copies
        cur.execute('SELECT COUNT(*) as total FROM book_copies')
        total_copies = cur.fetchone()['total']

        # Available copies
        cur.execute('''
            SELECT COUNT(*) as total FROM book_copies
            WHERE status = 'Available'
        ''')
        available_copies = cur.fetchone()['total']

        # Active checkouts
        cur.execute('''
            SELECT COUNT(*) as total FROM checkouts
            WHERE status = 'Checked Out'
        ''')
        active_checkouts = cur.fetchone()['total']

        # Total borrowers
        cur.execute('SELECT COUNT(*) as total FROM borrowers')
        total_borrowers = cur.fetchone()['total']

        # Overdue checkouts
        cur.execute('''
            SELECT COUNT(*) as total FROM checkouts
            WHERE status = 'Checked Out' AND due_date < CURRENT_DATE
        ''')
        overdue_checkouts = cur.fetchone()['total']

        # Wishlist items
        cur.execute('''
            SELECT COUNT(*) as total FROM book_wishlist
            WHERE status = 'Requested'
        ''')
        wishlist_items = cur.fetchone()['total']

        # Pending follow-ups
        cur.execute('''
            SELECT COUNT(*) as total FROM follow_ups
            WHERE status IN ('Pending', 'Contacted')
        ''')
        pending_follow_ups = cur.fetchone()['total']

        cur.close()
        conn.close()

        return jsonify({
            'total_books': total_books,
            'total_copies': total_copies,
            'available_copies': available_copies,
            'active_checkouts': active_checkouts,
            'total_borrowers': total_borrowers,
            'overdue_checkouts': overdue_checkouts,
            'wishlist_items': wishlist_items,
            'pending_follow_ups': pending_follow_ups
        })

    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

# =============================================================================
# ERROR HANDLERS
# =============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    port = int(os.getenv('ZOELIBRARYAPP_BACKEND_PORT', 5002))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('ZOELIBRARYAPP_FLASK_ENV') == 'development')
