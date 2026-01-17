import { useUser } from '@clerk/clerk-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Shield, Zap } from 'lucide-react'
import ClerkHeader from '../integrations/clerk/header-user.tsx'

// Admin email addresses - keep in sync with admin.tsx
const ADMIN_EMAILS = ['jonathan.higger@gmail.com']

export default function Header() {
  const { user, isSignedIn } = useUser()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

  return (
    <header className="bg-gray-800 text-white shadow-lg">
      <div className="p-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Zap className="w-6 h-6" />
          <h1 className="text-xl font-semibold">packapunch</h1>
        </Link>
        <ClerkHeader />
      </div>

      {/* Navigation tabs for signed-in users */}
      {isSignedIn && (
        <nav className="px-4 pb-2 flex gap-1">
          <Link
            to="/"
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              currentPath === '/' || currentPath === '/history'
                ? 'bg-white text-gray-800'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            My Hours
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                currentPath === '/admin'
                  ? 'bg-white text-gray-800'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}
