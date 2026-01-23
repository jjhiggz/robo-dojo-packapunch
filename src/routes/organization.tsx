import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useBoardContext } from '@/lib/board-context'

export const Route = createFileRoute('/organization')({
  component: OrganizationLayout,
})

function OrganizationLayout() {
  const { currentOrg, isOrgAdmin } = useBoardContext()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  if (!currentOrg) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-2xl mx-auto flex items-center justify-center">
        <Card className="bg-muted/50">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-bold mb-2">No Organization Selected</h3>
            <p className="text-muted-foreground">
              Please select an organization from your profile to manage it.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Non-admin view
  if (!isOrgAdmin) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-2xl mx-auto flex items-center justify-center">
        <Card className="bg-muted/50">
          <CardContent className="py-12 text-center">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-extrabold mb-2 uppercase tracking-tight">
              You are a member of {currentOrg.name}
            </h2>
            <p className="text-muted-foreground font-medium">
              Contact an administrator to manage boards, members, or settings.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Admin view with tabs
  const tabs = [
    { path: '/organization/boards', label: 'Boards' },
    { path: '/organization/members', label: 'Members' },
    { path: '/organization/settings', label: 'Settings' },
  ]

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-3">
          <Building2 className="w-7 h-7 sm:w-8 sm:h-8" />
          {currentOrg.name}
        </h1>
        <p className="text-muted-foreground font-medium mt-2">Manage your organization</p>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-border mb-6">
        <nav className="flex gap-2 sm:gap-4">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-4 sm:px-6 py-3 font-extrabold uppercase tracking-wider transition-all duration-200 border-b-2 text-sm sm:text-base ${
                currentPath === tab.path
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <Outlet />
    </div>
  )
}
