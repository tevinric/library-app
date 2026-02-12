import { useState, useEffect } from 'react'
import { getBooks, getBookCopies, updateBook, createBookCopy, createWishlistItem, createFollowUp, getBookByBarcode } from '../api'
import { formatDistanceToNow } from 'date-fns'
import BarcodeScanner from '../components/BarcodeScanner'
import { SearchIcon, StarIcon, EditIcon, BellIcon, BookIcon } from '../components/Icons'

function BookSearch() {
  const [search, setSearch] = useState('')
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(true)
  const [copies, setCopies] = useState([])
  const [showWishlistModal, setShowWishlistModal] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [showEditBookModal, setShowEditBookModal] = useState(false)
  const [showAddCopyModal, setShowAddCopyModal] = useState(false)
  const [selectedCheckout, setSelectedCheckout] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [wishlistData, setWishlistData] = useState({
    title: '',
    author: '',
    isbn: '',
    requested_by: '',
    request_notes: '',
    priority: 'Medium'
  })
  const [editBookData, setEditBookData] = useState({
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    publication_year: '',
    genre: '',
    description: '',
    language: 'English',
    pages: ''
  })
  const [newCopyData, setNewCopyData] = useState({
    condition: 'Good',
    location: '',
    notes: ''
  })

  const loadBooks = async () => {
    try {
      setLoading(true)
      const response = await getBooks(search)
      setBooks(response.data)
    } catch (error) {
      console.error('Error loading books:', error)
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

  const handleEditBook = (book) => {
    setSelectedBook(book)
    setEditBookData({
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      publisher: book.publisher || '',
      publication_year: book.publication_year || '',
      genre: book.genre || '',
      description: book.description || '',
      language: book.language || 'English',
      pages: book.pages || ''
    })
    setShowEditBookModal(true)
  }

  const handleUpdateBook = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await updateBook(selectedBook.id, editBookData)
      alert('Book updated successfully!')
      setShowEditBookModal(false)
      loadBooks()
      if (selectedBookId === selectedBook.id) {
        loadCopies(selectedBook.id)
      }
    } catch (error) {
      alert('Error updating book: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCopy = (book) => {
    setSelectedBook(book)
    setNewCopyData({
      condition: 'Good',
      location: '',
      notes: ''
    })
    setShowAddCopyModal(true)
  }

  const handleCreateCopy = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await createBookCopy({
        book_id: selectedBook.id,
        ...newCopyData,
        status: 'Available'
      })
      alert('Copy added successfully!')
      setShowAddCopyModal(false)
      loadBooks()
      if (selectedBookId === selectedBook.id) {
        loadCopies(selectedBook.id)
      }
    } catch (error) {
      alert('Error adding copy: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToWishlist = async (e) => {
    e.preventDefault()
    try {
      await createWishlistItem(wishlistData)
      alert('Added to wishlist successfully!')
      setShowWishlistModal(false)
      setWishlistData({
        title: '',
        author: '',
        isbn: '',
        requested_by: '',
        request_notes: '',
        priority: 'Medium'
      })
    } catch (error) {
      alert('Error adding to wishlist: ' + error.message)
    }
  }

  const handleAddToFollowUp = async (checkout) => {
    try {
      await createFollowUp({
        checkout_id: checkout.id,
        reason: 'Requested follow-up from book search'
      })
      alert('Added to follow-up list successfully!')
      setShowCheckoutModal(false)
      loadCopies(selectedBookId)
    } catch (error) {
      alert('Error adding to follow-up: ' + error.message)
    }
  }

  const showCheckoutDetails = (checkout) => {
    setSelectedCheckout(checkout)
    setShowCheckoutModal(true)
  }

  const handleBarcodeScan = async (barcode) => {
    try {
      setLoading(true)
      const response = await getBookByBarcode(barcode)
      const book = response.data

      // Display the found book with full details
      setBooks([book])
      setShowBarcodeScanner(false)

      // Auto-expand copies to show detailed information
      if (book.id) {
        await loadCopies(book.id)
      }

    } catch (error) {
      if (error.response?.status === 404) {
        alert('Book not found. Please check the barcode or register the book first.')
      } else {
        alert('Error scanning barcode: ' + error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Book Search</h1>
        <p className="text-gray-400 mt-1">Search for books and check availability</p>
      </div>

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Quick Search: Scan Barcode
          </label>
          <BarcodeScanner
            onScan={handleBarcodeScan}
            placeholder="Scan book barcode..."
            autoFocus={true}
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-2">
            Fastest method: Scan barcode to instantly find the book with full details
          </p>
        </div>
      )}

      {/* Search Bar */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {showBarcodeScanner ? 'Or search manually' : 'Search Books'}
        </label>
        <div className="flex gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author, ISBN, or barcode..."
            className="flex-1 px-4 py-2"
            onKeyPress={(e) => e.key === 'Enter' && loadBooks()}
          />
          <button onClick={loadBooks} className="btn-primary flex items-center gap-2">
            <SearchIcon className="w-5 h-5" />
            <span>Search</span>
          </button>
          {!showBarcodeScanner && (
            <button
              onClick={() => {
                setShowBarcodeScanner(true)
                setBooks([])
                setSearch('')
              }}
              className="btn-secondary"
            >
              📷 Scan Barcode
            </button>
          )}
          <button
            onClick={() => setShowWishlistModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <StarIcon className="w-5 h-5" />
            <span>Add to Wishlist</span>
          </button>
        </div>
      </div>

      {/* Results */}
      {books.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            {books.length} book{books.length !== 1 ? 's' : ''} found
          </h2>
          <div className="space-y-4">
            {books.map((book) => (
              <div key={book.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{book.title}</h3>
                    <p className="text-gray-400">by {book.author}</p>
                    <div className="mt-2 space-y-1">
                      {book.isbn && <p className="text-sm text-gray-500"><span className="text-gray-600 font-medium">ISBN:</span> {book.isbn}</p>}
                      {book.barcode && <p className="text-sm text-gray-500"><span className="text-gray-600 font-medium">Barcode:</span> {book.barcode}</p>}
                      {book.publisher && <p className="text-sm text-gray-500"><span className="text-gray-600 font-medium">Publisher:</span> {book.publisher}</p>}
                      {book.publication_year && <p className="text-sm text-gray-500">📅 Year: {book.publication_year}</p>}
                      {book.language && book.language !== 'English' && <p className="text-sm text-gray-500">🌐 Language: {book.language}</p>}
                      {book.pages && <p className="text-sm text-gray-500">📄 Pages: {book.pages}</p>}
                    </div>
                    {book.genre && <span className="inline-block px-2 py-1 bg-primary-900/50 text-primary-300 text-xs rounded mt-2">{book.genre}</span>}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-success-400">{book.available_copies}</p>
                    <p className="text-sm text-gray-400">of {book.total_copies} available</p>
                  </div>
                </div>

                {book.description && (
                  <p className="text-gray-400 text-sm mb-3">{book.description}</p>
                )}

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => selectedBookId === book.id ? setSelectedBookId(null) : loadCopies(book.id)}
                    className="btn-secondary text-sm"
                  >
                    {selectedBookId === book.id ? 'Hide' : 'View'} Copies
                  </button>
                  <button
                    onClick={() => handleEditBook(book)}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <EditIcon className="w-4 h-4" />
                    <span>Edit Book</span>
                  </button>
                  <button
                    onClick={() => handleAddCopy(book)}
                    className="btn-success text-sm"
                  >
                    ➕ Add Copy
                  </button>
                </div>

                {/* Copies List */}
                {selectedBookId === book.id && (
                  <div className="mt-4 border-t border-gray-600 pt-4">
                    <h4 className="font-semibold text-white mb-3">
                      Copies ({copies.length})
                      {copies.filter(c => c.status === 'Available').length > 0 && (
                        <span className="ml-2 text-sm text-success-400">
                          • {copies.filter(c => c.status === 'Available').length} Available
                        </span>
                      )}
                    </h4>
                    {copies.length === 0 ? (
                      <p className="text-gray-400 text-sm">No copies available</p>
                    ) : (
                      <div className="space-y-2">
                        {copies.map((copy) => (
                          <div key={copy.id} className="bg-gray-800 p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-white font-medium">Copy #{copy.copy_number}</span>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    copy.status === 'Available'
                                      ? 'bg-success-900/50 text-success-300'
                                      : 'bg-warning-900/50 text-warning-300'
                                  }`}>
                                    {copy.status}
                                  </span>
                                </div>
                                <div className="space-y-1 text-sm">
                                  <p className="text-gray-400">
                                    <span className="text-gray-500">Condition:</span> {copy.condition}
                                  </p>
                                  {copy.location && (
                                    <p className="text-gray-400">
                                      <span className="text-gray-500">📍 Location:</span> <span className="text-primary-400 font-medium">{copy.location}</span>
                                    </p>
                                  )}
                                  {copy.notes && (
                                    <p className="text-gray-400">
                                      <span className="text-gray-500">Notes:</span> {copy.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {copy.checkout_info && (
                                <button
                                  onClick={() => showCheckoutDetails(copy.checkout_info)}
                                  className="text-primary-400 hover:text-primary-300 text-sm underline ml-4"
                                >
                                  View Checkout Details
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && books.length === 0 && search && (
        <div className="card text-center">
          <p className="text-gray-400">No books found. Try a different search or add to wishlist.</p>
        </div>
      )}

      {/* Edit Book Modal */}
      {showEditBookModal && (
        <div className="modal-overlay" onClick={() => setShowEditBookModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4">Edit Book Details</h2>
            <form onSubmit={handleUpdateBook} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                  <input
                    type="text"
                    value={editBookData.title}
                    onChange={(e) => setEditBookData({...editBookData, title: e.target.value})}
                    required
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Author *</label>
                  <input
                    type="text"
                    value={editBookData.author}
                    onChange={(e) => setEditBookData({...editBookData, author: e.target.value})}
                    required
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">ISBN</label>
                  <input
                    type="text"
                    value={editBookData.isbn}
                    onChange={(e) => setEditBookData({...editBookData, isbn: e.target.value})}
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Publisher</label>
                  <input
                    type="text"
                    value={editBookData.publisher}
                    onChange={(e) => setEditBookData({...editBookData, publisher: e.target.value})}
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Publication Year</label>
                  <input
                    type="number"
                    value={editBookData.publication_year}
                    onChange={(e) => setEditBookData({...editBookData, publication_year: e.target.value})}
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Genre</label>
                  <input
                    type="text"
                    value={editBookData.genre}
                    onChange={(e) => setEditBookData({...editBookData, genre: e.target.value})}
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
                  <input
                    type="text"
                    value={editBookData.language}
                    onChange={(e) => setEditBookData({...editBookData, language: e.target.value})}
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Pages</label>
                  <input
                    type="number"
                    value={editBookData.pages}
                    onChange={(e) => setEditBookData({...editBookData, pages: e.target.value})}
                    className="w-full px-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={editBookData.description}
                  onChange={(e) => setEditBookData({...editBookData, description: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Updating...' : 'Update Book'}
                </button>
                <button type="button" onClick={() => setShowEditBookModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Copy Modal */}
      {showAddCopyModal && (
        <div className="modal-overlay" onClick={() => setShowAddCopyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4">Add Copy of "{selectedBook?.title}"</h2>
            <form onSubmit={handleCreateCopy} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Condition</label>
                <select
                  value={newCopyData.condition}
                  onChange={(e) => setNewCopyData({...newCopyData, condition: e.target.value})}
                  className="w-full px-4 py-2"
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                <input
                  type="text"
                  value={newCopyData.location}
                  onChange={(e) => setNewCopyData({...newCopyData, location: e.target.value})}
                  placeholder="e.g., Shelf A3, Room 101"
                  className="w-full px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                <textarea
                  value={newCopyData.notes}
                  onChange={(e) => setNewCopyData({...newCopyData, notes: e.target.value})}
                  rows="2"
                  placeholder="Optional notes about this copy"
                  className="w-full px-4 py-2"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={loading} className="btn-success">
                  {loading ? 'Adding...' : 'Add Copy'}
                </button>
                <button type="button" onClick={() => setShowAddCopyModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wishlist Modal */}
      {showWishlistModal && (
        <div className="modal-overlay" onClick={() => setShowWishlistModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4">Add to Wishlist</h2>
            <form onSubmit={handleAddToWishlist} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                <input
                  type="text"
                  value={wishlistData.title}
                  onChange={(e) => setWishlistData({...wishlistData, title: e.target.value})}
                  required
                  className="w-full px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Author</label>
                <input
                  type="text"
                  value={wishlistData.author}
                  onChange={(e) => setWishlistData({...wishlistData, author: e.target.value})}
                  className="w-full px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">ISBN</label>
                <input
                  type="text"
                  value={wishlistData.isbn}
                  onChange={(e) => setWishlistData({...wishlistData, isbn: e.target.value})}
                  className="w-full px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Requested By</label>
                <input
                  type="text"
                  value={wishlistData.requested_by}
                  onChange={(e) => setWishlistData({...wishlistData, requested_by: e.target.value})}
                  className="w-full px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                <select
                  value={wishlistData.priority}
                  onChange={(e) => setWishlistData({...wishlistData, priority: e.target.value})}
                  className="w-full px-4 py-2"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                <textarea
                  value={wishlistData.request_notes}
                  onChange={(e) => setWishlistData({...wishlistData, request_notes: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="btn-primary">Add to Wishlist</button>
                <button type="button" onClick={() => setShowWishlistModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Details Modal */}
      {showCheckoutModal && selectedCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckoutModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4">Checkout Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Borrowed By</p>
                <p className="text-white font-medium">{selectedCheckout.borrower_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Email</p>
                <p className="text-white">{selectedCheckout.borrower_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Checked Out</p>
                <p className="text-white">
                  {formatDistanceToNow(new Date(selectedCheckout.checkout_date), { addSuffix: true })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Due Date</p>
                <p className="text-white">
                  {new Date(selectedCheckout.due_date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => handleAddToFollowUp(selectedCheckout)}
                className="btn-primary flex items-center gap-2"
              >
                <BellIcon className="w-5 h-5" />
                <span>Add to Follow-up List</span>
              </button>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BookSearch
