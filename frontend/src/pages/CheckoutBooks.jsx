import { useState, useEffect } from 'react'
import { getBooks, getBookCopies, autocompleteBorrowers, createBorrower, createCheckout, getBookByBarcode } from '../api'
import BarcodeScanner from '../components/BarcodeScanner'

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
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    alt_phone: '',
    address: ''
  })

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
      const available = response.data.filter(c => c.status === 'Available')
      setCopies(available)
      setSelectedBook(book)
      setStep(2)
    } catch (error) {
      alert('Error loading copies: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const selectCopy = (copy) => {
    setSelectedCopy(copy)
    setStep(3)
  }

  const handleBarcodeScan = async (barcode) => {
    try {
      setLoading(true)
      const response = await getBookByBarcode(barcode)
      const book = response.data

      if (book.available_copies === 0) {
        alert('No available copies of this book')
        return
      }

      // Get available copies
      const availableCopies = book.copies?.filter(c => c.status === 'Available') || []

      if (availableCopies.length === 1) {
        // Auto-select the single available copy and skip to borrower selection
        setSelectedBook(book)
        setCopies(availableCopies)
        setSelectedCopy(availableCopies[0])
        setStep(3)
        setShowBarcodeScanner(false)
      } else {
        // Multiple copies available - show selection
        setSelectedBook(book)
        setCopies(availableCopies)
        setStep(2)
        setShowBarcodeScanner(false)
      }

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
    setBorrowerSearch(`${borrower.first_name} ${borrower.last_name}`)
    setBorrowerSuggestions([])
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
      await createCheckout({
        copy_id: selectedCopy.id,
        borrower_id: selectedBorrower.id,
        due_days: checkoutData.due_days,
        notes: checkoutData.notes
      })
      alert('Book checked out successfully!')
      // Reset
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
    } catch (error) {
      alert('Error checking out book: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Checkout Books</h1>
        <p className="text-gray-400 mt-1">Check out books to borrowers</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        <div className={`flex items-center ${step >= 1 ? 'text-primary-400' : 'text-gray-500'}`}>
          <span className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary-600' : 'bg-gray-700'}`}>1</span>
          <span className="ml-2">Select Book</span>
        </div>
        <span className="text-gray-600">→</span>
        <div className={`flex items-center ${step >= 2 ? 'text-primary-400' : 'text-gray-500'}`}>
          <span className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary-600' : 'bg-gray-700'}`}>2</span>
          <span className="ml-2">Select Copy</span>
        </div>
        <span className="text-gray-600">→</span>
        <div className={`flex items-center ${step >= 3 ? 'text-primary-400' : 'text-gray-500'}`}>
          <span className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-primary-600' : 'bg-gray-700'}`}>3</span>
          <span className="ml-2">Select Borrower</span>
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
                <div key={book.id} className="bg-gray-700 rounded-lg p-4 flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{book.title}</h3>
                    <p className="text-gray-400">by {book.author}</p>
                    <div className="mt-2 space-y-1">
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
                    disabled={book.available_copies === 0}
                    className={book.available_copies > 0 ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}
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
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">Select Copy of "{selectedBook?.title}"</h2>
            <p className="text-gray-400 text-sm mt-1">by {selectedBook?.author}</p>
            {selectedBook?.isbn && <p className="text-gray-500 text-sm">ISBN: {selectedBook.isbn}</p>}
            {selectedBook?.barcode && <p className="text-gray-500 text-sm">Barcode: {selectedBook.barcode}</p>}
          </div>

          <div className="space-y-3">
            {copies.map((copy) => (
              <div key={copy.id} className="bg-gray-700 rounded-lg p-4 flex justify-between items-start">
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
                        <span className="text-gray-500">📍 Location:</span> <span className="text-primary-400 font-medium">{copy.location}</span>
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
          <button onClick={() => { setStep(1); setShowBarcodeScanner(true); }} className="btn-secondary mt-4">← Back</button>
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
                    <p className="text-white font-medium">{borrower.first_name} {borrower.last_name}</p>
                    <p className="text-gray-400 text-sm">{borrower.email} • {borrower.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedBorrower && (
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <h3 className="text-white font-semibold mb-2">Selected Borrower</h3>
              <p className="text-white">{selectedBorrower.first_name} {selectedBorrower.last_name}</p>
              <p className="text-gray-400 text-sm">{selectedBorrower.email}</p>
              <p className="text-gray-400 text-sm">{selectedBorrower.phone}</p>
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

          <div className="flex gap-4 mt-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
                <input
                  type="text"
                  value={newBorrowerData.last_name}
                  onChange={(e) => setNewBorrowerData({...newBorrowerData, last_name: e.target.value})}
                  required
                  className="w-full px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                <input
                  type="email"
                  value={newBorrowerData.email}
                  onChange={(e) => setNewBorrowerData({...newBorrowerData, email: e.target.value})}
                  required
                  className="w-full px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone *</label>
                <input
                  type="tel"
                  value={newBorrowerData.phone}
                  onChange={(e) => setNewBorrowerData({...newBorrowerData, phone: e.target.value})}
                  required
                  className="w-full px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Alt Phone</label>
                <input
                  type="tel"
                  value={newBorrowerData.alt_phone}
                  onChange={(e) => setNewBorrowerData({...newBorrowerData, alt_phone: e.target.value})}
                  className="w-full px-4 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Address</label>
              <textarea
                value={newBorrowerData.address}
                onChange={(e) => setNewBorrowerData({...newBorrowerData, address: e.target.value})}
                rows="2"
                className="w-full px-4 py-2"
              />
            </div>
            <div className="flex gap-4">
              <button type="submit" disabled={loading} className="btn-primary">Create Borrower</button>
              <button type="button" onClick={() => setShowNewBorrowerForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default CheckoutBooks
