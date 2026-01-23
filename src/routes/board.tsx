import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useBoardContext } from '@/lib/board-context'
import { PunchControls } from '@/components/board/PunchControls'
import { AdminStats } from '@/components/board/AdminStats'
import { MonthlyStatsSection } from '@/components/board/MonthlyStatsSection'

export const Route = createFileRoute('/board')({
  component: BoardPage,
})

function BoardPage() {
  const { user } = useUser()
  const { currentBoard, isOrgAdmin, organizations, isLoading: boardLoading } = useBoardContext()

  if (boardLoading) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto flex items-center justify-center">
        <div className="text-muted-foreground font-bold uppercase tracking-wide">Loading...</div>
      </div>
    )
  }

  // User has no organizations
  if (organizations.length === 0) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-2xl mx-auto flex items-center justify-center">
        <Card className="bg-muted/50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-bold mb-2">No Organization Access</h3>
            <p className="text-muted-foreground">
              You haven't been added to any organizations yet. Please contact an administrator to get access.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No board selected
  if (!currentBoard) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-2xl mx-auto flex items-center justify-center">
        <Card className="bg-muted/50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-bold mb-2">No Board Selected</h3>
            <p className="text-muted-foreground">
              Please select a board from the header to start tracking time.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
          Hey, {user?.firstName || 'there'}!
        </h1>
        <p className="text-muted-foreground font-medium">
          Tracking hours on {currentBoard.name}
        </p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Punch Controls - Everyone can punch in/out and see who's here */}
        <PunchControls />

        {/* Admin Stats - Only visible for org admins */}
        {isOrgAdmin && <AdminStats />}

        {/* Monthly Stats - Everyone sees it, admins can click through */}
        <MonthlyStatsSection editable={isOrgAdmin} currentUserId={user?.id || ''} />
      </div>
    </div>
  )
}
