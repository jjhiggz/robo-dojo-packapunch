import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Clock, LogIn, LogOut, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

function PunchBoard() {
  const { user } = useUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

  const { data: usersStatus = [], isLoading } = useQuery({
    queryKey: ['allUsersStatus'],
    queryFn: () => getAllUsersStatus(),
    refetchInterval: 10000,
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

  const othersClockedIn = usersStatus
    .filter((u) => u.userId !== user?.id && u.isClockedIn)
    .slice(0, 50)

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
    <div className="space-y-4">
      {/* Current User Card - Prominent */}
      {user && (
        <Card 
          className={`transition-colors ${
            isClockedIn 
              ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30' 
              : ''
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Status indicator */}
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  isClockedIn 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isClockedIn ? (
                  <Clock className="w-6 h-6" />
                ) : (
                  <LogIn className="w-6 h-6" />
                )}
              </div>

              {/* Info */}
              <button 
                type="button"
                className="flex-1 min-w-0 text-left"
                onClick={() => navigate({ to: `/students/${user.id}` })}
              >
                <div className="font-semibold text-lg truncate hover:text-primary hover:underline">
                  {user.fullName || user.firstName || user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'You'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isClockedIn && currentUserStatus ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      In since {formatTime(currentUserStatus.lastPunchTime)}
                    </span>
                  ) : (
                    'Not clocked in'
                  )}
                </div>
              </button>

              {/* Punch Button */}
              <Button
                size="lg"
                variant={isClockedIn ? 'destructive' : 'default'}
                onClick={handlePunch}
                disabled={punchMutation.isPending}
                className="shrink-0"
              >
                {punchMutation.isPending ? (
                  '...'
                ) : isClockedIn ? (
                  <>
                    <LogOut className="w-5 h-5 mr-2" />
                    Out
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    In
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Others Currently In */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Who's Here
          </CardTitle>
          <CardDescription>
            {clockedInCount === 0
              ? 'No one is currently in the building'
              : clockedInCount === 1 && isClockedIn
                ? "You're the only one here"
                : `${clockedInCount} ${clockedInCount === 1 ? 'person' : 'people'} in the building`}
          </CardDescription>
        </CardHeader>
        
        {othersClockedIn.length > 0 && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              {othersClockedIn.map((u) => {
                const content = (
                  <>
                    {/* Green dot */}
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    
                    {/* Name */}
                    <div className={`flex-1 font-medium truncate text-left ${isAdmin ? 'group-hover:underline' : ''}`}>
                      {u.userName || u.userEmail?.split('@')[0] || 'Unknown'}
                    </div>
                    
                    {/* Time */}
                    <div className="text-sm text-muted-foreground shrink-0">
                      {formatTime(u.lastPunchTime)}
                    </div>
                  </>
                )

                return isAdmin ? (
                  <button
                    key={u.userId}
                    type="button"
                    className="group w-full flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors text-primary"
                    onClick={() => navigate({ to: `/admin/students/${u.userId}` })}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={u.userId}
                    className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30"
                  >
                    {content}
                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
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
      
      <PunchBoard />

      <div className="mt-4 text-center">
        <Button variant="link" asChild>
          <Link to="/history">View your history →</Link>
        </Button>
      </div>
    </div>
  )
}
