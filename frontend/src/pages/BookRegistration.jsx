import { useState, useEffect } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { getBooks, createBook, createBookCopy, getBookCopies, getBookByBarcode, fetchBookFromOpenLibrary, updateBookCopy } from '../api'
import BarcodeScanner from '../components/BarcodeScanner'
import { BookIcon, PlusIcon, XIcon, SearchIcon, EditIcon, CheckIcon } from '../components/Icons'

function BookRegistration() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
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
    pages: '',
    // OpenLibrary fields
    cover_small: '',
    cover_medium: '',
    cover_large: '',
    subjects: '',
    openlibrary_key: '',
    openlibrary_url: '',
    excerpt: '',
    dewey_decimal: '',
    lc_classification: ''
  })
  const [copies, setCopies] = useState([])
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [numCopiesToAdd, setNumCopiesToAdd] = useState(1)
  const [copyLocation, setCopyLocation] = useState('')
  const [editingCopyId, setEditingCopyId] = useState(null)
  const [editCopyData, setEditCopyData] = useState({
    condition: '',
    location: '',
    notes: '',
    status: ''
  })
  const [fetchingFromOpenLibrary, setFetchingFromOpenLibrary] = useState(false)
  const [openLibraryData, setOpenLibraryData] = useState(null)
  const [showAddCopyPrompt, setShowAddCopyPrompt] = useState(false)
  const [registeredBook, setRegisteredBook] = useState(null)
  const [showAddCopyModal, setShowAddCopyModal] = useState(false)
  const [newCopyData, setNewCopyData] = useState({ condition: 'Good', location: '', notes: '' })

  useEffect(() => {
    if (search.length > 0) {
      searchBooks()
    } else {
      setBooks([])
    }
  }, [search])

  // Handle URL parameters for auto-filtering to specific book
  useEffect(() => {
    const bookId = searchParams.get('bookId')
    const bookTitle = searchParams.get('title')
    const isbn = searchParams.get('isbn')
    const autoExpand = searchParams.get('expand') === 'true'

    // If URL has book parameters, auto-search and filter
    if (bookId || bookTitle || isbn) {
      const searchTerm = bookTitle || isbn || bookId
      setSearch(searchTerm)

      // If bookId is provided and autoExpand is true, load that book's copies
      if (bookId && autoExpand) {
        setTimeout(async () => {
          try {
            // Search for the book first
            const response = await getBooks(searchTerm)
            if (response.data.length > 0) {
              const book = response.data.find(b => b.id === bookId) || response.data[0]
              setBooks(response.data)
              // Auto-expand copies
              await loadCopies(book.id)
              // Scroll to the book
              setTimeout(() => {
                window.scrollTo({ top: 300, behavior: 'smooth' })
              }, 100)
            }
          } catch (error) {
            console.error('Error loading book from URL params:', error)
          }
        }, 500)
      }
    }
  }, [searchParams])

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

  // Fetch book data from OpenLibrary API
  const fetchFromOpenLibrary = async (isbn) => {
    if (!isbn || isbn.length < 10) {
      alert('Please enter a valid ISBN (at least 10 digits)')
      return
    }

    try {
      setFetchingFromOpenLibrary(true)
      console.log('Fetching book data for ISBN:', isbn)

      const bookData = await fetchBookFromOpenLibrary(isbn)
      console.log('Received book data:', bookData)

      setOpenLibraryData(bookData)

      // Prepopulate form with OpenLibrary data
      const updatedFormData = {
        ...formData,
        title: bookData.title || formData.title,
        author: bookData.author || formData.author,
        publisher: bookData.publisher || formData.publisher,
        publication_year: bookData.publication_year !== null && bookData.publication_year !== undefined
          ? bookData.publication_year
          : formData.publication_year,
        pages: bookData.pages !== null && bookData.pages !== undefined
          ? bookData.pages
          : formData.pages,
        description: bookData.description || formData.description,
        isbn: bookData.isbn || formData.isbn,
        // OpenLibrary specific fields - always use OpenLibrary values if present
        cover_small: bookData.cover_small !== null ? bookData.cover_small : '',
        cover_medium: bookData.cover_medium !== null ? bookData.cover_medium : '',
        cover_large: bookData.cover_large !== null ? bookData.cover_large : '',
        subjects: bookData.subjects !== null ? bookData.subjects : '',
        openlibrary_key: bookData.openlibrary_key !== null ? bookData.openlibrary_key : '',
        openlibrary_url: bookData.openlibrary_url !== null ? bookData.openlibrary_url : '',
        excerpt: bookData.excerpt !== null ? bookData.excerpt : '',
        dewey_decimal: bookData.dewey_decimal !== null ? bookData.dewey_decimal : '',
        lc_classification: bookData.lc_classification !== null ? bookData.lc_classification : ''
      }

      console.log('Updated form data:', updatedFormData)
      console.log('Cover images:', {
        small: updatedFormData.cover_small,
        medium: updatedFormData.cover_medium,
        large: updatedFormData.cover_large
      })

      setFormData(updatedFormData)

      alert('✓ Book details loaded from OpenLibrary! Please review and confirm.')
    } catch (error) {
      console.error('Error fetching from OpenLibrary:', error)
      alert(`Could not find book in OpenLibrary: ${error.message}\n\nPlease enter book details manually.`)
      setOpenLibraryData(null)
    } finally {
      setFetchingFromOpenLibrary(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)

      // Auto-populate barcode with ISBN if barcode is empty
      // This ensures books can be found by scanning ISBN barcodes
      const bookData = { ...formData }
      if (!bookData.barcode && bookData.isbn) {
        bookData.barcode = bookData.isbn
        console.log('Auto-populated barcode with ISBN:', bookData.isbn)
      }

      const response = await createBook(bookData)
      const newBook = response.data

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
        pages: '',
        cover_small: '',
        cover_medium: '',
        cover_large: '',
        subjects: '',
        openlibrary_key: '',
        openlibrary_url: '',
        excerpt: '',
        dewey_decimal: '',
        lc_classification: ''
      })
      setShowForm(false)
      setSearch('')
      setOpenLibraryData(null)

      // Prompt to add a physical copy
      setRegisteredBook(newBook)
      setNewCopyData({ condition: 'Good', location: '', notes: '' })
      setShowAddCopyPrompt(true)
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
          status: 'Available',
          location: copyLocation || null
        })
      }
      alert(`✓ ${numCopiesToAdd} cop${numCopiesToAdd > 1 ? 'ies' : 'y'} added successfully!${copyLocation ? `\nLocation: ${copyLocation}` : ''}`)
      loadCopies(bookId)
      setNumCopiesToAdd(1)
      setCopyLocation('')
    } catch (error) {
      alert('Error adding copies: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEditCopy = (copy) => {
    setEditingCopyId(copy.id)
    setEditCopyData({
      condition: copy.condition || 'Good',
      location: copy.location || '',
      notes: copy.notes || '',
      status: copy.status || 'Available'
    })
  }

  const handleUpdateCopy = async (copyId) => {
    try {
      setLoading(true)
      await updateBookCopy(copyId, {
        condition: editCopyData.condition,
        location: editCopyData.location || null,
        notes: editCopyData.notes || null,
        status: editCopyData.status
      })
      alert('✓ Copy updated successfully!')
      setEditingCopyId(null)
      setEditCopyData({ condition: '', location: '', notes: '', status: '' })
      // Reload copies to show updated data
      if (selectedBookId) {
        loadCopies(selectedBookId)
      }
    } catch (error) {
      alert('Error updating copy: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const cancelEdit = () => {
    setEditingCopyId(null)
    setEditCopyData({ condition: '', location: '', notes: '', status: '' })
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
        // Book not found locally - try OpenLibrary
        setFormData(prev => ({
          ...prev,
          barcode,
          isbn: barcode // Assume barcode is ISBN for OpenLibrary lookup
        }))
        setShowForm(true)

        // Try to fetch from OpenLibrary
        alert('Book not found in system. Searching OpenLibrary...')
        await fetchFromOpenLibrary(barcode)
      } else {
        alert('Error searching by barcode: ' + error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCopyAfterRegister = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await createBookCopy({
        book_id: registeredBook.id,
        condition: newCopyData.condition,
        location: newCopyData.location || null,
        notes: newCopyData.notes || null,
        status: 'Available'
      })
      setShowAddCopyModal(false)
      setRegisteredBook(null)
      setNewCopyData({ condition: 'Good', location: '', notes: '' })
      alert('✓ Copy added successfully!')
    } catch (error) {
      alert('Error adding copy: ' + error.message)
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

      {/* Info Banner when directed from another page */}
      {searchParams.get('expand') === 'true' && (
        <div className="alert-success">
          <div className="flex items-start gap-3">
            <BookIcon className="w-6 h-6 text-success-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-success-100 mb-1">Ready to Add Copies</h3>
              <p className="text-success-200 text-sm">
                The book you selected is shown below. Click "View Copies" to see existing copies and add more.
              </p>
            </div>
          </div>
        </div>
      )}

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
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
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
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => selectedBookId === book.id ? setSelectedBookId(null) : loadCopies(book.id)}
                      className="btn-secondary text-sm"
                    >
                      {selectedBookId === book.id ? 'Hide Copies' : 'View Copies & Add More'}
                    </button>
                  </div>
                </div>

                {/* Show copies when expanded */}
                {selectedBookId === book.id && (
                  <div className="mt-4 border-t border-gray-600 pt-4">
                    <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <BookIcon className="w-5 h-5 text-primary-400" />
                      <span>Physical Copies</span>
                    </h4>

                    {copies.length === 0 ? (
                      <div className="bg-warning-900/20 border border-warning-500/30 rounded-lg p-4 mb-4">
                        <p className="text-warning-200 text-sm mb-2">
                          ⚠️ No physical copies added yet. Add at least one copy to enable checkout.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {copies.map((copy) => (
                          <div key={copy.id} className="bg-gray-800 p-3 rounded-lg hover:bg-gray-750 transition-colors">
                            {editingCopyId === copy.id ? (
                              // Edit mode
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300 font-medium text-sm">Copy #{copy.copy_number}</span>
                                  <span className={`text-xs font-semibold ${copy.status === 'Available' ? 'text-success-400' : 'text-warning-400'}`}>
                                    {copy.status}
                                  </span>
                                </div>

                                {/* Condition dropdown */}
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">Condition</label>
                                  <select
                                    value={editCopyData.condition}
                                    onChange={(e) => setEditCopyData({...editCopyData, condition: e.target.value})}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                                  >
                                    <option value="Excellent">Excellent</option>
                                    <option value="Good">Good</option>
                                    <option value="Fair">Fair</option>
                                    <option value="Poor">Poor</option>
                                  </select>
                                </div>

                                {/* Location input */}
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">Location</label>
                                  <input
                                    type="text"
                                    value={editCopyData.location}
                                    onChange={(e) => setEditCopyData({...editCopyData, location: e.target.value})}
                                    placeholder="e.g., Shelf A3, Room 101"
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                                  />
                                </div>

                                {/* Notes textarea */}
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                                  <textarea
                                    value={editCopyData.notes}
                                    onChange={(e) => setEditCopyData({...editCopyData, notes: e.target.value})}
                                    placeholder="Any additional notes about this copy"
                                    rows="2"
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                                  />
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUpdateCopy(copy.id)}
                                    disabled={loading}
                                    className="btn-success text-sm px-3 py-2 flex items-center gap-1"
                                  >
                                    <CheckIcon className="w-4 h-4" />
                                    <span>Save Changes</span>
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="btn-secondary text-sm px-3 py-2 flex items-center gap-1"
                                  >
                                    <XIcon className="w-4 h-4" />
                                    <span>Cancel</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // View mode
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-300 font-medium text-sm">Copy #{copy.copy_number}</span>
                                    <span className={`text-xs font-semibold ${copy.status === 'Available' ? 'text-success-400' : 'text-warning-400'}`}>
                                      {copy.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    <span className="text-gray-500">Condition:</span> {copy.condition}
                                  </div>
                                  {copy.location ? (
                                    <div className="text-xs text-primary-400 flex items-center gap-1">
                                      <span className="text-gray-500">📍 Location:</span>
                                      <span className="font-medium">{copy.location}</span>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500 italic">No location set</div>
                                  )}
                                  {copy.notes && (
                                    <div className="text-xs text-gray-400">
                                      <span className="text-gray-500">Notes:</span> {copy.notes}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleEditCopy(copy)}
                                  className="btn-secondary text-xs px-2 py-1 flex items-center gap-1 flex-shrink-0"
                                >
                                  <EditIcon className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-gray-800 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        {copies.length === 0 ? 'Add First Copy' : 'Add More Copies'}
                      </label>

                      <div className="space-y-3">
                        {/* Number of copies */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Number of copies</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={numCopiesToAdd}
                            onChange={(e) => setNumCopiesToAdd(parseInt(e.target.value) || 1)}
                            className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-medium"
                          />
                        </div>

                        {/* Location */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Location (optional)
                          </label>
                          <input
                            type="text"
                            value={copyLocation}
                            onChange={(e) => setCopyLocation(e.target.value)}
                            placeholder="e.g., Shelf A3, Room 101, Section Fiction"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            All {numCopiesToAdd} cop{numCopiesToAdd > 1 ? 'ies' : 'y'} will be assigned to this location
                          </p>
                        </div>

                        {/* Add button */}
                        <button
                          onClick={() => addCopies(book.id)}
                          disabled={loading}
                          className="btn-success w-full flex items-center justify-center gap-2"
                        >
                          <PlusIcon className="w-5 h-5" />
                          <span>
                            {loading ? 'Adding...' : `Add ${numCopiesToAdd} Cop${numCopiesToAdd > 1 ? 'ies' : 'y'}`}
                          </span>
                        </button>
                      </div>

                      <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700">
                        💡 Each copy represents a physical book that can be checked out separately. You can edit locations later.
                      </p>
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
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {showForm ? (
            <>
              <XIcon className="w-5 h-5" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <PlusIcon className="w-5 h-5" />
              <span>Register New Book</span>
            </>
          )}
        </button>
      </div>

      {/* Add Copy Prompt Modal - shown after book registration */}
      {showAddCopyPrompt && registeredBook && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-success-500/20 flex items-center justify-center mx-auto mb-4">
                <BookIcon className="w-6 h-6 text-success-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Book Registered!</h2>
              <p className="text-gray-300 mb-1">
                <span className="text-white font-medium">"{registeredBook.title}"</span> has been added to the system.
              </p>
              <p className="text-gray-400 text-sm mb-6">
                Would you like to add a physical copy to the library now?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => { setShowAddCopyPrompt(false); setShowAddCopyModal(true) }}
                  className="btn-success flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Yes, Add a Copy</span>
                </button>
                <button
                  onClick={() => { setShowAddCopyPrompt(false); setRegisteredBook(null) }}
                  className="btn-secondary"
                >
                  No, Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Copy Modal - shown if librarian says yes to adding a copy */}
      {showAddCopyModal && registeredBook && (
        <div className="modal-overlay" onClick={() => { setShowAddCopyModal(false); setRegisteredBook(null) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-1">Add Physical Copy</h2>
            <p className="text-gray-400 text-sm mb-4">
              Adding a copy for: <span className="text-white font-medium">{registeredBook.title}</span>
            </p>
            <form onSubmit={handleCreateCopyAfterRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Condition</label>
                <select
                  value={newCopyData.condition}
                  onChange={(e) => setNewCopyData({ ...newCopyData, condition: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
                  onChange={(e) => setNewCopyData({ ...newCopyData, location: e.target.value })}
                  placeholder="e.g., Shelf A3, Room 101"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                <textarea
                  value={newCopyData.notes}
                  onChange={(e) => setNewCopyData({ ...newCopyData, notes: e.target.value })}
                  rows="2"
                  placeholder="Optional notes about this copy"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="btn-success flex items-center gap-2">
                  <PlusIcon className="w-4 h-4" />
                  <span>{loading ? 'Adding...' : 'Add Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddCopyModal(false); setRegisteredBook(null) }}
                  className="btn-secondary"
                >
                  Skip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registration Form */}
      {showForm && (
        <div className="card">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Register New Book</h2>
              <p className="text-sm text-gray-400 mt-1">
                Enter ISBN to auto-fetch details from OpenLibrary
              </p>
            </div>
            {formData.cover_large && (
              <img
                src={formData.cover_large}
                alt={formData.title}
                className="w-32 h-auto rounded-lg shadow-xl border-2 border-primary-500"
              />
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* OpenLibrary Fetch Section */}
            <div className="alert-success">
              <div className="flex items-center gap-3 mb-3">
                <BookIcon className="w-6 h-6 text-success-400" />
                <div>
                  <h3 className="font-semibold text-success-100">Auto-Fill from OpenLibrary</h3>
                  <p className="text-sm text-success-200">Enter ISBN below and click fetch to auto-populate book details</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="isbn"
                  value={formData.isbn}
                  onChange={handleInputChange}
                  placeholder="Enter ISBN-10 or ISBN-13"
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
                <button
                  type="button"
                  onClick={() => fetchFromOpenLibrary(formData.isbn)}
                  disabled={fetchingFromOpenLibrary || !formData.isbn}
                  className="btn-success flex items-center gap-2 whitespace-nowrap"
                >
                  <SearchIcon className="w-5 h-5" />
                  <span>{fetchingFromOpenLibrary ? 'Fetching...' : 'Fetch Details'}</span>
                </button>
              </div>
            </div>

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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Leave empty to use ISBN as barcode"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: If empty, will automatically use ISBN. For books with custom barcodes, enter here.
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex items-center gap-2"
              >
                <BookIcon className="w-5 h-5" />
                <span>{loading ? 'Registering...' : 'Register Book'}</span>
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
