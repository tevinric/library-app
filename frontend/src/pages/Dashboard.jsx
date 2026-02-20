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
  TrendingUpIcon
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
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1 text-sm sm:text-base">Library overview and statistics</p>
      </div>

      {/* Stats Grid - Compact horizontal tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link to="/books/search" className="stat-card group">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-primary-500 to-primary-600">
              <BookIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Total Books</p>
              <p className="stat-number leading-tight mt-0.5">{stats.total_books || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Unique titles</p>
            </div>
          </div>
        </Link>

        <Link to="/books/search" className="stat-card group">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-gray-600 to-gray-700">
              <CollectionIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Copies</p>
              <p className="stat-number leading-tight mt-0.5">{stats.total_copies || 0}</p>
              <p className="text-xs text-success-400 mt-0.5 hidden sm:block font-medium">{stats.available_copies || 0} available</p>
            </div>
          </div>
        </Link>

        <Link to="/checked-out" className="stat-card group">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-success-500 to-success-600">
              <CheckoutIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Checkouts</p>
              <p className="text-xl sm:text-2xl font-bold text-success-400 leading-tight mt-0.5">{stats.active_checkouts || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Currently out</p>
            </div>
          </div>
        </Link>

        <Link to="/checked-out" className="stat-card group">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-danger-500 to-danger-600">
              <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Overdue</p>
              <p className="text-xl sm:text-2xl font-bold text-danger-400 leading-tight mt-0.5">{stats.overdue_checkouts || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Past due date</p>
            </div>
          </div>
        </Link>

        <Link to="/users" className="stat-card group">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-primary-500 to-primary-600">
              <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Borrowers</p>
              <p className="stat-number leading-tight mt-0.5">{stats.total_borrowers || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Registered users</p>
            </div>
          </div>
        </Link>

        <Link to="/wishlist" className="stat-card group">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-warning-500 to-warning-600">
              <StarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Wishlist</p>
              <p className="text-xl sm:text-2xl font-bold text-warning-400 leading-tight mt-0.5">{stats.wishlist_items || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Requested books</p>
            </div>
          </div>
        </Link>

        <Link to="/follow-ups" className="stat-card group">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-warning-500 to-warning-600">
              <BellIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Follow-ups</p>
              <p className="text-xl sm:text-2xl font-bold text-warning-400 leading-tight mt-0.5">{stats.pending_follow_ups || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Need attention</p>
            </div>
          </div>
        </Link>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-primary-500 to-primary-600">
              <TrendingUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Utilization</p>
              <p className="text-xl sm:text-2xl font-bold text-primary-400 leading-tight mt-0.5">
                {stats.total_copies > 0
                  ? Math.round((stats.active_checkouts / stats.total_copies) * 100)
                  : 0}%
              </p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">In circulation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="gradient-text">Quick Actions</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Link to="/books/register" className="btn-primary text-center flex items-center justify-center gap-2 text-sm">
            <BookIcon className="w-4 h-4" />
            <span className="truncate">Register Book</span>
          </Link>
          <Link to="/checkout" className="btn-success text-center flex items-center justify-center gap-2 text-sm">
            <CheckoutIcon className="w-4 h-4" />
            <span className="truncate">Checkout Book</span>
          </Link>
          <Link to="/check-in" className="btn-primary text-center flex items-center justify-center gap-2 text-sm">
            <CollectionIcon className="w-4 h-4" />
            <span className="truncate">Return Book</span>
          </Link>
          <Link to="/books/search" className="btn-secondary text-center flex items-center justify-center gap-2 text-sm">
            <BookIcon className="w-4 h-4" />
            <span className="truncate">Search Books</span>
          </Link>
          <Link to="/users" className="btn-secondary text-center flex items-center justify-center gap-2 text-sm">
            <UsersIcon className="w-4 h-4" />
            <span className="truncate">Manage Users</span>
          </Link>
          <Link to="/wishlist" className="btn-secondary text-center flex items-center justify-center gap-2 text-sm">
            <StarIcon className="w-4 h-4" />
            <span className="truncate">View Wishlist</span>
          </Link>
        </div>
      </div>

      {/* Attention Required */}
      {(stats.overdue_checkouts > 0 || stats.pending_follow_ups > 0) && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-5">Attention Required</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.overdue_checkouts > 0 && (
              <Link
                to="/checked-out"
                className="flex items-start gap-4 p-4 rounded-xl bg-danger-900/20 border border-danger-500/40 hover:border-danger-400/70 hover:bg-danger-900/30 transition-all duration-200"
              >
                <div className="icon-circle from-danger-500 to-danger-600 w-10 h-10 flex-shrink-0">
                  <ClockIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-lg leading-tight">
                    {stats.overdue_checkouts} overdue
                  </p>
                  <p className="text-danger-300 text-sm mt-1">
                    {stats.overdue_checkouts === 1 ? 'Book is' : 'Books are'} past due date
                  </p>
                  <p className="text-gray-500 text-xs mt-2">View Borrowed Books →</p>
                </div>
              </Link>
            )}
            {stats.pending_follow_ups > 0 && (
              <Link
                to="/follow-ups"
                className="flex items-start gap-4 p-4 rounded-xl bg-indigo-900/20 border border-indigo-500/40 hover:border-indigo-400/70 hover:bg-indigo-900/30 transition-all duration-200"
              >
                <div className="icon-circle from-indigo-500 to-indigo-600 w-10 h-10 flex-shrink-0">
                  <BellIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-lg leading-tight">
                    {stats.pending_follow_ups} follow-up{stats.pending_follow_ups !== 1 ? 's' : ''}
                  </p>
                  <p className="text-indigo-300 text-sm mt-1">
                    Pending borrower contact
                  </p>
                  <p className="text-gray-500 text-xs mt-2">View Follow Ups →</p>
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
