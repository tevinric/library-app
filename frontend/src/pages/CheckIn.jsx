import { useState } from 'react'
import { getBooks, getBookCopies, getBookByBarcode, returnCheckout } from '../api'
import BarcodeScanner from '../components/BarcodeScanner'
import { CheckInIcon } from '../components/Icons'

function CheckIn() {
  const [search, setSearch] = useState('')
  const [bookResults, setBookResults] = useState([])
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(true)
  const [loading, setLoading] = useState(false)

  // Modal visibility
  const [showBookModal, setShowBookModal] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Data
  const [confirmedBook, setConfirmedBook] = useState(null)
  const [bookCopies, setBookCopies] = useState([])
  const [selectedCopy, setSelectedCopy] = useState(null)
  const [returnResult, setReturnResult] = useState(null)

  const getDueStatus = (dueDate) => {
    const due = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diffTime = due - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays < 0) {
      return { status: 'overdue', text: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue` }
    } else if (diffDays === 0) {
      return { status: 'due-today', text: 'Due today' }
    } else {
      return { status: 'on-time', text: `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining` }
    }
  }

  // ── Barcode scan ──────────────────────────────────────────────
  const handleBarcodeScan = async (barcode) => {
    try {
      setLoading(true)
      const response = await getBookByBarcode(barcode)
      setConfirmedBook(response.data)
      setShowBarcodeScanner(false)
      setShowBookModal(true)
    } catch (error) {
      if (error.response?.status === 404) {
        alert('Book not found')
      } else {
        alert('Error scanning barcode: ' + error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Manual search ─────────────────────────────────────────────
  const searchBooks = async () => {
    try {
      setLoading(true)
      const response = await getBooks(search)
      setBookResults(response.data)
    } catch (error) {
      alert('Error searching books: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const selectBookFromResults = (book) => {
    setConfirmedBook(book)
    setBookResults([])
    setSearch('')
    setShowBookModal(true)
  }

  // ── Modal 1: Book confirmation ────────────────────────────────
  const cancelBookModal = () => {
    setShowBookModal(false)
    setConfirmedBook(null)
    setShowBarcodeScanner(true)
  }

  const confirmBook = async () => {
    try {
      setLoading(true)
      const response = await getBookCopies(confirmedBook.id)
      const checkedOut = response.data.filter(c => c.status === 'Checked Out')
      setBookCopies(checkedOut)
      setShowBookModal(false)
      setShowCopyModal(true)
    } catch (error) {
      alert('Error loading copies: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Modal 2: Copy selection ───────────────────────────────────
  const cancelCopyModal = () => {
    setShowCopyModal(false)
    setBookCopies([])
    setShowBookModal(true)
  }

  const selectCopy = (copy) => {
    setSelectedCopy(copy)
    setShowCopyModal(false)
    setShowConfirmModal(true)
  }

  // ── Modal 3: Final confirmation ───────────────────────────────
  const cancelConfirmModal = () => {
    setShowConfirmModal(false)
    setSelectedCopy(null)
    setShowCopyModal(true)
  }

  const confirmReturn = async () => {
    try {
      setLoading(true)
      await returnCheckout(selectedCopy.checkout_info.id)
      setReturnResult({ book: confirmedBook, copy: selectedCopy })
      setShowConfirmModal(false)
      setShowSuccessModal(true)
    } catch (error) {
      alert('Error returning book: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Reset after success ───────────────────────────────────────
  const reset = () => {
    setShowSuccessModal(false)
    setConfirmedBook(null)
    setBookCopies([])
    setSelectedCopy(null)
    setReturnResult(null)
    setSearch('')
    setBookResults([])
    setShowBarcodeScanner(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Return</h1>
        <p className="text-gray-400 mt-1">Return borrowed books to inventory</p>
      </div>

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Quick Return: Scan Barcode
          </label>
          <BarcodeScanner
            onScan={handleBarcodeScan}
            placeholder="Scan book barcode..."
            autoFocus={true}
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-2">
            Fastest method: Scan barcode to instantly find the book
          </p>
        </div>
      )}

      {/* Manual Search */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Or search manually
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchBooks()}
            placeholder="Search by title, author, ISBN, or barcode..."
            className="flex-1 px-4 py-2"
          />
          <button onClick={searchBooks} disabled={loading} className="btn-primary flex-shrink-0">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Book Search Results */}
      {bookResults.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">
              {bookResults.length} result{bookResults.length !== 1 ? 's' : ''} — select a book to return
            </h2>
            <button onClick={() => setBookResults([])} className="text-gray-400 hover:text-white text-sm">
              Clear
            </button>
          </div>
          <div className="space-y-3">
            {bookResults.map((book) => {
              const checkedOutCount = book.total_copies - book.available_copies
              return (
                <div key={book.id} className="bg-gray-700 rounded-lg p-4 flex justify-between items-center gap-4">
                  <div className="flex gap-4 flex-1 min-w-0">
                    {(book.cover_large || book.cover_medium) && (
                      <img
                        src={book.cover_large || book.cover_medium}
                        alt={book.title}
                        className="w-12 h-auto rounded flex-shrink-0"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold truncate">{book.title}</h3>
                      <p className="text-gray-400 text-sm">by {book.author}</p>
                      <p className="text-sm mt-1">
                        <span className="text-success-400">{book.available_copies} available</span>
                        <span className="text-gray-500"> / {book.total_copies} total</span>
                        {checkedOutCount > 0 && (
                          <span className="text-warning-400 ml-2">{checkedOutCount} checked out</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => selectBookFromResults(book)}
                    disabled={checkedOutCount === 0}
                    className={checkedOutCount === 0
                      ? 'btn-secondary opacity-50 cursor-not-allowed flex-shrink-0'
                      : 'btn-primary flex-shrink-0'}
                  >
                    {checkedOutCount === 0 ? 'None Out' : 'Select'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modal 1: Confirm Book ── */}
      {showBookModal && confirmedBook && (
        <div className="modal-overlay" onClick={cancelBookModal}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-6">Confirm Book to Return</h2>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6">
              {(confirmedBook.cover_large || confirmedBook.cover_medium) && (
                <div className="flex-shrink-0 flex sm:block justify-center">
                  <img
                    src={confirmedBook.cover_large || confirmedBook.cover_medium}
                    alt={confirmedBook.title}
                    className="w-28 sm:w-36 h-auto rounded-lg shadow-xl border-2 border-primary-500"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-1">{confirmedBook.title}</h3>
                <p className="text-lg text-gray-300 mb-4">by {confirmedBook.author}</p>
                <div className="space-y-2 text-sm">
                  {confirmedBook.isbn && (
                    <p><span className="text-gray-500">ISBN:</span> <span className="text-gray-300">{confirmedBook.isbn}</span></p>
                  )}
                  {confirmedBook.barcode && (
                    <p><span className="text-gray-500">Barcode:</span> <span className="text-gray-300">{confirmedBook.barcode}</span></p>
                  )}
                  {confirmedBook.publication_year && (
                    <p><span className="text-gray-500">Year:</span> <span className="text-gray-300">{confirmedBook.publication_year}</span></p>
                  )}
                  {confirmedBook.publisher && (
                    <p><span className="text-gray-500">Publisher:</span> <span className="text-gray-300">{confirmedBook.publisher}</span></p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-6">
              Is this the correct book being returned? Click Confirm to proceed to copy selection.
            </p>

            <div className="flex flex-wrap gap-3 justify-end">
              <button onClick={cancelBookModal} className="btn-secondary">Cancel</button>
              <button onClick={confirmBook} disabled={loading} className="btn-primary">
                {loading ? 'Loading copies...' : 'Confirm — Select Copy →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Select Copy ── */}
      {showCopyModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-1">Select Copy to Return</h2>
            <p className="text-gray-400 mb-6">
              <span className="font-medium text-gray-300">"{confirmedBook?.title}"</span> — select the copy being returned
            </p>

            {bookCopies.length === 0 ? (
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-6 mb-6 text-center">
                <p className="text-blue-200 text-lg font-medium mb-2">No Checked-Out Copies Found</p>
                <p className="text-blue-300 text-sm">All copies of this book are currently available. Nothing to return.</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {bookCopies.map((copy) => {
                  const dueStatus = copy.checkout_info?.due_date ? getDueStatus(copy.checkout_info.due_date) : null
                  const borrowDate = copy.checkout_info?.checkout_date
                    ? new Date(copy.checkout_info.checkout_date).toLocaleDateString()
                    : '—'
                  const dueDate = copy.checkout_info?.due_date
                    ? new Date(copy.checkout_info.due_date).toLocaleDateString()
                    : '—'

                  return (
                    <div key={copy.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600/80 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                          {/* Copy # */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Copy</p>
                            <p className="text-white font-bold text-xl">#{copy.copy_number}</p>
                            {copy.condition && <p className="text-gray-400 text-xs mt-0.5">{copy.condition}</p>}
                            {copy.location && (
                              <p className="text-primary-400 text-xs mt-1 font-medium">📍 {copy.location}</p>
                            )}
                          </div>

                          {/* Borrower */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Borrower</p>
                            <p className="text-white font-semibold">{copy.checkout_info?.borrower_name || '—'}</p>
                            <p className="text-primary-400 font-mono text-sm">{copy.checkout_info?.borrower_id || '—'}</p>
                          </div>

                          {/* Dates */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Borrow Date</p>
                            <p className="text-gray-300">{borrowDate}</p>
                            <p className="text-xs text-gray-500 mt-1">Due: {dueDate}</p>
                          </div>

                          {/* Due status */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Days</p>
                            {dueStatus ? (
                              <p className={`font-semibold ${
                                dueStatus.status === 'overdue' ? 'text-red-400' :
                                dueStatus.status === 'due-today' ? 'text-warning-400' :
                                'text-success-400'
                              }`}>
                                {dueStatus.text}
                                {dueStatus.status === 'overdue' && ' ⚠️'}
                              </p>
                            ) : <p className="text-gray-400">—</p>}
                          </div>
                        </div>

                        <button
                          onClick={() => selectCopy(copy)}
                          className="btn-success flex-shrink-0 w-full sm:w-auto"
                        >
                          <CheckInIcon className="w-4 h-4 inline mr-2" />
                          Return This Copy
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex justify-start">
              <button onClick={cancelCopyModal} className="btn-secondary">← Back</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Final Confirmation ── */}
      {showConfirmModal && selectedCopy && confirmedBook && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-6">Confirm Return</h2>

            <div className="bg-gray-700 rounded-lg p-6 space-y-4 mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Book</p>
                <p className="text-lg font-bold text-white">{confirmedBook.title}</p>
                <p className="text-gray-300 text-sm">by {confirmedBook.author}</p>
              </div>

              <div className="border-t border-gray-600 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Copy</p>
                <p className="text-white font-semibold">Copy #{selectedCopy.copy_number}</p>
                {selectedCopy.condition && (
                  <p className="text-gray-400 text-sm">Condition: {selectedCopy.condition}</p>
                )}
                {selectedCopy.location && (
                  <p className="text-primary-400 text-sm font-medium mt-1">📍 Return to: {selectedCopy.location}</p>
                )}
              </div>

              <div className="border-t border-gray-600 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Borrower</p>
                <p className="text-lg font-bold text-white">{selectedCopy.checkout_info?.borrower_name}</p>
                <p className="text-primary-400 font-mono">ID: {selectedCopy.checkout_info?.borrower_id}</p>
              </div>

              {selectedCopy.checkout_info?.due_date && (() => {
                const dueStatus = getDueStatus(selectedCopy.checkout_info.due_date)
                return (
                  <div className="border-t border-gray-600 pt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Return Status</p>
                    <p className={`font-bold text-lg ${
                      dueStatus.status === 'overdue' ? 'text-red-400' :
                      dueStatus.status === 'due-today' ? 'text-warning-400' :
                      'text-success-400'
                    }`}>
                      {dueStatus.text} {dueStatus.status === 'overdue' && '⚠️'}
                    </p>
                  </div>
                )
              })()}
            </div>

            <p className="text-gray-400 text-sm mb-6">
              This will mark the copy as returned and make it available for borrowing again.
            </p>

            <div className="flex flex-wrap gap-3 justify-end">
              <button onClick={cancelConfirmModal} className="btn-secondary">← Back</button>
              <button onClick={confirmReturn} disabled={loading} className="btn-success">
                {loading ? 'Processing...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal ── */}
      {showSuccessModal && returnResult && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-success-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Book Returned!</h2>
              <p className="text-gray-400">The book has been successfully checked in.</p>
            </div>

            <div className="bg-gray-700 rounded-lg p-6 space-y-4 mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Book</p>
                <p className="text-white font-semibold">{returnResult.book.title}</p>
                <p className="text-gray-400 text-sm">Copy #{returnResult.copy.copy_number}</p>
              </div>
              {returnResult.copy.location && (
                <div className="border-t border-gray-600 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reshelve At</p>
                  <p className="text-primary-400 font-semibold text-lg">📍 {returnResult.copy.location}</p>
                </div>
              )}
              <div className="border-t border-gray-600 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Returned By</p>
                <p className="text-white font-semibold">{returnResult.copy.checkout_info?.borrower_name}</p>
                <p className="text-primary-400 font-mono text-sm">ID: {returnResult.copy.checkout_info?.borrower_id}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={reset} className="btn-primary px-8">
                Return Another Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckIn
