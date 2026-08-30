import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getPublicBooks } from '../api'
import { SearchIcon, BookIcon } from '../components/Icons'
import zccLogo from '../static/ZCC-logo.png'

function BrowseBooks() {
  const [books, setBooks] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getPublicBooks(search)
      setBooks(response.data)
    } catch {
      setError('Unable to load books. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const timer = setTimeout(loadBooks, 300)
    return () => clearTimeout(timer)
  }, [loadBooks])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={zccLogo} alt="ZOE Library" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-lg font-bold gradient-text">ZOE Library</h1>
              <p className="text-xs text-gray-400">Browse Collection</p>
            </div>
          </div>
          <Link
            to="/"
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all duration-200"
          >
            ← Back to Login
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Browse Our Library</h2>
          <p className="text-gray-400">Discover books available to borrow from the ZOE Library</p>
        </div>

        {/* Search */}
        <div className="relative max-w-2xl mx-auto mb-6">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title, author, or ISBN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Count */}
        {!loading && !error && (
          <p className="text-center text-gray-500 text-sm mb-6">
            {books.length} {books.length === 1 ? 'book' : 'books'} found
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadBooks}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && books.length === 0 && (
          <div className="text-center py-16">
            <BookIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No books found{search ? ` for "${search}"` : ''}</p>
          </div>
        )}

        {/* Books list */}
        {!loading && !error && books.length > 0 && (
          <div className="flex flex-col border border-gray-700/50 rounded-xl overflow-hidden divide-y divide-gray-700/50">
            {books.map((book, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 bg-gray-800 hover:bg-gray-700/50 p-4 transition-colors duration-200"
              >
                {/* Cover thumbnail */}
                <div className="flex-shrink-0 w-12 h-16 bg-gray-700/50 rounded flex items-center justify-center overflow-hidden">
                  {book.cover_medium ? (
                    <img src={book.cover_medium} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <BookIcon className="w-6 h-6 text-gray-600" />
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm leading-tight">{book.title}</h3>
                  {book.author && <p className="text-primary-400 text-sm mt-0.5">{book.author}</p>}
                  <div className="flex flex-wrap gap-x-3 mt-1">
                    {book.publisher && <span className="text-gray-500 text-xs">{book.publisher}</span>}
                    {book.publication_year && <span className="text-gray-500 text-xs">{book.publication_year}</span>}
                    {book.isbn && <span className="text-gray-600 text-xs font-mono">ISBN: {book.isbn}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-600 text-sm border-t border-gray-800">
        ZOE Library &mdash;{' '}
        <Link to="/" className="text-primary-500 hover:text-primary-400 transition-colors">
          Sign in
        </Link>{' '}
        to borrow books
      </footer>
    </div>
  )
}

export default BrowseBooks
