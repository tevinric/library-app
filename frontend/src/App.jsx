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
import {
  DashboardIcon,
  BookIcon,
  SearchIcon,
  CheckoutIcon,
  ListIcon,
  CheckInIcon,
  HistoryIcon,
  UsersIcon,
  StarIcon,
  BellIcon,
  LogoutIcon,
  LibraryIcon,
  MicrosoftIcon
} from './components/Icons'
import './App.css'

// Check if we're in development mode
const ENV_TYPE = import.meta.env.VITE_ZOELIBRARYAPP_ENV_TYPE || 'PROD'
const IS_DEV_MODE = ENV_TYPE === 'DEV'
const DEV_USER_EMAIL = import.meta.env.VITE_ZOELIBRARYAPP_DEV_USER_EMAIL || 'dev@library.local'

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

  // Navigation items with professional icons
  const navItems = [
    { path: '/', label: 'Dashboard', IconComponent: DashboardIcon },
    { path: '/books/register', label: 'Register Books', IconComponent: BookIcon },
    { path: '/books/search', label: 'Book Search', IconComponent: SearchIcon },
    { path: '/checkout', label: 'Checkout Books', IconComponent: CheckoutIcon },
    { path: '/checked-out', label: 'Checked Out', IconComponent: ListIcon },
    { path: '/check-in', label: 'Check In', IconComponent: CheckInIcon },
    { path: '/history', label: 'Checkout History', IconComponent: HistoryIcon },
    { path: '/users', label: 'Users', IconComponent: UsersIcon },
    { path: '/wishlist', label: 'Wishlist', IconComponent: StarIcon },
    { path: '/follow-ups', label: 'Follow Ups', IconComponent: BellIcon },
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="login-container max-w-md w-full text-center space-y-8">
          {/* Logo and Branding */}
          <div className="relative z-10 space-y-4">
            <div className="flex justify-center">
              <div className="icon-circle from-primary-500 to-primary-600 w-20 h-20">
                <LibraryIcon className="w-10 h-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold gradient-text mb-2">
                ZOE Library
              </h1>
              <p className="text-gray-400 text-lg font-medium">
                Management System
              </p>
            </div>
          </div>

          {/* Login Form */}
          <div className="relative z-10 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">Welcome Back</h2>
              <p className="text-gray-400">
                Sign in with your Microsoft account to continue
              </p>
            </div>

            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 font-semibold shadow-2xl shadow-primary-500/40 hover:shadow-primary-500/60 hover:-translate-y-1 group"
            >
              <MicrosoftIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span>Sign in with Microsoft</span>
            </button>

            <p className="text-xs text-gray-500">
              Secure authentication powered by Microsoft Azure AD
            </p>
          </div>
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
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-gray-800 to-gray-900 border-r border-gray-700/50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="icon-circle from-primary-500 to-primary-600 w-10 h-10">
                <LibraryIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">ZOE Library</h1>
                <p className="text-xs text-gray-500">Management</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700/50">
              <p className="text-xs text-gray-400 truncate">{currentUser?.email || accounts[0]?.username}</p>
              {IS_DEV_MODE && (
                <span className="inline-block mt-2 px-2 py-1 bg-warning-900/50 text-warning-300 text-xs rounded-md font-medium">
                  DEV MODE
                </span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.IconComponent className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-700/50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700/50 hover:text-white rounded-lg transition-all duration-200 font-medium"
            >
              <LogoutIcon className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700/50 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="icon-circle from-primary-500 to-primary-600 w-10 h-10">
                <LibraryIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">ZOE Library</h1>
                {IS_DEV_MODE && (
                  <span className="inline-block px-2 py-0.5 bg-warning-900/50 text-warning-300 text-xs rounded-md font-medium">
                    DEV MODE
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-300 hover:text-white transition-colors p-2 hover:bg-gray-700/50 rounded-lg"
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
