import { useState, useEffect } from 'react'
import { getCheckouts } from '../api'
import { formatDistanceToNow } from 'date-fns'

function CheckedOutBooks() {
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

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date()
  }

  if (loading) {
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
        <h1 className="text-3xl font-bold text-white">Checked Out Books</h1>
        <p className="text-gray-400 mt-1">View all currently checked out books (oldest first)</p>
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
            {checkouts.length} book{checkouts.length !== 1 ? 's' : ''} checked out
          </h2>
          <div className="space-y-4">
            {checkouts.map((checkout) => (
              <div
                key={checkout.id}
                className={`rounded-lg p-4 ${
                  isOverdue(checkout.due_date)
                    ? 'bg-danger-900/30 border border-danger-500'
                    : 'bg-gray-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
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
                    <p className="text-gray-400 text-sm">{checkout.phone}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-400">Checked Out</p>
                    <p className="text-white">
                      {formatDistanceToNow(new Date(checkout.checkout_date), { addSuffix: true })}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      {Math.floor(checkout.days_checked_out)} days ago
                    </p>
                    <p className={`mt-2 font-medium ${
                      isOverdue(checkout.due_date) ? 'text-danger-400' : 'text-success-400'
                    }`}>
                      Due: {new Date(checkout.due_date).toLocaleDateString()}
                    </p>
                    {isOverdue(checkout.due_date) && (
                      <span className="inline-block mt-2 px-2 py-1 bg-danger-900/50 text-danger-300 text-xs rounded">
                        OVERDUE
                      </span>
                    )}
                  </div>
                </div>

                {checkout.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <p className="text-sm text-gray-400">Notes: {checkout.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckedOutBooks
