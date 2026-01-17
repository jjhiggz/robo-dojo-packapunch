import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, LogIn, LogOut, Plus, Trash2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
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
  deletePunch,
  getPunchHistory,
  updatePunch,
} from '@/server/punches'
import { ADMIN_EMAILS } from './admin'

export const Route = createFileRoute('/admin/students/$userId')({
  component: StudentDetailPage,
})

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SerializedPunch {
  id: number
  userId: string
  userName: string | null
  userEmail: string | null
  type: string
  timestamp: string | Date
}

interface NormalizedPunch {
  id: number
  userId: string
  userName: string | null
  userEmail: string | null
  type: 'in' | 'out'
  timestamp: Date
}

interface PunchFormData {
  date: string
  time: string
  type: 'in' | 'out'
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

const toDate = (value: string | Date): Date =>
  value instanceof Date ? value : new Date(value)

const normalizePunch = (punch: SerializedPunch): NormalizedPunch => ({
  ...punch,
  type: punch.type as 'in' | 'out',
  timestamp: toDate(punch.timestamp),
})

const normalizePunches = (punches: SerializedPunch[]): NormalizedPunch[] =>
  punches.map(normalizePunch)

const formatDate = (date: Date): string =>
  date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

const formatTime = (date: Date): string =>
  date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

const formatHours = (hours: number): string => {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0 && m === 0) return '0h'
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const getWeekStart = (date: Date): Date => {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

const getWeekEnd = (weekStart: Date): Date => {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

const pad = (n: number): string => String(n).padStart(2, '0')

const toDateInputValue = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const toTimeInputValue = (date: Date): string =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`

const combineDateAndTime = (dateStr: string, timeStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hours, minutes] = timeStr.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

const calculateHoursFromPunches = (punches: NormalizedPunch[]): number => {
  const sorted = [...punches].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  
  let totalMs = 0
  let lastIn: Date | null = null

  for (const punch of sorted) {
    if (punch.type === 'in') {
      lastIn = punch.timestamp
    } else if (punch.type === 'out' && lastIn) {
      totalMs += punch.timestamp.getTime() - lastIn.getTime()
      lastIn = null
    }
  }

  if (lastIn) {
    totalMs += Date.now() - lastIn.getTime()
  }

  return totalMs / (1000 * 60 * 60)
}

const getDefaultFormData = (): PunchFormData => {
  const now = new Date()
  return {
    date: toDateInputValue(now),
    time: toTimeInputValue(now),
    type: 'in',
  }
}

const punchToFormData = (punch: NormalizedPunch): PunchFormData => ({
  date: toDateInputValue(punch.timestamp),
  time: toTimeInputValue(punch.timestamp),
  type: punch.type,
})

// ─────────────────────────────────────────────────────────────────────────────
// Punch Modal Component
// ─────────────────────────────────────────────────────────────────────────────

interface PunchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  formData: PunchFormData
  onFormChange: (data: PunchFormData) => void
  onSave: () => void
  isSaving: boolean
}

const PunchModal = ({
  open,
  onOpenChange,
  title,
  description,
  formData,
  onFormChange,
  onSave,
  isSaving,
}: PunchModalProps) => {
  const dateId = useId()
  const timeId = useId()
  const typeId = useId()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor={dateId}>Date</Label>
            <Input
              id={dateId}
              type="date"
              value={formData.date}
              onChange={(e) => onFormChange({ ...formData, date: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={timeId}>Time</Label>
            <Input
              id={timeId}
              type="time"
              value={formData.time}
              onChange={(e) => onFormChange({ ...formData, time: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={typeId}>Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'in' | 'out') => onFormChange({ ...formData, type: value })}
            >
              <SelectTrigger id={typeId}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4 text-green-600" />
                    Punch In
                  </span>
                </SelectItem>
                <SelectItem value="out">
                  <span className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-red-600" />
                    Punch Out
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Punch List Component
// ─────────────────────────────────────────────────────────────────────────────

interface WeeklyPunchListProps {
  userId: string
  userName: string | null
  userEmail: string | null
  weekStart: Date
}

const WeeklyPunchList = ({ userId, userName, userEmail, weekStart }: WeeklyPunchListProps) => {
  const queryClient = useQueryClient()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingPunch, setEditingPunch] = useState<NormalizedPunch | null>(null)
  const [formData, setFormData] = useState<PunchFormData>(getDefaultFormData)

  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart])

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
    select: (data) => normalizePunches(data).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
  })

  const totalWeekHours = useMemo(() => calculateHoursFromPunches(punches), [punches])

  const addMutation = useMutation({
    mutationFn: ({ type, timestamp }: { type: 'in' | 'out'; timestamp: string }) =>
      addPunch({
        data: {
          userId,
          userName: userName ?? undefined,
          userEmail: userEmail ?? undefined,
          type,
          timestamp,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchHistory', userId] })
      setAddModalOpen(false)
      setFormData(getDefaultFormData())
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ punchId, timestamp, type }: { punchId: number; timestamp: string; type: 'in' | 'out' }) =>
      updatePunch({ data: { punchId, timestamp, type } }),
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

  const handleOpenAddModal = () => {
    setFormData(getDefaultFormData())
    setAddModalOpen(true)
  }

  const handleOpenEditModal = (punch: NormalizedPunch) => {
    setFormData(punchToFormData(punch))
    setEditingPunch(punch)
  }

  const handleSaveAdd = () => {
    const timestamp = combineDateAndTime(formData.date, formData.time)
    addMutation.mutate({
      type: formData.type,
      timestamp: timestamp.toISOString(),
    })
  }

  const handleSaveEdit = () => {
    if (!editingPunch) return
    const timestamp = combineDateAndTime(formData.date, formData.time)
      updateMutation.mutate({
        punchId: editingPunch.id,
      timestamp: timestamp.toISOString(),
      type: formData.type,
    })
  }

  const handleDelete = (punchId: number) => {
    if (confirm('Delete this punch?')) {
      deleteMutation.mutate(punchId)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading punches...
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
                Weekly Punches
        </CardTitle>
        <CardDescription>
                {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' - '}
                {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold">{formatHours(totalWeekHours)}</div>
                <div className="text-xs text-muted-foreground">total hours</div>
              </div>
              <Button onClick={handleOpenAddModal} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Punch
              </Button>
            </div>
          </div>
      </CardHeader>
      <CardContent>
          {punches.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No punches recorded this week
            </div>
          ) : (
        <Table>
          <TableHeader>
            <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
                {punches.map((punch) => (
                  <TableRow
                    key={punch.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleOpenEditModal(punch)}
                  >
                  <TableCell className="font-medium">
                      {formatDate(punch.timestamp)}
                  </TableCell>
                    <TableCell>{formatTime(punch.timestamp)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          punch.type === 'in'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {punch.type === 'in' ? (
                          <LogIn className="w-3 h-3" />
                        ) : (
                          <LogOut className="w-3 h-3" />
                        )}
                        {punch.type === 'in' ? 'In' : 'Out'}
                      </span>
                  </TableCell>
                  <TableCell>
                    <Button
                        variant="ghost"
                      size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(punch.id)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                ))}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>

      {/* Add Punch Modal */}
      <PunchModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title="Add Punch"
        description="Add a new punch entry for this student."
        formData={formData}
        onFormChange={setFormData}
        onSave={handleSaveAdd}
        isSaving={addMutation.isPending}
      />

      {/* Edit Punch Modal */}
      <PunchModal
        open={editingPunch !== null}
        onOpenChange={(open) => !open && setEditingPunch(null)}
        title="Edit Punch"
        description="Modify the date, time, or type of this punch."
        formData={formData}
        onFormChange={setFormData}
        onSave={handleSaveEdit}
        isSaving={updateMutation.isPending}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

function StudentDetailPage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const navigate = useNavigate()
  const { userId } = Route.useParams()
  const [currentWeek, setCurrentWeek] = useState(new Date())

  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false
  const weekStart = useMemo(() => getWeekStart(currentWeek), [currentWeek])

  const { data: studentInfo } = useQuery({
    queryKey: ['studentInfo', userId],
    queryFn: () =>
      getPunchHistory({
        data: {
          userId,
          startDate: new Date(0).toISOString(),
          endDate: new Date().toISOString(),
        },
      }),
    select: (data): { userName: string | null; userEmail: string | null } => {
      const firstPunch = data[0]
      return firstPunch
        ? { userName: firstPunch.userName ?? null, userEmail: firstPunch.userEmail ?? null }
        : { userName: null, userEmail: null }
    },
  })

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + (direction === 'next' ? 7 : -7))
      return next
    })
  }

  const goToCurrentWeek = () => setCurrentWeek(new Date())

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
            {studentInfo?.userName || 'Unknown Student'}
          </h1>
          <p className="text-muted-foreground">
            {studentInfo?.userEmail || userId}
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

      {/* Weekly Punch List */}
      <WeeklyPunchList
        userId={userId}
        userName={studentInfo?.userName ?? null}
        userEmail={studentInfo?.userEmail ?? null}
        weekStart={weekStart}
      />
    </div>
  )
}
