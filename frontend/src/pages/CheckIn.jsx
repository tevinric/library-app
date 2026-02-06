import { useState, useEffect } from 'react'
import { getCheckouts, returnCheckout } from '../api'
import { formatDistanceToNow } from 'date-fns'

function CheckIn() {
  const [checkouts, setCheckouts] = useState([])
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

  const handleCheckIn = async (checkoutId) => {
    if (!confirm('Are you sure you want to check in this book?')) return

    try {
      setLoading(true)
      await returnCheckout(checkoutId)
      alert('Book checked in successfully!')
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

      {/* Search */}
      <div className="card">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by book title or borrower name..."
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
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{checkout.title}</h3>
                    <p className="text-gray-400">by {checkout.author}</p>
                    <p className="text-sm text-gray-500 mt-1">Copy #{checkout.copy_number}</p>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-gray-400">Borrowed By</p>
                    <p className="text-white font-medium">
                      {checkout.first_name} {checkout.last_name}
                    </p>
                    <p className="text-gray-400 text-sm">{checkout.email}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm text-gray-400">
                      Checked out {formatDistanceToNow(new Date(checkout.checkout_date), { addSuffix: true })}
                    </p>
                    <p className="text-sm text-gray-400">
                      Due: {new Date(checkout.due_date).toLocaleDateString()}
                    </p>
                    <button
                      onClick={() => handleCheckIn(checkout.id)}
                      disabled={loading}
                      className="btn-success"
                    >
                      📥 Check In
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
