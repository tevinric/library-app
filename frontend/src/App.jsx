import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { loginRequest } from './authConfig'
import Dashboard from './pages/Dashboard'
import BookRegistration from './pages/BookRegistration'
import BookSearch from './pages/BookSearch'
import CheckoutBooks from './pages/CheckoutBooks'
import CheckedOutBooks from './pages/CheckedOutBooks'
import CheckIn from './pages/CheckIn'
import CheckoutHistory from './pages/CheckoutHistory'
import Users from './pages/Users'
import Wishlist from './pages/Wishlist'
import FollowUps from './pages/FollowUps'
import './App.css'

// Check if we're in development mode
const ENV_TYPE = import.meta.env.VITE_ENV_TYPE || 'PROD'
const IS_DEV_MODE = ENV_TYPE === 'DEV'
const DEV_USER_EMAIL = import.meta.env.VITE_DEV_USER_EMAIL || 'dev@library.local'

function App() {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const location = useLocation()

  // Handle DEV mode - bypass authentication
  useEffect(() => {
    if (IS_DEV_MODE) {
      // In DEV mode, automatically authorize with dev email
      localStorage.setItem('userEmail', DEV_USER_EMAIL)
      setCurrentUser({ email: DEV_USER_EMAIL, username: 'Dev User' })
      setIsAuthorized(true)
      setIsLoading(false)
      return
    }

    // PROD mode - use Azure AD authentication
    checkAuthorization()
  }, [isAuthenticated, accounts, inProgress])

  // Check authorization (PROD mode only)
  const checkAuthorization = async () => {
    if (!isAuthenticated || inProgress !== InteractionStatus.None) {
      setIsLoading(inProgress !== InteractionStatus.None)
      return
    }

    try {
      const account = accounts[0]
      if (!account) {
        setIsLoading(false)
        return
      }

      // Get token for API calls
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: account
      })

      // Store auth info for API calls
      localStorage.setItem('userEmail', account.username)
      localStorage.setItem('accessToken', response.accessToken)
      setCurrentUser({ email: account.username, username: account.username })
      setIsAuthorized(true)
      setIsLoading(false)
    } catch (error) {
      console.error('Authorization check failed:', error)
      // Try interactive login if silent fails
      try {
        const response = await instance.acquireTokenPopup(loginRequest)
        localStorage.setItem('userEmail', accounts[0].username)
        localStorage.setItem('accessToken', response.accessToken)
        setCurrentUser({ email: accounts[0].username, username: accounts[0].username })
        setIsAuthorized(true)
      } catch (popupError) {
        console.error('Interactive auth failed:', popupError)
      }
      setIsLoading(false)
    }
  }

  // Handle login (PROD mode only)
  const handleLogin = () => {
    if (IS_DEV_MODE) return
    instance.loginPopup(loginRequest).catch(console.error)
  }

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('userEmail')
    localStorage.removeItem('accessToken')
    if (IS_DEV_MODE) {
      window.location.reload()
    } else {
      instance.logoutPopup()
    }
  }

  // Navigation items
  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/books/register', label: 'Register Books', icon: '📚' },
    { path: '/books/search', label: 'Book Search', icon: '🔍' },
    { path: '/checkout', label: 'Checkout Books', icon: '📤' },
    { path: '/checked-out', label: 'Checked Out', icon: '📋' },
    { path: '/check-in', label: 'Check In', icon: '📥' },
    { path: '/history', label: 'Checkout History', icon: '📜' },
    { path: '/users', label: 'Users', icon: '👥' },
    { path: '/wishlist', label: 'Wishlist', icon: '⭐' },
    { path: '/follow-ups', label: 'Follow Ups', icon: '🔔' },
  ]

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  // Not authenticated - show login (PROD mode only)
  if (!IS_DEV_MODE && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center">
          <h1 className="text-2xl font-bold text-white mb-6">Library Management</h1>
          <button
            onClick={handleLogin}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Sign in with Microsoft
          </button>
        </div>
      </div>
    )
  }

  // Authenticated but not authorized (PROD mode only)
  if (!IS_DEV_MODE && !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">You are not authorized to access this application.</p>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Authorized - show main app
  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-gray-700">
            <h1 className="text-xl font-bold text-primary-400">Library Management</h1>
            <p className="text-sm text-gray-400">{currentUser?.email || accounts[0]?.username}</p>
            {IS_DEV_MODE && (
              <span className="inline-block mt-1 px-2 py-1 bg-warning-900/50 text-warning-300 text-xs rounded">
                DEV MODE
              </span>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary-400">Library Management</h1>
              {IS_DEV_MODE && (
                <span className="inline-block mt-1 px-2 py-1 bg-warning-900/50 text-warning-300 text-xs rounded">
                  DEV MODE
                </span>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-300 hover:text-white"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {sidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/books/register" element={<BookRegistration />} />
            <Route path="/books/search" element={<BookSearch />} />
            <Route path="/checkout" element={<CheckoutBooks />} />
            <Route path="/checked-out" element={<CheckedOutBooks />} />
            <Route path="/check-in" element={<CheckIn />} />
            <Route path="/history" element={<CheckoutHistory />} />
            <Route path="/users" element={<Users />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/follow-ups" element={<FollowUps />} />
          </Routes>
        </main>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default App
