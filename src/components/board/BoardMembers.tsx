import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, X, Check, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useBoardContext } from '@/lib/board-context'
import {
  getBoardMembers,
  getOrganizationMembers,
  inviteToBoard,
  removeFromBoard,
} from '@/server/punches'

export function BoardMembers() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { currentBoard, currentOrg, isOrgAdmin } = useBoardContext()
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: boardMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['boardMembers', currentBoard?.id],
    queryFn: () => getBoardMembers({ data: currentBoard!.id }),
    enabled: !!currentBoard?.id,
  })

  const { data: orgMembers = [] } = useQuery({
    queryKey: ['organizationMembers', currentOrg?.id],
    queryFn: () => getOrganizationMembers({ data: currentOrg!.id }),
    enabled: !!currentOrg?.id && isOrgAdmin && addMemberDialogOpen,
  })

  const addMemberMutation = useMutation({
    mutationFn: (targetUserId: string) => {
      if (!user?.id || !currentBoard?.id) {
        throw new Error('Missing required context')
      }
      return inviteToBoard({
        data: {
          inviterId: user.id,
          targetUserId,
          boardId: currentBoard.id,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardMembers', currentBoard?.id] })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (targetUserId: string) => {
      if (!user?.id || !currentBoard?.id) {
        throw new Error('Missing required context')
      }
      return removeFromBoard({
        data: {
          adminId: user.id,
          targetUserId,
          boardId: currentBoard.id,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardMembers', currentBoard?.id] })
    },
  })

  const handleRemoveMember = (userId: string, userName: string) => {
    if (confirm(`Remove ${userName} from this board?`)) {
      removeMemberMutation.mutate(userId)
    }
  }

  const handleAddMember = (userId: string) => {
    addMemberMutation.mutate(userId)
  }

  // Get all members who have been explicitly added to the board (both admins and regular members)
  const membersWithAccess = boardMembers.filter(m => m.hasBoardAccess)

  // Get org members who don't have board access yet (include both admins and members)
  const boardMemberIds = new Set(membersWithAccess.map(m => m.userId))
  const availableMembers = orgMembers.filter(m => !boardMemberIds.has(m.userId))

  // Filter members by search term
  const filteredMembers = availableMembers.filter(member => {
    const search = searchTerm.toLowerCase()
    const name = (member.name || '').toLowerCase()
    const email = (member.email || '').toLowerCase()
    return name.includes(search) || email.includes(search)
  })

  if (!isOrgAdmin) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-extrabold uppercase text-base">
              <Users className="w-5 h-5 text-[hsl(200_80%_50%)]" />
              Board Members
            </CardTitle>
            <CardDescription className="font-medium">
              Manage who has access to {currentBoard?.name}
            </CardDescription>
          </div>
          <Button onClick={() => setAddMemberDialogOpen(true)} size="sm" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Add Member
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {membersLoading ? (
          <div className="text-center py-4 text-muted-foreground font-bold uppercase">Loading...</div>
        ) : membersWithAccess.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground font-medium">
            No members have been added to this board yet. Add members using the button above.
          </div>
        ) : (
          <div className="space-y-2">
            {membersWithAccess.map((member) => {
              const isAdmin = member.orgRole === 'admin'
              return (
                <div
                  key={member.userId}
                  className={`flex items-center gap-3 p-4 border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)] ${
                    isAdmin ? 'bg-[hsl(280_70%_88%)]' : 'bg-[hsl(200_70%_90%)]'
                  }`}
                >
                  <div className={`w-10 h-10 border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)] ${
                    isAdmin ? 'bg-accent' : 'bg-[hsl(200_80%_50%)]'
                  }`}>
                    <Users className={`w-5 h-5 ${isAdmin ? 'text-foreground' : 'text-white'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold truncate">
                      {member.name || 'Unknown'}
                      {isAdmin && <span className="ml-2 text-xs text-accent">(Admin)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate font-medium">{member.email}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-2 border-transparent hover:border-foreground shrink-0"
                    onClick={() => handleRemoveMember(member.userId, member.name || member.email)}
                    disabled={removeMemberMutation.isPending}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={(open) => {
        setAddMemberDialogOpen(open)
        if (!open) setSearchTerm('')
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase">Add Member to Board</DialogTitle>
            <DialogDescription className="font-medium">
              Add organization members to {currentBoard?.name}. You can add both admins and regular members.
            </DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          {availableMembers.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-2"
              />
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto py-2">
            {availableMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-medium">
                All organization members already have access to this board.
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-medium">
                No members found matching "{searchTerm}"
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((member) => {
                  const isAdmin = member.role === 'admin'
                  return (
                    <div
                      key={member.userId}
                      className={`flex items-center gap-3 p-3 border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)] ${
                        isAdmin ? 'bg-[hsl(280_70%_88%)]' : 'bg-muted'
                      }`}
                    >
                      <div className={`w-10 h-10 border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)] ${
                        isAdmin ? 'bg-accent' : 'bg-muted-foreground/20'
                      }`}>
                        <Users className={`w-5 h-5 ${isAdmin ? 'text-foreground' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold truncate text-sm">
                          {member.name || 'Unknown'}
                          {isAdmin && <span className="ml-2 text-xs text-accent">(Admin)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate font-medium">{member.email}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleAddMember(member.userId)
                          setAddMemberDialogOpen(false)
                        }}
                        disabled={addMemberMutation.isPending}
                        className="gap-1 shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
