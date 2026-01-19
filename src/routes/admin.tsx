import { useUser } from '@clerk/clerk-react'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ADMIN_EMAILS } from '@/lib/constants'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const { user, isSignedIn, isLoaded } = useUser()
  const navigate = useNavigate()

  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

  if (!isLoaded) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    navigate({ to: '/login' })
    return null
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-md mx-auto flex items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <Outlet />
}
