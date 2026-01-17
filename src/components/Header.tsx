import { useUser } from '@clerk/clerk-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Shield } from 'lucide-react'
import ClerkHeader from '../integrations/clerk/header-user.tsx'

// Admin email addresses - keep in sync with admin.tsx
const ADMIN_EMAILS = [
  'jonathan.higger@gmail.com',
  'aionfork@gmail.com',
  'armstrong.dan237@gmail.com',
  'tarheelwinetraders@gmail.com',
  'janyoumd@gmail.com',
  'semoyer@vt.edu'
]

// Boxing glove SVG icon component
const BoxingGlove = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.8 8.5c0-1.1-.4-2.2-1.2-3-.8-.8-1.9-1.3-3-1.3h-1.2c-.3-.7-.8-1.2-1.4-1.6-.6-.4-1.3-.6-2-.6-1.1 0-2.2.4-3 1.2-.8.8-1.3 1.9-1.3 3v.3c-1.3.5-2.3 1.5-2.8 2.8-.5 1.3-.5 2.7.1 4 .6 1.3 1.7 2.3 3 2.7v4.5c0 .8.3 1.6.9 2.1.6.6 1.3.9 2.1.9h6c.8 0 1.6-.3 2.1-.9.6-.6.9-1.3.9-2.1V14c1.3-.3 2.4-1.1 3.1-2.3.7-1.1.9-2.5.7-3.8-.2-.9-.6-1.7-1.2-2.4zM10 4c.5 0 1 .2 1.4.5.4.3.6.8.6 1.3v.2h-4v-.2c0-.5.2-1 .5-1.3.4-.3.9-.5 1.5-.5zm7 16.5c0 .3-.1.5-.3.7-.2.2-.4.3-.7.3h-6c-.3 0-.5-.1-.7-.3-.2-.2-.3-.4-.3-.7V15h8v5.5zm1.5-8c-.4.7-1 1.2-1.8 1.4-.2.1-.4.1-.7.1h-8c-.2 0-.5 0-.7-.1-.8-.2-1.4-.7-1.8-1.4-.4-.7-.5-1.5-.3-2.2.2-.7.6-1.4 1.3-1.8.4-.3.9-.5 1.5-.5h9c.6 0 1.1.2 1.5.5.7.4 1.1 1.1 1.3 1.8.2.7.1 1.5-.3 2.2z"/>
  </svg>
)

export default function Header() {
  const { user, isSignedIn } = useUser()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

  return (
    <header className="bg-foreground text-background border-b-4 border-foreground">
      <div className="p-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-secondary p-2 border-3 border-background shadow-[2px_2px_0px_hsl(48_100%_98%)] group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-none transition-all">
            <BoxingGlove className="w-5 h-5 text-foreground" />
          </div>
          <h1 className="text-xl font-extrabold uppercase tracking-tight">packapunch</h1>
        </Link>
        <ClerkHeader />
      </div>

      {/* Navigation tabs for signed-in users */}
      {isSignedIn && (
        <nav className="px-4 pb-0 flex gap-2">
          <Link
            to="/"
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all border-3 border-b-0 ${
              currentPath === '/' || currentPath === '/history'
                ? 'bg-background text-foreground border-background translate-y-[3px]'
                : 'bg-foreground text-background border-foreground hover:bg-primary hover:text-primary-foreground'
            }`}
          >
            My Hours
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className={`px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all flex items-center gap-2 border-3 border-b-0 ${
                currentPath === '/admin'
                  ? 'bg-background text-foreground border-background translate-y-[3px]'
                  : 'bg-foreground text-background border-foreground hover:bg-accent hover:text-accent-foreground'
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
