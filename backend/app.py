from flask import Flask, request, jsonify, g
from flask_cors import CORS
from functools import wraps
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import logging
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

# CORS Configuration
CORS(app, resources={
    r"/api/*": {
        "origins": [
            f"http://localhost:{os.getenv('FRONTEND_PORT', '3002')}",
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
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        cursor_factory=RealDictCursor
    )

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
    """Get all books for the current user."""
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
                WHERE b.user_id = %s
                  AND (LOWER(b.title) LIKE LOWER(%s)
                       OR LOWER(b.author) LIKE LOWER(%s)
                       OR LOWER(b.isbn) LIKE LOWER(%s))
                GROUP BY b.id
                ORDER BY b.title ASC
            ''', (str(g.user_id), f'%{search}%', f'%{search}%', f'%{search}%'))
        else:
            cur.execute('''
                SELECT b.*,
                       COUNT(DISTINCT bc.id) as total_copies,
                       COUNT(DISTINCT CASE WHEN bc.status = 'Available' THEN bc.id END) as available_copies
                FROM books b
                LEFT JOIN book_copies bc ON b.id = bc.book_id
                WHERE b.user_id = %s
                GROUP BY b.id
                ORDER BY b.title ASC
            ''', (str(g.user_id),))

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
            WHERE b.id = %s AND b.user_id = %s
            GROUP BY b.id
        ''', (book_id, str(g.user_id)))

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
            INSERT INTO books (user_id, title, author, isbn, publisher, publication_year,
                             genre, description, language, pages)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        ''', (
            str(g.user_id),
            data.get('title'),
            data.get('author'),
            sanitize_input(data.get('isbn')),
            sanitize_input(data.get('publisher')),
            sanitize_input(data.get('publication_year'), 'int'),
            sanitize_input(data.get('genre')),
            sanitize_input(data.get('description')),
            data.get('language', 'English'),
            sanitize_input(data.get('pages'), 'int')
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
            SET title = %s, author = %s, isbn = %s, publisher = %s,
                publication_year = %s, genre = %s, description = %s,
                language = %s, pages = %s
            WHERE id = %s AND user_id = %s
            RETURNING *
        ''', (
            data.get('title'),
            data.get('author'),
            sanitize_input(data.get('isbn')),
            sanitize_input(data.get('publisher')),
            sanitize_input(data.get('publication_year'), 'int'),
            sanitize_input(data.get('genre')),
            sanitize_input(data.get('description')),
            data.get('language'),
            sanitize_input(data.get('pages'), 'int'),
            book_id,
            str(g.user_id)
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
            WHERE id = %s AND user_id = %s
            RETURNING id
        ''', (book_id, str(g.user_id)))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Book not found'}), 404

        return jsonify({'message': 'Book deleted successfully'})

    except Exception as e:
        logger.error(f"Error deleting book: {str(e)}")
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
                           'borrower_name', br.first_name || ' ' || br.last_name,
                           'borrower_email', br.email,
                           'checkout_date', co.checkout_date,
                           'due_date', co.due_date
                       )
                       ELSE NULL
                   END as checkout_info
            FROM book_copies bc
            JOIN books b ON bc.book_id = b.id
            LEFT JOIN checkouts co ON bc.id = co.copy_id AND co.status = 'Checked Out'
            LEFT JOIN borrowers br ON co.borrower_id = br.id
            WHERE bc.book_id = %s AND bc.user_id = %s
            ORDER BY bc.copy_number ASC
        ''', (book_id, str(g.user_id)))

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
            WHERE id = %s AND user_id = %s
            RETURNING *
        ''', (
            data.get('condition'),
            data.get('location'),
            data.get('status'),
            data.get('notes'),
            copy_id,
            str(g.user_id)
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
            WHERE id = %s AND user_id = %s
            RETURNING id
        ''', (copy_id, str(g.user_id)))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Book copy not found'}), 404

        return jsonify({'message': 'Book copy deleted successfully'})

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
                WHERE b.user_id = %s
                  AND (LOWER(b.first_name) LIKE LOWER(%s)
                       OR LOWER(b.last_name) LIKE LOWER(%s)
                       OR LOWER(b.email) LIKE LOWER(%s))
                GROUP BY b.id
                ORDER BY b.last_name ASC, b.first_name ASC
            ''', (str(g.user_id), f'%{search}%', f'%{search}%', f'%{search}%'))
        else:
            cur.execute('''
                SELECT b.*,
                       COUNT(DISTINCT CASE WHEN co.status = 'Checked Out' THEN co.id END) as active_checkouts
                FROM borrowers b
                LEFT JOIN checkouts co ON b.id = co.borrower_id
                WHERE b.user_id = %s
                GROUP BY b.id
                ORDER BY b.last_name ASC, b.first_name ASC
            ''', (str(g.user_id),))

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
            SELECT id, first_name, last_name, email, phone
            FROM borrowers
            WHERE user_id = %s
              AND (LOWER(first_name) LIKE LOWER(%s) OR LOWER(last_name) LIKE LOWER(%s))
            ORDER BY last_name ASC, first_name ASC
            LIMIT 10
        ''', (str(g.user_id), f'%{query}%', f'%{query}%'))

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
            WHERE b.id = %s AND b.user_id = %s
            GROUP BY b.id
        ''', (borrower_id, str(g.user_id)))

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

        cur.execute('''
            INSERT INTO borrowers (user_id, first_name, last_name, email, phone, alt_phone, address)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        ''', (
            str(g.user_id),
            data.get('first_name'),
            data.get('last_name'),
            data.get('email'),
            data.get('phone'),
            data.get('alt_phone'),
            data.get('address')
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
    """Update a borrower."""
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            UPDATE borrowers
            SET first_name = %s, last_name = %s, email = %s,
                phone = %s, alt_phone = %s, address = %s
            WHERE id = %s AND user_id = %s
            RETURNING *
        ''', (
            data.get('first_name'),
            data.get('last_name'),
            data.get('email'),
            data.get('phone'),
            data.get('alt_phone'),
            data.get('address'),
            borrower_id,
            str(g.user_id)
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
            WHERE id = %s AND user_id = %s
            RETURNING id
        ''', (borrower_id, str(g.user_id)))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Borrower not found'}), 404

        return jsonify({'message': 'Borrower deleted successfully'})

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
                       b.title, b.author,
                       bc.copy_number,
                       br.first_name, br.last_name, br.email, br.phone,
                       EXTRACT(DAY FROM (CURRENT_TIMESTAMP - co.checkout_date)) as days_checked_out
                FROM checkouts co
                JOIN book_copies bc ON co.copy_id = bc.id
                JOIN books b ON bc.book_id = b.id
                JOIN borrowers br ON co.borrower_id = br.id
                WHERE co.user_id = %s AND co.status = 'Checked Out'
                  AND (LOWER(b.title) LIKE LOWER(%s)
                       OR LOWER(br.first_name) LIKE LOWER(%s)
                       OR LOWER(br.last_name) LIKE LOWER(%s))
                ORDER BY co.checkout_date ASC
            ''', (str(g.user_id), f'%{search}%', f'%{search}%', f'%{search}%'))
        else:
            cur.execute('''
                SELECT co.*,
                       b.title, b.author,
                       bc.copy_number,
                       br.first_name, br.last_name, br.email, br.phone,
                       EXTRACT(DAY FROM (CURRENT_TIMESTAMP - co.checkout_date)) as days_checked_out
                FROM checkouts co
                JOIN book_copies bc ON co.copy_id = bc.id
                JOIN books b ON bc.book_id = b.id
                JOIN borrowers br ON co.borrower_id = br.id
                WHERE co.user_id = %s AND co.status = 'Checked Out'
                ORDER BY co.checkout_date ASC
            ''', (str(g.user_id),))

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
            WHERE id = %s AND user_id = %s
        ''', (data.get('copy_id'), str(g.user_id)))

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
            SELECT copy_id FROM checkouts
            WHERE id = %s AND user_id = %s AND status = 'Checked Out'
        ''', (checkout_id, str(g.user_id)))

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

        conn.commit()
        cur.close()
        conn.close()

        return jsonify(updated)

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
            WHERE id = %s AND user_id = %s
            RETURNING id
        ''', (checkout_id, str(g.user_id)))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Checkout not found'}), 404

        return jsonify({'message': 'Checkout deleted successfully'})

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
                   br.first_name, br.last_name, br.email,
                   EXTRACT(DAY FROM (COALESCE(co.return_date, CURRENT_TIMESTAMP) - co.checkout_date)) as duration_days
            FROM checkouts co
            JOIN book_copies bc ON co.copy_id = bc.id
            JOIN books b ON bc.book_id = b.id
            JOIN borrowers br ON co.borrower_id = br.id
            WHERE co.user_id = %s
        '''

        params = [str(g.user_id)]

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
                           OR LOWER(br.last_name) LIKE LOWER(%s))'''
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
            WHERE user_id = %s
            ORDER BY
                CASE priority
                    WHEN 'High' THEN 1
                    WHEN 'Medium' THEN 2
                    WHEN 'Low' THEN 3
                END,
                created_at DESC
        ''', (str(g.user_id),))

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
            WHERE id = %s AND user_id = %s
            RETURNING *
        ''', (
            data.get('title'),
            data.get('author'),
            data.get('isbn'),
            data.get('requested_by'),
            data.get('request_notes'),
            data.get('priority'),
            data.get('status'),
            item_id,
            str(g.user_id)
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
            WHERE id = %s AND user_id = %s
            RETURNING id
        ''', (item_id, str(g.user_id)))

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
    """Get all follow-ups ordered by checkout date (oldest first)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            SELECT fu.*,
                   co.checkout_date, co.due_date,
                   b.title, b.author,
                   bc.copy_number,
                   br.first_name, br.last_name, br.email, br.phone,
                   EXTRACT(DAY FROM (CURRENT_TIMESTAMP - co.checkout_date)) as days_checked_out
            FROM follow_ups fu
            JOIN checkouts co ON fu.checkout_id = co.id
            JOIN book_copies bc ON co.copy_id = bc.id
            JOIN books b ON bc.book_id = b.id
            JOIN borrowers br ON co.borrower_id = br.id
            WHERE fu.user_id = %s
            ORDER BY co.checkout_date ASC, fu.status ASC
        ''', (str(g.user_id),))

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
            WHERE checkout_id = %s AND user_id = %s
        ''', (data.get('checkout_id'), str(g.user_id)))

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
            WHERE id = %s AND user_id = %s
            RETURNING *
        ''', (
            data.get('status'),
            data.get('contacted_date'),
            data.get('resolution_notes'),
            follow_up_id,
            str(g.user_id)
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
            WHERE id = %s AND user_id = %s
            RETURNING id
        ''', (follow_up_id, str(g.user_id)))

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
        cur.execute('''
            SELECT COUNT(*) as total FROM books WHERE user_id = %s
        ''', (str(g.user_id),))
        total_books = cur.fetchone()['total']

        # Total copies
        cur.execute('''
            SELECT COUNT(*) as total FROM book_copies WHERE user_id = %s
        ''', (str(g.user_id),))
        total_copies = cur.fetchone()['total']

        # Available copies
        cur.execute('''
            SELECT COUNT(*) as total FROM book_copies
            WHERE user_id = %s AND status = 'Available'
        ''', (str(g.user_id),))
        available_copies = cur.fetchone()['total']

        # Active checkouts
        cur.execute('''
            SELECT COUNT(*) as total FROM checkouts
            WHERE user_id = %s AND status = 'Checked Out'
        ''', (str(g.user_id),))
        active_checkouts = cur.fetchone()['total']

        # Total borrowers
        cur.execute('''
            SELECT COUNT(*) as total FROM borrowers WHERE user_id = %s
        ''', (str(g.user_id),))
        total_borrowers = cur.fetchone()['total']

        # Overdue checkouts
        cur.execute('''
            SELECT COUNT(*) as total FROM checkouts
            WHERE user_id = %s AND status = 'Checked Out' AND due_date < CURRENT_DATE
        ''', (str(g.user_id),))
        overdue_checkouts = cur.fetchone()['total']

        # Wishlist items
        cur.execute('''
            SELECT COUNT(*) as total FROM book_wishlist
            WHERE user_id = %s AND status = 'Requested'
        ''', (str(g.user_id),))
        wishlist_items = cur.fetchone()['total']

        # Pending follow-ups
        cur.execute('''
            SELECT COUNT(*) as total FROM follow_ups
            WHERE user_id = %s AND status IN ('Pending', 'Contacted')
        ''', (str(g.user_id),))
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
    port = int(os.getenv('BACKEND_PORT', 5002))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
