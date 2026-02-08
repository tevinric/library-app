import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.PROD ? '' : (import.meta.env.VITE_ZOELIBRARYAPP_API_URL || 'http://localhost:5002'),
})

// Request interceptor to add auth header
api.interceptors.request.use((config) => {
  const userEmail = localStorage.getItem('userEmail')
  if (userEmail) {
    config.headers['X-User-Email'] = userEmail
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('userEmail')
      localStorage.removeItem('accessToken')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

// =============================================================================
// API FUNCTIONS
// =============================================================================

// Health check
export const healthCheck = () => api.get('/api/health')

// User
export const getCurrentUser = () => api.get('/api/user')

// Books
export const getBooks = (search = '') => api.get('/api/books', { params: { search } })
export const getBook = (id) => api.get(`/api/books/${id}`)
export const getBookByBarcode = (barcode) => api.get(`/api/books/by-barcode/${barcode}`)
export const createBook = (data) => api.post('/api/books', data)
export const updateBook = (id, data) => api.put(`/api/books/${id}`, data)
export const deleteBook = (id) => api.delete(`/api/books/${id}`)

// Book Copies
export const getBookCopies = (bookId) => api.get(`/api/books/${bookId}/copies`)
export const createBookCopy = (data) => api.post('/api/book-copies', data)
export const updateBookCopy = (id, data) => api.put(`/api/book-copies/${id}`, data)
export const deleteBookCopy = (id) => api.delete(`/api/book-copies/${id}`)

// Borrowers
export const getBorrowers = (search = '') => api.get('/api/borrowers', { params: { search } })
export const getBorrower = (id) => api.get(`/api/borrowers/${id}`)
export const autocompleteBorrowers = (query) => api.get('/api/borrowers/autocomplete', { params: { q: query } })
export const createBorrower = (data) => api.post('/api/borrowers', data)
export const updateBorrower = (id, data) => api.put(`/api/borrowers/${id}`, data)
export const deleteBorrower = (id) => api.delete(`/api/borrowers/${id}`)

// Checkouts
export const getCheckouts = (search = '') => api.get('/api/checkouts', { params: { search } })
export const createCheckout = (data) => api.post('/api/checkouts', data)
export const returnCheckout = (id) => api.put(`/api/checkouts/${id}/return`)
export const deleteCheckout = (id) => api.delete(`/api/checkouts/${id}`)

// Checkout History
export const getCheckoutHistory = (params = {}) => api.get('/api/checkout-history', { params })

// Wishlist
export const getWishlist = () => api.get('/api/wishlist')
export const createWishlistItem = (data) => api.post('/api/wishlist', data)
export const updateWishlistItem = (id, data) => api.put(`/api/wishlist/${id}`, data)
export const deleteWishlistItem = (id) => api.delete(`/api/wishlist/${id}`)

// Follow-ups
export const getFollowUps = () => api.get('/api/follow-ups')
export const createFollowUp = (data) => api.post('/api/follow-ups', data)
export const updateFollowUp = (id, data) => api.put(`/api/follow-ups/${id}`, data)
export const deleteFollowUp = (id) => api.delete(`/api/follow-ups/${id}`)

// Dashboard Stats
export const getDashboardStats = () => api.get('/api/dashboard/stats')

export default api
