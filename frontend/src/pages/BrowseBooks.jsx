import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getPublicBooks, getPublicBookDetail, getPublicGenres } from '../api'
import { SearchIcon, BookIcon, ChevronDownIcon, XIcon } from '../components/Icons'
import zoeLogo from '../static/ZOE-logo-blue.png'

function availabilityBadge(book, { compact = false } = {}) {
  const total = book.total_copies || 0
  const available = book.available_copies || 0

  if (total === 0) {
    return compact ? null : <span className="badge-neutral">Not yet available to borrow</span>
  }
  if (available > 0) {
    return (
      <span className="badge-success">
        {compact ? 'Available' : `${available} of ${total} ${total === 1 ? 'copy' : 'copies'} available`}
      </span>
    )
  }
  return <span className="badge-warning">All copies borrowed</span>
}

function parseSubjects(subjects) {
  if (!subjects) return []
  try {
    const parsed = JSON.parse(subjects)
    if (Array.isArray(parsed)) return parsed.slice(0, 8)
  } catch {
    // not JSON — fall through to raw string
  }
  return String(subjects).split(',').map(s => s.trim()).filter(Boolean).slice(0, 8)
}

function BookDetailModal({ bookId, onClose }) {
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPublicBookDetail(bookId)
      .then(res => { if (!cancelled) setBook(res.data) })
      .catch(() => { if (!cancelled) setError('Unable to load book details.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bookId])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-ink hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-danger-600">{error}</p>
          </div>
        )}

        {!loading && !error && book && (
          <div className="flex flex-col sm:flex-row gap-6 -mt-4">
            {/* Cover */}
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <div className="w-36 h-52 bg-gray-100 rounded-lg overflow-hidden shadow-sm flex items-center justify-center">
                {(book.cover_large || book.cover_medium) ? (
                  <img src={book.cover_large || book.cover_medium} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <BookIcon className="w-10 h-10 text-gray-300" />
                )}
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-ink leading-tight">{book.title}</h2>
              {book.author && <p className="text-primary-600 font-medium mt-1">{book.author}</p>}

              <div className="mt-3">{availabilityBadge(book)}</div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-5 text-sm">
                {book.genre && (
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wide">Genre</dt>
                    <dd className="text-ink font-medium">{book.genre}</dd>
                  </div>
                )}
                {book.publisher && (
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wide">Publisher</dt>
                    <dd className="text-ink font-medium">{book.publisher}</dd>
                  </div>
                )}
                {book.publication_year && (
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wide">Year</dt>
                    <dd className="text-ink font-medium">{book.publication_year}</dd>
                  </div>
                )}
                {book.pages && (
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wide">Pages</dt>
                    <dd className="text-ink font-medium">{book.pages}</dd>
                  </div>
                )}
                {book.language && (
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wide">Language</dt>
                    <dd className="text-ink font-medium">{book.language}</dd>
                  </div>
                )}
                {book.isbn && (
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wide">ISBN</dt>
                    <dd className="text-ink font-medium font-mono">{book.isbn}</dd>
                  </div>
                )}
              </dl>

              {book.description && (
                <div className="mt-5">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Description</p>
                  <p className="text-gray-600 text-sm leading-relaxed">{book.description}</p>
                </div>
              )}

              {parseSubjects(book.subjects).length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {parseSubjects(book.subjects).map((s, i) => (
                    <span key={i} className="badge-neutral">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BrowseBooks() {
  const [books, setBooks] = useState([])
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBookId, setSelectedBookId] = useState(null)

  useEffect(() => {
    getPublicGenres().then(res => setGenres(res.data)).catch(() => {})
  }, [])

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getPublicBooks({ search, genre, availableOnly })
      setBooks(response.data)
    } catch {
      setError('Unable to load books. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [search, genre, availableOnly])

  useEffect(() => {
    const timer = setTimeout(loadBooks, 300)
    return () => clearTimeout(timer)
  }, [loadBooks])

  const hasActiveFilters = search || genre || availableOnly
  const clearFilters = () => { setSearch(''); setGenre(''); setAvailableOnly(false) }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={zoeLogo} alt="ZOE Library" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-lg font-bold gradient-text leading-tight">ZOE Library</h1>
              <p className="text-xs text-gray-400">Browse Collection</p>
            </div>
          </div>
          <Link
            to="/"
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-ink bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-all duration-200"
          >
            ← Back to Login
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-primary-50/70 to-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-12 pb-8 text-center">
          <p className="text-primary-600 font-semibold tracking-wide uppercase text-xs mb-2">ZOE Community Church</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mb-2">Browse Our Library</h2>
          <p className="text-gray-500 max-w-lg mx-auto">Discover books available to borrow from our collection</p>

          {/* Search */}
          <div className="relative max-w-2xl mx-auto mt-8">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title, author, or ISBN..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-300 text-ink placeholder-gray-400 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <div className="relative">
              <select
                value={genre}
                onChange={e => setGenre(e.target.value)}
                className="appearance-none pl-4 pr-9 py-2 bg-white border border-gray-300 text-ink text-sm rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 cursor-pointer"
              >
                <option value="">All genres</option>
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm">
              <button
                onClick={() => setAvailableOnly(false)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${!availableOnly ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-ink'}`}
              >
                All Books
              </button>
              <button
                onClick={() => setAvailableOnly(true)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${availableOnly ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-ink'}`}
              >
                Available Now
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-400 hover:text-primary-600 underline underline-offset-2 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Count */}
        {!loading && !error && (
          <p className="text-gray-400 text-sm mb-4">
            {books.length} {books.length === 1 ? 'book' : 'books'} found
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-danger-600 mb-4">{error}</p>
            <button
              onClick={loadBooks}
              className="btn-secondary text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && books.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <BookIcon className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-gray-500">No books found{search ? ` for "${search}"` : ''}</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-primary-600 hover:text-primary-700 text-sm font-medium mt-2 underline underline-offset-2">
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Books grid */}
        {!loading && !error && books.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <div
                key={book.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedBookId(book.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBookId(book.id) } }}
                className="flex items-center gap-4 bg-white hover:bg-gray-50 border border-gray-200 hover:border-primary-200 hover:shadow-md rounded-xl p-4 transition-all duration-200 cursor-pointer text-left"
              >
                {/* Cover thumbnail */}
                <div className="flex-shrink-0 w-14 h-20 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden shadow-sm">
                  {book.cover_medium ? (
                    <img src={book.cover_medium} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <BookIcon className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-ink font-semibold text-sm leading-tight">{book.title}</h3>
                  {book.author && <p className="text-primary-600 text-sm mt-0.5">{book.author}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {availabilityBadge(book, { compact: true })}
                    {book.genre && <span className="badge-neutral">{book.genre}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-400 text-sm border-t border-gray-100">
        ZOE Library &mdash;{' '}
        <Link to="/" className="text-primary-600 hover:text-primary-700 font-medium transition-colors">
          Sign in
        </Link>{' '}
        to borrow books
      </footer>

      {selectedBookId && (
        <BookDetailModal bookId={selectedBookId} onClose={() => setSelectedBookId(null)} />
      )}
    </div>
  )
}

export default BrowseBooks
