import { useState, useEffect } from 'react'
import { getWishlist, createWishlistItem, updateWishlistItem, deleteWishlistItem } from '../api'
import { StarIcon, EditIcon, TrashIcon } from '../components/Icons'

function Wishlist() {
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    requested_by: '',
    request_notes: '',
    priority: 'Medium',
    status: 'Requested'
  })

  useEffect(() => {
    loadWishlist()
  }, [])

  const loadWishlist = async () => {
    try {
      setLoading(true)
      const response = await getWishlist()
      setWishlist(response.data)
    } catch (error) {
      console.error('Error loading wishlist:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      if (editingItem) {
        await updateWishlistItem(editingItem.id, formData)
        alert('Wishlist item updated successfully!')
      } else {
        await createWishlistItem(formData)
        alert('Wishlist item added successfully!')
      }
      setShowModal(false)
      setEditingItem(null)
      setFormData({
        title: '',
        author: '',
        isbn: '',
        requested_by: '',
        request_notes: '',
        priority: 'Medium',
        status: 'Requested'
      })
      loadWishlist()
    } catch (error) {
      alert('Error saving wishlist item: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      title: item.title,
      author: item.author || '',
      isbn: item.isbn || '',
      requested_by: item.requested_by || '',
      request_notes: item.request_notes || '',
      priority: item.priority,
      status: item.status
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this wishlist item?')) return

    try {
      setLoading(true)
      await deleteWishlistItem(id)
      alert('Wishlist item deleted successfully!')
      loadWishlist()
    } catch (error) {
      alert('Error deleting wishlist item: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleNewItem = () => {
    setEditingItem(null)
    setFormData({
      title: '',
      author: '',
      isbn: '',
      requested_by: '',
      request_notes: '',
      priority: 'Medium',
      status: 'Requested'
    })
    setShowModal(true)
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'bg-danger-900/50 text-danger-300'
      case 'Medium': return 'bg-warning-900/50 text-warning-300'
      case 'Low': return 'bg-gray-600 text-gray-300'
      default: return 'bg-gray-600 text-gray-300'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Requested': return 'bg-primary-900/50 text-primary-300'
      case 'Ordered': return 'bg-warning-900/50 text-warning-300'
      case 'Received': return 'bg-success-900/50 text-success-300'
      case 'Cancelled': return 'bg-gray-600 text-gray-300'
      default: return 'bg-gray-600 text-gray-300'
    }
  }

  if (loading && wishlist.length === 0) {
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
          <h1 className="text-3xl font-bold text-white">Book Wishlist</h1>
          <p className="text-gray-400 mt-1">Requested books not in library</p>
        </div>
        <button onClick={handleNewItem} className="btn-primary flex items-center gap-2">
          <StarIcon className="w-5 h-5" />
          <span>Add to Wishlist</span>
        </button>
      </div>

      {/* Wishlist */}
      {wishlist.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-400">No items in wishlist</p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            {wishlist.length} item{wishlist.length !== 1 ? 's' : ''} in wishlist
          </h2>
          <div className="space-y-4">
            {wishlist.map((item) => (
              <div key={item.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    {item.author && <p className="text-gray-400">by {item.author}</p>}
                    {item.isbn && <p className="text-sm text-gray-500">ISBN: {item.isbn}</p>}
                    {item.requested_by && (
                      <p className="text-sm text-gray-400 mt-2">Requested by: {item.requested_by}</p>
                    )}
                    {item.request_notes && (
                      <p className="text-sm text-gray-400 mt-1">Notes: {item.request_notes}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                        {item.priority} Priority
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <EditIcon className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="btn-danger text-sm flex items-center gap-2"
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
              {editingItem ? 'Edit Wishlist Item' : 'Add to Wishlist'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  className="w-full px-4 py-2"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Author</label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({...formData, author: e.target.value})}
                    className="w-full px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">ISBN</label>
                  <input
                    type="text"
                    value={formData.isbn}
                    onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                    className="w-full px-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Requested By</label>
                <input
                  type="text"
                  value={formData.requested_by}
                  onChange={(e) => setFormData({...formData, requested_by: e.target.value})}
                  className="w-full px-4 py-2"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full px-4 py-2"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-4 py-2"
                  >
                    <option value="Requested">Requested</option>
                    <option value="Ordered">Ordered</option>
                    <option value="Received">Received</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                <textarea
                  value={formData.request_notes}
                  onChange={(e) => setFormData({...formData, request_notes: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={loading} className="btn-primary">
                  {editingItem ? 'Update' : 'Add'}
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

export default Wishlist
