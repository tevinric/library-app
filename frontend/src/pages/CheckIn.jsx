import { useState, useEffect } from 'react'
import { getCheckouts, returnCheckout, getBookByBarcode } from '../api'
import { formatDistanceToNow } from 'date-fns'
import BarcodeScanner from '../components/BarcodeScanner'
import { CheckInIcon } from '../components/Icons'

function CheckIn() {
  const [checkouts, setCheckouts] = useState([])
  const [scannedCheckouts, setScannedCheckouts] = useState([])
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(true)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadCheckouts()
  }, [search])

  const loadCheckouts = async () => {
    try {
      setLoading(true)
      const response = await getCheckouts(search)
      setCheckouts(response.data)
    } catch (error) {
      console.error('Error loading checkouts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBarcodeScan = async (barcode) => {
    try {
      setLoading(true)
      const response = await getBookByBarcode(barcode)
      const book = response.data

      // Find checked-out copies of this book
      const checkedOutCopies = book.copies?.filter(c => c.status === 'Checked Out') || []

      if (checkedOutCopies.length === 0) {
        alert('No checked out copies found for this book')
        return
      }

      // Load full checkout details for these copies
      const allCheckoutsResponse = await getCheckouts('')
      const matchingCheckouts = allCheckoutsResponse.data.filter(
        checkout => checkedOutCopies.some(copy => copy.id === checkout.copy_id)
      )

      if (matchingCheckouts.length === 1) {
        // Auto check-in if only one copy
        const checkout = matchingCheckouts[0]
        if (confirm(`Check in "${book.title}" Copy #${checkout.copy_number} borrowed by ${checkout.first_name} ${checkout.last_name}?`)) {
          await handleCheckIn(checkout.id)
        }
      } else {
        // Show matching checkouts for selection
        setScannedCheckouts(matchingCheckouts)
        setShowBarcodeScanner(false)
      }

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

  const handleCheckIn = async (checkoutId) => {
    if (!confirm('Are you sure you want to check in this book?')) return

    try {
      setLoading(true)
      await returnCheckout(checkoutId)
      alert('Book checked in successfully!')
      setScannedCheckouts([])
      setShowBarcodeScanner(true)
      loadCheckouts()
    } catch (error) {
      alert('Error checking in book: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && checkouts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Check In Books</h1>
        <p className="text-gray-400 mt-1">Return checked out books to inventory</p>
      </div>

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Quick Check-In: Scan Barcode
          </label>
          <BarcodeScanner
            onScan={handleBarcodeScan}
            placeholder="Scan book barcode..."
            autoFocus={true}
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-2">
            Fastest method: Scan barcode to instantly find checked out copies
          </p>
        </div>
      )}

      {/* Scanned Results */}
      {scannedCheckouts.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">
              Scanned Book - Select Copy to Check In
            </h2>
            <button
              onClick={() => { setScannedCheckouts([]); setShowBarcodeScanner(true); }}
              className="btn-secondary text-sm"
            >
              Scan Another
            </button>
          </div>
          <div className="space-y-4">
            {scannedCheckouts.map((checkout) => (
              <div key={checkout.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{checkout.title}</h3>
                    <p className="text-gray-400">by {checkout.author}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Copy #{checkout.copy_number}</span>
                        {checkout.condition && <span className="ml-2">• Condition: {checkout.condition}</span>}
                      </p>
                      {checkout.location && (
                        <p className="text-sm text-primary-400">
                          📍 Location: {checkout.location}
                        </p>
                      )}
                      {checkout.isbn && <p className="text-sm text-gray-500">ISBN: {checkout.isbn}</p>}
                      {checkout.barcode && <p className="text-sm text-gray-500">Barcode: {checkout.barcode}</p>}
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-gray-400">Borrowed By</p>
                    <p className="text-white font-medium">
                      {checkout.first_name} {checkout.last_name}
                    </p>
                    <p className="text-gray-400 text-sm">{checkout.email}</p>
                    {checkout.phone && <p className="text-gray-400 text-sm">{checkout.phone}</p>}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm text-gray-400">
                      Checked out {formatDistanceToNow(new Date(checkout.checkout_date), { addSuffix: true })}
                    </p>
                    <p className="text-sm text-gray-400">
                      Due: {new Date(checkout.due_date).toLocaleDateString()}
                    </p>
                    {checkout.notes && (
                      <p className="text-xs text-gray-500 italic max-w-xs text-right">
                        Note: {checkout.notes}
                      </p>
                    )}
                    <button
                      onClick={() => handleCheckIn(checkout.id)}
                      disabled={loading}
                      className="btn-success"
                    >
                      <CheckInIcon className="w-4 h-4 inline mr-2" />
                      Check In
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Or search manually
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by book title, borrower name, or barcode..."
          className="w-full px-4 py-2"
        />
      </div>

      {/* Checkouts List */}
      {checkouts.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-400">No checked out books found</p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            {checkouts.length} book{checkouts.length !== 1 ? 's' : ''} to check in
          </h2>
          <div className="space-y-4">
            {checkouts.map((checkout) => (
              <div key={checkout.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{checkout.title}</h3>
                    <p className="text-gray-400">by {checkout.author}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Copy #{checkout.copy_number}</span>
                        {checkout.condition && <span className="ml-2">• Condition: {checkout.condition}</span>}
                      </p>
                      {checkout.location && (
                        <p className="text-sm text-primary-400">
                          📍 Location: {checkout.location}
                        </p>
                      )}
                      {checkout.isbn && <p className="text-sm text-gray-500">ISBN: {checkout.isbn}</p>}
                      {checkout.barcode && <p className="text-sm text-gray-500">Barcode: {checkout.barcode}</p>}
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-gray-400">Borrowed By</p>
                    <p className="text-white font-medium">
                      {checkout.first_name} {checkout.last_name}
                    </p>
                    <p className="text-gray-400 text-sm">{checkout.email}</p>
                    {checkout.phone && <p className="text-gray-400 text-sm">{checkout.phone}</p>}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm text-gray-400">
                      Checked out {formatDistanceToNow(new Date(checkout.checkout_date), { addSuffix: true })}
                    </p>
                    <p className="text-sm text-gray-400">
                      Due: {new Date(checkout.due_date).toLocaleDateString()}
                    </p>
                    {checkout.notes && (
                      <p className="text-xs text-gray-500 italic max-w-xs text-right">
                        Note: {checkout.notes}
                      </p>
                    )}
                    <button
                      onClick={() => handleCheckIn(checkout.id)}
                      disabled={loading}
                      className="btn-success"
                    >
                      <CheckInIcon className="w-4 h-4 inline mr-2" />
                      Check In
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckIn
