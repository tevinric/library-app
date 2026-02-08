import { useState, useEffect } from 'react'
import { getBooks, createBook, createBookCopy, getBookCopies, getBookByBarcode } from '../api'
import BarcodeScanner from '../components/BarcodeScanner'

function BookRegistration() {
  const [search, setSearch] = useState('')
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    barcode: '',
    publisher: '',
    publication_year: '',
    genre: '',
    description: '',
    language: 'English',
    pages: ''
  })
  const [copies, setCopies] = useState([])
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [numCopiesToAdd, setNumCopiesToAdd] = useState(1)

  useEffect(() => {
    if (search.length > 0) {
      searchBooks()
    } else {
      setBooks([])
    }
  }, [search])

  const searchBooks = async () => {
    try {
      setLoading(true)
      const response = await getBooks(search)
      setBooks(response.data)
    } catch (error) {
      console.error('Error searching books:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const response = await createBook(formData)
      alert('Book registered successfully!')

      // Reset form
      setFormData({
        title: '',
        author: '',
        isbn: '',
        barcode: '',
        publisher: '',
        publication_year: '',
        genre: '',
        description: '',
        language: 'English',
        pages: ''
      })
      setShowForm(false)
      setSearch('')
    } catch (error) {
      alert('Error registering book: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCopies = async (bookId) => {
    try {
      const response = await getBookCopies(bookId)
      setCopies(response.data)
      setSelectedBookId(bookId)
    } catch (error) {
      console.error('Error loading copies:', error)
    }
  }

  const addCopies = async (bookId) => {
    try {
      setLoading(true)
      for (let i = 0; i < numCopiesToAdd; i++) {
        await createBookCopy({
          book_id: bookId,
          condition: 'Good',
          status: 'Available'
        })
      }
      alert(`${numCopiesToAdd} cop${numCopiesToAdd > 1 ? 'ies' : 'y'} added successfully!`)
      loadCopies(bookId)
      setNumCopiesToAdd(1)
    } catch (error) {
      alert('Error adding copies: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBarcodeScan = async (barcode) => {
    try {
      setLoading(true)
      const response = await getBookByBarcode(barcode)

      // Book found - show in search results
      setBooks([response.data])
      setSearch('') // Clear search to prevent re-triggering
      alert('Book found! You can view or add more copies below.')

    } catch (error) {
      if (error.response?.status === 404) {
        // Book not found - pre-fill form with barcode for new registration
        setFormData({
          ...formData,
          barcode
          // Note: ISBN and barcode are separate fields, not pre-filling ISBN
        })
        setShowForm(true)
        alert('Book not found in system. Register it below with this barcode.')
      } else {
        alert('Error searching by barcode: ' + error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Register Books</h1>
        <p className="text-gray-400 mt-1">Search existing books or register new ones</p>
      </div>

      {/* Barcode Scanner */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Quick Lookup: Scan Barcode
        </label>
        <BarcodeScanner
          onScan={handleBarcodeScan}
          placeholder="Scan book barcode here..."
          autoFocus={true}
          disabled={loading}
        />
        <p className="text-xs text-gray-500 mt-2">
          Scan a barcode to search for existing books or start registration for new ones
        </p>
      </div>

      {/* Search Bar */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Search Existing Books (before registering)
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, author, or ISBN..."
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        />
      </div>

      {/* Search Results */}
      {books.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Search Results</h2>
          <div className="space-y-4">
            {books.map((book) => (
              <div key={book.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{book.title}</h3>
                    <p className="text-gray-400">by {book.author}</p>
                    {book.isbn && <p className="text-sm text-gray-500">ISBN: {book.isbn}</p>}
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="text-success-400">
                        {book.available_copies} available
                      </span>
                      <span className="text-gray-400">
                        {book.total_copies} total copies
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadCopies(book.id)}
                      className="btn-secondary text-sm"
                    >
                      View Copies
                    </button>
                  </div>
                </div>

                {/* Show copies when expanded */}
                {selectedBookId === book.id && (
                  <div className="mt-4 border-t border-gray-600 pt-4">
                    <h4 className="font-semibold text-white mb-2">Copies</h4>
                    <div className="space-y-2 mb-4">
                      {copies.map((copy) => (
                        <div key={copy.id} className="flex justify-between text-sm bg-gray-800 p-2 rounded">
                          <span className="text-gray-300">Copy #{copy.copy_number}</span>
                          <span className={`font-medium ${copy.status === 'Available' ? 'text-success-400' : 'text-warning-400'}`}>
                            {copy.status}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min="1"
                        value={numCopiesToAdd}
                        onChange={(e) => setNumCopiesToAdd(parseInt(e.target.value))}
                        className="w-20 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                      />
                      <button
                        onClick={() => addCopies(book.id)}
                        disabled={loading}
                        className="btn-primary"
                      >
                        Add {numCopiesToAdd} More Cop{numCopiesToAdd > 1 ? 'ies' : 'y'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Register New Book Button */}
      <div className="card">
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary w-full"
        >
          {showForm ? '❌ Cancel' : '➕ Register New Book'}
        </button>
      </div>

      {/* Registration Form */}
      {showForm && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Register New Book</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Author *
                </label>
                <input
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ISBN
                </label>
                <input
                  type="text"
                  name="isbn"
                  value={formData.isbn}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Barcode
                </label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2"
                  placeholder="ISBN, UPC, or custom barcode"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Can be same as ISBN or a custom barcode
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Publisher
                </label>
                <input
                  type="text"
                  name="publisher"
                  value={formData.publisher}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Publication Year
                </label>
                <input
                  type="number"
                  name="publication_year"
                  value={formData.publication_year}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Genre
                </label>
                <input
                  type="text"
                  name="genre"
                  value={formData.genre}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Language
                </label>
                <input
                  type="text"
                  name="language"
                  value={formData.language}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pages
                </label>
                <input
                  type="number"
                  name="pages"
                  value={formData.pages}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-4 py-2"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Registering...' : '📚 Register Book'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default BookRegistration
