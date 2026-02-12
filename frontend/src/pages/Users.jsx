import { useState, useEffect } from 'react'
import { getBorrowers, createBorrower, updateBorrower, deleteBorrower } from '../api'
import { EditIcon, TrashIcon } from '../components/Icons'

function Users() {
  const [borrowers, setBorrowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingBorrower, setEditingBorrower] = useState(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    alt_phone: '',
    address: ''
  })

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      if (editingBorrower) {
        await updateBorrower(editingBorrower.id, formData)
        alert('Borrower updated successfully!')
      } else {
        await createBorrower(formData)
        alert('Borrower created successfully!')
      }
      setShowModal(false)
      setEditingBorrower(null)
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        alt_phone: '',
        address: ''
      })
      loadBorrowers()
    } catch (error) {
      alert('Error saving borrower: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (borrower) => {
    setEditingBorrower(borrower)
    setFormData({
      first_name: borrower.first_name,
      last_name: borrower.last_name,
      email: borrower.email,
      phone: borrower.phone,
      alt_phone: borrower.alt_phone || '',
      address: borrower.address || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this borrower?')) return

    try {
      setLoading(true)
      await deleteBorrower(id)
      alert('Borrower deleted successfully!')
      loadBorrowers()
    } catch (error) {
      alert('Error deleting borrower: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleNewBorrower = () => {
    setEditingBorrower(null)
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      alt_phone: '',
      address: ''
    })
    setShowModal(true)
  }

  if (loading && borrowers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Users (Borrowers)</h1>
          <p className="text-gray-400 mt-1">Manage library users and borrowers</p>
        </div>
        <button onClick={handleNewBorrower} className="btn-primary">
          ➕ Add Borrower
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
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
          <h2 className="text-xl font-semibold text-white mb-4">
            {borrowers.length} borrower{borrowers.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-4">
            {borrowers.map((borrower) => (
              <div key={borrower.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">
                      {borrower.first_name} {borrower.last_name}
                    </h3>
                    <p className="text-gray-400">{borrower.email}</p>
                    <p className="text-gray-400">{borrower.phone}</p>
                    {borrower.alt_phone && (
                      <p className="text-gray-500 text-sm">Alt: {borrower.alt_phone}</p>
                    )}
                    {borrower.address && (
                      <p className="text-gray-500 text-sm mt-1">{borrower.address}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-sm">
                      <span className={`px-3 py-1 rounded-full ${
                        borrower.active_checkouts > 0
                          ? 'bg-primary-900/50 text-primary-300'
                          : 'bg-gray-600 text-gray-300'
                      }`}>
                        {borrower.active_checkouts || 0} active checkout{borrower.active_checkouts !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(borrower)}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <EditIcon className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
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
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingBorrower ? 'Edit Borrower' : 'New Borrower'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    required
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    required
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    required
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Alt Phone</label>
                  <input
                    type="tel"
                    value={formData.alt_phone}
                    onChange={(e) => setFormData({...formData, alt_phone: e.target.value})}
                    className="w-full px-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  rows="2"
                  className="w-full px-4 py-2"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={loading} className="btn-primary">
                  {editingBorrower ? 'Update' : 'Create'} Borrower
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

export default Users
