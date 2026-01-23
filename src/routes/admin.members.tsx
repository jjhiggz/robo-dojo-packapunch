import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
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

export const Route = createFileRoute('/admin/members')({
  component: MembersPage,
})

interface InviteFormData {
  email: string
  name: string
  role: 'admin' | 'member'
}

function MembersPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentBoard, currentOrg, isOrgAdmin, isLoading: boardLoading } = useBoardContext()
  
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    name: '',
    role: 'member',
  })

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['boardMembers', currentBoard?.id],
    queryFn: () => getBoardMembers({ data: currentBoard!.id }),
    enabled: !!currentBoard?.id && isOrgAdmin,
  })

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      if (!user?.id || !currentOrg?.id || !currentBoard?.id) {
        throw new Error('Missing required context')
      }

      // First, create the user in our database
      // Note: In a real app, you'd want to look up the user by email first
      // For now, we'll create a placeholder user ID based on email
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

  if (boardLoading) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-4xl mx-auto flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isOrgAdmin || !currentBoard || !currentOrg) {
    navigate({ to: '/' })
    return null
  }

  const admins = members.filter(m => m.orgRole === 'admin')
  const boardMembers = members.filter(m => m.orgRole === 'member' && m.hasBoardAccess)
  const orgMembersWithoutBoard = members.filter(m => m.orgRole === 'member' && !m.hasBoardAccess)

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            Members
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Manage {currentBoard.name} members
          </p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite
        </Button>
      </div>

      {/* Admins Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-accent" />
            Organization Admins
          </CardTitle>
          <CardDescription>
            Admins have access to all boards in {currentOrg.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : admins.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No admins found</div>
          ) : (
            <div className="space-y-2">
              {admins.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-3 bg-accent/10 rounded-lg"
                >
                  <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{member.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                  </div>
                  <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded font-semibold uppercase">
                    Admin
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Board Members Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Check className="w-5 h-5 text-green-600" />
            Board Members
          </CardTitle>
          <CardDescription>
            Members with access to {currentBoard.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : boardMembers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No members with board access yet
            </div>
          ) : (
            <div className="space-y-2">
              {boardMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg"
                >
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{member.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
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
            <CardTitle className="flex items-center gap-2 text-lg">
              <X className="w-5 h-5 text-muted-foreground" />
              Organization Members (No Board Access)
            </CardTitle>
            <CardDescription>
              These members belong to {currentOrg.name} but don't have access to this board
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {orgMembersWithoutBoard.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{member.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (user?.id) {
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
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Add a new member to {currentOrg.name}. They will receive access based on their role.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'admin' | 'member') => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    <span className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Member - Access to {currentBoard.name} only
                    </span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2">
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
