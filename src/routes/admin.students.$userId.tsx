import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Edit2, Plus, Save, Trash2, X } from 'lucide-react'
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
  addPunch,
  calculateHoursFromPunches,
  deletePunch,
  getPunchHistory,
  updatePunch,
} from '@/server/punches'
import { ADMIN_EMAILS } from './admin'

export const Route = createFileRoute('/admin/students/$userId')({
  component: StudentDetailPage,
})

const formatTime = (date: Date | string | null | undefined) => {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const formatDateTimeLocal = (date: Date | string | null | undefined) => {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
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

function WeeklyPunchCard({
  userId,
  userName,
  userEmail,
  weekStart,
}: {
  userId: string
  userName: string | null
  userEmail: string | null
  weekStart: Date
}) {
  const queryClient = useQueryClient()
  const [editingPunch, setEditingPunch] = useState<{ id: number; timestamp: string } | null>(null)
  const [addingPunch, setAddingPunch] = useState<{ date: string; type: 'in' | 'out' } | null>(null)

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
  }, [weekStart])

  const { data: punches = [], isLoading } = useQuery({
    queryKey: ['punchHistory', userId, weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: () =>
      getPunchHistory({
        data: {
          userId,
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
        },
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ punchId, timestamp }: { punchId: number; timestamp: string }) =>
      updatePunch({ data: { punchId, timestamp } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchHistory', userId] })
      setEditingPunch(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (punchId: number) => deletePunch({ data: punchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchHistory', userId] })
    },
  })

  const addMutation = useMutation({
    mutationFn: ({ type, timestamp }: { type: 'in' | 'out'; timestamp: string }) =>
      addPunch({
        data: {
          userId,
          userName: userName || undefined,
          userEmail: userEmail || undefined,
          type,
          timestamp,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchHistory', userId] })
      setAddingPunch(null)
    },
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
      if (grouped.has(dateKey)) {
        grouped.get(dateKey)!.push(p)
      }
    }
    return grouped
  }, [punches, weekDays])

  const totalWeekHours = useMemo(() => calculateHoursFromPunches(punches), [punches])

  const handleSaveEdit = () => {
    if (editingPunch) {
      updateMutation.mutate({
        punchId: editingPunch.id,
        timestamp: editingPunch.timestamp,
      })
    }
  }

  const handleSaveAdd = () => {
    if (addingPunch) {
      // Combine date and current time
      const timestamp = new Date(addingPunch.date).toISOString()
      addMutation.mutate({
        type: addingPunch.type,
        timestamp,
      })
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
              <TableHead className="w-[80px]"></TableHead>
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
                    const isEditing = editingPunch?.id === punch?.id

                    return (
                      <TableCell key={idx}>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="datetime-local"
                              value={editingPunch.timestamp}
                              onChange={(e) =>
                                setEditingPunch({ ...editingPunch, timestamp: e.target.value })
                              }
                              className="text-xs px-1 py-0.5 border rounded"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={handleSaveEdit}
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => setEditingPunch(null)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : punch ? (
                          <div className="flex items-center gap-1 group">
                            <span className="text-sm">{formatTime(punch.timestamp)}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() =>
                                setEditingPunch({
                                  id: punch.id,
                                  timestamp: formatDateTimeLocal(punch.timestamp),
                                })
                              }
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                              onClick={() => {
                                if (confirm('Delete this punch?')) {
                                  deleteMutation.mutate(punch.id)
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
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
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setAddingPunch({ date: dateKey, type: 'in' })}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            <TableRow className="font-bold bg-muted/50">
              <TableCell colSpan={5}>Total</TableCell>
              <TableCell className="text-right">{formatHours(totalWeekHours)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Add Punch Dialog */}
        {addingPunch && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold mb-2">Add Punch</h3>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={formatDateTimeLocal(addingPunch.date)}
                onChange={(e) => setAddingPunch({ ...addingPunch, date: e.target.value })}
                className="px-2 py-1 border rounded"
              />
              <select
                value={addingPunch.type}
                onChange={(e) =>
                  setAddingPunch({ ...addingPunch, type: e.target.value as 'in' | 'out' })
                }
                className="px-2 py-1 border rounded"
              >
                <option value="in">In</option>
                <option value="out">Out</option>
              </select>
              <Button size="sm" onClick={handleSaveAdd}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingPunch(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StudentDetailPage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const navigate = useNavigate()
  const { userId } = Route.useParams()
  const [currentWeek, setCurrentWeek] = useState(new Date())

  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

  const weekStart = useMemo(() => getWeekStart(currentWeek), [currentWeek])

  // Get student info from a punch record
  const { data: recentPunches = [] } = useQuery({
    queryKey: ['studentInfo', userId],
    queryFn: () =>
      getPunchHistory({
        data: {
          userId,
          startDate: new Date(0).toISOString(), // All time
          endDate: new Date().toISOString(),
        },
      }),
    select: (data) => data.slice(0, 1), // Just get the most recent one for name/email
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

  if (!isLoaded) {
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

  if (!isAdmin) {
    navigate({ to: '/' })
    return null
  }

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {studentInfo.userName || 'Unknown Student'}
          </h1>
          <p className="text-muted-foreground">
            {studentInfo.userEmail || userId}
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
      <WeeklyPunchCard
        userId={userId}
        userName={studentInfo.userName}
        userEmail={studentInfo.userEmail}
        weekStart={weekStart}
      />
    </div>
  )
}
