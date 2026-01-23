import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Shield, UserPlus, Users, Check, X, Mail } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBoardContext } from '@/lib/board-context'
import {
  getBoardMembers,
  inviteToBoard,
  inviteToOrganization,
  removeFromBoard,
  ensureUser,
} from '@/server/punches'

export const Route = createFileRoute('/organization/members')({
  component: OrganizationMembersPage,
})

interface InviteFormData {
  email: string
  name: string
  role: 'admin' | 'member'
}

function OrganizationMembersPage() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { currentBoard, currentOrg } = useBoardContext()

  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    name: '',
    role: 'member',
  })

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['boardMembers', currentBoard?.id],
    queryFn: () => getBoardMembers({ data: currentBoard!.id }),
    enabled: !!currentBoard?.id,
  })

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      if (!user?.id || !currentOrg?.id || !currentBoard?.id) {
        throw new Error('Missing required context')
      }

      // First, create the user in our database
      const targetUserId = `user_${data.email.replace(/[^a-zA-Z0-9]/g, '_')}`

      await ensureUser({
        data: {
          userId: targetUserId,
          email: data.email,
          name: data.name || undefined,
        },
      })

      // Invite to organization with specified role
      await inviteToOrganization({
        data: {
          inviterId: user.id,
          targetUserId,
          organizationId: currentOrg.id,
          role: data.role,
        },
      })

      // If member role, also add board membership
      if (data.role === 'member') {
        await inviteToBoard({
          data: {
            inviterId: user.id,
            targetUserId,
            boardId: currentBoard.id,
          },
        })
      }

      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardMembers', currentBoard?.id] })
      setInviteModalOpen(false)
      setFormData({ email: '', name: '', role: 'member' })
    },
  })

  const removeFromBoardMutation = useMutation({
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

  const handleInvite = () => {
    if (!formData.email) return
    inviteMutation.mutate(formData)
  }

  const handleRemoveAccess = (userId: string) => {
    if (confirm('Remove this user\'s access to this board?')) {
      removeFromBoardMutation.mutate(userId)
    }
  }

  const admins = members.filter(m => m.orgRole === 'admin')
  const boardMembers = members.filter(m => m.orgRole === 'member' && m.hasBoardAccess)
  const orgMembersWithoutBoard = members.filter(m => m.orgRole === 'member' && !m.hasBoardAccess)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground font-medium">
          Manage members in {currentOrg?.name}
        </p>
        <Button onClick={() => setInviteModalOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Invite
        </Button>
      </div>

      {/* Admins Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-extrabold uppercase text-base">
            <Shield className="w-5 h-5 text-accent" />
            Organization Admins
          </CardTitle>
          <CardDescription className="font-medium">
            Admins have access to all boards in {currentOrg?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center py-4 text-muted-foreground font-bold uppercase">Loading...</div>
          ) : admins.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground font-medium">No admins found</div>
          ) : (
            <div className="space-y-2">
              {admins.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-4 bg-[hsl(280_70%_88%)] border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)]"
                >
                  <div className="w-12 h-12 bg-accent border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
                    <Shield className="w-6 h-6 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold truncate">{member.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate font-medium">{member.email}</div>
                  </div>
                  <span className="text-xs bg-accent border-2 border-foreground text-foreground px-3 py-1 font-extrabold uppercase shadow-[2px_2px_0px_hsl(0_0%_5%)]">
                    Admin
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Board Members Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-extrabold uppercase text-base">
            <Check className="w-5 h-5 text-[hsl(140_80%_45%)]" />
            Board Members
          </CardTitle>
          <CardDescription className="font-medium">
            Members with access to {currentBoard?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center py-4 text-muted-foreground font-bold uppercase">Loading...</div>
          ) : boardMembers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground font-medium">
              No members with board access yet
            </div>
          ) : (
            <div className="space-y-2">
              {boardMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-4 bg-[hsl(140_70%_90%)] border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)]"
                >
                  <div className="w-12 h-12 bg-[hsl(140_80%_45%)] border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold truncate">{member.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate font-medium">{member.email}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-2 border-transparent hover:border-foreground"
                    onClick={() => handleRemoveAccess(member.userId)}
                    disabled={removeFromBoardMutation.isPending}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Org Members Without Board Access */}
      {orgMembersWithoutBoard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-extrabold uppercase text-base">
              <Users className="w-5 h-5" />
              Organization Members (No Board Access)
            </CardTitle>
            <CardDescription className="font-medium">
              These members belong to {currentOrg?.name} but don't have access to this board
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {orgMembersWithoutBoard.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-4 bg-muted border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)]"
                >
                  <div className="w-12 h-12 bg-muted-foreground/20 border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
                    <Mail className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold truncate">{member.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate font-medium">{member.email}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (user?.id && currentBoard?.id) {
                        inviteToBoard({
                          data: {
                            inviterId: user.id,
                            targetUserId: member.userId,
                            boardId: currentBoard.id,
                          },
                        }).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['boardMembers', currentBoard?.id] })
                        })
                      }
                    }}
                  >
                    Grant Access
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase">Invite Member</DialogTitle>
            <DialogDescription className="font-medium">
              Add a new member to {currentOrg?.name}. They will receive access based on their role.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="font-bold">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="border-2"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name" className="font-bold">Name (optional)</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="border-2"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role" className="font-bold">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'admin' | 'member') => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger id="role" className="border-2">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    <span className="flex items-center gap-2 font-bold">
                      <Check className="w-4 h-4 text-[hsl(140_80%_45%)]" />
                      Member - Access to {currentBoard?.name} only
                    </span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2 font-bold">
                      <Shield className="w-4 h-4 text-accent" />
                      Admin - Access to all boards
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!formData.email || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? 'Inviting...' : 'Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
