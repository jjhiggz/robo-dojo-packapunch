import { useUser } from '@clerk/clerk-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Building2, ChevronDown, LayoutGrid, Shield } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'
import ClerkHeader from '../integrations/clerk/header-user.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

// Boxing glove SVG icon component
const BoxingGlove = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Boxing glove"
  >
    <title>Boxing glove</title>
    <path d="M19.8 8.5c0-1.1-.4-2.2-1.2-3-.8-.8-1.9-1.3-3-1.3h-1.2c-.3-.7-.8-1.2-1.4-1.6-.6-.4-1.3-.6-2-.6-1.1 0-2.2.4-3 1.2-.8.8-1.3 1.9-1.3 3v.3c-1.3.5-2.3 1.5-2.8 2.8-.5 1.3-.5 2.7.1 4 .6 1.3 1.7 2.3 3 2.7v4.5c0 .8.3 1.6.9 2.1.6.6 1.3.9 2.1.9h6c.8 0 1.6-.3 2.1-.9.6-.6.9-1.3.9-2.1V14c1.3-.3 2.4-1.1 3.1-2.3.7-1.1.9-2.5.7-3.8-.2-.9-.6-1.7-1.2-2.4zM10 4c.5 0 1 .2 1.4.5.4.3.6.8.6 1.3v.2h-4v-.2c0-.5.2-1 .5-1.3.4-.3.9-.5 1.5-.5zm7 16.5c0 .3-.1.5-.3.7-.2.2-.4.3-.7.3h-6c-.3 0-.5-.1-.7-.3-.2-.2-.3-.4-.3-.7V15h8v5.5zm1.5-8c-.4.7-1 1.2-1.8 1.4-.2.1-.4.1-.7.1h-8c-.2 0-.5 0-.7-.1-.8-.2-1.4-.7-1.8-1.4-.4-.7-.5-1.5-.3-2.2.2-.7.6-1.4 1.3-1.8.4-.3.9-.5 1.5-.5h9c.6 0 1.1.2 1.5.5.7.4 1.1 1.1 1.3 1.8.2.7.1 1.5-.3 2.2z"/>
  </svg>
)

export default function Header() {
  const { isSignedIn } = useUser()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const { 
    organizations, 
    currentOrg, 
    currentBoard, 
    boards, 
    isOrgAdmin,
    setCurrentOrg, 
    setCurrentBoard 
  } = useBoardContext()

  const hasOrgs = organizations.length > 0
  const hasBoards = boards.length > 0

  return (
    <header className="bg-background/95 backdrop-blur-sm border-b-2 border-primary/50 relative overflow-hidden">
      {/* Ambient glow effect at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      
      <div className="p-4 flex items-center justify-between relative z-10">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="bg-primary/20 p-2.5 rounded border-2 border-primary shadow-neon-pink-sm group-hover:shadow-neon-pink transition-all duration-300">
            <BoxingGlove className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-widest text-secondary text-glow-cyan">
            PACKAPUNCH
          </h1>
        </Link>

        {/* Org/Board Selector - only show if signed in and has orgs */}
        {isSignedIn && hasOrgs && (
          <div className="flex items-center gap-2">
            {/* Organization Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 font-semibold">
                  <Building2 className="w-4 h-4" />
                  {currentOrg?.name || 'Select Org'}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => setCurrentOrg(org)}
                    className={currentOrg?.id === org.id ? 'bg-accent' : ''}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    {org.name}
                    {org.role === 'admin' && (
                      <Shield className="w-3 h-3 ml-auto text-accent" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Board Selector */}
            {hasBoards && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 font-semibold">
                    <LayoutGrid className="w-4 h-4" />
                    {currentBoard?.name || 'Select Board'}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuLabel>Boards</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {boards.map((board) => (
                    <DropdownMenuItem
                      key={board.id}
                      onClick={() => setCurrentBoard(board)}
                      className={currentBoard?.id === board.id ? 'bg-accent' : ''}
                    >
                      <LayoutGrid className="w-4 h-4 mr-2" />
                      {board.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        <ClerkHeader />
      </div>

      {/* Navigation tabs for signed-in users */}
      {isSignedIn && (
        <nav className="px-4 pb-0 flex gap-3 relative z-10">
          <Link
            to="/"
            className={`px-5 py-3 text-sm font-semibold uppercase tracking-wider transition-all duration-200 rounded-t border-2 border-b-0 ${
              currentPath === '/' || currentPath === '/history'
                ? 'bg-card text-secondary border-secondary shadow-neon-cyan-sm translate-y-[2px]'
                : 'bg-background/50 text-muted-foreground border-muted hover:text-secondary hover:border-secondary/50 hover:shadow-neon-cyan-sm'
            }`}
          >
            My Hours
          </Link>
          {isOrgAdmin && (
            <Link
              to="/admin"
              className={`px-5 py-3 text-sm font-semibold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 rounded-t border-2 border-b-0 ${
                currentPath.startsWith('/admin')
                  ? 'bg-card text-accent border-accent shadow-neon-purple translate-y-[2px]'
                  : 'bg-background/50 text-muted-foreground border-muted hover:text-accent hover:border-accent/50 hover:shadow-neon-purple'
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
