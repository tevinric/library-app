import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.PROD ? '' : (import.meta.env.VITE_ZOELIBRARYAPP_API_URL || 'http://localhost:5002'),
})

// Request interceptor to add auth header.
// DEV mode (see App.jsx) never talks to Entra, so it has no access token —
// it identifies itself the old way, but only because the backend's own
// ZOELIBRARYAPP_AUTH_DEV_BYPASS must also be explicitly on for that header
// to be trusted. In PROD, the only thing sent is the verified bearer token.
const isDevMode = import.meta.env.VITE_ZOELIBRARYAPP_ENV_TYPE === 'DEV'

api.interceptors.request.use((config) => {
  if (isDevMode) {
    const userEmail = localStorage.getItem('userEmail')
    if (userEmail) {
      config.headers['X-User-Email'] = userEmail
    }
  } else {
    const accessToken = localStorage.getItem('accessToken')
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`
    }
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

// Public books (no auth required)
const publicBaseURL = import.meta.env.PROD ? '' : (import.meta.env.VITE_ZOELIBRARYAPP_API_URL || 'http://localhost:5002')
export const getPublicBooks = ({ search = '', genre = '', availableOnly = false } = {}) =>
  axios.get(`${publicBaseURL}/api/public/books`, { params: { search, genre, available_only: availableOnly } })
export const getPublicBookDetail = (id) =>
  axios.get(`${publicBaseURL}/api/public/books/${id}`)
export const getPublicGenres = () =>
  axios.get(`${publicBaseURL}/api/public/genres`)

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
export const deleteBookCopy = (id, data = {}) => api.delete(`/api/book-copies/${id}`, { data })
export const getDeletedBookCopies = (params = {}) => api.get('/api/deleted-book-copies', { params })

// Borrowers
export const getBorrowers = (search = '') => api.get('/api/borrowers', { params: { search } })
export const getBorrower = (id) => api.get(`/api/borrowers/${id}`)
export const autocompleteBorrowers = (query) => api.get('/api/borrowers/autocomplete', { params: { q: query } })
export const createBorrower = () => api.post('/api/borrowers')
export const deleteBorrower = (id) => api.delete(`/api/borrowers/${id}`)

// Checkouts
export const getCheckouts = (search = '') => api.get('/api/checkouts', { params: { search } })
export const createCheckout = (data) => api.post('/api/checkouts', data)
export const returnCheckout = (id) => api.put(`/api/checkouts/${id}/return`)
export const deleteCheckout = (id) => api.delete(`/api/checkouts/${id}`)

// Checkout History
export const getCheckoutHistory = (params = {}) => api.get('/api/checkout-history', { params })

// Activity Log
export const getActivityLog = (params = {}) => api.get('/api/activity-log', { params })

// Wishlist
export const getWishlist = () => api.get('/api/wishlist')
export const createWishlistItem = (data) => api.post('/api/wishlist', data)
export const updateWishlistItem = (id, data) => api.put(`/api/wishlist/${id}`, data)
export const deleteWishlistItem = (id) => api.delete(`/api/wishlist/${id}`)

// Follow-ups
export const getFollowUps = (view = 'active') => api.get('/api/follow-ups', { params: { view } })
export const createFollowUp = (data) => api.post('/api/follow-ups', data)
export const updateFollowUp = (id, data) => api.put(`/api/follow-ups/${id}`, data)
export const deleteFollowUp = (id) => api.delete(`/api/follow-ups/${id}`)

// Dashboard Stats
export const getDashboardStats = () => api.get('/api/dashboard/stats')

// Settings
export const getSettings = () => api.get('/api/settings')
export const updateSettings = (data) => api.put('/api/settings', data)

// Overdue Books + Fines (unified — see OverdueBooks.jsx)
export const getOverdueActive = () => api.get('/api/overdue/active')

// Fines
export const getFines = () => api.get('/api/fines')
export const settleFines = (fineIds) => api.post('/api/fines/settle', { fine_ids: fineIds })
export const unpayFine = (id) => api.put(`/api/fines/${id}/unpay`)
export const getFineTransactions = () => api.get('/api/fines/transactions')

// =============================================================================
// OPENLIBRARY API INTEGRATION
// =============================================================================

/**
 * Fetch book details from OpenLibrary API
 * @param {string} isbn - ISBN-10 or ISBN-13
 * @returns {Promise} OpenLibrary book data
 */
export const fetchBookFromOpenLibrary = async (isbn) => {
  try {
    // Clean ISBN - remove hyphens and spaces
    const cleanIsbn = isbn.replace(/[-\s]/g, '')

    console.log('Fetching from OpenLibrary for ISBN:', cleanIsbn)

    // Call OpenLibrary API
    const response = await axios.get(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`,
      { timeout: 10000 } // 10 second timeout
    )

    console.log('OpenLibrary API Response:', response.data)

    const bookKey = `ISBN:${cleanIsbn}`
    const bookData = response.data[bookKey]

    if (!bookData) {
      throw new Error('Book not found in OpenLibrary')
    }

    console.log('Book data found:', bookData)
    console.log('Cover data:', bookData.cover)
    console.log('Publish date:', bookData.publish_date)

    // Extract year from publish_date (might be "2006" or "April 2006" etc)
    let publicationYear = ''
    if (bookData.publish_date) {
      // Try to extract 4-digit year
      const yearMatch = String(bookData.publish_date).match(/\d{4}/)
      if (yearMatch) {
        publicationYear = yearMatch[0] // Keep as string for input field
      }
    }

    // Transform OpenLibrary data to our format
    const transformedData = {
      title: bookData.title || '',
      author: bookData.authors ? bookData.authors.map(a => a.name).join(', ') : '',
      publisher: bookData.publishers ? bookData.publishers[0]?.name : '',
      publication_year: publicationYear,
      pages: bookData.number_of_pages || null,
      description: bookData.notes || '',
      isbn: cleanIsbn,

      // OpenLibrary specific fields
      cover_small: bookData.cover?.small || null,
      cover_medium: bookData.cover?.medium || null,
      cover_large: bookData.cover?.large || null,
      subjects: bookData.subjects ? JSON.stringify(bookData.subjects.map(s => s.name)) : null,
      openlibrary_key: bookData.key || null,
      openlibrary_url: bookData.url || null,
      excerpt: bookData.excerpts?.[0]?.text || null,
      dewey_decimal: bookData.classifications?.dewey_decimal_class?.[0] || null,
      lc_classification: bookData.classifications?.lc_classifications?.[0] || null,

      // Additional metadata
      rawData: bookData // Keep raw data for reference
    }

    console.log('Transformed data:', transformedData)
    console.log('Cover URLs:', {
      small: transformedData.cover_small,
      medium: transformedData.cover_medium,
      large: transformedData.cover_large
    })

    return transformedData
  } catch (error) {
    console.error('Error fetching from OpenLibrary:', error)
    throw error
  }
}

export default api
