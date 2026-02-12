import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats } from '../api'
import {
  BookIcon,
  CollectionIcon,
  CheckoutIcon,
  ClockIcon,
  UsersIcon,
  StarIcon,
  BellIcon,
  TrendingUpIcon,
  AlertIcon
} from '../components/Icons'

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

      {/* Stats Grid - Clickable Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/books/search" className="stat-card group">
          <div className="flex items-start justify-between mb-4">
            <div className="icon-circle from-primary-500 to-primary-600">
              <BookIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Total Books</h3>
          <p className="stat-number">{stats.total_books || 0}</p>
          <p className="text-sm text-gray-500 mt-2">Unique titles</p>
        </Link>

        <Link to="/books/search" className="stat-card group">
          <div className="flex items-start justify-between mb-4">
            <div className="icon-circle from-gray-600 to-gray-700">
              <CollectionIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Total Copies</h3>
          <p className="stat-number">{stats.total_copies || 0}</p>
          <p className="text-sm text-success-400 mt-2 font-medium">{stats.available_copies || 0} available</p>
        </Link>

        <Link to="/checked-out" className="stat-card group">
          <div className="flex items-start justify-between mb-4">
            <div className="icon-circle from-success-500 to-success-600">
              <CheckoutIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Active Checkouts</h3>
          <p className="text-3xl font-bold text-success-400">{stats.active_checkouts || 0}</p>
          <p className="text-sm text-gray-500 mt-2">Currently checked out</p>
        </Link>

        <Link to="/checked-out" className="stat-card group">
          <div className="flex items-start justify-between mb-4">
            <div className="icon-circle from-danger-500 to-danger-600">
              <ClockIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Overdue</h3>
          <p className="text-3xl font-bold text-danger-400">{stats.overdue_checkouts || 0}</p>
          <p className="text-sm text-gray-500 mt-2">Past due date</p>
        </Link>

        <Link to="/users" className="stat-card group">
          <div className="flex items-start justify-between mb-4">
            <div className="icon-circle from-primary-500 to-primary-600">
              <UsersIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Total Borrowers</h3>
          <p className="stat-number">{stats.total_borrowers || 0}</p>
          <p className="text-sm text-gray-500 mt-2">Registered users</p>
        </Link>

        <Link to="/wishlist" className="stat-card group">
          <div className="flex items-start justify-between mb-4">
            <div className="icon-circle from-warning-500 to-warning-600">
              <StarIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Wishlist Items</h3>
          <p className="text-3xl font-bold text-warning-400">{stats.wishlist_items || 0}</p>
          <p className="text-sm text-gray-500 mt-2">Requested books</p>
        </Link>

        <Link to="/follow-ups" className="stat-card group">
          <div className="flex items-start justify-between mb-4">
            <div className="icon-circle from-warning-500 to-warning-600">
              <BellIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Pending Follow-ups</h3>
          <p className="text-3xl font-bold text-warning-400">{stats.pending_follow_ups || 0}</p>
          <p className="text-sm text-gray-500 mt-2">Need attention</p>
        </Link>

        <div className="stat-card">
          <div className="flex items-start justify-between mb-4">
            <div className="icon-circle from-primary-500 to-primary-600">
              <TrendingUpIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Utilization Rate</h3>
          <p className="text-3xl font-bold text-primary-400">
            {stats.total_copies > 0
              ? Math.round((stats.active_checkouts / stats.total_copies) * 100)
              : 0}%
          </p>
          <p className="text-sm text-gray-500 mt-2">Books in circulation</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="gradient-text">Quick Actions</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/books/register" className="btn-primary text-center flex items-center justify-center gap-2">
            <BookIcon className="w-5 h-5" />
            <span>Register New Book</span>
          </Link>
          <Link to="/checkout" className="btn-success text-center flex items-center justify-center gap-2">
            <CheckoutIcon className="w-5 h-5" />
            <span>Checkout Book</span>
          </Link>
          <Link to="/check-in" className="btn-primary text-center flex items-center justify-center gap-2">
            <CollectionIcon className="w-5 h-5" />
            <span>Check In Book</span>
          </Link>
          <Link to="/books/search" className="btn-secondary text-center flex items-center justify-center gap-2">
            <BookIcon className="w-5 h-5" />
            <span>Search Books</span>
          </Link>
          <Link to="/users" className="btn-secondary text-center flex items-center justify-center gap-2">
            <UsersIcon className="w-5 h-5" />
            <span>Manage Users</span>
          </Link>
          <Link to="/wishlist" className="btn-secondary text-center flex items-center justify-center gap-2">
            <StarIcon className="w-5 h-5" />
            <span>View Wishlist</span>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {(stats.overdue_checkouts > 0 || stats.pending_follow_ups > 0) && (
        <div className="card">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <AlertIcon className="w-6 h-6 text-warning-400" />
            <span>System Alerts</span>
          </h2>
          <div className="space-y-4">
            {stats.overdue_checkouts > 0 && (
              <Link to="/checked-out" className="alert-danger flex items-start gap-4 hover:border-danger-400 transition-all">
                <div className="icon-circle from-danger-500 to-danger-600 w-10 h-10 flex-shrink-0">
                  <ClockIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-danger-200 font-medium">
                    <strong className="text-danger-100 text-lg">{stats.overdue_checkouts}</strong> books are overdue
                  </p>
                  <p className="text-danger-300 text-sm mt-1">
                    These items require immediate attention →
                  </p>
                </div>
              </Link>
            )}
            {stats.pending_follow_ups > 0 && (
              <Link to="/follow-ups" className="alert-warning flex items-start gap-4 hover:border-warning-400 transition-all">
                <div className="icon-circle from-warning-500 to-warning-600 w-10 h-10 flex-shrink-0">
                  <BellIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-warning-200 font-medium">
                    <strong className="text-warning-100 text-lg">{stats.pending_follow_ups}</strong> checkouts need follow-up
                  </p>
                  <p className="text-warning-300 text-sm mt-1">
                    Review and update status →
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
