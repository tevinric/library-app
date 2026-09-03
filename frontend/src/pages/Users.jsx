import { useState, useEffect } from 'react'
import { getBorrowers, createBorrower, deleteBorrower } from '../api'
import { TrashIcon } from '../components/Icons'

function Users() {
  const [borrowers, setBorrowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

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
      await createBorrower()
      alert('Borrower created successfully!')
      setShowModal(false)
      loadBorrowers()
    } catch (error) {
      alert('Error creating borrower: ' + error.message)
    } finally {
      setLoading(false)
    }
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
          <h2 className="text-xl font-semibold text-ink mb-4">
            {borrowers.length} borrower{borrowers.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-4">
            {borrowers.map((borrower) => (
              <div key={borrower.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-ink">
                      Borrower {borrower.borrower_id}
                    </h3>
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
    </div>
  )
}

export default Users
