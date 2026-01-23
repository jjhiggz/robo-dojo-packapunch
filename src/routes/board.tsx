import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { AlertCircle, ChevronDown, LayoutGrid, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBoardContext } from '@/lib/board-context'
import { PunchControls } from '@/components/board/PunchControls'
import { AdminStats } from '@/components/board/AdminStats'
import { MonthlyStatsSection } from '@/components/board/MonthlyStatsSection'
import { BoardMembers } from '@/components/board/BoardMembers'

export const Route = createFileRoute('/board')({
  component: BoardPage,
})

function BoardPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const { currentBoard, isOrgAdmin, organizations, boards, setCurrentBoard, isLoading: boardLoading } = useBoardContext()

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
    <div className="min-h-[calc(100vh-80px)] p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight mb-2 sm:mb-3">
          Hey, {user?.firstName || 'there'}!
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg sm:text-xl text-muted-foreground font-medium">
            Tracking hours for
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="h-10 sm:h-12 gap-2 font-extrabold text-base sm:text-lg border-2 hover:shadow-[3px_3px_0px_hsl(0_0%_5%)] hover:-translate-x-px hover:-translate-y-px transition-all"
              >
                <LayoutGrid className="w-5 h-5 shrink-0 text-secondary" />
                <span className="max-w-[200px] sm:max-w-[300px] truncate">
                  {currentBoard.name}
                </span>
                <ChevronDown className="w-5 h-5 opacity-70 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[250px]">
              <DropdownMenuLabel className="font-bold">Switch Board</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {boards.map((board) => (
                <DropdownMenuItem
                  key={board.id}
                  onClick={() => setCurrentBoard(board)}
                  className={currentBoard?.id === board.id ? 'bg-accent/20' : ''}
                >
                  <LayoutGrid className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">{board.name}</span>
                </DropdownMenuItem>
              ))}
              {isOrgAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate({ to: '/organization/boards' })}
                    className="text-primary font-bold"
                  >
                    <Plus className="w-4 h-4 mr-2 shrink-0" />
                    Create New Board
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Punch Controls - Everyone can punch in/out and see who's here */}
        <PunchControls />

        {/* Admin Stats - Only visible for org admins */}
        {isOrgAdmin && <AdminStats />}

        {/* Monthly Stats - Everyone sees it, admins can click through */}
        <MonthlyStatsSection editable={isOrgAdmin} currentUserId={user?.id || ''} />

        {/* Board Members - Only visible for org admins */}
        {isOrgAdmin && <BoardMembers />}
      </div>
    </div>
  )
}
