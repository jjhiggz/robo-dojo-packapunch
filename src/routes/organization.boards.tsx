import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, Plus } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'
import { getUserBoardsInOrg, createBoard } from '@/server/punches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/organization/boards')({
  component: OrganizationBoardsPage,
})

function OrganizationBoardsPage() {
  const { user } = useUser()
  const { currentOrg } = useBoardContext()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [createError, setCreateError] = useState('')

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ['userBoards', user?.id, currentOrg?.id],
    queryFn: () =>
      getUserBoardsInOrg({
        data: { userId: user!.id, organizationId: currentOrg!.id },
      }),
    enabled: !!user?.id && !!currentOrg?.id,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      return createBoard({
        data: {
          userId: user!.id,
          organizationId: currentOrg!.id,
          name,
          slug,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBoards'] })
      setCreateDialogOpen(false)
      setNewBoardName('')
      setCreateError('')
    },
    onError: (error: Error) => {
      setCreateError(error.message)
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground font-medium">
          Manage boards within {currentOrg?.name}
        </p>
        <Button
          onClick={() => {
            setNewBoardName('')
            setCreateError('')
            setCreateDialogOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Board
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground font-bold uppercase">Loading boards...</p>
        </div>
      ) : boards.length === 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="p-12 text-center">
            <LayoutGrid className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-extrabold mb-2 uppercase">No Boards Yet</h3>
            <p className="text-muted-foreground font-medium mb-4">
              Create your first board to start tracking time
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Board
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => (
            <Card
              key={board.id}
              className="transition-all hover:shadow-[3px_3px_0px_hsl(0_0%_5%)] hover:-translate-x-px hover:-translate-y-px"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-primary/20 p-2 border-2 border-foreground shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
                    <LayoutGrid className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-lg truncate">{board.name}</h3>
                    <p className="text-xs text-muted-foreground font-medium truncate">{board.slug}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" disabled>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1" disabled>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Board Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase">Create Board</DialogTitle>
            <DialogDescription className="font-medium">
              Create a new board to track time for different projects or teams.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="board-name" className="font-bold">Board Name</Label>
              <Input
                id="board-name"
                placeholder="Development Team"
                value={newBoardName}
                onChange={(e) => {
                  setNewBoardName(e.target.value)
                  setCreateError('')
                }}
                className="border-2"
              />
              {newBoardName && (
                <p className="text-xs text-muted-foreground font-medium">
                  Slug: {newBoardName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                </p>
              )}
            </div>

            {createError && (
              <p className="text-sm text-destructive font-bold">{createError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newBoardName.trim()) {
                  setCreateError('Board name is required')
                  return
                }
                createMutation.mutate(newBoardName)
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
