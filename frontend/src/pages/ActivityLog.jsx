import { useState, useEffect } from 'react'
import { getActivityLog } from '../api'
import { format } from 'date-fns'
import { SearchIcon } from '../components/Icons'

const PAGE_SIZE = 50

const METHOD_STYLES = {
  GET: 'bg-primary-50 text-primary-700',
  POST: 'bg-success-50 text-success-700',
  PUT: 'bg-warning-50 text-warning-700',
  DELETE: 'bg-danger-50 text-danger-700',
}

function ActivityLog() {
  const [log, setLog] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)

  const [user, setUser] = useState('')
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    loadLog()
  }, [offset])

  const loadLog = async (overrideOffset) => {
    const currentOffset = overrideOffset !== undefined ? overrideOffset : offset
    try {
      setLoading(true)
      // NOTE: this endpoint returns an envelope ({ data, total }), not a flat
      // array like most other list endpoints in this app.
      const filters = { user, method, status, date_from: dateFrom, date_to: dateTo }
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      const response = await getActivityLog({
        ...params,
        limit: PAGE_SIZE,
        offset: currentOffset,
      })
      setLog(response.data.data)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error loading activity log:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    // Filters changed — reset to the first page so we don't land on an
    // empty page if the new filter matches fewer rows.
    setOffset(0)
    loadLog(0)
  }

  const handlePrev = () => setOffset(Math.max(offset - PAGE_SIZE, 0))
  const handleNext = () => setOffset(offset + PAGE_SIZE)

  if (loading && log.length === 0) {
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
        <h1 className="text-3xl font-bold text-ink">Activity Log</h1>
        <p className="text-gray-400 mt-1">Every action taken by every logged in user</p>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Filter by user email..."
            className="px-4 py-2"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-4 py-2">
            <option value="">All methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-4 py-2">
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-4 py-2"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-4 py-2"
          />
        </div>
        <button onClick={handleSearch} className="btn-primary flex items-center gap-2">
          <SearchIcon className="w-5 h-5" />
          <span>Apply Filters</span>
        </button>
      </div>

      {/* Log List */}
      {log.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-400">No activity found</p>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-ink">
              Showing {offset + 1}-{offset + log.length} of {total}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={offset === 0}
                className={`btn-secondary text-sm ${offset === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Prev
              </button>
              <button
                onClick={handleNext}
                disabled={offset + PAGE_SIZE >= total}
                className={`btn-secondary text-sm ${offset + PAGE_SIZE >= total ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Next
              </button>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {log.map((row) => (
              <div key={row.id} className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${METHOD_STYLES[row.method] || 'bg-gray-100 text-gray-600'}`}>
                    {row.method}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.status_code < 400 ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
                    {row.status_code}
                  </span>
                </div>
                <p className="font-medium text-ink truncate">{row.path}</p>
                <p className="text-sm text-gray-400">{row.user_email}</p>
                <p className="text-xs text-gray-500">{format(new Date(row.created_at), 'MMM d, yyyy h:mm a')}</p>
                {(row.error_message || row.query_string || row.request_body) && (
                  <p className="text-xs text-gray-600 break-words">
                    {row.error_message || row.query_string || row.request_body}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id}>
                    <td className="text-gray-600 whitespace-nowrap">
                      {format(new Date(row.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="text-gray-600">{row.user_email}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${METHOD_STYLES[row.method] || 'bg-gray-100 text-gray-600'}`}>
                          {row.method}
                        </span>
                        <span className="text-ink text-sm truncate">{row.path}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.status_code < 400 ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
                        {row.status_code}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm max-w-xs truncate" title={row.error_message || row.query_string || row.request_body || ''}>
                      {row.error_message || row.query_string || row.request_body || '-'}
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

export default ActivityLog
