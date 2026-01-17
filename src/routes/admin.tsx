import { useUser } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Calendar, ChevronLeft, ChevronRight, Clock, Shield, Users } from 'lucide-react'
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
  getAllUsersStatus,
  getAllUsersMonthlyStats,
  getUserMonthlyBreakdown,
  calculateHoursFromPunches,
} from '@/server/punches'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

// Add your admin email addresses here
const ADMIN_EMAILS = ['jonathan.higger@gmail.com']

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

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const getAdjacentMonth = (monthStr: string, direction: 'prev' | 'next') => {
  const [year, month] = monthStr.split('-').map(Number)
  const date = new Date(year, month - 1 + (direction === 'next' ? 1 : -1))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function StudentDetail({
  student,
  onBack,
  month,
}: {
  student: { userId: string; userName: string | null; userEmail: string | null }
  onBack: () => void
  month: string
}) {
  const { data: breakdown = [], isLoading } = useQuery({
    queryKey: ['userMonthlyBreakdown', student.userId, month],
    queryFn: () =>
      getUserMonthlyBreakdown({
        data: { userId: student.userId, month },
      }),
  })

  const totalHours = breakdown.reduce((sum, w) => sum + w.hours, 0)
  const totalDays = breakdown.reduce((sum, w) => sum + w.days, 0)

  return (
    <div>
      <Button variant="ghost" className="mb-4" onClick={onBack}>
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back to all students
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{student.userName || 'Unknown Student'}</CardTitle>
          <CardDescription>{student.userEmail || student.userId}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-bold">{formatHours(totalHours)}</div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </div>
            <div>
              <div className="text-3xl font-bold">{totalDays}</div>
              <p className="text-sm text-muted-foreground">Days Worked</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Breakdown - {formatMonth(month)}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : breakdown.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity this month
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.map((week) => (
                  <TableRow key={week.weekStart}>
                    <TableCell>
                      {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' - '}
                      {new Date(week.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">{week.days}</TableCell>
                    <TableCell className="text-right font-medium">{formatHours(week.hours)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totalDays}</TableCell>
                  <TableCell className="text-right">{formatHours(totalHours)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AdminPage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [selectedStudent, setSelectedStudent] = useState<{
    userId: string
    userName: string | null
    userEmail: string | null
  } | null>(null)

  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

  const { data: usersStatus = [], isLoading: statusLoading } = useQuery({
    queryKey: ['allUsersStatus'],
    queryFn: () => getAllUsersStatus(),
    enabled: isAdmin,
    refetchInterval: 30000,
  })

  const { data: monthlyStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['allUsersMonthlyStats', selectedMonth],
    queryFn: () => getAllUsersMonthlyStats({ data: { month: selectedMonth } }),
    enabled: isAdmin,
  })

  const clockedInUsers = usersStatus.filter((u) => u.isClockedIn)

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(getAdjacentMonth(selectedMonth, direction))
  }

  if (!isLoaded) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    navigate({ to: '/login' })
    return null
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-md mx-auto flex items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (selectedStudent) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-2xl mx-auto">
        <StudentDetail
          student={selectedStudent}
          onBack={() => setSelectedStudent(null)}
          month={selectedMonth}
        />
      </div>
    )
  }

  const totalMonthHours = monthlyStats.reduce((sum, s) => sum + s.totalHours, 0)

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Monitor student attendance and hours</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <div className="text-3xl font-bold">{clockedInUsers.length}</div>
                <p className="text-sm text-muted-foreground">Currently In</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-3xl font-bold">{usersStatus.length}</div>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-3xl font-bold">{formatHours(totalMonthHours)}</div>
                <p className="text-sm text-muted-foreground">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Currently Clocked In */}
      {clockedInUsers.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              Currently Clocked In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {clockedInUsers.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => setSelectedStudent(u)}
                  className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-medium hover:bg-emerald-200 transition-colors"
                >
                  {u.userName || u.userEmail?.split('@')[0] || 'Unknown'}
                  <span className="ml-2 text-emerald-600">
                    since {formatTime(u.lastPunchTime)}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Stats Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Monthly Hours Report</CardTitle>
              <CardDescription>Click on a student to see their breakdown</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="min-w-[140px] text-center font-medium">
                {formatMonth(selectedMonth)}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('next')}
                disabled={selectedMonth === getCurrentMonth()}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : monthlyStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity recorded for this month
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Avg/Day</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyStats.map((stat) => {
                  const currentStatus = usersStatus.find((u) => u.userId === stat.userId)
                  const isClockedIn = currentStatus?.isClockedIn ?? false

                  return (
                    <TableRow
                      key={stat.userId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setSelectedStudent({
                          userId: stat.userId,
                          userName: stat.userName,
                          userEmail: stat.userEmail,
                        })
                      }
                    >
                      <TableCell>
                        <div
                          className={`w-3 h-3 rounded-full ${
                            isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                          }`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {stat.userName || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {stat.userEmail || '-'}
                      </TableCell>
                      <TableCell className="text-right">{stat.daysWorked}</TableCell>
                      <TableCell className="text-right">
                        {formatHours(stat.avgHoursPerDay)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatHours(stat.totalHours)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
