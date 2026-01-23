import { useUser } from '@clerk/clerk-react'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Shield, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useBoardContext } from '@/lib/board-context'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const { isSignedIn, isLoaded } = useUser()
  const navigate = useNavigate()
  const { isOrgAdmin, currentOrg, currentBoard, isLoading: boardLoading } = useBoardContext()

  if (!isLoaded || boardLoading) {
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

  if (!currentOrg) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-md mx-auto flex items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">No Organization</h2>
            <p className="text-muted-foreground">
              Please select an organization to view admin dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isOrgAdmin) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-md mx-auto flex items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have admin permissions for {currentOrg.name}.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentBoard) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-md mx-auto flex items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">No Board Selected</h2>
            <p className="text-muted-foreground">
              Please select a board from the header to view dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <Outlet />
}
