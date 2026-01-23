import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Shield, UserPlus, Users } from 'lucide-react'
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
  getOrganizationMembers,
  inviteToOrganization,
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
  const { currentOrg } = useBoardContext()

  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    name: '',
    role: 'member',
  })

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['organizationMembers', currentOrg?.id],
    queryFn: () => getOrganizationMembers({ data: currentOrg!.id }),
    enabled: !!currentOrg?.id,
  })

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      if (!user?.id || !currentOrg?.id) {
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

      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizationMembers', currentOrg?.id] })
      setInviteModalOpen(false)
      setFormData({ email: '', name: '', role: 'member' })
    },
  })

  const handleInvite = () => {
    if (!formData.email) return
    inviteMutation.mutate(formData)
  }

  const admins = members.filter(m => m.role === 'admin')
  const regularMembers = members.filter(m => m.role === 'member')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold uppercase">Members</h2>
          <p className="text-muted-foreground font-medium">
            Manage members in {currentOrg?.name}
          </p>
        </div>
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
            Admins have full access to all boards and can manage organization settings
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

      {/* Regular Members Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-extrabold uppercase text-base">
            <Users className="w-5 h-5 text-[hsl(200_80%_50%)]" />
            Members
          </CardTitle>
          <CardDescription className="font-medium">
            Organization members - board access is managed per board in the Boards tab
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center py-4 text-muted-foreground font-bold uppercase">Loading...</div>
          ) : regularMembers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground font-medium">
              No members yet. Invite members to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {regularMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-4 bg-[hsl(200_70%_90%)] border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)]"
                >
                  <div className="w-12 h-12 bg-[hsl(200_80%_50%)] border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold truncate">{member.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate font-medium">{member.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase">Invite Member</DialogTitle>
            <DialogDescription className="font-medium">
              Add a new member to {currentOrg?.name}. Board access can be managed separately in the Boards tab.
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
                      <Users className="w-4 h-4 text-[hsl(200_80%_50%)]" />
                      Member
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
