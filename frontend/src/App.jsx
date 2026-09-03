import { useState, useEffect } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { loginRequest } from './authConfig'
import BrowseBooks from './pages/BrowseBooks'
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
import OverdueBooks from './pages/OverdueBooks'
import ActivityLog from './pages/ActivityLog'
import Settings from './pages/Settings'
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
  MicrosoftIcon,
  AlertIcon,
  SettingsIcon,
  ClockIcon
} from './components/Icons'
import zoeLogo from './static/ZOE-logo-blue.png'
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
  const [loginError, setLoginError] = useState(null)
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
  const handleLogin = async () => {
    if (IS_DEV_MODE) return
    setLoginError(null)

    try {
      await instance.loginPopup(loginRequest)
    } catch (error) {
      // Entra rejects accounts it hasn't been assigned on its own hosted page,
      // so what reaches us here is usually just the popup being closed. Either
      // way the message stays generic — the raw AADSTS text names the tenant
      // and the app registration, and none of that belongs on our page.
      console.error('Sign-in failed:', error)

      if (error?.errorCode === 'popup_window_error' || error?.errorCode === 'empty_window_error') {
        setLoginError('Your browser blocked the sign-in window. Allow pop-ups for this site and try again.')
      } else {
        setLoginError('Sign-in was not completed. Access is limited to approved accounts — please contact the library administrator if you should have access.')
      }
    }
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
    { path: '/checkout', label: 'Borrow', IconComponent: CheckoutIcon },
    { path: '/checked-out', label: 'Borrowed Books', IconComponent: ListIcon },
    { path: '/check-in', label: 'Return', IconComponent: CheckInIcon },
    { path: '/history', label: 'Checkout History', IconComponent: HistoryIcon },
    { path: '/users', label: 'Users', IconComponent: UsersIcon },
    { path: '/wishlist', label: 'Wishlist', IconComponent: StarIcon },
    { path: '/follow-ups', label: 'Follow Ups', IconComponent: BellIcon },
    { path: '/overdue-books', label: 'Overdue & Fines', IconComponent: AlertIcon },
    { path: '/activity-log', label: 'Activity Log', IconComponent: ClockIcon },
    { path: '/settings', label: 'Settings', IconComponent: SettingsIcon },
  ]

  // Public browse page — always accessible without authentication
  if (location.pathname === '/browse') {
    return <BrowseBooks />
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Not authenticated - show landing page (PROD mode only)
  if (!IS_DEV_MODE && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
        {/* Soft brand-tinted backdrop */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-50/70 via-white to-white" />
        <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary-100/60 blur-3xl" />

        {/* Top bar — admin login button top-right */}
        <header className="relative flex justify-end p-4 sm:p-6">
          <button
            onClick={handleLogin}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium border border-gray-300 shadow-sm text-sm"
          >
            <MicrosoftIcon className="w-4 h-4" />
            <span>Admin Login</span>
          </button>
        </header>

        {/* Main content */}
        <main className="relative flex-1 flex flex-col items-center justify-center gap-8 p-4 text-center">
          {/* Logo and Branding */}
          <div className="space-y-5">
            <div className="flex justify-center">
              <img src={zoeLogo} alt="ZOE Community Church Library" className="w-24 h-24 object-contain" />
            </div>
            <div>
              <p className="text-primary-600 font-semibold tracking-wide uppercase text-xs mb-2">ZOE Community Church</p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-ink mb-2">Library</h1>
              <p className="text-gray-500 max-w-md mx-auto">Explore our collection and find your next good read.</p>
            </div>
          </div>

          {loginError && (
            <div className="alert-warning max-w-md text-sm text-left" role="alert">
              {loginError}
            </div>
          )}

          {/* Browse Library CTA */}
          <Link
            to="/browse"
            className="flex items-center justify-center gap-3 px-10 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all duration-300 font-semibold text-lg shadow-lg shadow-primary-600/25 hover:shadow-xl hover:shadow-primary-600/30 hover:-translate-y-0.5"
          >
            <BookIcon className="w-6 h-6" />
            <span>Browse the Library</span>
          </Link>
        </main>

        <footer className="relative text-center py-6 text-gray-400 text-xs">
          &copy; {new Date().getFullYear()} ZOE Community Church
        </footer>
      </div>
    )
  }

  // Authenticated but not authorized (PROD mode only)
  if (!IS_DEV_MODE && !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card text-center max-w-sm w-full">
          <div className="icon-circle from-danger-500 to-danger-600 mx-auto mb-4">
            <AlertIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-ink mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6 text-sm">You are not authorized to access this application.</p>
          <button
            onClick={handleLogout}
            className="btn-secondary w-full"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Authorized - show main app
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <img src={zoeLogo} alt="ZOE Library" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-lg font-bold gradient-text leading-tight">ZOE Library</h1>
                <p className="text-xs text-gray-400">Management</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 truncate">{currentUser?.email || accounts[0]?.username}</p>
              {IS_DEV_MODE && (
                <span className="badge-warning inline-block mt-2">
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
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 hover:text-ink rounded-lg transition-all duration-200 font-medium text-sm"
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
        <header className="lg:hidden bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={zoeLogo} alt="ZOE Library" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-lg font-bold gradient-text leading-tight">ZOE Library</h1>
                {IS_DEV_MODE && (
                  <span className="badge-warning">
                    DEV MODE
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500 hover:text-ink transition-colors p-2 hover:bg-gray-100 rounded-lg"
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
            <Route path="/overdue-books" element={<OverdueBooks />} />
            {/* Fines were folded into Overdue Books — keep old links working */}
            <Route path="/fines" element={<Navigate to="/overdue-books" replace />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/settings" element={<Settings />} />
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
