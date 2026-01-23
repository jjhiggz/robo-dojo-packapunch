import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, AlertCircle, Edit, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { calculateHoursFromPunches, getPunchHistory, updatePunch, deletePunch } from '@/server/punches'
import { useBoardContext } from '@/lib/board-context'

export const Route = createFileRoute('/students/$userId')({
  component: StudentProfilePage,
})

const formatTime = (date: Date | string) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const formatHours = (hours: number) => {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0 && m === 0) return '0h'
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const getWeekStart = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const getWeekDays = (weekStart: Date) => {
  const days = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + i)
    days.push(day)
  }
  return days
}

interface EditPunchData {
  id: number
  timestamp: string
  type: 'in' | 'out'
}

function WeeklyPunchCard({ userId, boardId, weekStart, isOrgAdmin }: { userId: string; boardId: number; weekStart: Date; isOrgAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [editingPunch, setEditingPunch] = useState<EditPunchData | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editDate, setEditDate] = useState('')

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
  }, [weekStart])

  const { data: punches = [], isLoading } = useQuery({
    queryKey: ['punchHistory', userId, boardId, weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: () =>
      getPunchHistory({
        data: {
          userId,
          boardId,
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
        },
      }),
  })

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  // Group punches by day
  const punchesByDay = useMemo(() => {
    const grouped = new Map<string, typeof punches>()
    for (const day of weekDays) {
      const dateKey = day.toISOString().split('T')[0]
      grouped.set(dateKey, [])
    }
    for (const p of punches) {
      const dateKey = new Date(p.timestamp).toISOString().split('T')[0]
      const dayPunches = grouped.get(dateKey)
      if (dayPunches) {
        dayPunches.push(p)
      }
    }
    return grouped
  }, [punches, weekDays])

  const totalWeekHours = useMemo(() => calculateHoursFromPunches(punches), [punches])

  const updateMutation = useMutation({
    mutationFn: ({ punchId, timestamp }: { punchId: number; timestamp: string }) =>
      updatePunch({ data: { punchId, timestamp } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchHistory', userId, boardId] })
      setEditingPunch(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (punchId: number) => deletePunch({ data: punchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchHistory', userId, boardId] })
    },
  })

  const handleEdit = (punch: any) => {
    const date = new Date(punch.timestamp)
    setEditDate(date.toISOString().split('T')[0])
    setEditTime(date.toTimeString().slice(0, 5))
    setEditingPunch({
      id: punch.id,
      timestamp: punch.timestamp,
      type: punch.type,
    })
  }

  const handleSaveEdit = () => {
    if (!editingPunch || !editDate || !editTime) return

    const timestamp = new Date(`${editDate}T${editTime}:00`).toISOString()
    updateMutation.mutate({ punchId: editingPunch.id, timestamp })
  }

  const handleDelete = (punchId: number) => {
    if (confirm('Are you sure you want to delete this punch?')) {
      deleteMutation.mutate(punchId)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading punch card...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Weekly Punch Card
          </span>
          <span className="text-2xl">{formatHours(totalWeekHours)}</span>
        </CardTitle>
        <CardDescription>
          {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' - '}
          {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Day</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              {isOrgAdmin && <TableHead className="w-[80px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {weekDays.map((day) => {
              const dateKey = day.toISOString().split('T')[0]
              const dayPunches = punchesByDay.get(dateKey) || []
              const sortedPunches = [...dayPunches].sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )
              const dayHours = calculateHoursFromPunches(dayPunches)
              const isToday = dateKey === new Date().toISOString().split('T')[0]

              return (
                <TableRow key={dateKey} className={isToday ? 'bg-primary/5' : ''}>
                  <TableCell className="font-medium">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    {isToday && <span className="ml-1 text-xs text-primary">(today)</span>}
                  </TableCell>
                  {[0, 1, 2, 3].map((idx) => {
                    const punch = sortedPunches[idx]
                    return (
                      <TableCell key={idx}>
                        {punch ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{formatTime(punch.timestamp)}</span>
                            {isOrgAdmin && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleEdit(punch)}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(punch.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right font-medium">
                    {dayHours > 0 ? formatHours(dayHours) : '—'}
                  </TableCell>
                  {isOrgAdmin && <TableCell></TableCell>}
                </TableRow>
              )
            })}
            <TableRow className="font-bold bg-muted/50">
              <TableCell colSpan={5}>Total</TableCell>
              <TableCell className="text-right">{formatHours(totalWeekHours)}</TableCell>
              {isOrgAdmin && <TableCell></TableCell>}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Punch Dialog */}
      <Dialog open={!!editingPunch} onOpenChange={() => setEditingPunch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase">Edit Punch</DialogTitle>
            <DialogDescription className="font-medium">
              Update the time for this punch {editingPunch?.type === 'in' ? 'in' : 'out'} record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date" className="font-bold">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="border-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time" className="font-bold">Time</Label>
              <Input
                id="edit-time"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="border-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPunch(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending || !editDate || !editTime}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function StudentProfilePage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const navigate = useNavigate()
  const { userId } = Route.useParams()
  const { currentBoard, isOrgAdmin, isLoading: boardLoading } = useBoardContext()
  const [currentWeek, setCurrentWeek] = useState(new Date())

  const weekStart = useMemo(() => getWeekStart(currentWeek), [currentWeek])

  // Users can view their own profile, or org admins can view anyone's
  const isOwnProfile = user?.id === userId
  const canView = isOwnProfile || isOrgAdmin

  // Get student info from a punch record
  const { data: recentPunches = [] } = useQuery({
    queryKey: ['studentInfo', userId, currentBoard?.id],
    queryFn: () =>
      getPunchHistory({
        data: {
          userId,
          boardId: currentBoard!.id,
          startDate: new Date(0).toISOString(),
          endDate: new Date().toISOString(),
        },
      }),
    select: (data) => data.slice(0, 1),
    enabled: !!currentBoard?.id,
  })

  const studentInfo = recentPunches?.[0] || { userName: null, userEmail: null }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeek(newWeek)
  }

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date())
  }

  if (!isLoaded || boardLoading) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-4xl mx-auto flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    navigate({ to: '/login' })
    return null
  }

  // Redirect if trying to view someone else's profile and not an admin
  if (!canView) {
    navigate({ to: '/' })
    return null
  }

  if (!currentBoard) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">My Profile</h1>
          </div>
        </div>
        <Card className="bg-muted/50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-bold mb-2">No Board Selected</h3>
            <p className="text-muted-foreground">
              Please select an organization and board from the header to view your profile.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {isOwnProfile ? 'My Profile' : studentInfo.userName || 'Unknown Student'}
          </h1>
          <p className="text-muted-foreground">
            {currentBoard.name} - {studentInfo.userEmail || userId}
          </p>
        </div>
      </div>

      {/* Week Navigation */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <Button variant="link" size="sm" onClick={goToCurrentWeek}>
                Go to current week
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Punch Card */}
      <WeeklyPunchCard userId={userId} boardId={currentBoard.id} weekStart={weekStart} isOrgAdmin={isOrgAdmin} />

      {!isOrgAdmin && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>This is a read-only view for accountability.</p>
        </div>
      )}
    </div>
  )
}
