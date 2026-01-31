import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Clock, LogIn, LogOut, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAllUsersStatus, punch } from '@/server/punches'
import { useBoardContext } from '@/lib/board-context'
import { PunchConfirmationModal } from './PunchConfirmationModal'

const formatTime = (date: Date | string) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function PunchControls() {
  const { user } = useUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentBoard, isOrgAdmin } = useBoardContext()

  const { data: usersStatus = [], isLoading } = useQuery({
    queryKey: ['allUsersStatus', currentBoard?.id],
    queryFn: () => getAllUsersStatus({ data: currentBoard!.id }),
    refetchInterval: 10000,
    enabled: !!currentBoard?.id,
  })

  const punchMutation = useMutation({
    mutationFn: (params: { type: 'in' | 'out'; timestamp?: string; notes?: string }) =>
      punch({
        data: {
          userId: user?.id ?? '',
          boardId: currentBoard!.id,
          userName: user?.fullName || user?.firstName || undefined,
          userEmail: user?.emailAddresses[0]?.emailAddress,
          type: params.type,
          timestamp: params.timestamp,
          notes: params.notes,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsersStatus', currentBoard?.id] })
    },
  })

  const currentUserStatus = usersStatus.find((u) => u.userId === user?.id)
  const isClockedIn = currentUserStatus?.isClockedIn ?? false

  const othersClockedIn = usersStatus
    .filter((u) => u.userId !== user?.id && u.isClockedIn)
    .slice(0, 50)

  const clockedInCount = usersStatus.filter((u) => u.isClockedIn).length

  const [showModal, setShowModal] = useState(false)
  const [pendingPunchType, setPendingPunchType] = useState<'in' | 'out'>('in')

  const handlePunch = () => {
    setPendingPunchType(isClockedIn ? 'out' : 'in')
    setShowModal(true)
  }

  const handleConfirm = (timestamp: Date, notes: string) => {
    punchMutation.mutate({
      type: pendingPunchType,
      timestamp: timestamp.toISOString(),
      notes,
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground font-bold uppercase">
          Loading...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current User Card - Prominent */}
      {user && (
        <Card
          className={`transition-all ${
            isClockedIn
              ? 'bg-[hsl(140_70%_85%)] border-foreground'
              : 'bg-card'
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              {/* Status indicator */}
              <div
                className={`w-14 h-14 flex items-center justify-center shrink-0 border-3 border-foreground shadow-[3px_3px_0px_hsl(0_0%_5%)] ${
                  isClockedIn
                    ? 'bg-[hsl(140_80%_45%)] text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isClockedIn ? (
                  <Clock className="w-7 h-7" />
                ) : (
                  <LogIn className="w-7 h-7" />
                )}
              </div>

              {/* Info */}
              <button
                type="button"
                className="flex-1 min-w-0 text-left group"
                onClick={() => navigate({ to: '/students/$userId', params: { userId: user.id } })}
              >
                <div className="font-extrabold text-lg truncate group-hover:text-primary group-hover:underline underline-offset-2 decoration-2">
                  {user.fullName || user.firstName || user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'You'}
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  {isClockedIn && currentUserStatus ? (
                    <span className="text-[hsl(140_80%_30%)] font-bold">
                      ● In since {formatTime(currentUserStatus.lastPunchTime)}
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
            <Users className="w-5 h-5" />
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
            <div className="space-y-3">
              {othersClockedIn.map((u) => {
                const content = (
                  <>
                    {/* Green indicator */}
                    <div className="w-3 h-3 bg-[hsl(140_80%_45%)] border-2 border-foreground shrink-0" />

                    {/* Name */}
                    <div className={`flex-1 font-bold truncate text-left ${isOrgAdmin ? 'group-hover:underline underline-offset-2' : ''}`}>
                      {u.userName || u.userEmail?.split('@')[0] || 'Unknown'}
                    </div>

                    {/* Time */}
                    <div className="text-sm font-medium text-muted-foreground shrink-0">
                      {formatTime(u.lastPunchTime)}
                    </div>
                  </>
                )

                return isOrgAdmin ? (
                  <button
                    key={u.userId}
                    type="button"
                    className="group w-full flex items-center gap-3 p-4 bg-[hsl(140_70%_90%)] border-2 border-foreground cursor-pointer hover:bg-[hsl(140_70%_85%)] transition-colors shadow-[2px_2px_0px_hsl(0_0%_5%)] hover:shadow-[3px_3px_0px_hsl(0_0%_5%)] hover:-translate-x-px hover:-translate-y-px"
                    onClick={() => navigate({ to: '/students/$userId', params: { userId: u.userId } })}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={u.userId}
                    className="flex items-center gap-3 p-4 bg-[hsl(140_70%_90%)] border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)]"
                  >
                    {content}
                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>

      <PunchConfirmationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        punchType={pendingPunchType}
        lastPunch={
          currentUserStatus
            ? {
                type: currentUserStatus.isClockedIn ? 'in' : 'out',
                timestamp: currentUserStatus.lastPunchTime,
              }
            : null
        }
        onConfirm={handleConfirm}
      />
    </div>
  )
}
