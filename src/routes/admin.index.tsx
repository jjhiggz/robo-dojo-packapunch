import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Calendar, ChevronLeft, ChevronRight, Clock, Shield, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  getAllUsersMonthlyStats,
  getAllUsersStatus,
} from '@/server/punches'
import { useBoardContext } from '@/lib/board-context'

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
  const navigate = useNavigate()
  const { currentBoard, isOrgAdmin } = useBoardContext()
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())

  const { data: usersStatus = [] } = useQuery({
    queryKey: ['allUsersStatus', currentBoard?.id],
    queryFn: () => getAllUsersStatus({ data: currentBoard!.id }),
    enabled: isOrgAdmin && !!currentBoard?.id,
    refetchInterval: 30000,
  })

  const { data: monthlyStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['allUsersMonthlyStats', currentBoard?.id, selectedMonth],
    queryFn: () => getAllUsersMonthlyStats({ data: { boardId: currentBoard!.id, month: selectedMonth } }),
    enabled: isOrgAdmin && !!currentBoard?.id,
  })

  const clockedInUsers = usersStatus.filter((u) => u.isClockedIn)

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(getAdjacentMonth(selectedMonth, direction))
  }

  const totalMonthHours = monthlyStats.reduce((sum, s) => sum + s.totalHours, 0)

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            {currentBoard?.name} - Monitor attendance and hours
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/members">
            <UserPlus className="w-4 h-4 mr-2" />
            Members
          </Link>
        </Button>
      </div>

      {/* Stats Overview - Horizontal scroll on mobile */}
      <div className="flex gap-3 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible">
        <Card className="shrink-0 w-[140px] sm:w-auto bg-[hsl(140_70%_85%)]">
          <CardContent className="p-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[hsl(140_80%_45%)] border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold">{clockedInUsers.length}</div>
                <p className="text-xs sm:text-sm text-muted-foreground font-bold uppercase">Currently In</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shrink-0 w-[140px] sm:w-auto bg-[hsl(210_70%_85%)]">
          <CardContent className="p-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold">{usersStatus.length}</div>
                <p className="text-xs sm:text-sm text-muted-foreground font-bold uppercase">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shrink-0 w-[140px] sm:w-auto bg-[hsl(280_70%_88%)]">
          <CardContent className="p-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold">{formatHours(totalMonthHours)}</div>
                <p className="text-xs sm:text-sm text-muted-foreground font-bold uppercase">This Month</p>
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
            <span className="flex-1 text-center font-extrabold uppercase">
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
          <p className="text-xs text-muted-foreground text-center font-medium">Tap a member for details</p>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {statsLoading ? (
            <div className="text-center py-8 text-muted-foreground font-bold uppercase">Loading...</div>
          ) : monthlyStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm font-medium">
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
                    className={`w-full flex items-center gap-3 p-4 text-left transition-all border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)] hover:shadow-[3px_3px_0px_hsl(0_0%_5%)] hover:-translate-x-px hover:-translate-y-px ${
                      isClockedIn ? 'bg-[hsl(140_70%_90%)]' : 'bg-card hover:bg-muted'
                    }`}
                    onClick={() => navigate({ to: '/admin/students/$userId', params: { userId: stat.userId } })}
                  >
                    {/* Status dot */}
                    <div
                      className={`w-3 h-3 shrink-0 border-2 border-foreground ${
                        isClockedIn ? 'bg-[hsl(140_80%_45%)]' : 'bg-muted'
                      }`}
                    />
                    
                    {/* Name and email */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">
                        {stat.userName || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate hidden xs:block font-medium">
                        {stat.userEmail || '-'}
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-sm sm:text-base">
                        {formatHours(stat.totalHours)}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
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
