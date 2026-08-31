import { useState, useEffect } from 'react'
import { getCheckoutHistory, getBookByBarcode } from '../api'
import { format } from 'date-fns'
import { SearchIcon, BookIcon } from '../components/Icons'
import BarcodeScanner from '../components/BarcodeScanner'

function CheckoutHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [scannedBook, setScannedBook] = useState(null)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async (searchTerm) => {
    const term = searchTerm !== undefined ? searchTerm : search
    try {
      setLoading(true)
      const response = await getCheckoutHistory({ search: term })
      setHistory(response.data)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setScannedBook(null)
    loadHistory(search)
  }

  const handleBarcodeScan = async (barcode) => {
    try {
      setLoading(true)
      const response = await getBookByBarcode(barcode)
      const book = response.data
      setScannedBook(book)
      setSearch(book.title)
      const historyResponse = await getCheckoutHistory({ search: book.title })
      setHistory(historyResponse.data)
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

  const clearScannedBook = () => {
    setScannedBook(null)
    setSearch('')
    loadHistory('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink">Checkout History</h1>
        <p className="text-gray-400 mt-1">View complete checkout history</p>
      </div>

      {/* Barcode Scanner */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-600 mb-2">
          Quick Lookup: Scan Barcode
        </label>
        <BarcodeScanner
          onScan={handleBarcodeScan}
          placeholder="Scan book barcode to view its history..."
          autoFocus={true}
          disabled={loading}
        />
        <p className="text-xs text-gray-500 mt-2">
          Scan a book barcode to instantly filter history to that book
        </p>
      </div>

      {/* Text Search */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-600 mb-2">
          Or search manually
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by book title, author, or borrower name..."
            className="flex-1 px-4 py-2"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn-primary flex items-center gap-2 flex-shrink-0">
            <SearchIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </div>

      {/* Scanned Book Banner */}
      {scannedBook && (
        <div className="alert-success">
          <div className="flex items-center gap-4">
            {(scannedBook.cover_small || scannedBook.cover_medium) ? (
              <img
                src={scannedBook.cover_small || scannedBook.cover_medium}
                alt={scannedBook.title}
                className="w-12 h-auto rounded shadow-lg flex-shrink-0"
                onError={(e) => e.target.style.display = 'none'}
              />
            ) : (
              <div className="w-12 h-16 bg-success-50 rounded flex items-center justify-center flex-shrink-0">
                <BookIcon className="w-6 h-6 text-success-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-success-800 font-semibold truncate">{scannedBook.title}</p>
              <p className="text-success-800 text-sm">by {scannedBook.author}</p>
              {scannedBook.isbn && (
                <p className="text-success-700 text-xs mt-0.5">ISBN: {scannedBook.isbn}</p>
              )}
            </div>
            <button
              onClick={clearScannedBook}
              className="btn-secondary text-sm flex-shrink-0"
            >
              Clear Filter
            </button>
          </div>
        </div>
      )}

      {/* History List */}
      {history.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-400">
            {scannedBook
              ? `No checkout history found for "${scannedBook.title}"`
              : search
              ? 'No checkout history found for that search'
              : 'No checkout history found'}
          </p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-xl font-semibold text-ink mb-4">
            {history.length} checkout record{history.length !== 1 ? 's' : ''}
            {scannedBook && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                for "{scannedBook.title}"
              </span>
            )}
          </h2>

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {history.map((record) => (
              <div key={record.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{record.title}</p>
                    <p className="text-sm text-gray-400">by {record.author}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                    record.status === 'Returned'
                      ? 'bg-success-50 text-success-700'
                      : record.status === 'Checked Out'
                      ? 'bg-primary-50 text-primary-700'
                      : 'bg-danger-50 text-danger-700'
                  }`}>
                    {record.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Borrower</p>
                    <p className="text-ink">{record.first_name}</p>
                    <p className="text-gray-400 text-xs">ID: {record.borrower_id}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Copy</p>
                    <p className="text-gray-600">#{record.copy_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Checkout Date</p>
                    <p className="text-gray-600">{format(new Date(record.checkout_date), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Due Date</p>
                    <p className="text-gray-600">{format(new Date(record.due_date), 'MMM d, yyyy')}</p>
                  </div>
                  {record.return_date && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Returned</p>
                      <p className="text-gray-600">{format(new Date(record.return_date), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Duration</p>
                    <p className="text-gray-600">{Math.floor(record.duration_days)} days</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Copy</th>
                  <th>Borrower</th>
                  <th>Checkout Date</th>
                  <th>Due Date</th>
                  <th>Return Date</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div>
                        <p className="font-medium text-ink">{record.title}</p>
                        <p className="text-sm text-gray-400">by {record.author}</p>
                      </div>
                    </td>
                    <td className="text-gray-600">#{record.copy_number}</td>
                    <td>
                      <div>
                        <p className="text-ink">{record.first_name}</p>
                        <p className="text-sm text-gray-400">ID: {record.borrower_id}</p>
                      </div>
                    </td>
                    <td className="text-gray-600">
                      {format(new Date(record.checkout_date), 'MMM d, yyyy')}
                    </td>
                    <td className="text-gray-600">
                      {format(new Date(record.due_date), 'MMM d, yyyy')}
                    </td>
                    <td className="text-gray-600">
                      {record.return_date
                        ? format(new Date(record.return_date), 'MMM d, yyyy')
                        : '-'}
                    </td>
                    <td className="text-gray-600">{Math.floor(record.duration_days)} days</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.status === 'Returned'
                          ? 'bg-success-50 text-success-700'
                          : record.status === 'Checked Out'
                          ? 'bg-primary-50 text-primary-700'
                          : 'bg-danger-50 text-danger-700'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckoutHistory
