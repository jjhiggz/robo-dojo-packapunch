import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { LogIn, LogOut, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAllUsersStatus, punch } from '@/server/punches'
import { ADMIN_EMAILS } from './admin'

export const Route = createFileRoute('/')({
  component: App,
})

const formatTime = (date: Date | string) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function PunchBoardTable() {
  const { user } = useUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

  const { data: usersStatus = [], isLoading } = useQuery({
    queryKey: ['allUsersStatus'],
    queryFn: () => getAllUsersStatus(),
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  const punchMutation = useMutation({
    mutationFn: (type: 'in' | 'out') =>
      punch({
        data: {
          userId: user!.id,
          userName: user?.fullName || user?.firstName || undefined,
          userEmail: user?.emailAddresses[0]?.emailAddress,
          type,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsersStatus'] })
    },
  })

  const clockedInCount = usersStatus.filter((u) => u.isClockedIn).length
  const currentUserStatus = usersStatus.find((u) => u.userId === user?.id)
  const isClockedIn = currentUserStatus?.isClockedIn ?? false

  // Sort: clocked in first, then by name, with current user at top
  const sortedUsers = [...usersStatus].sort((a, b) => {
    // Current user always first
    if (a.userId === user?.id) return -1
    if (b.userId === user?.id) return 1
    // Then by clocked in status
    if (a.isClockedIn !== b.isClockedIn) {
      return a.isClockedIn ? -1 : 1
    }
    return (a.userName || '').localeCompare(b.userName || '')
  })

  const handlePunch = () => {
    punchMutation.mutate(isClockedIn ? 'out' : 'in')
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Punch Board
            </CardTitle>
            <CardDescription>
          {clockedInCount === 0
            ? 'No one is currently in the building'
            : `${clockedInCount} ${clockedInCount === 1 ? 'person' : 'people'} in the building`}
            </CardDescription>
          </CardHeader>
          <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Since</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Current user row - always shown first with punch button */}
            {user && (
              <TableRow 
                className="bg-primary/5 hover:bg-primary/10 cursor-pointer"
                onClick={() => navigate({ to: `/students/${user.id}` })}
              >
                <TableCell>
                  <div
                    className={`w-4 h-4 rounded-full ${
                      isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                    }`}
                  />
                </TableCell>
                <TableCell className="font-semibold">
                  <span className="text-primary hover:underline">
                    {user.fullName || user.firstName || user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'You'}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {isClockedIn && currentUserStatus
                    ? formatTime(currentUserStatus.lastPunchTime)
                    : '—'}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant={isClockedIn ? 'destructive' : 'default'}
                    onClick={handlePunch}
                    disabled={punchMutation.isPending}
                    className="w-full"
                  >
                    {punchMutation.isPending ? (
                      '...'
                    ) : isClockedIn ? (
                      <>
                        <LogOut className="w-4 h-4 mr-1" />
                        Out
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-1" />
                        In
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {/* Other users - only show those currently clocked in (max 50) */}
            {sortedUsers
              .filter((u) => u.userId !== user?.id && u.isClockedIn)
              .slice(0, 50)
              .map((u) => (
                <TableRow 
                  key={u.userId}
                  className={isAdmin ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={isAdmin ? () => navigate({ to: `/admin/students/${u.userId}` }) : undefined}
                >
                  <TableCell>
                    <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
                  </TableCell>
                  <TableCell className={`font-medium ${isAdmin ? 'text-primary hover:underline' : ''}`}>
                    {u.userName || u.userEmail?.split('@')[0] || 'Unknown'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatTime(u.lastPunchTime)}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}

            {/* Empty state if no other users clocked in */}
            {sortedUsers.filter((u) => u.userId !== user?.id && u.isClockedIn).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No one else is clocked in right now
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
          </CardContent>
        </Card>
  )
}

function App() {
  const { user, isSignedIn, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-2xl mx-auto flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
                    </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-md mx-auto flex items-center justify-center">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">packapunch</CardTitle>
            <CardDescription>Sign in to track your hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <Button asChild className="w-full">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/signup">Create Account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
                    </div>
                  )
                }
                
                    return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hey, {user?.firstName || 'there'}!</h1>
        <p className="text-muted-foreground">Ready to track your hours?</p>
                        </div>
                        
      <PunchBoardTable />

      <div className="mt-4 text-center">
        <Button variant="link" asChild>
          <Link to="/history">View your history →</Link>
                                  </Button>
                                </div>
    </div>
  )
}
