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

// Public books (no auth required)
const publicBaseURL = import.meta.env.PROD ? '' : (import.meta.env.VITE_ZOELIBRARYAPP_API_URL || 'http://localhost:5002')
export const getPublicBooks = (search = '') =>
  axios.get(`${publicBaseURL}/api/public/books`, { params: { search } })

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
