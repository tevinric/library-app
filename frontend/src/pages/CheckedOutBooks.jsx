import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCheckouts, createFollowUp, getFollowUps } from '../api'
import { formatDistanceToNow } from 'date-fns'

const FlagIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V4m0 0l9-1 9 1v12l-9-1-9 1V4z" />
  </svg>
)

function CheckedOutBooks() {
  const [searchParams] = useSearchParams()
  const [checkouts, setCheckouts] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [followUpIds, setFollowUpIds] = useState(new Set())

  // Follow-up modal
  const [showFollowUpModal, setShowFollowUpModal] = useState(false)
  const [followUpTarget, setFollowUpTarget] = useState(null)
  const [followUpReason, setFollowUpReason] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)

  useEffect(() => { loadFollowUpIds() }, [])
  useEffect(() => { loadCheckouts() }, [search])

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

  const loadFollowUpIds = async () => {
    try {
      const response = await getFollowUps()
      setFollowUpIds(new Set(response.data.map(fu => fu.checkout_id)))
    } catch (error) {
      console.error('Error loading follow-ups:', error)
    }
  }

  const isOverdue = (dueDate) => new Date(dueDate) < new Date()

  const openFollowUpModal = (checkout) => {
    setFollowUpTarget(checkout)
    setFollowUpReason('')
    setShowFollowUpModal(true)
  }

  const submitFollowUp = async () => {
    try {
      setFollowUpLoading(true)
      await createFollowUp({
        checkout_id: followUpTarget.id,
        reason: followUpReason.trim() || null
      })
      setFollowUpIds(prev => new Set([...prev, followUpTarget.id]))
      setShowFollowUpModal(false)
      setFollowUpTarget(null)
    } catch (error) {
      if (error.response?.status === 400) {
        // Already flagged — update local state to reflect that
        setFollowUpIds(prev => new Set([...prev, followUpTarget.id]))
        setShowFollowUpModal(false)
      } else {
        alert('Error creating follow-up: ' + error.message)
      }
    } finally {
      setFollowUpLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Borrowed Books</h1>
        <p className="text-gray-400 mt-1">View all currently borrowed books (oldest first)</p>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by book title or borrower name..."
            className="w-full px-4 py-2"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          )}
        </div>
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
            {checkouts.map((checkout) => {
              const overdue = isOverdue(checkout.due_date)
              const alreadyFlagged = followUpIds.has(checkout.id)

              return (
                <div
                  key={checkout.id}
                  className={`rounded-lg p-4 ${
                    overdue
                      ? 'bg-danger-900/30 border border-danger-500'
                      : 'bg-gray-700'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Book Cover */}
                    {(checkout.cover_large || checkout.cover_medium) && (
                      <div className="flex-shrink-0">
                        <img
                          src={checkout.cover_large || checkout.cover_medium}
                          alt={checkout.title}
                          className="w-16 h-auto rounded-lg shadow-lg border border-gray-600 object-cover"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      </div>
                    )}

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

                        {/* Book info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-white truncate">{checkout.title}</h3>
                          <p className="text-gray-400 text-sm">by {checkout.author}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <span className="text-sm text-gray-500">Copy #{checkout.copy_number}</span>
                            {checkout.condition && (
                              <span className="text-sm text-gray-500">{checkout.condition}</span>
                            )}
                          </div>
                          {checkout.location && (
                            <p className="text-sm text-primary-400 mt-1">
                              📍 {checkout.location}
                            </p>
                          )}
                        </div>

                        {/* Borrower */}
                        <div className="flex-1">
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Borrowed By</p>
                          <p className="text-white font-medium">{checkout.first_name}</p>
                          <p className="text-gray-400 text-sm font-mono">ID: {checkout.borrower_id}</p>
                        </div>

                        {/* Dates + actions */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm text-gray-400">
                              {formatDistanceToNow(new Date(checkout.checkout_date), { addSuffix: true })}
                            </p>
                            <p className={`text-sm font-medium mt-1 ${
                              overdue ? 'text-danger-400' : 'text-success-400'
                            }`}>
                              Due: {new Date(checkout.due_date).toLocaleDateString()}
                            </p>
                            {overdue && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-danger-900/50 text-danger-300 text-xs rounded font-semibold">
                                OVERDUE
                              </span>
                            )}
                          </div>

                          {/* Follow-up button */}
                          <button
                            onClick={() => !alreadyFlagged && openFollowUpModal(checkout)}
                            disabled={alreadyFlagged}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                              alreadyFlagged
                                ? 'bg-warning-900/40 text-warning-300 border border-warning-500/50 cursor-default'
                                : 'bg-gray-600 hover:bg-gray-500 text-gray-200 border border-gray-500 hover:border-gray-400'
                            }`}
                          >
                            <FlagIcon className="w-3.5 h-3.5" />
                            {alreadyFlagged ? 'Follow-up Flagged' : 'Flag Follow-up'}
                          </button>
                        </div>
                      </div>

                      {checkout.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <p className="text-sm text-gray-400">Notes: {checkout.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowUpModal && followUpTarget && (
        <div className="modal-overlay" onClick={() => setShowFollowUpModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-warning-900/50 border border-warning-500/50 flex items-center justify-center flex-shrink-0">
                <FlagIcon className="w-5 h-5 text-warning-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Flag for Follow-up</h2>
                <p className="text-gray-400 text-sm">This will appear on the Follow Ups page</p>
              </div>
            </div>

            {/* Book summary */}
            <div className="bg-gray-700/60 rounded-lg p-4 mb-5 flex gap-3">
              {(followUpTarget.cover_large || followUpTarget.cover_medium) && (
                <img
                  src={followUpTarget.cover_large || followUpTarget.cover_medium}
                  alt={followUpTarget.title}
                  className="w-12 h-auto rounded flex-shrink-0"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <div>
                <p className="text-white font-semibold">{followUpTarget.title}</p>
                <p className="text-gray-400 text-sm">Copy #{followUpTarget.copy_number}</p>
                <p className="text-gray-400 text-sm">
                  Borrowed by <span className="text-white">{followUpTarget.first_name}</span>
                  <span className="text-primary-400 font-mono ml-1">({followUpTarget.borrower_id})</span>
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reason <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                value={followUpReason}
                onChange={(e) => setFollowUpReason(e.target.value)}
                rows="3"
                placeholder="e.g. Overdue — borrower not responding, damaged copy, etc."
                className="w-full px-4 py-2"
                autoFocus
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={submitFollowUp}
                disabled={followUpLoading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-warning-600 to-warning-500 text-white rounded-lg hover:from-warning-700 hover:to-warning-600 transition-all duration-200 font-semibold shadow-lg"
              >
                <FlagIcon className="w-4 h-4" />
                {followUpLoading ? 'Flagging...' : 'Flag for Follow-up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckedOutBooks
