import { useUser } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Calendar, ChevronLeft, ChevronRight, Clock, Shield, Users } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getAllUsersMonthlyStats,
  getAllUsersStatus,
} from '@/server/punches'
import { ADMIN_EMAILS } from './admin'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

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

function AdminDashboard() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())

  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

  const { data: usersStatus = [] } = useQuery({
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

  const totalMonthHours = monthlyStats.reduce((sum, s) => sum + s.totalHours, 0)

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Monitor attendance and hours</p>
      </div>

      {/* Stats Overview - Horizontal scroll on mobile */}
      <div className="flex gap-3 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible">
        <Card className="shrink-0 w-[140px] sm:w-auto">
          <CardContent className="p-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold">{clockedInUsers.length}</div>
                <p className="text-xs sm:text-sm text-muted-foreground">Currently In</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shrink-0 w-[140px] sm:w-auto">
          <CardContent className="p-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold">{usersStatus.length}</div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shrink-0 w-[140px] sm:w-auto">
          <CardContent className="p-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold">{formatHours(totalMonthHours)}</div>
                <p className="text-xs sm:text-sm text-muted-foreground">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Stats */}
      <Card>
        <CardHeader className="pb-3 space-y-3">
          {/* Month Navigation - Full width on mobile */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="flex-1 text-center font-semibold">
              {formatMonth(selectedMonth)}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => navigateMonth('next')}
              disabled={selectedMonth === getCurrentMonth()}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">Tap a student for details</p>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {statsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : monthlyStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No activity recorded for this month
            </div>
          ) : (
            <div className="space-y-2">
              {monthlyStats.slice(0, 50).map((stat) => {
                const currentStatus = usersStatus.find((u) => u.userId === stat.userId)
                const isClockedIn = currentStatus?.isClockedIn ?? false

                return (
                  <button
                    key={stat.userId}
                    type="button"
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-muted/50 ${
                      isClockedIn ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''
                    }`}
                    onClick={() => navigate({ to: '/admin/students/$userId', params: { userId: stat.userId } })}
                  >
                    {/* Status dot */}
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                      }`}
                    />
                    
                    {/* Name and email */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {stat.userName || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate hidden xs:block">
                        {stat.userEmail || '-'}
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm sm:text-base">
                        {formatHours(stat.totalHours)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stat.daysWorked}d · {formatHours(stat.avgHoursPerDay)}/d
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
