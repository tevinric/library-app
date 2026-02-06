import { useState, useEffect } from 'react'
import { getFollowUps, updateFollowUp, deleteFollowUp } from '../api'
import { formatDistanceToNow, format } from 'date-fns'

function FollowUps() {
  const [followUps, setFollowUps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedFollowUp, setSelectedFollowUp] = useState(null)
  const [updateData, setUpdateData] = useState({
    status: '',
    contacted_date: '',
    resolution_notes: ''
  })

  useEffect(() => {
    loadFollowUps()
  }, [])

  const loadFollowUps = async () => {
    try {
      setLoading(true)
      const response = await getFollowUps()
      setFollowUps(response.data)
    } catch (error) {
      console.error('Error loading follow-ups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = (followUp) => {
    setSelectedFollowUp(followUp)
    setUpdateData({
      status: followUp.status,
      contacted_date: followUp.contacted_date ? format(new Date(followUp.contacted_date), 'yyyy-MM-dd') : '',
      resolution_notes: followUp.resolution_notes || ''
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await updateFollowUp(selectedFollowUp.id, updateData)
      alert('Follow-up updated successfully!')
      setShowModal(false)
      setSelectedFollowUp(null)
      loadFollowUps()
    } catch (error) {
      alert('Error updating follow-up: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this follow-up?')) return

    try {
      setLoading(true)
      await deleteFollowUp(id)
      alert('Follow-up deleted successfully!')
      loadFollowUps()
    } catch (error) {
      alert('Error deleting follow-up: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-warning-900/50 text-warning-300'
      case 'Contacted': return 'bg-primary-900/50 text-primary-300'
      case 'Resolved': return 'bg-success-900/50 text-success-300'
      case 'Escalated': return 'bg-danger-900/50 text-danger-300'
      default: return 'bg-gray-600 text-gray-300'
    }
  }

  if (loading && followUps.length === 0) {
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
        <h1 className="text-3xl font-bold text-white">Follow Ups</h1>
        <p className="text-gray-400 mt-1">Books requiring follow-up (oldest first)</p>
      </div>

      {/* Follow-ups List */}
      {followUps.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-400">No follow-ups found</p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            {followUps.length} follow-up{followUps.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-4">
            {followUps.map((followUp) => (
              <div key={followUp.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{followUp.title}</h3>
                    <p className="text-gray-400">by {followUp.author}</p>
                    <p className="text-sm text-gray-500 mt-1">Copy #{followUp.copy_number}</p>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-gray-400">Borrowed By</p>
                    <p className="text-white font-medium">
                      {followUp.first_name} {followUp.last_name}
                    </p>
                    <p className="text-gray-400 text-sm">{followUp.email}</p>
                    <p className="text-gray-400 text-sm">{followUp.phone}</p>
                  </div>

                  <div className="flex-1 text-right">
                    <p className="text-sm text-gray-400">Checked Out</p>
                    <p className="text-white">
                      {formatDistanceToNow(new Date(followUp.checkout_date), { addSuffix: true })}
                    </p>
                    <p className="text-danger-400 font-medium mt-1">
                      {Math.floor(followUp.days_checked_out)} days ago
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Due: {format(new Date(followUp.due_date), 'MMM d, yyyy')}
                    </p>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(followUp.status)}`}>
                      {followUp.status}
                    </span>
                  </div>
                </div>

                {followUp.reason && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <p className="text-sm text-gray-400">
                      <strong>Reason:</strong> {followUp.reason}
                    </p>
                  </div>
                )}

                {followUp.contacted_date && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-400">
                      <strong>Contacted:</strong> {format(new Date(followUp.contacted_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}

                {followUp.resolution_notes && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-400">
                      <strong>Notes:</strong> {followUp.resolution_notes}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleUpdate(followUp)}
                    className="btn-secondary text-sm"
                  >
                    📝 Update
                  </button>
                  <button
                    onClick={() => handleDelete(followUp.id)}
                    className="btn-danger text-sm"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Update Modal */}
      {showModal && selectedFollowUp && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4">Update Follow-up</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-white font-medium mb-4">
                  {selectedFollowUp.title} - {selectedFollowUp.first_name} {selectedFollowUp.last_name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select
                  value={updateData.status}
                  onChange={(e) => setUpdateData({...updateData, status: e.target.value})}
                  className="w-full px-4 py-2"
                >
                  <option value="Pending">Pending</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Escalated">Escalated</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Contacted Date</label>
                <input
                  type="date"
                  value={updateData.contacted_date}
                  onChange={(e) => setUpdateData({...updateData, contacted_date: e.target.value})}
                  className="w-full px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Resolution Notes</label>
                <textarea
                  value={updateData.resolution_notes}
                  onChange={(e) => setUpdateData({...updateData, resolution_notes: e.target.value})}
                  rows="4"
                  className="w-full px-4 py-2"
                  placeholder="Enter notes about the contact or resolution..."
                />
              </div>

              <div className="flex gap-4">
                <button type="submit" disabled={loading} className="btn-primary">
                  Update Follow-up
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default FollowUps
