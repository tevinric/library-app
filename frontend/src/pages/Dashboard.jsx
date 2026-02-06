import { useState, useEffect } from 'react'
import { getDashboardStats } from '../api'

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({})

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await getDashboardStats()
      setStats(response.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-danger-900/50 border border-danger-500 text-danger-200 px-4 py-3 rounded-lg">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Library overview and statistics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <h3 className="text-gray-400 text-sm font-medium">Total Books</h3>
          <p className="text-3xl font-bold text-primary-400 mt-2">{stats.total_books || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Unique titles</p>
        </div>

        <div className="stat-card">
          <h3 className="text-gray-400 text-sm font-medium">Total Copies</h3>
          <p className="text-3xl font-bold text-white mt-2">{stats.total_copies || 0}</p>
          <p className="text-sm text-gray-500 mt-1">{stats.available_copies || 0} available</p>
        </div>

        <div className="stat-card">
          <h3 className="text-gray-400 text-sm font-medium">Active Checkouts</h3>
          <p className="text-3xl font-bold text-success-400 mt-2">{stats.active_checkouts || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Currently checked out</p>
        </div>

        <div className="stat-card">
          <h3 className="text-gray-400 text-sm font-medium">Overdue</h3>
          <p className="text-3xl font-bold text-danger-400 mt-2">{stats.overdue_checkouts || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Past due date</p>
        </div>

        <div className="stat-card">
          <h3 className="text-gray-400 text-sm font-medium">Total Borrowers</h3>
          <p className="text-3xl font-bold text-white mt-2">{stats.total_borrowers || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Registered users</p>
        </div>

        <div className="stat-card">
          <h3 className="text-gray-400 text-sm font-medium">Wishlist Items</h3>
          <p className="text-3xl font-bold text-warning-400 mt-2">{stats.wishlist_items || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Requested books</p>
        </div>

        <div className="stat-card">
          <h3 className="text-gray-400 text-sm font-medium">Pending Follow-ups</h3>
          <p className="text-3xl font-bold text-warning-400 mt-2">{stats.pending_follow_ups || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Need attention</p>
        </div>

        <div className="stat-card">
          <h3 className="text-gray-400 text-sm font-medium">Utilization Rate</h3>
          <p className="text-3xl font-bold text-primary-400 mt-2">
            {stats.total_copies > 0
              ? Math.round((stats.active_checkouts / stats.total_copies) * 100)
              : 0}%
          </p>
          <p className="text-sm text-gray-500 mt-1">Books in circulation</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a href="/books/register" className="btn-primary text-center">
            📚 Register New Book
          </a>
          <a href="/checkout" className="btn-success text-center">
            📤 Checkout Book
          </a>
          <a href="/check-in" className="btn-primary text-center">
            📥 Check In Book
          </a>
          <a href="/books/search" className="btn-secondary text-center">
            🔍 Search Books
          </a>
          <a href="/users" className="btn-secondary text-center">
            👥 Manage Users
          </a>
          <a href="/wishlist" className="btn-secondary text-center">
            ⭐ View Wishlist
          </a>
        </div>
      </div>

      {/* Alerts */}
      {(stats.overdue_checkouts > 0 || stats.pending_follow_ups > 0) && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">⚠️ Alerts</h2>
          <div className="space-y-3">
            {stats.overdue_checkouts > 0 && (
              <div className="bg-danger-900/30 border border-danger-500 rounded-lg p-4">
                <p className="text-danger-200">
                  <strong>{stats.overdue_checkouts}</strong> books are overdue.
                  <a href="/checked-out" className="ml-2 underline hover:text-danger-100">
                    View Details →
                  </a>
                </p>
              </div>
            )}
            {stats.pending_follow_ups > 0 && (
              <div className="bg-warning-900/30 border border-warning-500 rounded-lg p-4">
                <p className="text-warning-200">
                  <strong>{stats.pending_follow_ups}</strong> checkouts need follow-up.
                  <a href="/follow-ups" className="ml-2 underline hover:text-warning-100">
                    View Details →
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
