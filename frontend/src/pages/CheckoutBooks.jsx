import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getBooks, getBookCopies, autocompleteBorrowers, createBorrower, createCheckout, getBookByBarcode, deleteBook } from '../api'
import BarcodeScanner from '../components/BarcodeScanner'
import { TrashIcon, AlertIcon, PlusIcon } from '../components/Icons'

function CheckoutBooks() {
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState('')
  const [books, setBooks] = useState([])
  const [selectedBook, setSelectedBook] = useState(null)
  const [copies, setCopies] = useState([])
  const [selectedCopy, setSelectedCopy] = useState(null)
  const [borrowerSearch, setBorrowerSearch] = useState('')
  const [borrowerSuggestions, setBorrowerSuggestions] = useState([])
  const [selectedBorrower, setSelectedBorrower] = useState(null)
  const [showNewBorrowerForm, setShowNewBorrowerForm] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(true)
  const [loading, setLoading] = useState(false)
  const [checkoutData, setCheckoutData] = useState({
    due_days: 14,
    notes: ''
  })
  const [newBorrowerData, setNewBorrowerData] = useState({
    first_name: ''
  })
  const [showBookConfirmModal, setShowBookConfirmModal] = useState(false)
  const [scannedBookData, setScannedBookData] = useState(null)
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState(null)

  useEffect(() => {
    if (borrowerSearch.length > 1) {
      searchBorrowers()
    } else {
      setBorrowerSuggestions([])
    }
  }, [borrowerSearch])

  const searchBooks = async () => {
    try {
      setLoading(true)
      const response = await getBooks(search)
      setBooks(response.data)
    } catch (error) {
      alert('Error searching books: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const selectBook = async (book) => {
    try {
      setLoading(true)
      const response = await getBookCopies(book.id)
      const allCopies = response.data
      const availableCopies = allCopies.filter(c => c.status === 'Available')

      // Open the same confirmation modal used by the barcode scan path
      setScannedBookData({ book: { ...book, copies: allCopies }, availableCopies })
      setShowBookConfirmModal(true)
    } catch (error) {
      alert('Error loading book details: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const selectCopy = (copy) => {
    setSelectedCopy(copy)
    setStep(3)
  }

  // Helper function to calculate days since checkout
  const getDaysSinceCheckout = (checkoutDate) => {
    const checkout = new Date(checkoutDate)
    const today = new Date()
    const diffTime = Math.abs(today - checkout)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Helper function to get due status
  const getDueStatus = (dueDate) => {
    const due = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)

    const diffTime = due - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { status: 'overdue', days: Math.abs(diffDays), text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}` }
    } else if (diffDays === 0) {
      return { status: 'due-today', days: 0, text: 'Due today' }
    } else {
      return { status: 'due', days: diffDays, text: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}` }
    }
  }

  const handleBarcodeScan = async (barcode) => {
    try {
      setLoading(true)
      const response = await getBookByBarcode(barcode)
      const book = response.data

      // Get available copies
      const availableCopies = book.copies?.filter(c => c.status === 'Available') || []

      // Store scanned book data and show confirmation modal
      setScannedBookData({ book, availableCopies })
      setShowBookConfirmModal(true)
      setShowBarcodeScanner(false)

    } catch (error) {
      if (error.response?.status === 404) {
        alert('Book not found. Please register it first.')
      } else {
        alert('Error scanning barcode: ' + error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const confirmBook = () => {
    const { book, availableCopies } = scannedBookData

    // Set book and copies
    setSelectedBook(book)
    setCopies(availableCopies)
    setShowBookConfirmModal(false)

    if (availableCopies.length === 0) {
      // No available copies - show book details at step 2
      setStep(2)
      if (book.total_copies === 0) {
        // Only show alert if truly no copies exist
        alert('⚠️ Book found but no copies have been added yet.\n\nThis book needs copies before it can be checked out.\n\nYou can view details or delete the book registration.')
      }
      // If copies are checked out, don't show alert - the info box will show details
    } else if (availableCopies.length === 1) {
      // Auto-select the single available copy and skip to borrower selection
      setSelectedCopy(availableCopies[0])
      setStep(3)
    } else {
      // Multiple copies available - show selection
      setStep(2)
    }
  }

  const cancelBookConfirm = () => {
    setShowBookConfirmModal(false)
    setScannedBookData(null)
    setShowBarcodeScanner(true)
  }

  const searchBorrowers = async () => {
    try {
      const response = await autocompleteBorrowers(borrowerSearch)
      setBorrowerSuggestions(response.data)
    } catch (error) {
      console.error('Error searching borrowers:', error)
    }
  }

  const selectBorrower = (borrower) => {
    setSelectedBorrower(borrower)
    setBorrowerSearch(`${borrower.first_name} (${borrower.borrower_id})`)
    setBorrowerSuggestions([])
  }

  const handleDeleteBook = async (bookId) => {
    if (!confirm('⚠️ Are you sure you want to delete this book?\n\nThis will permanently remove the book and all its copies from the system.\n\nThis action cannot be undone!')) {
      return
    }

    try {
      setLoading(true)
      await deleteBook(bookId)
      alert('✓ Book deleted successfully!')

      // Reset to step 1
      setStep(1)
      setSelectedBook(null)
      setCopies([])
      setSelectedCopy(null)
      setBooks([])
      setSearch('')
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('checked out')) {
        alert('❌ Cannot delete this book:\n\nThere are active checkouts for this book.\n\nPlease check in all copies before deleting.')
      } else {
        alert('Error deleting book: ' + error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBorrower = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const response = await createBorrower(newBorrowerData)
      setSelectedBorrower(response.data)
      setShowNewBorrowerForm(false)
      alert('Borrower created successfully!')
    } catch (error) {
      alert('Error creating borrower: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckout = async () => {
    try {
      setLoading(true)
      const response = await createCheckout({
        copy_id: selectedCopy.id,
        borrower_id: selectedBorrower.id,
        due_days: checkoutData.due_days,
        notes: checkoutData.notes
      })

      // Calculate due date
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + checkoutData.due_days)

      // Store result and show success modal
      setCheckoutResult({
        book: selectedBook,
        copy: selectedCopy,
        borrower: selectedBorrower,
        dueDate: dueDate.toLocaleDateString()
      })
      setShowCheckoutSuccess(true)
    } catch (error) {
      alert('Error checking out book: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const closeSuccessModal = () => {
    setShowCheckoutSuccess(false)
    setCheckoutResult(null)
    // Reset to fresh page
    setStep(1)
    setSearch('')
    setBooks([])
    setSelectedBook(null)
    setCopies([])
    setSelectedCopy(null)
    setBorrowerSearch('')
    setSelectedBorrower(null)
    setShowBarcodeScanner(true)
    setCheckoutData({ due_days: 14, notes: '' })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Borrow</h1>
        <p className="text-gray-400 mt-1">Lend books to borrowers</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        <div className={`flex items-center ${step >= 1 ? 'text-primary-400' : 'text-gray-500'}`}>
          <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step >= 1 ? 'bg-primary-600' : 'bg-gray-700'}`}>1</span>
          <span className="ml-1 sm:ml-2 text-sm sm:text-base">Select Book</span>
        </div>
        <span className="text-gray-600 flex-shrink-0">→</span>
        <div className={`flex items-center ${step >= 2 ? 'text-primary-400' : 'text-gray-500'}`}>
          <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-700'}`}>2</span>
          <span className="ml-1 sm:ml-2 text-sm sm:text-base">Select Copy</span>
        </div>
        <span className="text-gray-600 flex-shrink-0">→</span>
        <div className={`flex items-center ${step >= 3 ? 'text-primary-400' : 'text-gray-500'}`}>
          <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step >= 3 ? 'bg-primary-600' : 'bg-gray-700'}`}>3</span>
          <span className="ml-1 sm:ml-2 text-sm sm:text-base">Select Borrower</span>
        </div>
      </div>

      {/* Step 1: Select Book */}
      {step === 1 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Search for Book</h2>

          {/* Barcode Scanner Section */}
          {showBarcodeScanner && (
            <div className="mb-6 pb-6 border-b border-gray-600">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quick Checkout: Scan Barcode
              </label>
              <BarcodeScanner
                onScan={handleBarcodeScan}
                placeholder="Scan book barcode..."
                autoFocus={true}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Fastest method: Scan barcode to instantly find the book
              </p>
            </div>
          )}

          {/* Manual Search Section */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Or search manually
            </label>
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, author, ISBN, or barcode..."
                className="flex-1 px-4 py-2"
                onKeyPress={(e) => e.key === 'Enter' && searchBooks()}
              />
              <button onClick={searchBooks} className="btn-primary">Search</button>
            </div>
          </div>

          {books.length > 0 && (
            <div className="space-y-3">
              {books.map((book) => (
                <div key={book.id} className="bg-gray-700 rounded-lg p-4 flex items-center gap-4">
                  {/* Cover image */}
                  {(book.cover_large || book.cover_medium) && (
                    <img
                      src={book.cover_large || book.cover_medium}
                      alt={book.title}
                      className="w-14 h-auto rounded shadow-lg flex-shrink-0"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">{book.title}</h3>
                    <p className="text-gray-400 text-sm">by {book.author}</p>
                    <div className="mt-1 space-y-0.5">
                      {book.isbn && <p className="text-sm text-gray-500">ISBN: {book.isbn}</p>}
                      {book.barcode && <p className="text-sm text-gray-500">Barcode: {book.barcode}</p>}
                      <p className="text-sm">
                        <span className="text-success-400 font-medium">{book.available_copies} available</span>
                        <span className="text-gray-500"> of {book.total_copies} total</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => selectBook(book)}
                    disabled={loading}
                    className="btn-primary flex-shrink-0"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Copy */}
      {step === 2 && (
        <div className="card">
          <div className="mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white">"{selectedBook?.title}"</h2>
                <p className="text-gray-400 text-sm mt-1">by {selectedBook?.author}</p>
                {selectedBook?.isbn && <p className="text-gray-500 text-sm">ISBN: {selectedBook.isbn}</p>}
                {selectedBook?.barcode && <p className="text-gray-500 text-sm">Barcode: {selectedBook.barcode}</p>}
              </div>

              {/* Book Cover */}
              {selectedBook?.cover_large || selectedBook?.cover_medium ? (
                <img
                  src={selectedBook.cover_large || selectedBook.cover_medium}
                  alt={selectedBook.title}
                  className="w-24 h-auto rounded-lg shadow-xl border-2 border-primary-500 ml-4"
                  onError={(e) => e.target.style.display = 'none'}
                />
              ) : null}
            </div>
          </div>

          {copies.length === 0 ? (
            // No copies available
            selectedBook?.total_copies === 0 ? (
              // No copies exist at all - show warning
              <div className="alert-warning mb-4">
                <div className="flex items-start gap-3">
                  <AlertIcon className="w-6 h-6 text-warning-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-warning-100 mb-2">No Copies Available</h3>
                    <div>
                      <p className="text-warning-200 mb-3">
                        This book has been registered but no physical copies have been added yet.
                      </p>
                      <p className="text-warning-200 mb-3">
                        <strong>To checkout this book:</strong>
                      </p>
                      <ol className="list-decimal list-inside text-warning-200 space-y-1 mb-3">
                        <li>Go to the <strong>Register Books</strong> page</li>
                        <li>Search for this book</li>
                        <li>Click "View Copies"</li>
                        <li>Add at least one copy</li>
                      </ol>
                      <div className="flex gap-2">
                        <Link
                          to={`/books/register?bookId=${selectedBook.id}&title=${encodeURIComponent(selectedBook.title)}&isbn=${selectedBook.isbn || ''}&expand=true`}
                          className="btn-success text-sm flex items-center gap-2"
                        >
                          <PlusIcon className="w-4 h-4" />
                          <span>Add Copies Now</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // All copies are checked out - show info box with borrower details
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-100 mb-3">No Copies Available - All Currently Borrowed</h3>
                    <p className="text-blue-200 mb-4">
                      All <strong>{selectedBook?.total_copies}</strong> cop{selectedBook?.total_copies > 1 ? 'ies' : 'y'} of this book {selectedBook?.total_copies > 1 ? 'are' : 'is'} currently borrowed.
                    </p>

                    {/* List of checked out copies */}
                    <div className="space-y-3">
                      {selectedBook?.copies?.filter(c => c.status === 'Checked Out').map((copy) => {
                        const daysSince = copy.checkout_info?.checkout_date ? getDaysSinceCheckout(copy.checkout_info.checkout_date) : null
                        const dueStatus = copy.checkout_info?.due_date ? getDueStatus(copy.checkout_info.due_date) : null

                        return (
                          <div key={copy.id} className="bg-blue-900/40 border border-blue-500/30 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-blue-100 font-bold text-lg mb-2">
                                  Copy #{copy.copy_number}
                                </p>
                                {copy.checkout_info ? (
                                  <div className="space-y-2">
                                    <div>
                                      <p className="text-blue-300 text-xs uppercase tracking-wide mb-1">Borrower</p>
                                      <p className="text-white font-semibold text-base">
                                        {copy.checkout_info.borrower_name}
                                      </p>
                                      <p className="text-primary-400 font-mono font-semibold text-sm">
                                        ID: {copy.checkout_info.borrower_id}
                                      </p>
                                    </div>
                                    {daysSince !== null && (
                                      <div>
                                        <p className="text-blue-300 text-xs uppercase tracking-wide mb-1">Borrowed For</p>
                                        <p className="text-white font-semibold text-base">
                                          {daysSince} day{daysSince !== 1 ? 's' : ''}
                                        </p>
                                      </div>
                                    )}
                                    {dueStatus && (
                                      <div>
                                        <p className="text-blue-300 text-xs uppercase tracking-wide mb-1">Status</p>
                                        <p className={`font-bold text-base ${
                                          dueStatus.status === 'overdue' ? 'text-red-400' :
                                          dueStatus.status === 'due-today' ? 'text-warning-400' :
                                          'text-success-400'
                                        }`}>
                                          {dueStatus.text}
                                          {dueStatus.status === 'overdue' && ' ⚠️'}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-blue-300 text-sm italic">Checkout information not available</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Link to Borrowed Books filtered to this book */}
                    <div className="mt-4 pt-4 border-t border-blue-500/30">
                      <Link
                        to={`/checked-out?search=${encodeURIComponent(selectedBook?.title || '')}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700/50 hover:bg-blue-600/60 text-blue-100 hover:text-white rounded-lg text-sm font-medium transition-all duration-200 border border-blue-500/50 hover:border-blue-400/70"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View in Borrowed Books →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            // Show available copies
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-3">
                Select a Copy ({copies.length} available)
              </h3>
              <div className="space-y-3">
                {copies.map((copy) => (
                  <div key={copy.id} className="bg-gray-700 rounded-lg p-4 flex justify-between items-start hover:bg-gray-600 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-white font-medium">Copy #{copy.copy_number}</p>
                        <span className="px-2 py-1 bg-success-900/50 text-success-300 text-xs rounded-full">
                          {copy.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-400">
                          <span className="text-gray-500">Condition:</span> {copy.condition}
                        </p>
                        {copy.location && (
                          <p className="text-gray-400">
                            <span className="text-gray-500">Location:</span> <span className="text-primary-400 font-medium">{copy.location}</span>
                          </p>
                        )}
                        {copy.notes && (
                          <p className="text-gray-400 text-xs">
                            <span className="text-gray-500">Notes:</span> {copy.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => selectCopy(copy)} className="btn-primary ml-4">Select</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => { setStep(1); setShowBarcodeScanner(true); }} className="btn-secondary mt-4">← Back to Search</button>
        </div>
      )}

      {/* Step 3: Select Borrower */}
      {step === 3 && !showNewBorrowerForm && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Select Borrower</h2>
          <div className="relative mb-4">
            <input
              type="text"
              value={borrowerSearch}
              onChange={(e) => setBorrowerSearch(e.target.value)}
              placeholder="Start typing borrower name..."
              className="w-full px-4 py-2"
            />
            {borrowerSuggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-gray-700 border border-gray-600 rounded-lg mt-1 max-h-60 overflow-y-auto">
                {borrowerSuggestions.map((borrower) => (
                  <div
                    key={borrower.id}
                    onClick={() => selectBorrower(borrower)}
                    className="px-4 py-3 hover:bg-gray-600 cursor-pointer"
                  >
                    <p className="text-white font-medium">{borrower.first_name}</p>
                    <p className="text-gray-400 text-sm">ID: {borrower.borrower_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedBorrower && (
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <h3 className="text-white font-semibold mb-2">Selected Borrower</h3>
              <p className="text-white">{selectedBorrower.first_name}</p>
              <p className="text-gray-400 text-sm">ID: {selectedBorrower.borrower_id}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Due in (days)</label>
              <input
                type="number"
                value={checkoutData.due_days}
                onChange={(e) => setCheckoutData({...checkoutData, due_days: parseInt(e.target.value)})}
                className="w-full px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
              <textarea
                value={checkoutData.notes}
                onChange={(e) => setCheckoutData({...checkoutData, notes: e.target.value})}
                rows="3"
                className="w-full px-4 py-2"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={handleCheckout}
              disabled={!selectedBorrower || loading}
              className="btn-primary"
            >
              Complete Checkout
            </button>
            <button
              onClick={() => setShowNewBorrowerForm(true)}
              className="btn-secondary"
            >
              + New Borrower
            </button>
            <button onClick={() => { setStep(2); }} className="btn-secondary">← Back</button>
          </div>
        </div>
      )}

      {/* New Borrower Form */}
      {showNewBorrowerForm && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">New Borrower</h2>
          <form onSubmit={handleCreateBorrower} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
              <input
                type="text"
                value={newBorrowerData.first_name}
                onChange={(e) => setNewBorrowerData({...newBorrowerData, first_name: e.target.value})}
                required
                className="w-full px-4 py-2"
              />
            </div>
            <div className="bg-gray-700 p-3 rounded-lg">
              <p className="text-sm text-gray-400">
                A unique borrower ID will be automatically generated when you create this borrower.
              </p>
            </div>
            <div className="flex gap-4">
              <button type="submit" disabled={loading} className="btn-primary">Create Borrower</button>
              <button type="button" onClick={() => setShowNewBorrowerForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Book Confirmation Modal */}
      {showBookConfirmModal && scannedBookData && (
        <div className="modal-overlay" onClick={cancelBookConfirm}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-6">Confirm Book</h2>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6">
              {/* Book Cover */}
              {(scannedBookData.book.cover_large || scannedBookData.book.cover_medium) && (
                <div className="flex-shrink-0 flex sm:block justify-center">
                  <img
                    src={scannedBookData.book.cover_large || scannedBookData.book.cover_medium}
                    alt={scannedBookData.book.title}
                    className="w-32 sm:w-40 h-auto rounded-lg shadow-xl border-2 border-primary-500"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}

              {/* Book Details */}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2">{scannedBookData.book.title}</h3>
                <p className="text-lg text-gray-300 mb-4">by {scannedBookData.book.author}</p>

                <div className="space-y-2 text-gray-400">
                  {scannedBookData.book.publish_year && (
                    <p className="text-lg">
                      <span className="text-gray-500">Year:</span> <span className="text-white font-semibold">{scannedBookData.book.publish_year}</span>
                    </p>
                  )}
                  {scannedBookData.book.isbn && (
                    <p><span className="text-gray-500">ISBN:</span> {scannedBookData.book.isbn}</p>
                  )}
                  {scannedBookData.book.barcode && (
                    <p><span className="text-gray-500">Barcode:</span> {scannedBookData.book.barcode}</p>
                  )}
                  <p>
                    <span className="text-gray-500">Available Copies:</span>{' '}
                    <span className={scannedBookData.availableCopies.length > 0 ? 'text-success-400 font-semibold' : 'text-warning-400 font-semibold'}>
                      {scannedBookData.availableCopies.length}
                    </span>
                    {' '}of {scannedBookData.book.total_copies}
                  </p>
                </div>
              </div>
            </div>

            {/* Show checked out copies info if no copies available */}
            {scannedBookData.availableCopies.length === 0 && scannedBookData.book.total_copies > 0 && (
              <div className="mb-6 bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-100 mb-2">All Copies Currently Borrowed</h4>
                    <div className="space-y-2 text-sm">
                      {scannedBookData.book.copies?.filter(c => c.status === 'Checked Out').map((copy) => {
                        const daysSince = copy.checkout_info?.checkout_date ? getDaysSinceCheckout(copy.checkout_info.checkout_date) : null
                        const dueStatus = copy.checkout_info?.due_date ? getDueStatus(copy.checkout_info.due_date) : null

                        return (
                          <div key={copy.id} className="bg-blue-900/40 border border-blue-500/30 rounded-lg p-2 text-sm">
                            <span className="font-semibold text-blue-100">Copy #{copy.copy_number}</span>
                            {copy.checkout_info && (
                              <div className="mt-1 space-y-0.5">
                                <div>
                                  <span className="text-blue-300">Borrower:</span>{' '}
                                  <span className="text-white font-semibold">{copy.checkout_info.borrower_name}</span>
                                  {' '}
                                  <span className="font-mono text-primary-400">({copy.checkout_info.borrower_id})</span>
                                </div>
                                {daysSince && (
                                  <div>
                                    <span className="text-blue-300">Borrowed for:</span>{' '}
                                    <span className="text-white font-semibold">{daysSince} day{daysSince !== 1 ? 's' : ''}</span>
                                  </div>
                                )}
                                {dueStatus && (
                                  <div>
                                    <span className="text-blue-300">Status:</span>{' '}
                                    <span className={`font-semibold ${
                                      dueStatus.status === 'overdue' ? 'text-red-400' :
                                      dueStatus.status === 'due-today' ? 'text-warning-400' :
                                      'text-success-400'
                                    }`}>
                                      {dueStatus.text}
                                      {dueStatus.status === 'overdue' && ' ⚠️'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Link to Borrowed Books filtered to this book */}
                    <div className="mt-3 pt-3 border-t border-blue-500/30">
                      <Link
                        to={`/checked-out?search=${encodeURIComponent(scannedBookData.book.title || '')}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-700/50 hover:bg-blue-600/60 text-blue-100 hover:text-white rounded-lg text-sm font-medium transition-all duration-200 border border-blue-500/50 hover:border-blue-400/70"
                        onClick={cancelBookConfirm}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View in Borrowed Books →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-end">
              <button onClick={cancelBookConfirm} className="btn-secondary">
                Cancel
              </button>
              <button onClick={confirmBook} className="btn-primary">
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Success Modal */}
      {showCheckoutSuccess && checkoutResult && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-success-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Checkout Successful!</h2>
              <p className="text-gray-400">Book has been borrowed successfully</p>
            </div>

            <div className="bg-gray-700 rounded-lg p-6 space-y-4 mb-6">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">Book</h3>
                <p className="text-lg font-semibold text-white">{checkoutResult.book.title}</p>
                <p className="text-gray-300">Copy #{checkoutResult.copy.copy_number}</p>
              </div>

              <div className="border-t border-gray-600 pt-4">
                <h3 className="text-sm font-medium text-gray-400 mb-1">Borrower</h3>
                <p className="text-lg font-semibold text-white">{checkoutResult.borrower.first_name}</p>
                <p className="text-primary-400 font-mono">ID: {checkoutResult.borrower.borrower_id}</p>
              </div>

              <div className="border-t border-gray-600 pt-4">
                <h3 className="text-sm font-medium text-gray-400 mb-1">Due Date</h3>
                <p className="text-lg font-semibold text-warning-400">{checkoutResult.dueDate}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={closeSuccessModal} className="btn-primary px-8">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckoutBooks
