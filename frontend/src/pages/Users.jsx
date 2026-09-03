import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getBorrowers, createBorrower, deleteBorrower } from '../api'
import { TrashIcon, CheckIcon, ClockIcon } from '../components/Icons'

// Borrower IDs are the only identifier a borrower has, so a newly created one
// has to be readable and copyable before the admin navigates away.
function Users() {
  const [borrowers, setBorrowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [createdBorrower, setCreatedBorrower] = useState(null)
  const [copyState, setCopyState] = useState('idle')

  useEffect(() => {
    loadBorrowers()
  }, [search])

  const loadBorrowers = async () => {
    try {
      setLoading(true)
      const response = await getBorrowers(search)
      setBorrowers(response.data)
    } catch (error) {
      console.error('Error loading borrowers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      setLoading(true)
      const response = await createBorrower()
      setShowModal(false)
      setCopyState('idle')
      setCreatedBorrower(response.data)
      loadBorrowers()
    } catch (error) {
      alert('Error creating borrower: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleCopyId = async (borrowerId) => {
    try {
      await navigator.clipboard.writeText(borrowerId)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch (error) {
      // The clipboard API only works in a secure context (HTTPS or localhost).
      // Rather than fail silently, point the admin at selecting it by hand —
      // the ID is rendered as plain selectable text for exactly this case.
      setCopyState('failed')
    }
  }

  // created_at arrives as an RFC-1123 string from Flask; guard against a row
  // that somehow lacks one so the list still renders.
  const formatCreated = (value) => {
    if (!value) return null
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : format(date, 'MMM d, yyyy h:mm a')
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this borrower?')) return

    try {
      setLoading(true)
      await deleteBorrower(id)
      alert('Borrower deleted successfully!')
      loadBorrowers()
    } catch (error) {
      alert('Error deleting borrower: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  if (loading && borrowers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink">Users (Borrowers)</h1>
          <p className="text-gray-400 mt-1">Manage library users and borrowers</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary self-start sm:self-auto">
          ➕ Add Borrower
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by borrower ID..."
          className="w-full px-4 py-2"
        />
      </div>

      {/* Borrowers List */}
      {borrowers.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-400">No borrowers found</p>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold text-ink">
              {borrowers.length} borrower{borrowers.length !== 1 ? 's' : ''}
            </h2>
            <span className="text-xs text-gray-400">Newest first</span>
          </div>
          <div className="space-y-4">
            {borrowers.map((borrower) => (
              <div key={borrower.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-ink">
                      Borrower {borrower.borrower_id}
                    </h3>
                    {formatCreated(borrower.created_at) && (
                      <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>Created {formatCreated(borrower.created_at)}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-sm">
                      <span className={`px-3 py-1 rounded-full ${
                        borrower.active_checkouts > 0
                          ? 'bg-primary-50 text-primary-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {borrower.active_checkouts || 0} active checkout{borrower.active_checkouts !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(borrower.id)}
                        disabled={borrower.active_checkouts > 0}
                        className={`btn-danger text-sm flex items-center gap-2 ${
                          borrower.active_checkouts > 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <TrashIcon className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-ink mb-4">New Borrower</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-400">
                  No personal details are collected. A unique borrower ID will be automatically generated and used to track this borrower's activity.
                </p>
              </div>
              <div className="flex gap-4">
                <button onClick={handleCreate} disabled={loading} className="btn-primary">
                  Create Borrower
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success modal — the generated ID is the borrower's only identifier,
          so it has to be captured before this closes. */}
      {createdBorrower && (
        <div className="modal-overlay" onClick={() => setCreatedBorrower(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="icon-circle from-success-500 to-success-600">
                <CheckIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-ink">Borrower created</h2>
                {formatCreated(createdBorrower.created_at) && (
                  <p className="text-sm text-gray-400">
                    {formatCreated(createdBorrower.created_at)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  Give this ID to the borrower — it's the only way their activity
                  is tracked, and it isn't shown again after you close this.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-2xl font-bold tracking-widest text-ink select-all">
                    {createdBorrower.borrower_id}
                  </span>
                  <button
                    onClick={() => handleCopyId(createdBorrower.borrower_id)}
                    className="btn-secondary text-sm whitespace-nowrap"
                  >
                    {copyState === 'copied' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {copyState === 'failed' && (
                  <p className="text-sm text-warning-700 mt-2">
                    Couldn't copy automatically — select the ID above and copy it manually.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setCreatedBorrower(null)}
                className="btn-primary w-full"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Users
