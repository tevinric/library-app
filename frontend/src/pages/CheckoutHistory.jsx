import { useState, useEffect } from 'react'
import { getCheckoutHistory } from '../api'
import { format } from 'date-fns'
import { SearchIcon } from '../components/Icons'

function CheckoutHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const response = await getCheckoutHistory({ search })
      setHistory(response.data)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadHistory()
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
        <h1 className="text-3xl font-bold text-white">Checkout History</h1>
        <p className="text-gray-400 mt-1">View complete checkout history</p>
      </div>

      {/* Search */}
      <div className="card">
        <div className="flex gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by book title, author, or borrower name..."
            className="flex-1 px-4 py-2"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn-primary flex items-center gap-2">
            <SearchIcon className="w-5 h-5" />
            <span>Search</span>
          </button>
        </div>
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-400">No checkout history found</p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            {history.length} checkout record{history.length !== 1 ? 's' : ''}
          </h2>
          <div className="overflow-x-auto">
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
                        <p className="font-medium text-white">{record.title}</p>
                        <p className="text-sm text-gray-400">by {record.author}</p>
                      </div>
                    </td>
                    <td className="text-gray-300">#{record.copy_number}</td>
                    <td>
                      <div>
                        <p className="text-white">{record.first_name} {record.last_name}</p>
                        <p className="text-sm text-gray-400">{record.email}</p>
                      </div>
                    </td>
                    <td className="text-gray-300">
                      {format(new Date(record.checkout_date), 'MMM d, yyyy')}
                    </td>
                    <td className="text-gray-300">
                      {format(new Date(record.due_date), 'MMM d, yyyy')}
                    </td>
                    <td className="text-gray-300">
                      {record.return_date
                        ? format(new Date(record.return_date), 'MMM d, yyyy')
                        : '-'}
                    </td>
                    <td className="text-gray-300">{Math.floor(record.duration_days)} days</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.status === 'Returned'
                          ? 'bg-success-900/50 text-success-300'
                          : record.status === 'Checked Out'
                          ? 'bg-primary-900/50 text-primary-300'
                          : 'bg-danger-900/50 text-danger-300'
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
